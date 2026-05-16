import type { NextRequest } from 'next/server';
import { getWorkspace } from '@/modules/ainderstanding/connect/lib/workspace-service';
import { db } from '@/core/db/client';
import { workspaces } from '@/core/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

const VALID_AI_MODES = new Set(['auto', 'documentation', 'queries', 'manual']);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  try {
    const workspace = getWorkspace(workspaceId);
    return Response.json({ workspace });
  } catch {
    return Response.json(
      { error: 'WORKSPACE_NOT_FOUND', message: `Workspace '${workspaceId}' does not exist` },
      { status: 404 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  const existing = db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!existing) {
    return Response.json(
      { error: 'WORKSPACE_NOT_FOUND', message: `Workspace '${workspaceId}' does not exist` },
      { status: 404 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'INVALID_JSON', message: 'Request body must be valid JSON.' }, { status: 400 });
  }

  if (typeof body.aiMode !== 'string' || !VALID_AI_MODES.has(body.aiMode)) {
    return Response.json(
      { error: 'INVALID_AI_MODE', message: 'aiMode must be one of: auto, documentation, queries, manual' },
      { status: 400 },
    );
  }

  db.update(workspaces)
    .set({ aiMode: body.aiMode, updatedAt: new Date().toISOString() })
    .where(eq(workspaces.id, workspaceId))
    .run();

  const updated = db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  return Response.json({ workspace: updated });
}
