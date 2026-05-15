import type { NextRequest } from 'next/server';
import { db } from '@/core/db/client';
import { workspaces } from '@/core/db/schema';
import { eq } from 'drizzle-orm';
import { addSource, listSources } from '@/modules/ainderstanding/connect/lib/data-source-service';
import type { DbDriver, ConnectionMode, ConnectionCredentials, ConnectionSettings } from '@/core/types/workspace';

export const runtime = 'nodejs';

type AddSourceBody = {
  name: string;
  dbType: DbDriver;
  connectionMode: ConnectionMode;
  credentials: ConnectionCredentials;
  settings?: ConnectionSettings;
};

function workspaceExists(workspaceId: string): boolean {
  return !!db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, workspaceId)).get();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  if (!workspaceExists(workspaceId)) {
    return Response.json({ error: 'WORKSPACE_NOT_FOUND' }, { status: 404 });
  }

  const sources = listSources(workspaceId);
  return Response.json({ sources });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  if (!workspaceExists(workspaceId)) {
    return Response.json({ error: 'WORKSPACE_NOT_FOUND' }, { status: 404 });
  }

  let body: AddSourceBody;
  try {
    body = (await req.json()) as AddSourceBody;
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const { name, dbType, connectionMode, credentials, settings } = body;

  if (!name?.trim()) {
    return Response.json({ error: 'INVALID_NAME', message: 'Source name is required.' }, { status: 400 });
  }
  if (!['postgres', 'mssql', 'mysql', 'duckdb'].includes(dbType)) {
    return Response.json({ error: 'INVALID_DB_TYPE' }, { status: 400 });
  }
  if (!credentials) {
    return Response.json({ error: 'MISSING_CREDENTIALS' }, { status: 400 });
  }

  try {
    const source = addSource({ workspaceId, name: name.trim(), dbType, connectionMode, credentials, settings });
    return Response.json({ source }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'CREATE_FAILED', message }, { status: 500 });
  }
}
