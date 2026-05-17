import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { db } from '@/core/db/client';
import { workspaces, chatMessages } from '@/core/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { withAgentContext } from '@/core/orchestration/context';
import { sseEmitter } from '@/core/orchestration/streaming';
import { createSession, getActiveSession, endSession } from '@/modules/ainderstanding/shell/lib/session-manager';
import { createSupervisor, type SupervisorContext, type QuerySessionSummary, type RecentMessage } from '@/modules/ainderstanding/shell/orchestrator';
import { getOpenSessions } from '@/modules/ainderstanding/explore/lib/query-sessions';
import { getSource, listSources } from '@/modules/ainderstanding/connect/lib/data-source-service';
import { readSchemaSnapshot } from '@/modules/ainderstanding/explore/lib/mcp-tools';
import { createSupervisorState, cleanupSupervisorState } from '@/modules/ainderstanding/shell/lib/supervisor-state';
import { runPostProcessing } from '@/modules/ainderstanding/shell/lib/post-processing';
import type { ActorName, AIMode } from '@/core/types/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MESSAGE_LENGTH = 4000; // BR-SHL-005
const MAX_TABLES_IN_SUMMARY = 30;

function buildSourcesSummary(workspaceId: string): string {
  const sources = listSources(workspaceId);
  if (sources.length === 0) return 'No sources connected yet.';

  const lines: string[] = [`Connected sources (${sources.length}):`];
  for (const s of sources) {
    const snap = readSchemaSnapshot(s.id);
    if (!snap || snap.tables.length === 0) {
      lines.push(`- ${s.name} (${s.dbType}, status: ${s.status}) — schema not yet introspected`);
      continue;
    }
    const shown = snap.tables.slice(0, MAX_TABLES_IN_SUMMARY);
    const list = shown.map((t) => `${t.name} (${t.columns.length} cols)`).join(', ');
    const more = snap.tables.length > MAX_TABLES_IN_SUMMARY
      ? ` … +${snap.tables.length - MAX_TABLES_IN_SUMMARY} more` : '';
    lines.push(`- ${s.name} (${s.dbType}, status: ${s.status})`);
    lines.push(`  Tables (${snap.tables.length}): ${list}${more}`);
  }
  return lines.join('\n');
}

type ChatRequestBody = {
  message: string;
  activeModule?: string;
  activeQuerySessionId?: string | null;
  threadId?: string | null;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  const workspace = db
    .select({ id: workspaces.id, name: workspaces.name, aiMode: workspaces.aiMode })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .get();

  if (!workspace) {
    return Response.json(
      { error: 'WORKSPACE_NOT_FOUND', message: `Workspace '${workspaceId}' does not exist` },
      { status: 404 },
    );
  }

  // BR-SHL-010: Manual mode → reject with 400
  if (workspace.aiMode === 'manual') {
    return Response.json(
      { error: 'MANUAL_MODE_ACTIVE', message: 'AI is disabled in Manual mode. Use the Monaco editor directly.' },
      { status: 400 },
    );
  }

  // BR-SHL-033: Reject concurrent session
  const existing = getActiveSession(workspaceId);
  if (existing) {
    return Response.json(
      {
        error: 'SESSION_IN_PROGRESS',
        message: 'A session is already active for this workspace.',
        sessionId: existing.sessionId,
      },
      { status: 409 },
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: 'INVALID_JSON', message: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const { message, activeModule = 'connect', activeQuerySessionId = null, threadId = null } = body;

  if (typeof message !== 'string' || message.trim().length === 0) {
    return Response.json({ error: 'EMPTY_MESSAGE', message: 'Message must be a non-empty string.' }, { status: 400 });
  }

  // BR-SHL-005: Max 4000 characters
  if (message.length > MAX_MESSAGE_LENGTH) {
    return Response.json(
      { error: 'MESSAGE_TOO_LONG', message: `Message must not exceed ${MAX_MESSAGE_LENGTH} characters.` },
      { status: 400 },
    );
  }

  // Fetch conversation history before inserting current message
  const effectiveThreadId = threadId ?? null;
  const recentMessages: RecentMessage[] = effectiveThreadId
    ? db
        .select({ role: chatMessages.role, content: chatMessages.content })
        .from(chatMessages)
        .where(and(eq(chatMessages.workspaceId, workspaceId), eq(chatMessages.threadId, effectiveThreadId)))
        .orderBy(desc(chatMessages.createdAt))
        .limit(20)
        .all()
        .reverse()
        .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }))
    : [];

  const session = createSession(workspaceId);
  const messageId = randomUUID();

  db.insert(chatMessages).values({
    id: messageId,
    workspaceId,
    sessionId: session.sessionId,
    threadId: effectiveThreadId,
    role: 'user',
    content: message,
    agentName: null,
    activeModule,
  }).run();

  // Build query sessions context for the supervisor
  const openSessions = getOpenSessions(workspaceId);
  let querySessionsCtx: SupervisorContext['querySessions'] | undefined;
  if (openSessions.length > 0) {
    const toSummary = (s: (typeof openSessions)[0]): QuerySessionSummary => {
      let dataSourceName = s.dataSourceId;
      try { dataSourceName = getSource(s.dataSourceId).name; } catch {}
      return {
        id: s.id,
        title: s.title ?? 'Query',
        dataSourceName,
        sqlDraft: s.sqlDraft,
        hasUnrevertedAgentEdit: s.hasUnrevertedAgentEdit,
      };
    };
    const activeSession = openSessions.find((s) => s.id === activeQuerySessionId) ?? null;
    const others = openSessions.filter((s) => s.id !== activeSession?.id);
    querySessionsCtx = {
      active: activeSession ? toSummary(activeSession) : null,
      others: others.map((s) => {
        const sum = toSummary(s);
        return { id: sum.id, title: sum.title, dataSourceName: sum.dataSourceName, hasUnrevertedAgentEdit: sum.hasUnrevertedAgentEdit, sqlPreview: sum.sqlDraft.slice(0, 200) };
      }),
    };
  }

  const agentCtx = {
    workspaceId,
    agentName: 'supervisor' as ActorName,
    sessionId: session.sessionId,
    aiMode: workspace.aiMode as AIMode,
    activeModule,
    activeQuerySessionId: activeQuerySessionId ?? null,
    tokenCounter: { input: 0, output: 0 },
    tokenLimit: 100_000,
  };

  const supervisorCtx: SupervisorContext = {
    workspaceName: workspace.name,
    workspaceId,
    sessionId: session.sessionId,
    activeModule,
    aiMode: workspace.aiMode as AIMode,
    sourcesSummary: buildSourcesSummary(workspaceId),
    querySessions: querySessionsCtx,
    recentMessages: recentMessages.slice(-20),
  };

  createSupervisorState(session.sessionId, workspaceId);

  // Fire-and-forget supervisor run — response returns immediately, stream via SSE
  void withAgentContext(agentCtx, async () => {
    let supervisorText = '';
    try {
      for await (const msg of createSupervisor(supervisorCtx, agentCtx, message)) {
        const raw = msg as { type?: string; message?: { content?: unknown[] } };
        if (raw.type === 'assistant' && Array.isArray(raw.message?.content)) {
          for (const block of raw.message.content) {
            const b = block as { type?: string; text?: string };
            if (b.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
              supervisorText += b.text;
            }
          }
        }
      }
      if (supervisorText.trim() && effectiveThreadId) {
        db.insert(chatMessages).values({
          id: randomUUID(),
          workspaceId,
          sessionId: session.sessionId,
          threadId: effectiveThreadId,
          role: 'assistant',
          content: supervisorText.trim(),
          agentName: 'supervisor',
          activeModule,
        }).run();
      }
      await runPostProcessing(agentCtx);
      sseEmitter.emit(workspaceId, {
        type: 'stream_end',
        sessionId: session.sessionId,
        workspaceId,
        timestamp: new Date().toISOString(),
        payload: { summary: 'Done.', agentsUsed: ['supervisor'], totalDurationMs: 0 },
      });
    } catch (err) {
      if (supervisorText.trim() && effectiveThreadId) {
        db.insert(chatMessages).values({
          id: randomUUID(),
          workspaceId,
          sessionId: session.sessionId,
          threadId: effectiveThreadId,
          role: 'assistant',
          content: supervisorText.trim(),
          agentName: 'supervisor',
          activeModule,
        }).run();
      }
      const errMessage = err instanceof Error ? err.message : String(err);
      sseEmitter.emit(workspaceId, {
        type: 'stream_error',
        sessionId: session.sessionId,
        workspaceId,
        timestamp: new Date().toISOString(),
        payload: { errorCode: 'SUPERVISOR_ERROR', message: errMessage, recoverable: false },
      });
    } finally {
      endSession(session.sessionId);
      cleanupSupervisorState(session.sessionId);
    }
  });

  return Response.json(
    { sessionId: session.sessionId, status: 'dispatched', messageId },
    { status: 202 },
  );
}

export async function GET(
  _req: NextRequest,
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

  // Latest 50 messages for current session (no pagination needed for active session view)
  const messages = db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
      agentName: chatMessages.agentName,
      activeModule: chatMessages.activeModule,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.workspaceId, workspaceId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(50)
    .all()
    .reverse();

  return Response.json({ messages });
}
