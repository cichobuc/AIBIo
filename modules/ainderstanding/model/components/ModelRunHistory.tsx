'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Badge, cn } from '@/core/ui';
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, Play } from 'lucide-react';
import type { ModelRun, ModelRunStatus } from '../db/schema';

interface Props {
  workspaceId: string;
  onBuildAll?: () => void;
  building?: boolean;
}

const STATUS_ICON: Record<ModelRunStatus, React.ReactNode> = {
  pending: <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />,
  running: <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />,
  success: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
  failed: <XCircle className="w-3.5 h-3.5 text-destructive" />,
  approval_denied: <XCircle className="w-3.5 h-3.5 text-yellow-500" />,
};

function formatDuration(start: string, end?: string | null): string {
  if (!end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ModelRunHistory({ workspaceId, onBuildAll, building }: Props) {
  const [runs, setRuns] = useState<ModelRun[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/model/${workspaceId}/runs`);
      if (res.ok) {
        const data = (await res.json()) as { runs: ModelRun[] };
        setRuns(data.runs);
      }
    } catch {
      // silent
    }
  }, [workspaceId]);

  useEffect(() => {
    void fetchRuns();
    const interval = setInterval(() => void fetchRuns(), 3000);
    return () => clearInterval(interval);
  }, [fetchRuns]);

  const toggleExpand = (runId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold">Model Runs</span>
        <Button
          variant="default"
          size="sm"
          className="h-6 text-xs gap-1"
          onClick={onBuildAll}
          disabled={building}
        >
          {building ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Play className="w-3 h-3" />
          )}
          Build All
        </Button>
      </div>

      {runs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
          No runs yet. Click &quot;Build All&quot; to start.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {runs.map((run) => {
            const affectedModels = run.modelsAffectedJson
              ? (JSON.parse(run.modelsAffectedJson) as string[])
              : [];
            const isExpanded = expanded.has(run.id);

            return (
              <div key={run.id} className="text-xs">
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-accent/50 text-left"
                  onClick={() => toggleExpand(run.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 shrink-0" />
                  )}
                  {STATUS_ICON[run.status]}
                  <span className="text-muted-foreground tabular-nums">
                    {new Date(run.startedAt).toLocaleTimeString()}
                  </span>
                  <span className="flex-1 truncate">
                    {run.runScope === 'all' ? 'Full build' : `Single: ${affectedModels[0] ?? '?'}`}
                  </span>
                  {run.modelsTotal !== null && (
                    <span
                      className={cn(
                        run.status === 'success' ? 'text-green-500' : 'text-muted-foreground',
                      )}
                    >
                      {run.modelsSucceeded ?? 0}/{run.modelsTotal}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {formatDuration(run.startedAt, run.finishedAt)}
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-7 pb-2 space-y-1">
                    {affectedModels.map((name) => (
                      <div key={name} className="flex items-center gap-2 text-muted-foreground">
                        <span className="font-mono">{name}</span>
                      </div>
                    ))}
                    {run.errorMessage && (
                      <p className="text-destructive mt-1 font-mono whitespace-pre-wrap break-words">
                        {run.errorMessage}
                      </p>
                    )}
                    {run.selfHealAttempt > 0 && (
                      <p className="text-yellow-500">
                        Self-heal attempt {run.selfHealAttempt}/3
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
