import { createHash } from 'node:crypto';
import { db } from '@/core/db/client';
import { approvalSettings } from '@/core/db/schema';
import { eq } from 'drizzle-orm';
import { getAdapterForSource } from '@/modules/ainderstanding/connect/lib/adapters/get-adapter';
import {
  validateSelectOnly,
  SqlRejectedErr,
  extractTableRefs,
  injectLimit,
} from '@/modules/ainderstanding/connect/lib/sql-gate';
import {
  getEffectivePermission,
  TIER_RANK,
} from '@/modules/ainderstanding/govern/lib/permission-service';
import { loadPiiColumnsForTable, maskRow } from '@/modules/ainderstanding/govern/lib/pii-masking';
import { log } from '@/modules/ainderstanding/govern/lib/audit-logger';
import { insertHistory } from './query-history';
import { updateSession } from './query-sessions';

const HARD_CAP = 5000;

type ExecuteResult =
  | { ok: true; columns: string[]; rows: Record<string, unknown>[]; rowCount: number; durationMs: number; truncated: boolean; historyId: string }
  | { ok: false; error: 'sql_rejected'; reason: string; statementType?: string; historyId: string }
  | { ok: false; error: 'permission_denied'; tier: string; offendingTables: string[]; reason: string; historyId: string }
  | { ok: false; error: 'query_failed' | 'timeout'; detail: string; historyId: string };

export async function executeQuery(params: {
  sessionId: string;
  workspaceId: string;
  dataSourceId: string;
  sql: string;
}): Promise<ExecuteResult> {
  const { sessionId, workspaceId, dataSourceId, sql } = params;
  const sqlHash = createHash('sha256').update(sql).digest('hex');

  const settings = db
    .select({ queryResultsMaxRows: approvalSettings.queryResultsMaxRows })
    .from(approvalSettings)
    .where(eq(approvalSettings.workspaceId, workspaceId))
    .get();
  const cap = Math.min(settings?.queryResultsMaxRows ?? 1000, HARD_CAP);

  // Step 1 — sql-gate validation
  try {
    validateSelectOnly(sql);
  } catch (err) {
    if (err instanceof SqlRejectedErr) {
      const historyId = insertHistory({
        sessionId,
        workspaceId,
        dataSourceId,
        sqlText: sql,
        sqlHash,
        outcome: 'blocked_sqlgate',
        errorMessage: err.structured.reason,
      });
      log({
        workspaceId,
        dataSourceId,
        sessionId,
        agentName: 'user',
        actionType: 'run_query',
        sqlHash,
        outcome: 'blocked',
        detail: { reason: err.structured.reason, statementType: err.structured.statement_type },
      });
      return { ok: false, error: 'sql_rejected', reason: err.structured.reason, statementType: err.structured.statement_type, historyId };
    }
    throw err;
  }

  // Step 2 — table ref extraction + tier check
  const tables = extractTableRefs(sql);
  const offending = tables.filter(
    (t) => TIER_RANK[getEffectivePermission(dataSourceId, t)] < TIER_RANK['with_query_results'],
  );

  if (offending.length > 0) {
    const effectiveTier = getEffectivePermission(dataSourceId, offending[0]);
    const historyId = insertHistory({
      sessionId,
      workspaceId,
      dataSourceId,
      sqlText: sql,
      sqlHash,
      outcome: 'blocked_tier',
      errorMessage: `Tables with insufficient tier: ${offending.join(', ')}`,
    });
    log({
      workspaceId,
      dataSourceId,
      sessionId,
      agentName: 'user',
      actionType: 'run_query',
      sqlHash,
      outcome: 'blocked',
      detail: { offendingTables: offending, effectiveTier },
    });
    return {
      ok: false,
      error: 'permission_denied',
      tier: effectiveTier,
      offendingTables: offending,
      reason: `Tables [${offending.join(', ')}] require tier with_query_results. Adjust access in Govern settings.`,
      historyId,
    };
  }

  // Step 3 — build PII union
  type PiiInfo = { columnName: string; piiSubtype: string | null; piiClassification: string | null };
  const piiUnion = new Map<string, PiiInfo>();
  const PII_RANK: Record<string, number> = { none: 0, pii: 1, sensitive: 2 };
  for (const tableName of tables) {
    for (const col of loadPiiColumnsForTable(dataSourceId, tableName)) {
      const existing = piiUnion.get(col.columnName);
      const existingRank = existing ? (PII_RANK[existing.piiClassification ?? 'none'] ?? 0) : -1;
      const newRank = PII_RANK[col.piiClassification ?? 'none'] ?? 0;
      if (newRank > existingRank) piiUnion.set(col.columnName, col);
    }
  }

  // Step 4 — inject limit
  const finalSql = injectLimit(sql, cap);

  // Step 5 — execute
  const start = Date.now();
  try {
    const { adapter } = getAdapterForSource(dataSourceId);
    const result = await adapter.executeSelect(finalSql);
    const durationMs = Date.now() - start;

    const piiCols = Array.from(piiUnion.values());
    const rows = result.rows.map((row) => {
      const normalized = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]),
      );
      return maskRow(normalized, piiCols);
    });

    const historyId = insertHistory({
      sessionId,
      workspaceId,
      dataSourceId,
      sqlText: sql,
      sqlHash,
      outcome: 'success',
      rowCount: result.rowCount,
      durationMs,
      resultColumnsJson: JSON.stringify(result.columns),
    });

    updateSession(sessionId, workspaceId, { sqlDraft: sql });

    log({
      workspaceId,
      dataSourceId,
      sessionId,
      agentName: 'user',
      actionType: 'run_query',
      tableName: tables.join(','),
      columnNames: result.columns,
      sqlHash,
      outcome: 'allowed',
    });

    return {
      ok: true,
      columns: result.columns,
      rows,
      rowCount: result.rowCount,
      durationMs,
      truncated: result.rowCount === cap,
      historyId,
    };
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const detail = String(err);
    const isTimeout = detail.toLowerCase().includes('timeout');
    const outcome = isTimeout ? 'timeout' : 'error';

    const historyId = insertHistory({
      sessionId,
      workspaceId,
      dataSourceId,
      sqlText: sql,
      sqlHash,
      outcome,
      durationMs,
      errorMessage: detail,
    });

    log({
      workspaceId,
      dataSourceId,
      sessionId,
      agentName: 'user',
      actionType: 'run_query',
      sqlHash,
      outcome: 'blocked',
      detail: { error: detail },
    });

    return { ok: false, error: isTimeout ? 'timeout' : 'query_failed', detail, historyId };
  }
}
