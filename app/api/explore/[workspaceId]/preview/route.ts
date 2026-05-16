import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/core/db/client';
import { dataSources } from '@/core/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAdapterForSource } from '@/modules/ainderstanding/connect/lib/adapters/get-adapter';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const { workspaceId } = await params;
  const sourceId = req.nextUrl.searchParams.get('source');
  const tableName = req.nextUrl.searchParams.get('table');

  if (!sourceId || !tableName) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const source = db
    .select({ id: dataSources.id })
    .from(dataSources)
    .where(and(eq(dataSources.id, sourceId), eq(dataSources.workspaceId, workspaceId)))
    .get();

  if (!source) {
    return NextResponse.json({ error: 'source_not_found' }, { status: 404 });
  }

  try {
    const { adapter } = getAdapterForSource(sourceId);
    const result = await adapter.executeSelect(`SELECT * FROM "${tableName}" LIMIT 100`);
    const rows = result.rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]),
      ),
    );
    return NextResponse.json({ columns: result.columns, rows });
  } catch (err) {
    return NextResponse.json({ error: 'query_failed', detail: String(err) }, { status: 500 });
  }
}
