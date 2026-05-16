import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { db } from '@/core/db/client';
import { columnPermissions } from '@/modules/ainderstanding/govern/db/schema';
import { log } from '@/modules/ainderstanding/govern/lib/audit-logger';
import { and, eq } from 'drizzle-orm';

type RequestBody = {
  dataSourceId: string;
  workspaceId: string;
  tableName: string;
  columnName: string;
  piiClassification: 'none' | 'pii' | 'sensitive';
  piiSubtype?: 'email' | 'phone' | 'national_id' | 'address' | 'ip' | 'name' | 'date_of_birth' | 'iban' | 'other';
  setBy: 'user' | 'heuristic';
};

export async function POST(request: Request): Promise<NextResponse> {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { dataSourceId, workspaceId, tableName, columnName, piiClassification, piiSubtype, setBy } = body;

  if (!dataSourceId || !workspaceId || !tableName || !columnName || !piiClassification || !setBy) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const now = new Date().toISOString();

  const existing = db
    .select()
    .from(columnPermissions)
    .where(
      and(
        eq(columnPermissions.dataSourceId, dataSourceId),
        eq(columnPermissions.tableName, tableName),
        eq(columnPermissions.columnName, columnName),
      ),
    )
    .get();

  if (existing) {
    db.update(columnPermissions)
      .set({
        piiClassification,
        piiSubtype: piiSubtype ?? null,
        setBy,
        updatedAt: now,
      })
      .where(eq(columnPermissions.id, existing.id))
      .run();
  } else {
    db.insert(columnPermissions)
      .values({
        id: randomUUID(),
        dataSourceId,
        tableName,
        columnName,
        piiClassification,
        piiSubtype: piiSubtype ?? null,
        setBy,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  log({
    workspaceId,
    dataSourceId,
    sessionId: 'user-action',
    agentName: 'user',
    actionType: 'write_doc',
    tableName,
    columnNames: [columnName],
    outcome: 'allowed',
    detail: { piiClassification, piiSubtype, setBy },
  });

  return NextResponse.json({ ok: true });
}
