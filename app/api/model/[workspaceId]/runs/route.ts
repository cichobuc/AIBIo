import { NextResponse } from 'next/server';
import { workspaces } from '@/core/db/schema';
import { db } from '@/core/db/client';
import { eq } from 'drizzle-orm';
import { getRunsForWorkspace } from '@/modules/ainderstanding/model/lib/run-recorder';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const { workspaceId } = await params;

  const ws = db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 100);

  const runs = getRunsForWorkspace(workspaceId, limit);
  return NextResponse.json({ runs });
}
