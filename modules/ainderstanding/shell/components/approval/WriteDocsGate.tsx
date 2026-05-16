'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';

type Props = {
  agentName: string;
  recordType: string;
  name: string;
  description: string;
  countdown: string;
  onApprove: () => void;
  onDeny: () => void;
};

export function WriteDocsGate({ agentName, recordType, name, description, countdown, onApprove, onDeny }: Props) {
  return (
    <div className="border-t border-layer-2/50 bg-layer-2/10 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-layer-2 shrink-0" />
        <div className="flex-1 min-w-0 space-y-0.5">
          <span className="text-body text-foreground">
            <span className="font-mono text-accent-ai">{agentName}</span>
            {' wants to write '}
            <Badge variant="secondary" className="text-[10px]">{recordType}</Badge>
            {' '}
            <span className="font-medium">{name}</span>
          </span>
          {description && (
            <p className="text-[11px] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-caption text-layer-2">{countdown}</span>
          <Button
            size="sm"
            className="h-7 text-caption bg-layer-1/20 text-layer-1 border border-layer-1/50 hover:bg-layer-1/30"
            onClick={onApprove}
          >
            Approve
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-caption" onClick={onDeny}>Deny</Button>
        </div>
      </div>
    </div>
  );
}
