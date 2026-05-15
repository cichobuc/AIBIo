'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/core/ui';

type Props = {
  requestId: string;
  agentName: string;
  description: string;
  onApprove: (requestId: string, decision: 'approved' | 'denied') => void;
};

export function ApprovalRequiredCard({ requestId, agentName, description, onApprove }: Props) {
  return (
    <div className="rounded-lg border border-layer-2/50 bg-layer-2/10 p-3">
      <div className="flex items-start gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-layer-2 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-body font-medium text-foreground">Approval required</p>
          <p className="text-caption text-muted-foreground">
            <span className="font-mono text-accent-ai">{agentName}</span> — {description}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-7 text-caption bg-layer-1/20 text-layer-1 border border-layer-1/50 hover:bg-layer-1/30"
          onClick={() => onApprove(requestId, 'approved')}
        >
          Allow once
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-caption text-muted-foreground hover:text-foreground"
          onClick={() => onApprove(requestId, 'denied')}
        >
          Deny
        </Button>
      </div>
    </div>
  );
}
