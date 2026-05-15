import type { NextRequest } from 'next/server';
import { testExistingSource } from '@/modules/ainderstanding/connect/lib/data-source-service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ workspaceId: string; sourceId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { workspaceId, sourceId } = await params;

  try {
    const result = await testExistingSource(sourceId, workspaceId);
    return Response.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'TEST_FAILED', message }, { status: 500 });
  }
}
