import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/core/db/client';
import { dataSources, workspaces } from '@/core/db/schema';
import { eq, and } from 'drizzle-orm';
import { getOpenSessions, createSession } from '@/modules/ainderstanding/explore/lib/query-sessions';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const { workspaceId } = await params;

  const ws = db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!ws) return NextResponse.json({ error: 'workspace_not_found' }, { status: 404 });

  const sessions = getOpenSessions(workspaceId);
  return NextResponse.json({ sessions });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const { workspaceId } = await params;

  const ws = db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!ws) return NextResponse.json({ error: 'workspace_not_found' }, { status: 404 });

  const body = (await req.json()) as { dataSourceId?: string; title?: string };
  if (!body.dataSourceId) return NextResponse.json({ error: 'missing_data_source_id' }, { status: 400 });

  const source = db
    .select({ id: dataSources.id })
    .from(dataSources)
    .where(and(eq(dataSources.id, body.dataSourceId), eq(dataSources.workspaceId, workspaceId)))
    .get();
  if (!source) return NextResponse.json({ error: 'source_not_found' }, { status: 404 });

  const session = createSession(workspaceId, body.dataSourceId, body.title);
  return NextResponse.json({ session }, { status: 201 });
}
