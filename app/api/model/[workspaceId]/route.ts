import { NextResponse } from 'next/server';
import { workspaces } from '@/core/db/schema';
import { db } from '@/core/db/client';
import { eq } from 'drizzle-orm';
import { createModel, listModels } from '@/modules/ainderstanding/model/lib/model-service';
import type { ModelLayer } from '@/modules/ainderstanding/model/db/schema';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const { workspaceId } = await params;

  const ws = db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const staging = listModels(workspaceId, 'staging');
  const intermediate = listModels(workspaceId, 'intermediate');
  const marts = listModels(workspaceId, 'marts');

  return NextResponse.json({ staging, intermediate, marts });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const { workspaceId } = await params;

  const ws = db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  let body: { name?: string; layer?: string; initialSql?: string; description?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.name || !body.layer) {
    return NextResponse.json({ error: 'name and layer are required' }, { status: 400 });
  }

  const validLayers: ModelLayer[] = ['staging', 'intermediate', 'marts'];
  if (!validLayers.includes(body.layer as ModelLayer)) {
    return NextResponse.json({ error: 'Invalid layer' }, { status: 400 });
  }

  try {
    const model = await createModel({
      workspaceId,
      name: body.name,
      layer: body.layer as ModelLayer,
      initialSql: body.initialSql,
      description: body.description,
    });
    return NextResponse.json(model, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create model';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
