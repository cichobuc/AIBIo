import { NextResponse } from 'next/server';
import { workspaces } from '@/core/db/schema';
import { db } from '@/core/db/client';
import { eq } from 'drizzle-orm';
import { executeDatamartRead } from '@/modules/ainderstanding/model/lib/duckdb-datamart';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const { workspaceId } = await params;

  const ws = db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const url = new URL(req.url);
  const modelName = url.searchParams.get('model');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 1000);

  if (!modelName) {
    return NextResponse.json({ error: 'model query param is required' }, { status: 400 });
  }
  if (!/^[a-z][a-z0-9_]*$/.test(modelName)) {
    return NextResponse.json({ error: 'Invalid model name' }, { status: 400 });
  }

  try {
    const result = await executeDatamartRead(workspaceId, `SELECT * FROM "${modelName}"`, limit);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Preview failed';
    if (msg.includes('Table') || msg.includes('table') || msg.includes('does not exist')) {
      return NextResponse.json(
        { error: `Model "${modelName}" has not been materialized yet. Run "Build" first.` },
        { status: 404 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
