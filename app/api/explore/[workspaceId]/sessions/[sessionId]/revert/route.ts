import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/core/db/client';
import { querySessions } from '@/core/db/schema';
import { eq, and } from 'drizzle-orm';
import { revertToBaseline } from '@/modules/ainderstanding/explore/lib/query-sessions';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; sessionId: string }> },
): Promise<NextResponse> {
  const { workspaceId, sessionId } = await params;

  const exists = db
    .select({ id: querySessions.id })
    .from(querySessions)
    .where(and(eq(querySessions.id, sessionId), eq(querySessions.workspaceId, workspaceId)))
    .get();
  if (!exists) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });

  const reverted = revertToBaseline(sessionId, workspaceId);
  if (!reverted) {
    return NextResponse.json({ error: 'no_baseline', message: 'No baseline to revert to.' }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    sqlDraft: reverted.sqlDraft,
    hasUnrevertedAgentEdit: reverted.hasUnrevertedAgentEdit,
  });
}
