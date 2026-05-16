import { NextResponse } from 'next/server';
import { db } from '@/core/db/client';
import {
  dataSources,
  sourcePermissions,
  approvalSettings,
  auditEntries,
  columnPermissions,
} from '@/core/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const { workspaceId } = await params;

  const sources = db
    .select({ id: dataSources.id, name: dataSources.name })
    .from(dataSources)
    .where(eq(dataSources.workspaceId, workspaceId))
    .all();

  const sourceIds = sources.map((s) => s.id);

  const permissions = sourceIds.length
    ? db.select().from(sourcePermissions).where(inArray(sourcePermissions.dataSourceId, sourceIds)).all()
    : [];

  const settings = db
    .select()
    .from(approvalSettings)
    .where(eq(approvalSettings.workspaceId, workspaceId))
    .get();

  const audits = db
    .select()
    .from(auditEntries)
    .where(eq(auditEntries.workspaceId, workspaceId))
    .orderBy(desc(auditEntries.createdAt))
    .limit(200)
    .all();

  const piiColumns = sourceIds.length
    ? db
        .select()
        .from(columnPermissions)
        .where(inArray(columnPermissions.dataSourceId, sourceIds))
        .all()
        .filter((c) => c.piiClassification && c.piiClassification !== 'none')
    : [];

  return NextResponse.json({ sources, permissions, settings, audits, piiColumns });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const { workspaceId } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const existing = db
    .select()
    .from(approvalSettings)
    .where(eq(approvalSettings.workspaceId, workspaceId))
    .get();

  const allowed = [
    'policyExecuteQuery',
    'policyShareResults',
    'policyWriteToDocs',
    'policySchemaIntrospect',
    'approvalTimeoutSec',
    'defaultPermissionTierNewSource',
  ] as const;

  const patch: Record<string, unknown> = { updatedAt: now };
  for (const key of allowed) {
    if (body[key] !== undefined) patch[key] = body[key];
  }

  if (existing) {
    db.update(approvalSettings)
      .set(patch)
      .where(eq(approvalSettings.workspaceId, workspaceId))
      .run();
  } else {
    db.insert(approvalSettings)
      .values({ id: randomUUID(), workspaceId, createdAt: now, ...patch })
      .run();
  }

  return NextResponse.json({ ok: true });
}
