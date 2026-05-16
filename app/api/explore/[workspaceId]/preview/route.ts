import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/core/db/client';
import { dataSources, tableProfiles } from '@/core/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAdapterForSource } from '@/modules/ainderstanding/connect/lib/adapters/get-adapter';
import {
  getEffectivePermission,
  getPiiColumns,
} from '@/modules/ainderstanding/govern/lib/permission-service';

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

  const tier = getEffectivePermission(sourceId, tableName);

  if (tier === 'metadata_only') {
    return NextResponse.json(
      { error: 'permission_denied', tier, reason: 'This source is restricted to metadata only. Set a higher access tier to preview data.' },
      { status: 403 },
    );
  }

  if (tier === 'with_reference_samples') {
    const tableProfile = db
      .select({ isReferenceTable: tableProfiles.isReferenceTable })
      .from(tableProfiles)
      .where(and(eq(tableProfiles.dataSourceId, sourceId), eq(tableProfiles.tableName, tableName)))
      .get();

    if (!tableProfile?.isReferenceTable) {
      return NextResponse.json(
        { error: 'permission_denied', tier, reason: 'Data preview is limited to reference tables at this tier.' },
        { status: 403 },
      );
    }
  }

  const piiCols = new Set(getPiiColumns(sourceId, tableName).map((c) => c.columnName));

  try {
    const { adapter } = getAdapterForSource(sourceId);
    const result = await adapter.executeSelect(`SELECT * FROM "${tableName.replace(/"/g, '""')}" LIMIT 100`);
    const rows = result.rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => {
          if (piiCols.has(k)) return [k, '[REDACTED]'];
          return [k, typeof v === 'bigint' ? Number(v) : v];
        }),
      ),
    );
    return NextResponse.json({ columns: result.columns, rows });
  } catch (err) {
    return NextResponse.json({ error: 'query_failed', detail: String(err) }, { status: 500 });
  }
}
