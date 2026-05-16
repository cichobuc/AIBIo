import { NextResponse } from 'next/server';
import {
  getModel,
  readModelSql,
  writeModelSql,
  deleteModel,
} from '@/modules/ainderstanding/model/lib/model-service';
import { parseAndRebuildLineage } from '@/modules/ainderstanding/model/lib/lineage-parser';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; modelId: string }> },
): Promise<NextResponse> {
  const { workspaceId, modelId } = await params;

  const model = getModel(modelId);
  if (!model || model.workspaceId !== workspaceId) {
    return NextResponse.json({ error: 'Model not found' }, { status: 404 });
  }

  const sql = await readModelSql(workspaceId, modelId);
  return NextResponse.json({ model, sql });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; modelId: string }> },
): Promise<NextResponse> {
  const { workspaceId, modelId } = await params;

  const model = getModel(modelId);
  if (!model || model.workspaceId !== workspaceId) {
    return NextResponse.json({ error: 'Model not found' }, { status: 404 });
  }

  let body: { sql?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.sql !== 'string') {
    return NextResponse.json({ error: 'sql is required' }, { status: 400 });
  }

  await writeModelSql(workspaceId, modelId, body.sql);
  parseAndRebuildLineage(workspaceId, modelId, body.sql);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; modelId: string }> },
): Promise<NextResponse> {
  const { workspaceId, modelId } = await params;

  const model = getModel(modelId);
  if (!model || model.workspaceId !== workspaceId) {
    return NextResponse.json({ error: 'Model not found' }, { status: 404 });
  }

  await deleteModel(workspaceId, modelId);
  return NextResponse.json({ ok: true });
}
