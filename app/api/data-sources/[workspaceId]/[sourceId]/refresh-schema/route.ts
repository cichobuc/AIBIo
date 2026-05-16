import type { NextRequest } from 'next/server';
import { getAdapterForSource } from '@/modules/ainderstanding/connect/lib/adapters/get-adapter';
import { detectSchemaChanges } from '@/modules/ainderstanding/explore/lib/mcp-tools';

export const runtime = 'nodejs';

type Params = { params: Promise<{ workspaceId: string; sourceId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { sourceId } = await params;

  let adapter;
  try {
    ({ adapter } = getAdapterForSource(sourceId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('DATA_SOURCE_NOT_FOUND')) {
      return Response.json({ error: 'SOURCE_NOT_FOUND' }, { status: 404 });
    }
    return Response.json({ error: 'ADAPTER_ERROR', message }, { status: 500 });
  }

  try {
    const snapshot = await adapter.introspectSchema();
    const result = await detectSchemaChanges(sourceId, snapshot);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'INTROSPECTION_FAILED', message }, { status: 500 });
  } finally {
    await adapter.close();
  }
}
