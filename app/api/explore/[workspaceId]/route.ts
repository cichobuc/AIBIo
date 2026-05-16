import { NextResponse } from 'next/server';
import { db } from '@/core/db/client';
import { dataSources, schemaSnapshots, tableProfiles, columnProfiles, schemaChanges } from '@/core/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const { workspaceId } = await params;

  const sources = db
    .select({ id: dataSources.id, name: dataSources.name })
    .from(dataSources)
    .where(eq(dataSources.workspaceId, workspaceId))
    .all();

  const sourceIds = sources.map((s) => s.id);

  if (!sourceIds.length) {
    return NextResponse.json({ sources, snapshots: [], tables: [], columns: [], recentChanges: [] });
  }

  const allSnapshots = db
    .select()
    .from(schemaSnapshots)
    .where(inArray(schemaSnapshots.dataSourceId, sourceIds))
    .orderBy(desc(schemaSnapshots.takenAt))
    .all();

  // Keep only the latest snapshot per source (allSnapshots is ordered desc by takenAt)
  const latestPerSource = new Map<string, typeof allSnapshots[0]>();
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

  return NextResponse.json({ sources, snapshots, tables, columns, recentChanges });
}
