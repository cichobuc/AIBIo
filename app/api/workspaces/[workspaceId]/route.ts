import type { NextRequest } from 'next/server';
import { getWorkspace } from '@/modules/ainderstanding/connect/lib/workspace-service';

export const runtime = 'nodejs';

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
