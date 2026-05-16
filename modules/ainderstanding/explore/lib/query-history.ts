import { randomUUID } from 'node:crypto';
import { db } from '@/core/db/client';
import { queryHistory, type QueryHistoryOutcome } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

export type QueryHistoryRow = typeof queryHistory.$inferSelect;

type InsertHistoryParams = {
  sessionId: string | null;
  workspaceId: string;
  dataSourceId: string;
  sqlText: string;
  sqlHash: string;
  outcome: QueryHistoryOutcome;
  rowCount?: number | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  resultColumnsJson?: string | null;
};

export function insertHistory(params: InsertHistoryParams): string {
  const id = randomUUID();
  db.insert(queryHistory)
    .values({
      id,
      sessionId: params.sessionId,
      workspaceId: params.workspaceId,
      dataSourceId: params.dataSourceId,
      sqlText: params.sqlText,
      sqlHash: params.sqlHash,
      outcome: params.outcome,
      rowCount: params.rowCount ?? null,
      durationMs: params.durationMs ?? null,
      errorMessage: params.errorMessage ?? null,
      resultColumnsJson: params.resultColumnsJson ?? null,
    })
    .run();
  return id;
}

export function getHistory(workspaceId: string, limit = 50, offset = 0): QueryHistoryRow[] {
  return db
    .select()
    .from(queryHistory)
    .where(eq(queryHistory.workspaceId, workspaceId))
    .orderBy(desc(queryHistory.executedAt))
    .limit(limit)
    .offset(offset)
    .all();
}

export function getSessionHistory(sessionId: string, workspaceId: string): QueryHistoryRow[] {
  return db
    .select()
    .from(queryHistory)
    .where(and(eq(queryHistory.sessionId, sessionId), eq(queryHistory.workspaceId, workspaceId)))
    .orderBy(desc(queryHistory.executedAt))
    .limit(100)
    .all();
}
