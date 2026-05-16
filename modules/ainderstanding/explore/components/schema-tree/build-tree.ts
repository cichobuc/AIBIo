import type { SchemaSnapshot } from '@/core/types/workspace';
import type {
  ExploreSource,
  ExploreTableProfile,
  ExploreColumnProfile,
  ExploreSourcePerm,
  ExploreTablePerm,
  ExploreColumnMeta,
} from '../../lib/explore-data';
import type {
  TreeNode,
  ConnectionNode,
  SchemaNode,
  GroupNode,
  TableNode,
  ViewNode,
  ColumnNode,
  RoutineNode,
  IndexNode,
  AccessTier,
  PiiClassification,
} from './types';

const TIER_RANK: Record<AccessTier, number> = {
  metadata_only: 0,
  with_reference_samples: 1,
  with_full_samples: 2,
  with_query_results: 3,
};

function strictest(a: AccessTier, b: AccessTier): AccessTier {
  return TIER_RANK[a] <= TIER_RANK[b] ? a : b;
}

type PermMaps = {
  sources: Map<string, AccessTier>;
  tables: Map<string, AccessTier>;
  columns: Map<string, { piiClassification: PiiClassification; piiSubtype: string | null }>;
};

type BuildArgs = {
  sources: ExploreSource[];
  snapshots: Map<string, SchemaSnapshot>;
  profiles: Map<string, ExploreTableProfile>;
  columnProfiles: Map<string, ExploreColumnProfile[]>;
  sourcePerms: ExploreSourcePerm[];
  tablePerms: ExploreTablePerm[];
  columnPerms: ExploreColumnMeta[];
};

function nodeId(...parts: string[]): string {
  return parts.join('/');
}

function buildPermMaps(
  sourcePerms: ExploreSourcePerm[],
  tablePerms: ExploreTablePerm[],
  columnPerms: ExploreColumnMeta[],
): PermMaps {
  const sources = new Map<string, AccessTier>();
  for (const p of sourcePerms) sources.set(p.dataSourceId, p.permissionTier);

  const tables = new Map<string, AccessTier>();
  for (const p of tablePerms) tables.set(`${p.dataSourceId}::${p.tableName}`, p.permissionOverride);

  const columns = new Map<string, { piiClassification: PiiClassification; piiSubtype: string | null }>();
  for (const p of columnPerms) {
    columns.set(`${p.dataSourceId}::${p.tableName}::${p.columnName}`, {
      piiClassification: (p.piiClassification ?? 'none') as PiiClassification,
      piiSubtype: p.piiSubtype,
    });
  }

  return { sources, tables, columns };
}

function effectiveSourceTier(sourceId: string, perms: PermMaps): AccessTier {
  return perms.sources.get(sourceId) ?? 'metadata_only';
}

function effectiveTableTier(sourceId: string, tableName: string, perms: PermMaps): AccessTier {
  const sourceTier = effectiveSourceTier(sourceId, perms);
  const tableOverride = perms.tables.get(`${sourceId}::${tableName}`);
  return tableOverride ? strictest(sourceTier, tableOverride) : sourceTier;
}

function effectiveColumnTier(
  sourceId: string,
  tableName: string,
  columnName: string,
  tableTier: AccessTier,
  perms: PermMaps,
): AccessTier {
  const colPerm = perms.columns.get(`${sourceId}::${tableName}::${columnName}`);
  if (colPerm && colPerm.piiClassification !== 'none') return 'metadata_only';
  return tableTier;
}

export function buildSchemaTree({
  sources,
  snapshots,
  profiles,
  columnProfiles,
  sourcePerms,
  tablePerms,
  columnPerms,
}: BuildArgs): TreeNode[] {
  const perms = buildPermMaps(sourcePerms, tablePerms, columnPerms);

  return sources.map((source) => {
    const snapshot = snapshots.get(source.id);
    const children = snapshot
      ? buildSchemaChildren(source.id, snapshot, profiles, columnProfiles, perms)
      : [];

    return {
      kind: 'connection',
      id: nodeId('src', source.id),
      sourceId: source.id,
      name: source.name,
      status: source.status as 'active' | 'error' | 'pending',
      dbType: source.dbType as 'postgres' | 'mssql' | 'mysql' | 'duckdb',
      effectiveTier: effectiveSourceTier(source.id, perms),
      children,
    } satisfies ConnectionNode;
  });
}

function buildSchemaChildren(
  sourceId: string,
  snapshot: SchemaSnapshot,
  profiles: Map<string, ExploreTableProfile>,
  columnProfileMap: Map<string, ExploreColumnProfile[]>,
  perms: PermMaps,
): TreeNode[] {
  const schemaNames = new Set<string>();

  for (const t of snapshot.tables) schemaNames.add(t.schema ?? 'public');
  for (const v of snapshot.views ?? []) schemaNames.add(v.schema ?? 'public');
  for (const r of snapshot.routines ?? []) schemaNames.add(r.schema ?? 'public');
  for (const i of snapshot.indexes ?? []) schemaNames.add(i.schema ?? 'public');

  const sorted = [...schemaNames].sort();

  return sorted.map((schemaName) => {
    const schemaId = nodeId('src', sourceId, 'schema', schemaName);
    const groups: TreeNode[] = [];

    const schemaTables = snapshot.tables.filter((t) => (t.schema ?? 'public') === schemaName);
    if (schemaTables.length > 0) {
      const tableNodes: TableNode[] = schemaTables.map((t) => {
        const profile = profiles.get(`${sourceId}:${t.name}`);
        const colProfs = columnProfileMap.get(`${sourceId}:${t.name}`) ?? [];
        const tableId = nodeId('src', sourceId, 'schema', schemaName, 'table', t.name);
        const tableTier = effectiveTableTier(sourceId, t.name, perms);

        const columnNodes: ColumnNode[] = t.columns.map((col) => {
          const colPerm = perms.columns.get(`${sourceId}::${t.name}::${col.name}`);
          const piiClassification: PiiClassification = colPerm?.piiClassification ?? 'none';
          const piiSubtype = colPerm?.piiSubtype ?? null;
          const colTier = effectiveColumnTier(sourceId, t.name, col.name, tableTier, perms);

          return {
            kind: 'column',
            id: nodeId('src', sourceId, 'schema', schemaName, 'table', t.name, 'col', col.name),
            sourceId,
            schemaName,
            parentName: t.name,
            columnName: col.name,
            dataType: col.dataType,
            nullable: col.nullable,
            isPrimaryKey: col.isPrimaryKey,
            isForeignKey: col.isForeignKey,
            piiClassification,
            piiSubtype,
            effectiveTier: colTier,
          };
        });

        void colProfs;

        return {
          kind: 'table',
          id: tableId,
          sourceId,
          schemaName,
          tableName: t.name,
          rowCount: profile?.rowCount ?? null,
          isReferenceTable: profile?.isReferenceTable ?? false,
          effectiveTier: tableTier,
          children: columnNodes,
        };
      });

      groups.push({
        kind: 'group',
        id: nodeId('src', sourceId, 'schema', schemaName, 'group', 'tables'),
        sourceId,
        schemaName,
        groupType: 'tables',
        count: tableNodes.length,
        children: tableNodes,
      } satisfies GroupNode);
    }

    const schemaViews = (snapshot.views ?? []).filter((v) => (v.schema ?? 'public') === schemaName);
    if (schemaViews.length > 0) {
      const viewNodes: ViewNode[] = schemaViews.map((v) => ({
        kind: 'view',
        id: nodeId('src', sourceId, 'schema', schemaName, 'view', v.name),
        sourceId,
        schemaName,
        viewName: v.name,
        children: v.columns.map((col) => {
          const tableTier = effectiveTableTier(sourceId, v.name, perms);
          const colPerm = perms.columns.get(`${sourceId}::${v.name}::${col.name}`);
          return {
            kind: 'column',
            id: nodeId('src', sourceId, 'schema', schemaName, 'view', v.name, 'col', col.name),
            sourceId,
            schemaName,
            parentName: v.name,
            columnName: col.name,
            dataType: col.dataType,
            nullable: col.nullable,
            isPrimaryKey: col.isPrimaryKey,
            isForeignKey: col.isForeignKey,
            piiClassification: (colPerm?.piiClassification ?? 'none') as PiiClassification,
            piiSubtype: colPerm?.piiSubtype ?? null,
            effectiveTier: effectiveColumnTier(sourceId, v.name, col.name, tableTier, perms),
          } satisfies ColumnNode;
        }),
      }));

      groups.push({
        kind: 'group',
        id: nodeId('src', sourceId, 'schema', schemaName, 'group', 'views'),
        sourceId,
        schemaName,
        groupType: 'views',
        count: viewNodes.length,
        children: viewNodes,
      } satisfies GroupNode);
    }

    const schemaRoutines = (snapshot.routines ?? []).filter((r) => (r.schema ?? 'public') === schemaName);
    if (schemaRoutines.length > 0) {
      const routineNodes: RoutineNode[] = schemaRoutines.map((r) => ({
        kind: 'routine',
        id: nodeId('src', sourceId, 'schema', schemaName, 'routine', r.name),
        sourceId,
        schemaName,
        routineName: r.name,
        routineKind: r.kind,
        returnType: r.returnType,
      }));

      groups.push({
        kind: 'group',
        id: nodeId('src', sourceId, 'schema', schemaName, 'group', 'routines'),
        sourceId,
        schemaName,
        groupType: 'routines',
        count: routineNodes.length,
        children: routineNodes,
      } satisfies GroupNode);
    }

    const schemaIndexes = (snapshot.indexes ?? []).filter((i) => (i.schema ?? 'public') === schemaName);
    if (schemaIndexes.length > 0) {
      const indexNodes: IndexNode[] = schemaIndexes.map((i) => ({
        kind: 'index',
        id: nodeId('src', sourceId, 'schema', schemaName, 'index', i.name),
        sourceId,
        schemaName,
        indexName: i.name,
        tableName: i.tableName,
        isUnique: i.isUnique,
        isPrimary: i.isPrimary,
      }));

      groups.push({
        kind: 'group',
        id: nodeId('src', sourceId, 'schema', schemaName, 'group', 'indexes'),
        sourceId,
        schemaName,
        groupType: 'indexes',
        count: indexNodes.length,
        children: indexNodes,
      } satisfies GroupNode);
    }

    return {
      kind: 'schema',
      id: schemaId,
      sourceId,
      schemaName,
      children: groups,
    } satisfies SchemaNode;
  });
}
