import { db } from '@/core/db/client';
import { models, lineageEdges } from '../db/schema';
import type { ModelRunStatus } from '../db/schema';
import { eq } from 'drizzle-orm';
import { sseEmitter } from '@/core/orchestration/streaming';
import { getAdapterForSource } from '@/modules/ainderstanding/connect/lib/adapters/get-adapter';
import { dataSources } from '@/core/db/schema';
import {
  listModels,
  readModelSql,
  updateModelRunStatus,
} from './model-service';
import { extractRefs, topologicalSort, renderModelSql, slugify } from './lineage-parser';
import { withDatamart } from './duckdb-datamart';
import { startRun, updateRun, finishRun } from './run-recorder';

export interface MaterializeOptions {
  workspaceId: string;
  modelNames?: string[];
  sessionId?: string;
  parentRunId?: string;
  _existingRunId?: string;  // Pre-created run ID from API route for immediate response
}

export interface MaterializeResult {
  runId: string;
  status: ModelRunStatus;
  modelsTotal: number;
  modelsSucceeded: number;
  modelsFailed: number;
  durationMs: number;
}

export async function materializeWorkspace(opts: MaterializeOptions): Promise<MaterializeResult> {
  const { workspaceId, sessionId = 'system', parentRunId } = opts;
  const startedAt = Date.now();

  // --- 1. Resolve target models ---
  const allModels = listModels(workspaceId);
  const modelMap = new Map(allModels.map((m) => [m.name, m]));
  const idToName = new Map(allModels.map((m) => [m.id, m.name]));

  let targetNames: string[];
  if (opts.modelNames?.length) {
    // Expand with upstream dependencies (BR-MOD-062)
    targetNames = expandWithDeps(opts.modelNames, workspaceId, idToName);
  } else {
    targetNames = allModels.map((m) => m.name);
  }

  const runScope = opts.modelNames?.length ? 'single' : 'all';
  const runId = opts._existingRunId ?? startRun({
    workspaceId,
    runScope,
    sessionId,
    parentRunId,
    modelNames: targetNames,
  });

  const emit = (modelName: string, status: 'running' | 'success' | 'error', extra?: { durationMs?: number; error?: string }) => {
    sseEmitter.emit(workspaceId, {
      type: 'model_run_update',
      sessionId,
      workspaceId,
      timestamp: new Date().toISOString(),
      payload: { runId, modelName, status, ...extra },
    });
  };

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    // --- 2. Validate --- topological sort, detect cycles
    const allEdges = db
      .select()
      .from(lineageEdges)
      .where(eq(lineageEdges.workspaceId, workspaceId))
      .all();

    const topoResult = topologicalSort(targetNames, allEdges, idToName);

    if (topoResult.cycle) {
      const msg = `CIRCULAR_DEPENDENCY: ${topoResult.cycle.join(' → ')}`;
      finishRun(runId, 'failed', msg);
      return {
        runId,
        status: 'failed',
        modelsTotal: targetNames.length,
        modelsSucceeded: 0,
        modelsFailed: targetNames.length,
        durationMs: Date.now() - startedAt,
      };
    }

    // --- 3. Collect source refs for source pull phase ---
    const sourceRefSet = new Set<string>();
    for (const name of targetNames) {
      const model = modelMap.get(name);
      if (!model) continue;
      const sql = await readModelSql(workspaceId, model.id);
      const refs = extractRefs(sql);
      for (const r of refs) {
        if (r.refType === 'source_ref' && r.sourceName && r.tableName) {
          sourceRefSet.add(`${r.sourceName}.${r.tableName}`);
        }
      }
    }

    // --- 4. Source pull phase ---
    if (sourceRefSet.size > 0) {
      sseEmitter.emit(workspaceId, {
        type: 'model_run_update',
        sessionId,
        workspaceId,
        timestamp: new Date().toISOString(),
        payload: { runId, modelName: '__source_pull__', status: 'running' },
      });

      // Find data sources by name
      const wsSources = db
        .select()
        .from(dataSources)
        .where(eq(dataSources.workspaceId, workspaceId))
        .all();

      const sourceByName = new Map(wsSources.map((s) => [s.name.toLowerCase(), s]));

      for (const ref of sourceRefSet) {
        const [srcName, tableName] = ref.split('.') as [string, string];
        const source = sourceByName.get(srcName.toLowerCase());

        if (!source) {
          errors.push(`Source not found: ${srcName}. Available: ${[...sourceByName.keys()].join(', ')}`);
          continue;
        }

        try {
          const { adapter } = getAdapterForSource(source.id);
          const result = await adapter.executeSelect(`SELECT * FROM "${tableName}"`);
          await adapter.close();

          // Insert into DuckDB as _src__{source}__{table}
          const stagingName = `_src__${slugify(srcName)}__${tableName}`;

          await withDatamart(workspaceId, async (ddDb) => {
            if (result.rows.length === 0) {
              const colDefs = result.columns.map((c) => `"${c}" VARCHAR`).join(', ');
              await ddDb.run(`CREATE OR REPLACE TABLE "${stagingName}" (${colDefs})`);
              return;
            }

            const cols = result.columns.map((c) => `"${c}"`).join(', ');
            const placeholders = result.columns.map(() => '?').join(', ');
            const rows = result.rows as Record<string, unknown>[];

            try {
              const allValues = rows.flatMap((row) =>
                result.columns.map((c) => {
                  const v = row[c];
                  return v === null || v === undefined ? null : v;
                }),
              );
              await ddDb.run(
                `CREATE OR REPLACE TABLE "${stagingName}" AS SELECT * FROM (VALUES ${
                  rows.map(() => `(${placeholders})`).join(', ')
                }) t(${cols})`,
                ...allValues,
              );
            } catch {
              // Fallback: row-by-row insert (handles type edge cases)
              const colDefs = result.columns.map((c) => `"${c}" VARCHAR`).join(', ');
              await ddDb.run(`DROP TABLE IF EXISTS "${stagingName}"`);
              await ddDb.run(`CREATE TABLE "${stagingName}" (${colDefs})`);
              for (const row of rows) {
                const vals = result.columns.map((c) => {
                  const v = row[c];
                  return v === null || v === undefined ? null : String(v);
                });
                await ddDb.run(`INSERT INTO "${stagingName}" (${cols}) VALUES (${placeholders})`, ...vals);
              }
            }
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Source pull failed for ${ref}: ${msg}`);
        }
      }
    }

    // --- 5. Model execution (topo order, parallel per layer) ---
    const CONCURRENCY = 4;

    for (const layer of topoResult.layers) {
      // Execute models in this layer with concurrency limit
      const chunks: string[][] = [];
      for (let i = 0; i < layer.length; i += CONCURRENCY) {
        chunks.push(layer.slice(i, i + CONCURRENCY));
      }

      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(async (name) => {
            const model = modelMap.get(name);
            if (!model) return;

            emit(name, 'running');
            const modelStart = Date.now();

            try {
              const sql = await readModelSql(workspaceId, model.id);
              const rendered = renderModelSql(sql);

              await withDatamart(workspaceId, async (ddDb) => {
                await ddDb.run(`CREATE OR REPLACE TABLE "${name}" AS ${rendered}`);
              });

              const durationMs = Date.now() - modelStart;
              emit(name, 'success', { durationMs });
              updateModelRunStatus(model.id, 'success');
              succeeded++;
              updateRun(runId, { modelsSucceeded: succeeded });
            } catch (err) {
              const error = err instanceof Error ? err.message : String(err);
              const durationMs = Date.now() - modelStart;
              emit(name, 'error', { durationMs, error });
              updateModelRunStatus(model.id, 'failed');
              failed++;
              errors.push(`${name}: ${error}`);
              updateRun(runId, { modelsFailed: failed });
            }
          }),
        );
      }
    }

    const finalStatus: ModelRunStatus = failed > 0 ? 'failed' : 'success';
    const errorMessage = errors.length > 0 ? errors.join('\n') : undefined;
    finishRun(runId, finalStatus, errorMessage);

    return {
      runId,
      status: finalStatus,
      modelsTotal: targetNames.length,
      modelsSucceeded: succeeded,
      modelsFailed: failed,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    finishRun(runId, 'failed', msg);
    return {
      runId,
      status: 'failed',
      modelsTotal: targetNames.length,
      modelsSucceeded: succeeded,
      modelsFailed: targetNames.length - succeeded,
      durationMs: Date.now() - startedAt,
    };
  }
}

function expandWithDeps(
  modelNames: string[],
  workspaceId: string,
  idToName: Map<string, string>,
): string[] {
  const allEdges = db
    .select()
    .from(lineageEdges)
    .where(eq(lineageEdges.workspaceId, workspaceId))
    .all();

  const nameToId = new Map(
    Array.from(idToName.entries()).map(([id, name]) => [name, id]),
  );

  const result = new Set<string>(modelNames);
  const queue = [...modelNames];

  while (queue.length > 0) {
    const name = queue.shift()!;
    const modelId = nameToId.get(name);
    if (!modelId) continue;

    // Find upstream dependencies (fromModelId → toModelId = this model)
    for (const edge of allEdges) {
      if (edge.toModelId === modelId && edge.fromModelId) {
        const upstreamName = idToName.get(edge.fromModelId);
        if (upstreamName && !result.has(upstreamName)) {
          result.add(upstreamName);
          queue.push(upstreamName);
        }
      }
    }
  }

  return Array.from(result);
}
