import { randomUUID } from 'node:crypto';
import { db } from '@/core/db/client';
import { workspaces, workspaceSettings } from '@/core/db/schema';
import { eq, and } from 'drizzle-orm';
import type { Workspace } from '@/core/types/workspace';
import type { AIMode } from '@/core/types/agent';

export function createWorkspace(name: string, description?: string): Workspace {
  const id = randomUUID();
  const settingsId = randomUUID();

  db.insert(workspaces).values({ id, name, description: description ?? null }).run();
  db.insert(workspaceSettings).values({ id: settingsId, workspaceId: id }).run();

  return getWorkspace(id);
}

export function listWorkspaces(): Workspace[] {
  return db
    .select()
    .from(workspaces)
    .where(eq(workspaces.isArchived, false))
    .all() as unknown as Workspace[];
}

export function getWorkspace(id: string): Workspace {
  const row = db.select().from(workspaces).where(eq(workspaces.id, id)).get();
  if (!row) throw new Error(`Workspace not found: ${id}`);
  return row as unknown as Workspace;
}

export function archiveWorkspace(id: string): void {
  db.update(workspaces)
    .set({ isArchived: true, updatedAt: new Date().toISOString() })
    .where(eq(workspaces.id, id))
    .run();
}

export function updateWorkspaceMode(id: string, mode: AIMode): void {
  db.update(workspaces)
    .set({ aiMode: mode, updatedAt: new Date().toISOString() })
    .where(eq(workspaces.id, id))
    .run();
}
