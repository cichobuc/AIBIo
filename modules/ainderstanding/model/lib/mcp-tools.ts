import { listModels, readModelSql, getModel } from './model-service';
import { validateSql } from './sql-validator';
import { extractRefs, refsToLineageEdges, getLineageForWorkspace, topologicalSort } from './lineage-parser';
import { rebuildLineageEdges } from './model-service';
import { db } from '@/core/db/client';
import { models, lineageEdges } from '../db/schema';
import type { ModelLayer } from '../db/schema';
import { eq } from 'drizzle-orm';

// ─── read_existing_models ────────────────────────────────────────────────────

export async function readExistingModels(input: {
  workspace_id: string;
  layer?: ModelLayer;
}): Promise<{
  models: Array<{
    model_id: string;
    name: string;
    layer: ModelLayer;
    file_path: string;
    sql: string;
    materialization: string;
    last_run_at: string | null;
    last_run_status: string | null;
  }>;
}> {
  const rows = listModels(input.workspace_id, input.layer);

  const result = await Promise.all(
    rows.map(async (m) => ({
      model_id: m.id,
      name: m.name,
      layer: m.layer,
      file_path: m.filePath,
      sql: await readModelSql(input.workspace_id, m.id),
      materialization: m.materialization,
      last_run_at: m.lastRunAt ?? null,
      last_run_status: m.lastRunStatus ?? null,
    })),
  );

  return { models: result };
}

// ─── validate_sql ────────────────────────────────────────────────────────────

export async function validateSqlTool(input: {
  sql: string;
  workspace_id?: string;
}): Promise<{
  valid: boolean;
  errors: Array<{ line: number; column: number; message: string }>;
  has_non_select_statements: boolean;
  unresolved_refs: string[];
}> {
  const result = await validateSql(input.workspace_id ?? '', input.sql);
  return {
    valid: result.valid,
    errors: result.errors,
    has_non_select_statements: result.hasNonSelectStatements,
    unresolved_refs: result.unresolvedRefs,
  };
}

// ─── parse_lineage ───────────────────────────────────────────────────────────

export async function parseLineage(input: {
  workspace_id: string;
}): Promise<{
  edges: Array<{
    from_model_id: string | null;
    to_model_id: string;
    from_source_ref: string | null;
    ref_type: string;
  }>;
  orphaned_models: string[];
  cycles_detected: boolean;
  topological_order: string[];
}> {
  const allModels = db.select().from(models).where(eq(models.workspaceId, input.workspace_id)).all();
  const nameToId = new Map(allModels.map((m) => [m.name, m.id]));
  const idToName = new Map(allModels.map((m) => [m.id, m.name]));

  // Re-parse lineage for each model from current SQL files
  for (const model of allModels) {
    const sql = await readModelSql(input.workspace_id, model.id);
    const refs = extractRefs(sql);
    const edges = refsToLineageEdges(input.workspace_id, model.id, refs, nameToId);
    rebuildLineageEdges(input.workspace_id, model.id, edges);
  }

  const lineage = getLineageForWorkspace(input.workspace_id);
  const allEdges = db
    .select()
    .from(lineageEdges)
    .where(eq(lineageEdges.workspaceId, input.workspace_id))
    .all();

  // Topo sort
  const topoResult = topologicalSort(
    allModels.map((m) => m.name),
    allEdges,
    idToName,
  );

  const referencedModelIds = new Set([
    ...allEdges.map((e) => e.fromModelId).filter(Boolean),
    ...allEdges.map((e) => e.toModelId),
  ]);
  const orphanedModels = allModels
    .filter((m) => !referencedModelIds.has(m.id))
    .map((m) => m.name);

  return {
    edges: lineage.edges.map((e) => ({
      from_model_id: e.fromModelId,
      to_model_id: e.toModelId,
      from_source_ref: e.fromSourceRef,
      ref_type: e.refType,
    })),
    orphaned_models: orphanedModels,
    cycles_detected: topoResult.cycle !== undefined,
    topological_order: topoResult.layers.flat(),
  };
}

// ─── propose_dimensional_model (M3) ─────────────────────────────────────────
// Tool handler is a schema gate — content comes from model-architect LLM output.

export async function proposeDimensionalModel(input: {
  workspace_id: string;
  data_source_id: string;
  user_intent: string;
}): Promise<{
  topology: 'star' | 'snowflake' | 'flat';
  rationale: string;
  staging_models: Array<{
    name: string;
    source_ref: { source: string; table: string };
    columns: Array<{ name: string; type: string; description?: string }>;
  }>;
  intermediate_models: Array<{ name: string; description: string }>;
  mart_models: Array<{
    name: string;
    kind: 'dim' | 'fct';
    description: string;
    columns: Array<{ name: string; type: string; description?: string }>;
  }>;
}> {
  // This tool receives structured output from model-architect — the LLM writes it.
  // The handler validates input only; the real proposal comes from the agent's generation.
  throw new Error(
    'propose_dimensional_model must be called by model-architect agent with a structured proposal.',
  );
}

// ─── write_model_file (M3) ───────────────────────────────────────────────────
// Implemented in register-tools.ts (needs approval gate import)

// ─── materialize_models (M2) ─────────────────────────────────────────────────
// Implemented in register-tools.ts (needs materializer import)
