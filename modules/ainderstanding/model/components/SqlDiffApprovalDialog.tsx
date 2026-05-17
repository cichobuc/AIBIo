'use client';

import { SqlDiffDialog } from '@/core/ui/sql-diff-dialog';

interface Props {
  agentName: string;
  modelName: string;
  layer: string;
  newSql: string;
  previousSql?: string;
  countdown: string;
  remainingSec: number;
  onApprove: (finalSql?: string) => void | Promise<void>;
  onDeny: () => void;
}

export function SqlDiffApprovalDialog({
  agentName,
  modelName,
  layer,
  newSql,
  previousSql,
  countdown,
  remainingSec,
  onApprove,
  onDeny,
}: Props) {
  return (
    <SqlDiffDialog
      agentName={agentName}
      title="Write Model File"
      subtitle={`${modelName}.sql`}
      badge={layer}
      newSql={newSql}
      previousSql={previousSql}
      countdown={countdown}
      remainingSec={remainingSec}
      approveLabel="Approve & Write File"
      onApprove={onApprove}
      onDeny={onDeny}
    />
  );
}
