import { randomUUID } from 'node:crypto';
import type { ApprovalGateType, ApprovalGateDetails, ApprovalResult } from '@/core/types/permissions';
import { sseEmitter } from './streaming';
import { getAgentContext } from './context';

const TIMEOUT_MS = 300_000;

export { type ApprovalResult };

export class ApprovalDeniedError extends Error {
  constructor(
    public readonly code: 'APPROVAL_DENIED' | 'APPROVAL_TIMEOUT',
    message: string,
  ) {
    super(message);
    this.name = 'ApprovalDeniedError';
  }
}

type PendingGate = {
  resolve: (value: ApprovalResult) => void;
  timeoutId: ReturnType<typeof setTimeout>;
  workspaceId: string;
  sessionId: string;
  gateType: ApprovalGateType;
};

const pendingGates = new Map<string, PendingGate>();
const resolvedIds = new Set<string>();

function describeGate(gateType: ApprovalGateType, details: ApprovalGateDetails): string {
  switch (gateType) {
    case 'execute_query':
      return `Run query on ${(details as { dataSourceName: string }).dataSourceName}`;
    case 'share_results_with_ai':
      return `Share ${(details as { rowCount: number }).rowCount} rows with AI`;
    case 'write_model_file':
      return `Write model file: ${(details as { modelName: string }).modelName}`;
    case 'write_test_file':
      return `Write test for: ${(details as { modelName: string }).modelName}`;
    case 'write_to_docs':
      return `Document ${(details as { recordType: string }).recordType}: ${(details as { name: string }).name}`;
  }
}

export function awaitApproval(
  gateType: ApprovalGateType,
  details: ApprovalGateDetails,
  options?: { timeoutMs?: number; description?: string },
): { promise: Promise<ApprovalResult>; requestId: string } {
  const ctx = getAgentContext();
  const requestId = randomUUID();
  const timeoutMs = options?.timeoutMs ?? TIMEOUT_MS;
  const description = options?.description ?? describeGate(gateType, details);
  const now = new Date().toISOString();
  const timeoutAt = new Date(Date.now() + timeoutMs).toISOString();

  const promise = new Promise<ApprovalResult>((resolve) => {
    const timeoutId = setTimeout(() => {
      pendingGates.delete(requestId);
      sseEmitter.emit(ctx.workspaceId, {
        type: 'approval_resolved',
        sessionId: ctx.sessionId,
        workspaceId: ctx.workspaceId,
        timestamp: new Date().toISOString(),
        payload: { requestId, decision: 'denied', gateType },
      });
      resolve({ decision: 'denied', requestId });
    }, timeoutMs);

    pendingGates.set(requestId, {
      workspaceId: ctx.workspaceId,
      sessionId: ctx.sessionId,
      gateType,
      resolve: (result) => {
        clearTimeout(timeoutId);
        pendingGates.delete(requestId);
        resolvedIds.add(requestId);
        resolve(result);
      },
      timeoutId,
    });

    sseEmitter.emit(ctx.workspaceId, {
      type: 'approval_required',
      sessionId: ctx.sessionId,
      workspaceId: ctx.workspaceId,
      timestamp: now,
      payload: { requestId, gateType, agentName: ctx.agentName, description, details, timeoutAt },
    });
  });

  return { promise, requestId };
}

export function hasPendingGate(requestId: string): boolean {
  return pendingGates.has(requestId);
}

export function wasAlreadyResolved(requestId: string): boolean {
  return resolvedIds.has(requestId);
}

export function resolveApproval(requestId: string, decision: 'approved' | 'denied', reason?: string): void {
  const gate = pendingGates.get(requestId);
  if (!gate) return;

  sseEmitter.emit(gate.workspaceId, {
    type: 'approval_resolved',
    sessionId: gate.sessionId,
    workspaceId: gate.workspaceId,
    timestamp: new Date().toISOString(),
    payload: { requestId, decision, gateType: gate.gateType, ...(reason ? { reason } : {}) },
  });

  gate.resolve({ decision, requestId });
}

export function cleanupPendingGates(): void {
  const entries = Array.from(pendingGates.entries());
  pendingGates.clear();
  for (const [requestId, gate] of entries) {
    clearTimeout(gate.timeoutId);
    gate.resolve({ decision: 'denied', requestId });
  }
}
