import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/core/db/client';
import { dataSources, schemaSnapshots } from '@/core/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { SchemaSnapshot } from '@/core/types/workspace';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const { workspaceId } = await params;
  const sourceId = req.nextUrl.searchParams.get('source');
  if (!sourceId) return NextResponse.json({ error: 'missing_source' }, { status: 400 });

  const source = db
    .select({ id: dataSources.id })
    .from(dataSources)
    .where(and(eq(dataSources.id, sourceId), eq(dataSources.workspaceId, workspaceId)))
    .get();
  if (!source) return NextResponse.json({ error: 'source_not_found' }, { status: 404 });

  const snapshot = db
    .select({ snapshotJson: schemaSnapshots.snapshotJson })
    .from(schemaSnapshots)
    .where(eq(schemaSnapshots.dataSourceId, sourceId))
    .orderBy(desc(schemaSnapshots.takenAt))
    .limit(1)
    .get();

  if (!snapshot) return NextResponse.json({ tables: [] });

  try {
    const parsed = JSON.parse(snapshot.snapshotJson) as SchemaSnapshot;
    const tables = (parsed.tables ?? []).map((t) => ({
      name: t.name,
      columns: (t.columns ?? []).map((c) => c.name),
    }));
    return NextResponse.json({ tables });
  } catch {
    return NextResponse.json({ tables: [] });
  }
}
