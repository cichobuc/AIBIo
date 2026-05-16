import { randomUUID } from 'node:crypto';
import { db } from '@/core/db/client';
import { auditEntries, type AuditActionType, type AuditOutcome } from '../db/schema';

type AuditEntry = {
  workspaceId: string;
  dataSourceId?: string;
  sessionId: string;
  agentName: string;
  actionType: AuditActionType;
  tableName?: string;
  columnNames?: string[];
  sqlHash?: string;
  outcome: AuditOutcome;
  detail?: Record<string, unknown>;
};

// BR-GOV-041/042: append-only, never update/delete, blocked ops also logged
export function log(entry: AuditEntry): void {
  db.insert(auditEntries)
    .values({
      id: randomUUID(),
      workspaceId: entry.workspaceId,
      dataSourceId: entry.dataSourceId ?? null,
      sessionId: entry.sessionId,
      agentName: entry.agentName,
      actionType: entry.actionType,
      tableName: entry.tableName ?? null,
      columnNamesJson: entry.columnNames ? JSON.stringify(entry.columnNames) : null,
      sqlHash: entry.sqlHash ?? null,
      outcome: entry.outcome,
      detailJson: entry.detail ? JSON.stringify(entry.detail) : null,
    })
    .run();
}
