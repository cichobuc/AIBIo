import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { db } from '@/core/db/client';
import { tablePermissions, type PermissionTierValue } from '@/modules/ainderstanding/govern/db/schema';
import { log } from '@/modules/ainderstanding/govern/lib/audit-logger';
import { and, eq } from 'drizzle-orm';

const VALID_TIERS: PermissionTierValue[] = [
  'metadata_only',
  'with_reference_samples',
  'with_full_samples',
  'with_query_results',
];

type RequestBody = {
  workspaceId: string;
  dataSourceId: string;
  tableName: string;
  permissionOverride: PermissionTierValue | null;
};

export async function POST(request: Request): Promise<NextResponse> {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { workspaceId, dataSourceId, tableName, permissionOverride } = body;

  if (!workspaceId || !dataSourceId || !tableName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (permissionOverride !== null && !VALID_TIERS.includes(permissionOverride)) {
    return NextResponse.json({ error: 'Invalid permissionOverride' }, { status: 400 });
  }

  const now = new Date().toISOString();

  const existing = db
    .select()
    .from(tablePermissions)
    .where(
      and(
        eq(tablePermissions.dataSourceId, dataSourceId),
        eq(tablePermissions.tableName, tableName),
      ),
    )
    .get();

  if (permissionOverride === null) {
    if (existing) {
      db.delete(tablePermissions).where(eq(tablePermissions.id, existing.id)).run();
    }
  } else if (existing) {
    db.update(tablePermissions)
      .set({ permissionOverride, updatedAt: now })
      .where(eq(tablePermissions.id, existing.id))
      .run();
  } else {
    db.insert(tablePermissions)
      .values({ id: randomUUID(), dataSourceId, tableName, permissionOverride, createdAt: now, updatedAt: now })
      .run();
  }

  log({
    workspaceId,
    dataSourceId,
    sessionId: 'user-action',
    agentName: 'user',
    actionType: 'write_doc',
    tableName,
    outcome: 'allowed',
    detail: { permissionOverride, action: 'set_table_override' },
  });

  return NextResponse.json({ ok: true });
}
