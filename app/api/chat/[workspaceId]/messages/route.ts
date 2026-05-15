import type { NextRequest } from 'next/server';
import { db } from '@/core/db/client';
import { workspaces, chatMessages } from '@/core/db/schema';
import { eq, and, lt, desc } from 'drizzle-orm';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const MESSAGE_COLS = {
  id: chatMessages.id,
  role: chatMessages.role,
  content: chatMessages.content,
  agentName: chatMessages.agentName,
  activeModule: chatMessages.activeModule,
  createdAt: chatMessages.createdAt,
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  const workspace = db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .get();

  if (!workspace) {
    return Response.json(
      { error: 'WORKSPACE_NOT_FOUND', message: `Workspace '${workspaceId}' does not exist` },
      { status: 404 },
    );
  }

  const url = new URL(req.url);
  const beforeId = url.searchParams.get('before');
  const limitParam = url.searchParams.get('limit');
  const limit = Math.min(Math.max(1, Number(limitParam) || DEFAULT_LIMIT), MAX_LIMIT);

  // Resolve cursor timestamp from the anchor message id
  let beforeCreatedAt: string | null = null;
  if (beforeId) {
    const cursor = db
      .select({ createdAt: chatMessages.createdAt })
      .from(chatMessages)
      .where(and(eq(chatMessages.workspaceId, workspaceId), eq(chatMessages.id, beforeId)))
      .get();
    beforeCreatedAt = cursor?.createdAt ?? null;
  }

  const whereClause = beforeCreatedAt
    ? and(eq(chatMessages.workspaceId, workspaceId), lt(chatMessages.createdAt, beforeCreatedAt))
    : eq(chatMessages.workspaceId, workspaceId);

  const rows = db
    .select(MESSAGE_COLS)
    .from(chatMessages)
    .where(whereClause)
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit + 1)
    .all();

  const hasMore = rows.length > limit;
  const messages = rows.slice(0, limit).reverse();

  return Response.json({ messages, hasMore });
}
