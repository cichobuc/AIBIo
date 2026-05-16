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
  db.update(querySessions)
    .set({ ...patch, updatedAt: now as unknown as string })
    .where(and(eq(querySessions.id, id), eq(querySessions.workspaceId, workspaceId)))
    .run();
}

export function closeSession(id: string, workspaceId: string): void {
  updateSession(id, workspaceId, { isClosed: true });
}
