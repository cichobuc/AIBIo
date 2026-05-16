import { tryGetAgentContext } from '@/core/orchestration/context';
import { log } from './audit-logger';
import { maskRows } from './pii-masking';
import type { QueryResult } from '@/core/types/workspace';

type ProfileTableInput = {
  dataSourceId: string;
  tableName: string;
  adapter: {
    executeSelect(sql: string): Promise<QueryResult>;
  };
  sql?: string;
};

// Direct access for profiling system operations — no approval gate.
// Called only from Explore run_profile_query MCP tool handler.
export async function profileTable(input: ProfileTableInput): Promise<QueryResult> {
  const ctx = tryGetAgentContext();
  const sessionId = ctx?.sessionId ?? 'system';
  const agentName = ctx?.agentName ?? 'data-profiler';
  const workspaceId = ctx?.workspaceId ?? 'system';

  const sql = input.sql ?? `SELECT * FROM "${input.tableName}" LIMIT 1000`;
  const result = await input.adapter.executeSelect(sql);

  const maskedRows = maskRows(result.rows, input.dataSourceId, input.tableName);

  log({
    workspaceId,
    dataSourceId: input.dataSourceId,
    sessionId,
    agentName,
    actionType: 'read_sample',
    tableName: input.tableName,
    outcome: 'allowed',
    detail: { mode: 'profiling', rowCount: result.rowCount },
  });

  return { columns: result.columns, rows: maskedRows, rowCount: maskedRows.length };
}
