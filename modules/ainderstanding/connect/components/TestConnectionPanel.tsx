'use client';

import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { ConnectionTestResult } from '@/core/types/workspace';

type Props = {
  result: ConnectionTestResult | null;
  loading: boolean;
};

export function TestConnectionPanel({ result, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-4 py-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Testing connection...</span>
      </div>
    );
  }

  if (!result) return null;

  if (result.success) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-green-500/40 bg-green-500/10 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
        <div className="flex-1">
          <span className="text-sm font-medium text-green-300">Connected</span>
          {result.latencyMs !== undefined && (
            <span className="ml-2 text-xs text-muted-foreground">{result.latencyMs}ms</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3">
      <div className="flex items-center gap-3">
        <XCircle className="h-4 w-4 shrink-0 text-red-400" />
        <span className="text-sm font-medium text-red-300">
          Failed at: {result.step}
        </span>
      </div>
      {result.error && (
        <p className="mt-1.5 pl-7 text-xs text-muted-foreground">{result.error}</p>
      )}
      {result.detail && (
        <p className="mt-0.5 pl-7 text-xs text-muted-foreground opacity-75">{result.detail}</p>
      )}
    </div>
  );
}
