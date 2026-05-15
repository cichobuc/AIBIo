'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/core/ui';

type Props = {
  toolName: string;
  toolCallId: string;
  result?: { success: boolean; summary: string };
};

export function ToolCallChip({ toolName, toolCallId, result }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded border border-border bg-secondary/50 text-caption">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span className="font-mono">{toolName}</span>
        {result && (
          result.success
            ? <CheckCircle className="ml-auto h-3 w-3 text-layer-1" />
            : <XCircle className="ml-auto h-3 w-3 text-layer-3" />
        )}
      </button>
      {open && result && (
        <div className={cn('border-t border-border px-2 py-1 font-mono', result.success ? 'text-layer-1/80' : 'text-layer-3/80')}>
          {result.summary}
        </div>
      )}
    </div>
  );
}
