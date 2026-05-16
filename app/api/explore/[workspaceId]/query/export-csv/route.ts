import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/core/db/client';
import { dataSources, querySessions } from '@/core/db/schema';
import { eq, and } from 'drizzle-orm';
import { executeQuery } from '@/modules/ainderstanding/explore/lib/query-executor';

function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines: string[] = [columns.map(escape).join(',')];
  for (const row of rows) {
    lines.push(columns.map((col) => escape(row[col])).join(','));
  }
  return lines.join('\r\n');
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const { workspaceId } = await params;

  const body = (await req.json()) as { sessionId?: string; sourceId?: string; sql?: string };
  if (!body.sessionId || !body.sourceId || !body.sql) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const source = db
    .select({ id: dataSources.id })
    .from(dataSources)
    .where(and(eq(dataSources.id, body.sourceId), eq(dataSources.workspaceId, workspaceId)))
    .get();
  if (!source) return NextResponse.json({ error: 'source_not_found' }, { status: 404 });

  const session = db
    .select({ id: querySessions.id })
    .from(querySessions)
    .where(and(eq(querySessions.id, body.sessionId), eq(querySessions.workspaceId, workspaceId)))
    .get();
  if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });

  const result = await executeQuery({
    sessionId: body.sessionId,
    workspaceId,
    dataSourceId: body.sourceId,
    sql: body.sql,
  });

  if (!result.ok) {
    const status = result.error === 'sql_rejected' ? 400 : result.error === 'permission_denied' ? 403 : 500;
    return NextResponse.json(result, { status });
  }

  const csv = rowsToCsv(result.columns, result.rows);
  const filename = `query-${body.sessionId}-${Date.now()}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
