import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/core/db/client';
import { querySessions } from '@/core/db/schema';
import { eq, and } from 'drizzle-orm';
import { updateSession, closeSession } from '@/modules/ainderstanding/explore/lib/query-sessions';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; sessionId: string }> },
): Promise<NextResponse> {
  const { workspaceId, sessionId } = await params;

  const session = db
    .select({ id: querySessions.id })
    .from(querySessions)
    .where(and(eq(querySessions.id, sessionId), eq(querySessions.workspaceId, workspaceId)))
    .get();
  if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });

  const body = (await req.json()) as { title?: string | null; sqlDraft?: string; isClosed?: boolean };
  updateSession(sessionId, workspaceId, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; sessionId: string }> },
): Promise<NextResponse> {
  const { workspaceId, sessionId } = await params;

  const session = db
    .select({ id: querySessions.id })
    .from(querySessions)
    .where(and(eq(querySessions.id, sessionId), eq(querySessions.workspaceId, workspaceId)))
    .get();
  if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });

  closeSession(sessionId, workspaceId);
  return NextResponse.json({ ok: true });
}
