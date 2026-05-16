'use client';

import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { ExecuteQueryGate } from './approval/ExecuteQueryGate';
import { ShareResultsGate } from './approval/ShareResultsGate';
import { WriteFileGate } from './approval/WriteFileGate';
import { WriteDocsGate } from './approval/WriteDocsGate';
import { SqlDiffApprovalDialog } from '../../model/components/SqlDiffApprovalDialog';

function useCountdown(timeoutAt: string | undefined): { display: string; remaining: number } {
  const [remaining, setRemaining] = useState(300);

  useEffect(() => {
    if (!timeoutAt) return;
    const update = () => {
      const secs = Math.max(0, Math.round((new Date(timeoutAt).getTime() - Date.now()) / 1000));
      setRemaining(secs);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [timeoutAt]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return { display: `${mins}:${secs.toString().padStart(2, '0')}`, remaining };
}

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

  return null;
}
