import type { NextRequest } from 'next/server';
import { db } from '@/core/db/client';
import { workspaces, workspaceSettings } from '@/core/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  const workspace = db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!workspace) {
    return Response.json(
      { error: 'WORKSPACE_NOT_FOUND', message: `Workspace '${workspaceId}' does not exist` },
      { status: 404 },
    );
  }

  const settings = db
    .select()
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId))
    .get();

  return Response.json({ settings: settings ?? null });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  const workspace = db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!workspace) {
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

  // Only allow safe scalar updates — never allow workspaceId override
  const ALLOWED_FIELDS = new Set([
    'queryTimeoutSec', 'autoProfileOnSourceAdd', 'profileSampleThresholdRows',
    'topValuesPerColumn', 'schemaChangeAutoDetect', 'piiHeuristicsEnabled',
    'selfHealMaxRetries', 'parallelBuildConcurrency', 'autoRunTestsAfterMaterialize',
    'aiTestGenerationEnabled', 'testExecutionTimeoutSec', 'failingPkSamplesCount',
    'autoWriteDocs', 'docVerbosity', 'docConfidenceThreshold', 'showToolCalls',
    'maxSupervisorTurns', 'sessionTimeoutMin',
  ]);

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) updates[key] = value;
  }

  db.update(workspaceSettings)
    .set(updates as Partial<typeof workspaceSettings.$inferInsert>)
    .where(eq(workspaceSettings.workspaceId, workspaceId))
    .run();

  const updated = db
    .select()
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId))
    .get();

  return Response.json({ settings: updated });
}
