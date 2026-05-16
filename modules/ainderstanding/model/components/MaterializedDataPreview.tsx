'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Badge } from '@/core/ui';
import { Loader2, Eye, EyeOff } from 'lucide-react';

interface PreviewResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  totalRows?: number;
  builtAt?: string;
}

interface Props {
  workspaceId: string;
  modelName: string;
}

export function MaterializedDataPreview({ workspaceId, modelName }: Props) {
  const [data, setData] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showData, setShowData] = useState(false);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/model/${workspaceId}/preview?model=${encodeURIComponent(modelName)}&limit=100`,
      );
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? 'Preview failed');
        return;
      }
      const result = (await res.json()) as PreviewResult;
      setData(result);
      setShowData(true);
    } catch {
      setError('Failed to load preview');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, modelName]);

  useEffect(() => {
    if (modelName) void fetchPreview();
  }, [fetchPreview, modelName]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading preview…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-2 text-center px-4">
        <p className="text-sm text-destructive">{error}</p>
        <p className="text-xs text-muted-foreground">
          Run &quot;Build All&quot; or &quot;Build Single&quot; to materialize this model first.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-2 text-center px-4">
        <p className="text-sm text-muted-foreground">No data yet</p>
        <p className="text-xs text-muted-foreground">Materialize the model to see a preview.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b shrink-0">
        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs">
          <span className="font-semibold">{data.rowCount}</span> rows
          {data.totalRows && data.totalRows > data.rowCount && (
            <span className="text-muted-foreground ml-1">(top {data.rowCount} of {data.totalRows})</span>
          )}
        </span>
        {data.builtAt && (
          <span className="text-xs text-muted-foreground ml-auto">
            Built: {new Date(data.builtAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="px-3 py-1.5 border-b bg-yellow-950/20 shrink-0">
        <p className="text-xs text-yellow-400/80">
          ⚠ AI cannot see these results.{' '}
          <button className="underline hover:text-yellow-300">Share top 10 with AI ↗</button>
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-card border-b">
            <tr>
              {data.columns.map((col) => (
                <th key={col} className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => (
              <tr key={ri} className="border-b border-border/50 hover:bg-accent/30">
                {(row as unknown[]).map((cell, ci) => (
                  <td key={ci} className="px-2 py-1 font-mono whitespace-nowrap max-w-[200px] truncate">
                    {cell === null ? (
                      <span className="text-muted-foreground/50">NULL</span>
                    ) : typeof cell === 'string' && cell.startsWith('[') && cell.endsWith('_MASKED]') ? (
                      <Badge variant="outline" className="text-[10px] px-1 h-4 border-yellow-500/50 text-yellow-500/70">
                        {cell}
                      </Badge>
                    ) : (
                      String(cell)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
