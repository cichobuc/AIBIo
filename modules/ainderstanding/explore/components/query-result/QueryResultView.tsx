'use client';

import { useState, useCallback } from 'react';
import { Download, AlertTriangle, Clock, Info, Loader2 } from 'lucide-react';
import { Button, ScrollArea, Badge } from '@/core/ui';
import { useExploreStore } from '../../store/explore-store';
import { useWorkspaceStore } from '@/modules/ainderstanding/shell/store/workspace-store';

export function QueryResultView() {
  const activeSessionId = useExploreStore((s) => s.activeQuerySessionId);
  const sessionState = useExploreStore((s) =>
    activeSessionId ? s.querySessions[activeSessionId] ?? null : null,
  );
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (!sessionState?.result || exporting || !activeSessionId) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/explore/${workspaceId}/query/export-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId,
          sourceId: sessionState.sourceId,
          sql: sessionState.sql,
        }),
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
  }, [sessionState, exporting, activeSessionId, workspaceId]);

  const { running, result, error } = sessionState ?? { running: false, result: null, error: null };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border bg-muted/30 px-2 gap-2">
        <div className="flex items-center gap-2">
          {running && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Running…
            </span>
          )}
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
            </>
          )}
        </div>
        {result && (
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
        )}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1">
        {!running && !result && !error && (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground gap-1">
            <Info className="h-3.5 w-3.5" />
            Press Run or Ctrl+Enter in the editor to execute
          </div>
        )}

        {!running && error && (
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
