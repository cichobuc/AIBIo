'use client';

import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { ReferenceTableSampleView } from './ReferenceTableSampleView';

type PreviewData = { columns: string[]; rows: Record<string, unknown>[] };

type State =
  | { status: 'loading' }
  | { status: 'ready'; data: PreviewData }
  | { status: 'restricted'; tier: string; reason: string }
  | { status: 'error'; message: string };

export function TableDetailTab({
  workspaceId,
  sourceId,
  tableName,
}: {
  workspaceId: string;
  sourceId: string;
  tableName: string;
}) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    setState({ status: 'loading' });
    const url = `/api/explore/${workspaceId}/preview?source=${encodeURIComponent(sourceId)}&table=${encodeURIComponent(tableName)}`;
    fetch(url)
      .then(async (res) => {
        const body = await res.json().catch(() => ({})) as {
          error?: string;
          detail?: string;
          tier?: string;
          reason?: string;
        };

        if (res.status === 403) {
          setState({ status: 'restricted', tier: body.tier ?? '', reason: body.reason ?? 'Access restricted.' });
          return;
        }
        if (!res.ok) {
          setState({ status: 'error', message: body.detail ?? body.error ?? `HTTP ${res.status}` });
          return;
        }
        setState({ status: 'ready', data: body as PreviewData });
      })
      .catch((err: unknown) => {
        setState({ status: 'error', message: String(err) });
      });
  }, [workspaceId, sourceId, tableName]);

  if (state.status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (state.status === 'restricted') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <Shield className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground max-w-56">{state.reason}</p>
        <p className="text-[10px] text-muted-foreground/60">
          Right-click the connection or table in the sidebar to change the access tier.
        </p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="p-4 text-xs text-destructive">
        Failed to load data: {state.message}
      </div>
    );
  }

  if (state.data.rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        No rows
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 h-full overflow-auto">
      <p className="text-xs text-muted-foreground shrink-0">
        {state.data.rows.length} rows (max 100)
      </p>
      <ReferenceTableSampleView columns={state.data.columns} rows={state.data.rows} />
    </div>
  );
}
