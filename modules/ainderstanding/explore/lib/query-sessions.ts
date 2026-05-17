import { randomUUID } from 'node:crypto';
import { db } from '@/core/db/client';
import { querySessions } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export type QuerySession = typeof querySessions.$inferSelect;

export function getOpenSessions(workspaceId: string): QuerySession[] {
  return db
    .select()
    .from(querySessions)
    .where(and(eq(querySessions.workspaceId, workspaceId), eq(querySessions.isClosed, false)))
    .all();
}

export function getSession(id: string, workspaceId: string): QuerySession | undefined {
  return db
    .select()
    .from(querySessions)
    .where(and(eq(querySessions.id, id), eq(querySessions.workspaceId, workspaceId)))
    .get();
}

export function createSession(workspaceId: string, dataSourceId: string, title?: string): QuerySession {
  const id = randomUUID();
  db.insert(querySessions)
    .values({ id, workspaceId, dataSourceId, title: title ?? null, sqlDraft: '', isClosed: false })
    .run();
  return db.select().from(querySessions).where(eq(querySessions.id, id)).get()!;
}

export function updateSession(
  id: string,
  workspaceId: string,
  patch: { title?: string | null; sqlDraft?: string; isClosed?: boolean },
): void {
  // User-initiated save clears agent baseline so revert is no longer possible.
  const baselineClear = patch.sqlDraft !== undefined
    ? { sqlBaseline: null as string | null, hasUnrevertedAgentEdit: false, lastAgentEditAt: null as string | null }
    : {};

  db.update(querySessions)
    .set({ ...patch, ...baselineClear, updatedAt: now as unknown as string })
    .where(and(eq(querySessions.id, id), eq(querySessions.workspaceId, workspaceId)))
    .run();
}

export function applyAgentEdit(
  id: string,
  workspaceId: string,
  newSql: string,
): void {
  const current = db.select().from(querySessions)
    .where(and(eq(querySessions.id, id), eq(querySessions.workspaceId, workspaceId)))
    .get();
  if (!current) return;

  // Snapshot baseline once — subsequent agent edits don't overwrite it.
  const baseline = current.sqlBaseline ?? current.sqlDraft;

  db.update(querySessions)
    .set({
      sqlDraft: newSql,
      sqlBaseline: baseline,
      hasUnrevertedAgentEdit: true,
      lastAgentEditAt: now as unknown as string,
      updatedAt: now as unknown as string,
    })
    .where(and(eq(querySessions.id, id), eq(querySessions.workspaceId, workspaceId)))
    .run();
}

export function revertToBaseline(id: string, workspaceId: string): QuerySession | null {
  const current = db.select().from(querySessions)
    .where(and(eq(querySessions.id, id), eq(querySessions.workspaceId, workspaceId)))
    .get();
  if (!current?.sqlBaseline) return null;

  db.update(querySessions)
    .set({
      sqlDraft: current.sqlBaseline,
      sqlBaseline: null,
      hasUnrevertedAgentEdit: false,
      lastAgentEditAt: null,
      updatedAt: now as unknown as string,
    })
    .where(and(eq(querySessions.id, id), eq(querySessions.workspaceId, workspaceId)))
    .run();

  return db.select().from(querySessions).where(eq(querySessions.id, id)).get()!;
}

export function closeSession(id: string, workspaceId: string): void {
  updateSession(id, workspaceId, { isClosed: true });
}
