'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/core/ui/button';

type Props = {
  agentName: string;
  sql: string;
  dataSourceName: string;
  countdown: string;
  onApprove: () => void;
  onDeny: () => void;
};

export function ExecuteQueryGate({ agentName, sql, dataSourceName, countdown, onApprove, onDeny }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-layer-2/50 bg-layer-2/10 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-layer-2 shrink-0" />
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-body text-foreground">
              <span className="font-mono text-accent-ai">{agentName}</span>
              {' wants to run a query on '}
              <span className="font-medium">{dataSourceName}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1 text-[10px] text-muted-foreground"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Hide SQL' : 'View SQL'}
            </Button>
          </div>
          {expanded && (
            <pre className="text-[11px] font-mono bg-secondary border border-border rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap">
              {sql}
            </pre>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-caption text-layer-2">{countdown}</span>
          <Button
            size="sm"
            className="h-7 text-caption bg-layer-1/20 text-layer-1 border border-layer-1/50 hover:bg-layer-1/30"
            onClick={onApprove}
          >
            Execute
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-caption" onClick={onDeny}>Deny</Button>
        </div>
      </div>
    </div>
  );
}
