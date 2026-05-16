import { Parser } from 'node-sql-parser';
import { db } from '@/core/db/client';
import { models, lineageEdges } from '../db/schema';
import type { LineageEdge } from '../db/schema';
import { eq } from 'drizzle-orm';
import { rebuildLineageEdges } from './model-service';

const parser = new Parser();

const REF_REGEX = /ref\(\s*['"](\w+)['"]\s*\)/g;
const SOURCE_REGEX = /source\(\s*['"](\w+)['"]\s*,\s*['"](\w+)['"]\s*\)/g;

export interface LineageRef {
  refType: 'model_ref' | 'source_ref';
  modelName?: string;
  sourceName?: string;
  tableName?: string;
}

export function extractRefs(sql: string): LineageRef[] {
  const refs: LineageRef[] = [];

  // AST-based extraction first (more reliable)
  try {
    const normalized = sql
      .replace(/ref\(['"](\w+)['"]\)/g, '"_ref_$1_"')
      .replace(/source\(['"](\w+)['"]\s*,\s*['"](\w+)['"]\)/g, '"_src_$1_$2_"');

    const ast = parser.astify(normalized, { database: 'DuckDB' });
    const astStr = JSON.stringify(ast);

    const refMatches = astStr.matchAll(/"_ref_(\w+)_"/g);
    for (const m of refMatches) {
      refs.push({ refType: 'model_ref', modelName: m[1] });
    }
    const srcMatches = astStr.matchAll(/"_src_(\w+)_(\w+)_"/g);
    for (const m of srcMatches) {
      refs.push({ refType: 'source_ref', sourceName: m[1], tableName: m[2] });
    }

    if (refs.length > 0) return dedup(refs);
  } catch {
    // fall through to regex
  }

  // Regex fallback (handles comments, CTEs, edge cases)
  for (const m of sql.matchAll(new RegExp(REF_REGEX.source, 'g'))) {
    refs.push({ refType: 'model_ref', modelName: m[1] });
  }
  for (const m of sql.matchAll(new RegExp(SOURCE_REGEX.source, 'g'))) {
    refs.push({ refType: 'source_ref', sourceName: m[1], tableName: m[2] });
  }

  return dedup(refs);
}

function dedup(refs: LineageRef[]): LineageRef[] {
  const seen = new Set<string>();
  return refs.filter((r) => {
    const key = r.refType === 'model_ref'
      ? `ref:${r.modelName}`
      : `src:${r.sourceName}.${r.tableName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface TopoResult {
  layers: string[][];
  cycle?: string[];
}

export function topologicalSort(
  nodeNames: string[],
  edges: Pick<LineageEdge, 'fromModelId' | 'toModelId'>[],
  modelIdToName: Map<string, string>,
): TopoResult {
  const nameToId = new Map(
    Array.from(modelIdToName.entries()).map(([id, name]) => [name, id]),
  );

  // Build adjacency (id → id[])
  const deps = new Map<string, Set<string>>();
  for (const n of nodeNames) {
    const id = nameToId.get(n);
    if (id) deps.set(id, new Set());
  }
  for (const e of edges) {
    if (e.fromModelId && e.toModelId && deps.has(e.toModelId)) {
      if (!deps.has(e.fromModelId)) deps.set(e.fromModelId, new Set());
      deps.get(e.toModelId)!.add(e.fromModelId);
    }
  }

  // Kahn's algorithm
  const inDegree = new Map<string, number>();
  for (const id of deps.keys()) inDegree.set(id, 0);
  for (const [id, depSet] of deps) {
    inDegree.set(id, depSet.size);
  }

  const layers: string[][] = [];
  let remaining = new Set(deps.keys());

  while (remaining.size > 0) {
    const layer = Array.from(remaining).filter((id) => (inDegree.get(id) ?? 0) === 0);
    if (layer.length === 0) {
      // Cycle detected — DFS to find it
      const cycle = findCycle(deps);
      return {
        layers,
        cycle: cycle.map((id) => modelIdToName.get(id) ?? id),
      };
    }
    layers.push(layer.map((id) => modelIdToName.get(id) ?? id));
    for (const id of layer) {
      remaining.delete(id);
      // decrement in-degree for all nodes that depend on this one
      for (const [nodeId, depSet] of deps) {
        if (depSet.has(id)) {
          inDegree.set(nodeId, (inDegree.get(nodeId) ?? 1) - 1);
        }
      }
    }
  }

  return { layers };
}

function findCycle(deps: Map<string, Set<string>>): string[] {
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string): string[] | null {
    if (stack.includes(node)) {
      return stack.slice(stack.indexOf(node));
    }
    if (visited.has(node)) return null;
    visited.add(node);
    stack.push(node);
    for (const dep of deps.get(node) ?? []) {
      const cycle = dfs(dep);
      if (cycle) return cycle;
    }
    stack.pop();
    return null;
  }

  for (const node of deps.keys()) {
    const cycle = dfs(node);
    if (cycle) return cycle;
  }
  return [];
}

export function renderModelSql(sql: string): string {
  let rendered = sql;
  rendered = rendered.replace(new RegExp(REF_REGEX.source, 'g'), (_match, name) => `"${name}"`);
  rendered = rendered.replace(
    new RegExp(SOURCE_REGEX.source, 'g'),
    (_match, src, table) => `"_src__${slugify(src)}__${table}"`,
  );
  return rendered;
}

export function slugify(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_');
}

export function refsToLineageEdges(
  workspaceId: string,
  toModelId: string,
  refs: LineageRef[],
  nameToId: Map<string, string>,
): Array<{
  refType: 'model_ref' | 'source_ref';
  fromModelId?: string;
  fromSourceRef?: string;
}> {
  return refs
    .map((ref) => {
      if (ref.refType === 'model_ref' && ref.modelName) {
        const fromModelId = nameToId.get(ref.modelName);
        return { refType: 'model_ref' as const, fromModelId };
      } else if (ref.refType === 'source_ref' && ref.sourceName && ref.tableName) {
        return {
          refType: 'source_ref' as const,
          fromSourceRef: `${ref.sourceName}.${ref.tableName}`,
        };
      }
      return null;
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);
}

export function parseAndRebuildLineage(
  workspaceId: string,
  modelId: string,
  sql: string,
): void {
  const refs = extractRefs(sql);

  // Resolve model names to IDs
  const allModels = db.select().from(models).where(eq(models.workspaceId, workspaceId)).all();
  const nameToId = new Map(allModels.map((m) => [m.name, m.id]));

  const edges = refsToLineageEdges(workspaceId, modelId, refs, nameToId);
  rebuildLineageEdges(workspaceId, modelId, edges);
}

export function getLineageForWorkspace(workspaceId: string): {
  nodes: Array<{ id: string; modelName: string; layer: string }>;
  edges: Array<{ fromModelId: string | null; toModelId: string; fromSourceRef: string | null; refType: string }>;
} {
  const allModels = db.select().from(models).where(eq(models.workspaceId, workspaceId)).all();
  const allEdges = db
    .select()
    .from(lineageEdges)
    .where(eq(lineageEdges.workspaceId, workspaceId))
    .all();

  return {
    nodes: allModels.map((m) => ({ id: m.id, modelName: m.name, layer: m.layer })),
    edges: allEdges.map((e) => ({
      fromModelId: e.fromModelId ?? null,
      toModelId: e.toModelId,
      fromSourceRef: e.fromSourceRef ?? null,
      refType: e.refType,
    })),
  };
}
