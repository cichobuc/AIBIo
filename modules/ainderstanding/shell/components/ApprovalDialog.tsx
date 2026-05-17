'use client';

import { useWorkspaceStore } from '../store/workspace-store';
import { ExecuteQueryGate } from './approval/ExecuteQueryGate';
import { ShareResultsGate } from './approval/ShareResultsGate';
import { WriteFileGate } from './approval/WriteFileGate';
import { WriteDocsGate } from './approval/WriteDocsGate';
import { SqlDiffApprovalDialog } from '../../model/components/SqlDiffApprovalDialog';
import { SqlDiffDialog } from '@/core/ui/sql-diff-dialog';
import { useCountdown } from '../hooks/useCountdown';

async function resolveApproval(requestId: string, decision: 'approved' | 'denied', reason?: string) {
  await fetch(`/api/approvals/${requestId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, ...(reason ? { reason } : {}) }),
  });
}

export function ApprovalDialog() {
  const pendingApproval = useWorkspaceStore((s) => s.pendingApproval);
  const setPendingApproval = useWorkspaceStore((s) => s.setPendingApproval);
  const chatPanelOpen = useWorkspaceStore((s) => s.chatPanelOpen);
  const { display: countdown, remaining } = useCountdown(pendingApproval?.timeoutAt);

  if (!pendingApproval) return null;

  const approve = async (reason?: string) => {
    await resolveApproval(pendingApproval.requestId, 'approved', reason);
    setPendingApproval(null);
  };

  const deny = async () => {
    await resolveApproval(pendingApproval.requestId, 'denied');
    setPendingApproval(null);
  };

  const { gateType, agentName, details } = pendingApproval;

  if (gateType === 'execute_query') {
    const d = details as { sql: string; dataSourceName: string };
    return (
      <div className="fixed bottom-[54px] left-0 right-0 z-40">
        <ExecuteQueryGate
          agentName={agentName}
          sql={d.sql}
          dataSourceName={d.dataSourceName}
          countdown={countdown}
          onApprove={() => void approve()}
          onDeny={() => void deny()}
        />
      </div>
    );
  }

  if (gateType === 'write_to_docs') {
    const d = details as { recordType: string; name: string; description: string };
    return (
      <div className="fixed bottom-[54px] left-0 right-0 z-40">
        <WriteDocsGate
          agentName={agentName}
          recordType={d.recordType ?? 'doc'}
          name={d.name ?? ''}
          description={d.description ?? ''}
          countdown={countdown}
          onApprove={() => void approve()}
          onDeny={() => void deny()}
        />
      </div>
    );
  }

  if (gateType === 'share_results_with_ai') {
    const d = details as { rowCount: number; columns: string[]; queryPreview: string };
    return (
      <ShareResultsGate
        agentName={agentName}
        rowCount={d.rowCount}
        columns={d.columns}
        queryPreview={d.queryPreview}
        countdown={countdown}
        remainingSec={remaining}
        onApprove={(reason) => void approve(reason)}
        onDeny={() => void deny()}
      />
    );
  }

  if (gateType === 'write_model_file') {
    const d = details as { modelName: string; layer: string; sqlDiff: string; previousSql?: string };
    return (
      <SqlDiffApprovalDialog
        agentName={agentName}
        modelName={d.modelName ?? ''}
        layer={d.layer ?? ''}
        newSql={d.sqlDiff ?? ''}
        previousSql={d.previousSql ?? ''}
        countdown={countdown}
        remainingSec={remaining}
        onApprove={(finalSql) => void approve(finalSql)}
        onDeny={() => void deny()}
      />
    );
  }

  if (gateType === 'write_test_file') {
    type WTPayload = { testType: 'generic' | 'custom'; modelName: string; testPreview: string };
    return (
      <WriteFileGate
        agentName={agentName}
        gateType={gateType}
        payload={details as WTPayload}
        countdown={countdown}
        remainingSec={remaining}
        onApprove={(reason) => void approve(reason)}
        onDeny={() => void deny()}
      />
    );
  }

  if (gateType === 'edit_query_session') {
    // Inline card in chat handles this when chat panel is open — show floating fallback otherwise
    if (chatPanelOpen) return null;
    const d = details as { sessionId: string; sessionTitle: string; dataSourceName: string; previousSql: string; newSql: string };
    return (
      <SqlDiffDialog
        agentName={agentName}
        title="Edit Query Card"
        subtitle={`${d.sessionTitle} · ${d.dataSourceName}`}
        newSql={d.newSql}
        previousSql={d.previousSql}
        countdown={countdown}
        remainingSec={remaining}
        approveLabel="Approve & Apply"
        onApprove={(finalSql) => void approve(finalSql)}
        onDeny={() => void deny()}
      />
    );
  }

  return null;
}
