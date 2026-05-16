import { db } from '@/core/db/client';
import { dataSources, schemaSnapshots, tableProfiles, columnProfiles, schemaChanges } from '@/core/db/schema';
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

export type ExploreData = {
  sources: ExploreSource[];
  snapshots: ExploreSnapshot[];
  tables: ExploreTableProfile[];
  columns: ExploreColumnProfile[];
  recentChanges: ExploreSchemaChange[];
};

export function getExploreData(workspaceId: string): ExploreData {
  const sources = db
    .select({ id: dataSources.id, name: dataSources.name, dbType: dataSources.dbType, status: dataSources.status })
    .from(dataSources)
    .where(eq(dataSources.workspaceId, workspaceId))
    .all();

  const sourceIds = sources.map((s) => s.id);

  if (!sourceIds.length) {
    return { sources, snapshots: [], tables: [], columns: [], recentChanges: [] };
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

  return { sources, snapshots, tables, columns, recentChanges };
}
