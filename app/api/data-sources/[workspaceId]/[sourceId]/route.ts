import type { NextRequest } from 'next/server';
import {
  removeSource,
  updateSource,
  testExistingSource,
} from '@/modules/ainderstanding/connect/lib/data-source-service';
import type { ConnectionCredentials, ConnectionSettings } from '@/core/types/workspace';

export const runtime = 'nodejs';

type Params = { params: Promise<{ workspaceId: string; sourceId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { workspaceId, sourceId } = await params;

  let body: { name?: string; credentials?: ConnectionCredentials; settings?: ConnectionSettings };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  try {
    const source = updateSource(sourceId, workspaceId, body);
    return Response.json({ source });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      return Response.json({ error: 'SOURCE_NOT_FOUND', message }, { status: 404 });
    }
    return Response.json({ error: 'UPDATE_FAILED', message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { workspaceId, sourceId } = await params;

  try {
    removeSource(sourceId, workspaceId);
    return new Response(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'DELETE_FAILED', message }, { status: 500 });
  }
}
