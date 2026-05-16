import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/core/db/client';
import { dataSources } from '@/core/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAdapterForSource } from '@/modules/ainderstanding/connect/lib/adapters/get-adapter';
import { runProfileQuery } from '@/modules/ainderstanding/explore/lib/mcp-tools';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const { workspaceId } = await params;

  let body: { sourceId: string; tableName: string };
  try {
    body = (await req.json()) as { sourceId: string; tableName: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { sourceId, tableName } = body;
  if (!sourceId || !tableName) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const source = db
    .select({ id: dataSources.id })
    .from(dataSources)
    .where(and(eq(dataSources.id, sourceId), eq(dataSources.workspaceId, workspaceId)))
    .get();

  if (!source) {
    return NextResponse.json({ error: 'source_not_found' }, { status: 404 });
  }

  const { adapter } = getAdapterForSource(sourceId);
  try {
    await runProfileQuery({ dataSourceId: sourceId, tableName, adapter, workspaceId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'profiling_failed', detail: String(err) }, { status: 500 });
  } finally {
    await adapter.close();
  }
}
