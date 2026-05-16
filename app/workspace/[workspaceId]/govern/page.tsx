import { notFound } from 'next/navigation';
import { db } from '@/core/db/client';
import {
  dataSources,
  sourcePermissions,
  tablePermissions,
  approvalSettings,
  auditEntries,
  columnPermissions,
  workspaces,
} from '@/core/db/schema';
import { and, eq, desc, gte, inArray, like } from 'drizzle-orm';
import { GovernPageClient } from './GovernPageClient';
import type {
  SourcePermissionRow,
  TablePermissionRow,
  ApprovalSettingsRow,
} from '@/modules/ainderstanding/govern/components/PermissionsPanel';
import type { PiiInventoryRow } from '@/modules/ainderstanding/govern/components/PIIInventoryDashboard';
import type { AuditEntryFull } from '@/modules/ainderstanding/govern/components/AuditEntryDetailSheet';
import type { AuditActionType, AuditOutcome } from '@/modules/ainderstanding/govern/db/schema';

const AUDIT_LIMIT = 200;
const AUDIT_FILTER_KEYS = ['agent', 'action', 'outcome', 'from', 'q'] as const;

function getGovernData(
  workspaceId: string,
  sp: Record<string, string>,
): {
  sources: { id: string; name: string }[];
  permissions: SourcePermissionRow[];
  tablePerms: TablePermissionRow[];
  settings: ApprovalSettingsRow | null;
  audits: AuditEntryFull[];
  piiColumns: PiiInventoryRow[];
} {
  const sources = db
    .select({ id: dataSources.id, name: dataSources.name })
    .from(dataSources)
    .where(eq(dataSources.workspaceId, workspaceId))
    .all();

  const sourceIds = sources.map((s) => s.id);

  const permissions = (
    sourceIds.length
      ? db.select().from(sourcePermissions).where(inArray(sourcePermissions.dataSourceId, sourceIds)).all()
      : []
  ) as SourcePermissionRow[];

  const tablePerms = (
    sourceIds.length
      ? db.select().from(tablePermissions).where(inArray(tablePermissions.dataSourceId, sourceIds)).all()
      : []
  ) as TablePermissionRow[];

  const settings = (db
    .select()
    .from(approvalSettings)
    .where(eq(approvalSettings.workspaceId, workspaceId))
    .get() ?? null) as ApprovalSettingsRow | null;

  const auditFilters = [eq(auditEntries.workspaceId, workspaceId)];
  const qAgent = sp.agent;
  const qAction = sp.action as AuditActionType | undefined;
  const qOutcome = sp.outcome as AuditOutcome | undefined;
  const qFrom = sp.from;
  const qSearch = sp.q;
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
    .limit(AUDIT_LIMIT)
    .all() as AuditEntryFull[];

  const piiColumns = (
    sourceIds.length
      ? db
          .select()
          .from(columnPermissions)
          .where(inArray(columnPermissions.dataSourceId, sourceIds))
          .all()
          .filter((c) => c.piiClassification && c.piiClassification !== 'none')
      : []
  ) as PiiInventoryRow[];

  return { sources, permissions, tablePerms, settings, audits, piiColumns };
}

export default async function GovernPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { workspaceId } = await params;
  const sp = await searchParams;

  const ws = db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!ws) notFound();

  const { sources, permissions, tablePerms, settings, audits, piiColumns } = getGovernData(workspaceId, sp);

  const auditFilters: { agent?: string; action?: string; outcome?: string; q?: string } = {};
  for (const key of AUDIT_FILTER_KEYS) {
    if (key !== 'from' && sp[key]) auditFilters[key as keyof typeof auditFilters] = sp[key];
  }

  return (
    <GovernPageClient
      workspaceId={workspaceId}
      sources={sources}
      permissions={permissions}
      tablePermissions={tablePerms}
      settings={settings}
      audits={audits}
      piiColumns={piiColumns}
      auditFilters={auditFilters}
    />
  );
}
