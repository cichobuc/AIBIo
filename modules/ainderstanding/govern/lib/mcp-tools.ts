import { createHash } from 'node:crypto';
import type { SchemaSnapshot, NativeComment, QueryResult } from '@/core/types/workspace';
import { awaitApproval, ApprovalDeniedError } from '@/core/orchestration/approval-gate';
import { getAgentContext } from '@/core/orchestration/context';
import { log } from './audit-logger';
import { getEffectivePermission, TIER_RANK } from './permission-service';
import { maskRows, loadPiiColumnsForTable, maskRow } from './pii-masking';
import { storeResult, getResult } from './result-cache';

type GuardedIntrospectInput = {
  dataSourceId: string;
  adapter: { introspectSchema(): Promise<SchemaSnapshot> };
};

// Layer 1 — always allowed (schema metadata)
export async function guardedIntrospectSchema(
  input: GuardedIntrospectInput,
): Promise<SchemaSnapshot> {
  const ctx = getAgentContext();

  try {
    const snapshot = await input.adapter.introspectSchema();
    log({
      workspaceId: ctx.workspaceId,
      dataSourceId: input.dataSourceId,
      sessionId: ctx.sessionId,
      agentName: ctx.agentName,
      actionType: 'read_schema',
      outcome: 'allowed',
    });
    return snapshot;
  } catch (err) {
    log({
      workspaceId: ctx.workspaceId,
      dataSourceId: input.dataSourceId,
      sessionId: ctx.sessionId,
      agentName: ctx.agentName,
      actionType: 'read_schema',
      outcome: 'blocked',
      detail: { error: String(err) },
    });
    throw err;
  }
}

type GuardedReadNativeCommentsInput = {
  dataSourceId: string;
  adapter: { readNativeComments(): Promise<NativeComment[]> };
};

// Layer 1 — always allowed (metadata)
export async function guardedReadNativeComments(
  input: GuardedReadNativeCommentsInput,
): Promise<NativeComment[]> {
  const ctx = getAgentContext();

  try {
    const comments = await input.adapter.readNativeComments();
    log({
      workspaceId: ctx.workspaceId,
      dataSourceId: input.dataSourceId,
      sessionId: ctx.sessionId,
      agentName: ctx.agentName,
      actionType: 'read_schema',
      outcome: 'allowed',
      detail: { sub: 'native_comments' },
    });
    return comments;
  } catch (err) {
    log({
      workspaceId: ctx.workspaceId,
      dataSourceId: input.dataSourceId,
      sessionId: ctx.sessionId,
      agentName: ctx.agentName,
      actionType: 'read_schema',
      outcome: 'blocked',
      detail: { sub: 'native_comments', error: String(err) },
    });
    throw err;
  }
}

type GuardedSampleDataInput = {
  dataSourceId: string;
  tableName: string;
  isReferenceTable: boolean;
  adapter: { executeSelect(sql: string): Promise<QueryResult> };
};

// Layer 2 — requires permission tier >= with_reference_samples AND isReferenceTable
export async function guardedSampleData(
  input: GuardedSampleDataInput,
): Promise<QueryResult> {
  const ctx = getAgentContext();
  const tier = getEffectivePermission(input.dataSourceId, input.tableName);
  const allowed = TIER_RANK[tier] >= TIER_RANK['with_reference_samples'] && input.isReferenceTable;

  if (!allowed) {
    log({
      workspaceId: ctx.workspaceId,
      dataSourceId: input.dataSourceId,
      sessionId: ctx.sessionId,
      agentName: ctx.agentName,
      actionType: 'read_sample',
      tableName: input.tableName,
      outcome: 'blocked',
      detail: { tier, isReferenceTable: input.isReferenceTable },
    });
    throw new Error(
      `SAMPLE_DENIED: table '${input.tableName}' requires permission >= with_reference_samples and must be a reference table (current tier: ${tier}, isReference: ${input.isReferenceTable})`,
    );
  }

  const sql = `SELECT * FROM "${input.tableName}" LIMIT 100`;
  const result = await input.adapter.executeSelect(sql);
  const maskedRows = maskRows(result.rows, input.dataSourceId, input.tableName);

  log({
    workspaceId: ctx.workspaceId,
    dataSourceId: input.dataSourceId,
    sessionId: ctx.sessionId,
    agentName: ctx.agentName,
    actionType: 'read_sample',
    tableName: input.tableName,
    outcome: 'allowed',
    detail: { rowCount: result.rowCount },
  });

  return { columns: result.columns, rows: maskedRows, rowCount: maskedRows.length };
}

type GuardedRunSelectQueryInput = {
  dataSourceId: string;
  dataSourceName: string;
  sql: string;
  adapter: { executeSelect(sql: string): Promise<QueryResult> };
};

type SelectQueryMeta = {
  rowCount: number;
  columns: string[];
  resultHandle: string;
};

// Layer 3 — requires approval gate, returns only metadata (never raw rows)
export async function guardedRunSelectQuery(
  input: GuardedRunSelectQueryInput,
): Promise<SelectQueryMeta> {
  const ctx = getAgentContext();
  const sqlHash = createHash('sha256').update(input.sql).digest('hex');

  const { promise, requestId } = awaitApproval('execute_query', {
    sql: input.sql,
    dataSourceName: input.dataSourceName,
  });

  const approval = await promise;

  if (approval.decision === 'denied') {
    log({
      workspaceId: ctx.workspaceId,
      dataSourceId: input.dataSourceId,
      sessionId: ctx.sessionId,
      agentName: ctx.agentName,
      actionType: 'run_query',
      sqlHash,
      outcome: 'approval_denied',
      detail: { requestId },
    });
    throw new ApprovalDeniedError('APPROVAL_DENIED', 'User denied query execution');
  }

  const result = await input.adapter.executeSelect(input.sql);
  const resultHandle = storeResult(ctx.sessionId, result.rows, result.columns);

  log({
    workspaceId: ctx.workspaceId,
    dataSourceId: input.dataSourceId,
    sessionId: ctx.sessionId,
    agentName: ctx.agentName,
    actionType: 'run_query',
    sqlHash,
    outcome: 'approval_granted',
    detail: { requestId, rowCount: result.rowCount, resultHandle },
  });

  return { rowCount: result.rowCount, columns: result.columns, resultHandle };
}

type GuardedShareResultsInput = {
  dataSourceId: string;
  tableName?: string;
  resultHandle: string;
};

// Layer 3 — requires second approval; reads from result-cache, applies PII masking
export async function guardedShareResults(
  input: GuardedShareResultsInput,
): Promise<QueryResult> {
  const ctx = getAgentContext();

  const cached = getResult(input.resultHandle, ctx.sessionId);
  if (!cached) {
    throw new Error('RESULT_EXPIRED: result handle expired or belongs to a different session');
  }

  const { promise, requestId } = awaitApproval('share_results_with_ai', {
    rowCount: cached.rowCount,
    columns: cached.columns,
    queryPreview: `${cached.rowCount} rows × ${cached.columns.length} columns`,
  });

  const approval = await promise;

  if (approval.decision === 'denied') {
    log({
      workspaceId: ctx.workspaceId,
      dataSourceId: input.dataSourceId,
      sessionId: ctx.sessionId,
      agentName: ctx.agentName,
      actionType: 'share_results',
      outcome: 'approval_denied',
      detail: { requestId, resultHandle: input.resultHandle },
    });
    throw new ApprovalDeniedError('APPROVAL_DENIED', 'User denied sharing results with AI');
  }

  let rows = cached.rows;
  if (input.tableName) {
    const piiCols = loadPiiColumnsForTable(input.dataSourceId, input.tableName);
    rows = rows.map((row) => maskRow(row, piiCols));
  }

  log({
    workspaceId: ctx.workspaceId,
    dataSourceId: input.dataSourceId,
    sessionId: ctx.sessionId,
    agentName: ctx.agentName,
    actionType: 'share_results',
    outcome: 'approval_granted',
    detail: { requestId, rowCount: rows.length },
  });

  return { columns: cached.columns, rows, rowCount: rows.length };
}
