import type { NextRequest } from 'next/server';
import { createWorkspace, listWorkspaces } from '@/modules/ainderstanding/connect/lib/workspace-service';

export const runtime = 'nodejs';

export async function GET() {
  const workspaces = listWorkspaces();
  return Response.json({ workspaces });
}

export async function POST(req: NextRequest) {
  let body: { name?: string; description?: string };
  try {
    body = (await req.json()) as { name?: string; description?: string };
  } catch {
    return Response.json({ error: 'INVALID_JSON', message: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const { name, description } = body;

  if (typeof name !== 'string' || name.trim().length === 0) {
    return Response.json({ error: 'INVALID_NAME', message: 'Workspace name is required.' }, { status: 400 });
  }
  if (name.length > 100) {
    return Response.json({ error: 'NAME_TOO_LONG', message: 'Workspace name must not exceed 100 characters.' }, { status: 400 });
  }

  try {
    const workspace = createWorkspace(name.trim(), description?.trim());
    return Response.json({ workspace }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'CREATE_FAILED', message }, { status: 500 });
  }
}
