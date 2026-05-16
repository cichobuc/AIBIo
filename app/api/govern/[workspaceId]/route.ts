import { NextResponse } from 'next/server';
import { db } from '@/core/db/client';
import {
  dataSources,
  sourcePermissions,
  tablePermissions,
  approvalSettings,
  auditEntries,
  columnPermissions,
} from '@/core/db/schema';
import { and, eq, desc, gte, inArray, like } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { AuditActionType, AuditOutcome } from '@/modules/ainderstanding/govern/db/schema';

const AUDIT_LIMIT = 200;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const { workspaceId } = await params;
  const url = new URL(req.url);
  const qAgent = url.searchParams.get('agent');
  const qAction = url.searchParams.get('action') as AuditActionType | null;
  const qOutcome = url.searchParams.get('outcome') as AuditOutcome | null;
  const qFrom = url.searchParams.get('from');
  const qSearch = url.searchParams.get('q');
  const qLimit = Math.min(Number(url.searchParams.get('limit') ?? AUDIT_LIMIT), 500);

  const sources = db
    .select({ id: dataSources.id, name: dataSources.name })
    .from(dataSources)
    .where(eq(dataSources.workspaceId, workspaceId))
    .all();

  const sourceIds = sources.map((s) => s.id);

  const permissions = sourceIds.length
    ? db.select().from(sourcePermissions).where(inArray(sourcePermissions.dataSourceId, sourceIds)).all()
    : [];

  const tablePerms = sourceIds.length
    ? db.select().from(tablePermissions).where(inArray(tablePermissions.dataSourceId, sourceIds)).all()
    : [];

  const settings = db
    .select()
    .from(approvalSettings)
    .where(eq(approvalSettings.workspaceId, workspaceId))
    .get();

  const auditFilters = [eq(auditEntries.workspaceId, workspaceId)];
  if (qAgent) auditFilters.push(eq(auditEntries.agentName, qAgent));
  if (qAction) auditFilters.push(eq(auditEntries.actionType, qAction));
  if (qOutcome) auditFilters.push(eq(auditEntries.outcome, qOutcome));
  if (qFrom) auditFilters.push(gte(auditEntries.createdAt, qFrom));
  if (qSearch) auditFilters.push(like(auditEntries.tableName, `%${qSearch}%`));

  const audits = db
    .select()
    .from(auditEntries)
    .where(and(...auditFilters))
    .orderBy(desc(auditEntries.createdAt))
    .limit(qLimit)
    .all();

  const piiColumns = sourceIds.length
    ? db
        .select()
        .from(columnPermissions)
        .where(inArray(columnPermissions.dataSourceId, sourceIds))
        .all()
        .filter((c) => c.piiClassification && c.piiClassification !== 'none')
    : [];

  return NextResponse.json({ sources, permissions, tablePermissions: tablePerms, settings, audits, piiColumns });
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
