'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Play, Download, AlertTriangle, Clock, Info } from 'lucide-react';
import { Button, ScrollArea, Badge } from '@/core/ui';

type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  truncated: boolean;
  historyId: string;
};

type QueryError = {
  error: string;
  reason?: string;
  offendingTables?: string[];
  detail?: string;
};

type Props = {
  sessionId: string;
  sourceId: string;
  workspaceId: string;
  sql: string;
  triggerRun?: number;
  onResult?: (result: QueryResult) => void;
};

export function QueryResultPanel({ sessionId, sourceId, workspaceId, sql, triggerRun, onResult }: Props) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<QueryError | null>(null);
  const [exporting, setExporting] = useState(false);
  const isRunningRef = useRef(false);

  const handleRun = useCallback(async () => {
    if (!sql.trim() || isRunningRef.current) return;
    isRunningRef.current = true;
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/explore/${workspaceId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, sourceId, sql }),
      });
      const data = await res.json() as QueryResult & QueryError;

      if (!res.ok) {
        setError(data);
      } else {
        setResult(data);
        onResult?.(data);
      }
    } catch (e) {
      setError({ error: 'query_failed', detail: String(e) });
    } finally {
      setRunning(false);
      isRunningRef.current = false;
    }
  }, [sessionId, sourceId, workspaceId, sql, onResult]);

  // Ctrl+Enter from SqlEditor increments triggerRun → trigger run
  useEffect(() => {
    if (triggerRun && triggerRun > 0) handleRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerRun]);

  const handleExport = useCallback(async () => {
    if (!result || exporting) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/explore/${workspaceId}/query/export-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, sourceId, sql }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `query-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  }, [result, exporting, sessionId, sourceId, workspaceId, sql]);

  return (
    <div className="flex h-full flex-col border-t border-border">
      {/* Toolbar */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border bg-muted/30 px-2 gap-2">
        <Button
          size="sm"
          variant="default"
          className="h-6 text-xs gap-1.5 px-2"
          disabled={running || !sql.trim()}
          onClick={handleRun}
        >
          <Play className="h-3 w-3" />
          {running ? 'Running…' : 'Run'}
        </Button>
        <div className="flex items-center gap-2">
          {result && (
            <>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {result.durationMs}ms
              </span>
              <span className="text-xs text-muted-foreground">
                {result.rowCount.toLocaleString()} rows
              </span>
              {result.truncated && (
                <Badge variant="outline" className="text-xs h-4 px-1">
                  truncated
                </Badge>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs gap-1 px-2"
                disabled={exporting}
                onClick={handleExport}
              >
                <Download className="h-3 w-3" />
                CSV
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1">
        {!result && !error && (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground gap-1">
            <Info className="h-3.5 w-3.5" />
            Press Run or Ctrl+Enter to execute
          </div>
        )}

        {error && (
          <div className="p-3 flex items-start gap-2 text-xs text-destructive bg-destructive/5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-medium">{error.error.replace(/_/g, ' ')}</p>
              {error.reason && <p className="text-muted-foreground">{error.reason}</p>}
              {error.detail && <p className="text-muted-foreground font-mono text-[11px]">{error.detail}</p>}
              {error.offendingTables && (
                <p className="text-muted-foreground">
                  Tables: {error.offendingTables.join(', ')}
                </p>
              )}
            </div>
          </div>
        )}

        {result && (
          <ScrollArea className="h-full">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {result.columns.map((col) => (
                      <th
                        key={col}
                        className="px-2 py-1 text-left font-medium text-muted-foreground whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                      {result.columns.map((col) => {
                        const val = row[col];
                        const isNull = val === null || val === undefined;
                        const isMasked = typeof val === 'string' && val.endsWith('_MASKED]');
                        return (
                          <td
                            key={col}
                            className={`px-2 py-1 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis ${
                              isNull ? 'text-muted-foreground italic' : isMasked ? 'text-orange-500 font-mono' : ''
                            }`}
                            title={String(val ?? '')}
                          >
                            {isNull ? 'NULL' : String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
