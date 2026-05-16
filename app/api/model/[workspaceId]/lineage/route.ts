import { NextResponse } from 'next/server';
import { workspaces } from '@/core/db/schema';
import { db } from '@/core/db/client';
import { eq } from 'drizzle-orm';
import { getLineageForWorkspace } from '@/modules/ainderstanding/model/lib/lineage-parser';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const { workspaceId } = await params;

  const ws = db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const lineage = getLineageForWorkspace(workspaceId);
  return NextResponse.json(lineage);
}
