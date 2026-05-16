import { notFound } from 'next/navigation';
import { db } from '@/core/db/client';
import {
  dataSources,
  auditEntries,
  columnMetadata,
  workspaces,
} from '@/core/db/schema';
import { and, eq, desc, gte, inArray, like } from 'drizzle-orm';
import { GovernPageClient } from './GovernPageClient';
import type { PiiInventoryRow } from '@/modules/ainderstanding/govern/components/PIIInventoryDashboard';
import type { AuditEntryFull } from '@/modules/ainderstanding/govern/components/AuditEntryDetailSheet';
import type { AuditActionType, AuditOutcome } from '@/modules/ainderstanding/govern/db/schema';

const AUDIT_LIMIT = 200;
const AUDIT_FILTER_KEYS = ['agent', 'action', 'outcome', 'from', 'q'] as const;

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

  const sources = db
    .select({ id: dataSources.id, name: dataSources.name })
    .from(dataSources)
    .where(eq(dataSources.workspaceId, workspaceId))
    .all();

  const sourceIds = sources.map((s) => s.id);

  const auditFiltersArr = [eq(auditEntries.workspaceId, workspaceId)];
  const qAgent = sp.agent;
  const qAction = sp.action as AuditActionType | undefined;
  const qOutcome = sp.outcome as AuditOutcome | undefined;
  const qFrom = sp.from;
  const qSearch = sp.q;
  if (qAgent) auditFiltersArr.push(eq(auditEntries.agentName, qAgent));
  if (qAction) auditFiltersArr.push(eq(auditEntries.actionType, qAction));
  if (qOutcome) auditFiltersArr.push(eq(auditEntries.outcome, qOutcome));
  if (qFrom) auditFiltersArr.push(gte(auditEntries.createdAt, qFrom));
  if (qSearch) auditFiltersArr.push(like(auditEntries.tableName, `%${qSearch}%`));

  const audits = db
    .select()
    .from(auditEntries)
    .where(and(...auditFiltersArr))
    .orderBy(desc(auditEntries.createdAt))
    .limit(AUDIT_LIMIT)
    .all() as AuditEntryFull[];

  const piiColumns = (
    sourceIds.length
      ? db
          .select()
          .from(columnMetadata)
          .where(inArray(columnMetadata.dataSourceId, sourceIds))
          .all()
          .filter((c) => c.piiClassification && c.piiClassification !== 'none')
      : []
  ) as PiiInventoryRow[];

  const auditFilters: { agent?: string; action?: string; outcome?: string; q?: string } = {};
  for (const key of AUDIT_FILTER_KEYS) {
    if (key !== 'from' && sp[key]) auditFilters[key as keyof typeof auditFilters] = sp[key];
  }

  const highlight =
    sp.source && sp.table && sp.column
      ? { dataSourceId: sp.source, tableName: sp.table, columnName: sp.column }
      : undefined;

  return (
    <GovernPageClient
      workspaceId={workspaceId}
      sources={sources}
      audits={audits}
      piiColumns={piiColumns}
      auditFilters={auditFilters}
      defaultTab={sp.tab}
      highlight={highlight}
    />
  );
}
