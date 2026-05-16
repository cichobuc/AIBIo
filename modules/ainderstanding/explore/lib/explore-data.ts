import { db } from '@/core/db/client';
import {
  dataSources,
  schemaSnapshots,
  tableProfiles,
  columnProfiles,
  schemaChanges,
  sourcePermissions,
  tablePermissions,
  columnPermissions,
  type PermissionTierValue,
} from '@/core/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';

export type ExploreSnapshot = typeof schemaSnapshots.$inferSelect;
export type ExploreTableProfile = typeof tableProfiles.$inferSelect;
export type ExploreColumnProfile = typeof columnProfiles.$inferSelect;
export type ExploreSchemaChange = typeof schemaChanges.$inferSelect;
export type ExploreSource = {
  id: string;
  name: string;
  dbType: string;
  status: string;
};

export type ExploreSourcePerm = {
  dataSourceId: string;
  permissionTier: PermissionTierValue;
};

export type ExploreTablePerm = {
  dataSourceId: string;
  tableName: string;
  permissionOverride: PermissionTierValue;
};

export type ExploreColumnPerm = {
  dataSourceId: string;
  tableName: string;
  columnName: string;
  piiClassification: 'none' | 'pii' | 'sensitive';
  piiSubtype: string | null;
};

export type ExploreData = {
  sources: ExploreSource[];
  snapshots: ExploreSnapshot[];
  tables: ExploreTableProfile[];
  columns: ExploreColumnProfile[];
  recentChanges: ExploreSchemaChange[];
  sourcePerms: ExploreSourcePerm[];
  tablePerms: ExploreTablePerm[];
  columnPerms: ExploreColumnPerm[];
};

export function getExploreData(workspaceId: string): ExploreData {
  const sources = db
    .select({ id: dataSources.id, name: dataSources.name, dbType: dataSources.dbType, status: dataSources.status })
    .from(dataSources)
    .where(eq(dataSources.workspaceId, workspaceId))
    .all();

  const sourceIds = sources.map((s) => s.id);

  if (!sourceIds.length) {
    return { sources, snapshots: [], tables: [], columns: [], recentChanges: [], sourcePerms: [], tablePerms: [], columnPerms: [] };
  }

  const allSnapshots = db
    .select()
    .from(schemaSnapshots)
    .where(inArray(schemaSnapshots.dataSourceId, sourceIds))
    .orderBy(desc(schemaSnapshots.takenAt))
    .all();

  const latestPerSource = new Map<string, (typeof allSnapshots)[0]>();
  for (const s of allSnapshots) {
    if (!latestPerSource.has(s.dataSourceId)) latestPerSource.set(s.dataSourceId, s);
  }
  const snapshots = Array.from(latestPerSource.values());

  const tables = db
    .select()
    .from(tableProfiles)
    .where(inArray(tableProfiles.dataSourceId, sourceIds))
    .all();

  const columns = db
    .select()
    .from(columnProfiles)
    .where(inArray(columnProfiles.dataSourceId, sourceIds))
    .all();

  const recentChanges = db
    .select()
    .from(schemaChanges)
    .where(inArray(schemaChanges.dataSourceId, sourceIds))
    .orderBy(desc(schemaChanges.detectedAt))
    .limit(200)
    .all();

  const rawSourcePerms = db
    .select({
      dataSourceId: sourcePermissions.dataSourceId,
      permissionTier: sourcePermissions.permissionTier,
    })
    .from(sourcePermissions)
    .where(inArray(sourcePermissions.dataSourceId, sourceIds))
    .all();

  const rawTablePerms = db
    .select({
      dataSourceId: tablePermissions.dataSourceId,
      tableName: tablePermissions.tableName,
      permissionOverride: tablePermissions.permissionOverride,
    })
    .from(tablePermissions)
    .where(inArray(tablePermissions.dataSourceId, sourceIds))
    .all();

  const rawColumnPerms = db
    .select({
      dataSourceId: columnPermissions.dataSourceId,
      tableName: columnPermissions.tableName,
      columnName: columnPermissions.columnName,
      piiClassification: columnPermissions.piiClassification,
      piiSubtype: columnPermissions.piiSubtype,
    })
    .from(columnPermissions)
    .where(inArray(columnPermissions.dataSourceId, sourceIds))
    .all();

  return {
    sources,
    snapshots,
    tables,
    columns,
    recentChanges,
    sourcePerms: rawSourcePerms as ExploreSourcePerm[],
    tablePerms: rawTablePerms.filter((r) => r.permissionOverride != null) as ExploreTablePerm[],
    columnPerms: rawColumnPerms
      .filter((r) => r.piiClassification != null)
      .map((r) => ({
        dataSourceId: r.dataSourceId,
        tableName: r.tableName,
        columnName: r.columnName,
        piiClassification: r.piiClassification as 'none' | 'pii' | 'sensitive',
        piiSubtype: r.piiSubtype ?? null,
      })),
  };
}
