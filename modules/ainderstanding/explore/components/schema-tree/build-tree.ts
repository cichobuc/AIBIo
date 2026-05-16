import type { SchemaSnapshot } from '@/core/types/workspace';
import type { ExploreSource, ExploreTableProfile, ExploreColumnProfile } from '../../lib/explore-data';
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
} from './types';

type BuildArgs = {
  sources: ExploreSource[];
  snapshots: Map<string, SchemaSnapshot>;
  profiles: Map<string, ExploreTableProfile>;
  columnProfiles: Map<string, ExploreColumnProfile[]>;
};

function nodeId(...parts: string[]): string {
  return parts.join('/');
}

export function buildSchemaTree({ sources, snapshots, profiles, columnProfiles }: BuildArgs): TreeNode[] {
  return sources.map((source) => {
    const snapshot = snapshots.get(source.id);
    const children = snapshot ? buildSchemaChildren(source.id, snapshot, profiles, columnProfiles) : [];

    return {
      kind: 'connection',
      id: nodeId('src', source.id),
      sourceId: source.id,
      name: source.name,
      status: source.status as 'active' | 'error' | 'pending',
      dbType: source.dbType as 'postgres' | 'mssql' | 'mysql' | 'duckdb',
      children,
    } satisfies ConnectionNode;
  });
}

function buildSchemaChildren(
  sourceId: string,
  snapshot: SchemaSnapshot,
  profiles: Map<string, ExploreTableProfile>,
  columnProfiles: Map<string, ExploreColumnProfile[]>,
): TreeNode[] {
  // Group objects by schema name
  const schemaNames = new Set<string>();

  for (const t of snapshot.tables) schemaNames.add(t.schema ?? 'public');
  for (const v of snapshot.views ?? []) schemaNames.add(v.schema ?? 'public');
  for (const r of snapshot.routines ?? []) schemaNames.add(r.schema ?? 'public');
  for (const i of snapshot.indexes ?? []) schemaNames.add(i.schema ?? 'public');

  const sorted = [...schemaNames].sort();

  return sorted.map((schemaName) => {
    const schemaId = nodeId('src', sourceId, 'schema', schemaName);
    const groups: TreeNode[] = [];

    // Tables group
    const schemaTables = snapshot.tables.filter((t) => (t.schema ?? 'public') === schemaName);
    if (schemaTables.length > 0) {
      const tableNodes: TableNode[] = schemaTables.map((t) => {
        const profileKey = `${sourceId}:${t.name}`;
        const profile = profiles.get(profileKey);
        const colProfKey = `${sourceId}:${t.name}`;
        const colProfs = columnProfiles.get(colProfKey) ?? [];
        const piiColNames = new Set(colProfs.filter((c) => c.piiCandidate).map((c) => c.columnName));

        const tableId = nodeId('src', sourceId, 'schema', schemaName, 'table', t.name);
        const columnNodes: ColumnNode[] = t.columns.map((col) => ({
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
          piiCandidate: piiColNames.has(col.name),
        }));

        return {
          kind: 'table',
          id: tableId,
          sourceId,
          schemaName,
          tableName: t.name,
          rowCount: profile?.rowCount ?? null,
          isReferenceTable: profile?.isReferenceTable ?? false,
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

    // Views group
    const schemaViews = (snapshot.views ?? []).filter((v) => (v.schema ?? 'public') === schemaName);
    if (schemaViews.length > 0) {
      const viewNodes: ViewNode[] = schemaViews.map((v) => ({
        kind: 'view',
        id: nodeId('src', sourceId, 'schema', schemaName, 'view', v.name),
        sourceId,
        schemaName,
        viewName: v.name,
        children: v.columns.map((col) => ({
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
          piiCandidate: false,
        })),
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

    // Routines group
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

    // Indexes group
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
