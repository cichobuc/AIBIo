import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { db } from '@/core/db/client';
import { sourcePermissions, type PermissionTierValue } from '@/modules/ainderstanding/govern/db/schema';
import { log } from '@/modules/ainderstanding/govern/lib/audit-logger';
import { eq } from 'drizzle-orm';

const VALID_TIERS: PermissionTierValue[] = [
  'metadata_only',
  'with_reference_samples',
  'with_full_samples',
  'with_query_results',
];

type RequestBody = {
  workspaceId: string;
  dataSourceId: string;
  permissionTier: PermissionTierValue;
};

export async function POST(request: Request): Promise<NextResponse> {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { workspaceId, dataSourceId, permissionTier } = body;

  if (!workspaceId || !dataSourceId || !VALID_TIERS.includes(permissionTier)) {
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 });
  }

  const now = new Date().toISOString();

  const existing = db
    .select()
    .from(sourcePermissions)
    .where(eq(sourcePermissions.dataSourceId, dataSourceId))
    .get();

  if (existing) {
    db.update(sourcePermissions)
      .set({ permissionTier, updatedAt: now })
      .where(eq(sourcePermissions.id, existing.id))
      .run();
  } else {
    db.insert(sourcePermissions)
      .values({ id: randomUUID(), dataSourceId, permissionTier, createdAt: now, updatedAt: now })
      .run();
  }

  log({
    workspaceId,
    dataSourceId,
    sessionId: 'user-action',
    agentName: 'user',
    actionType: 'write_doc',
    outcome: 'allowed',
    detail: { permissionTier, action: 'set_source_tier' },
  });

  return NextResponse.json({ ok: true });
}
