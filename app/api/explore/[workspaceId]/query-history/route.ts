import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/core/db/client';
import { workspaces } from '@/core/db/schema';
import { eq } from 'drizzle-orm';
import { getHistory } from '@/modules/ainderstanding/explore/lib/query-history';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const { workspaceId } = await params;

  const ws = db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!ws) return NextResponse.json({ error: 'workspace_not_found' }, { status: 404 });

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '50'), 200);
  const offset = Number(req.nextUrl.searchParams.get('offset') ?? '0');

  const rows = getHistory(workspaceId, limit, offset);
  return NextResponse.json({ rows });
}
