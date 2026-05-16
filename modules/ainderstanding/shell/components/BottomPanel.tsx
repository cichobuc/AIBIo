'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger, ScrollArea, Button } from '@/core/ui';
import { useWorkspaceStore } from '../store/workspace-store';

type HistoryRow = {
  id: string;
  sqlText: string;
  outcome: string;
  rowCount: number | null;
  durationMs: number | null;
  executedAt: string;
};

export function BottomPanel() {
  const [activeTab, setActiveTab] = useState<'output' | 'sql' | 'results' | 'approvals'>('output');
  const toggle = useWorkspaceStore((s) => s.toggleBottomPanel);
  const messages = useWorkspaceStore((s) => s.messages);
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const [sqlHistory, setSqlHistory] = useState<HistoryRow[]>([]);

  useEffect(() => {
    if (activeTab !== 'sql' || !workspaceId) return;
    fetch(`/api/explore/${workspaceId}/query-history?limit=20`)
      .then((r) => r.ok ? r.json() : { rows: [] })
      .then((d: { rows: HistoryRow[] }) => setSqlHistory(d.rows))
      .catch(() => {});
  }, [activeTab, workspaceId]);

  const outputLines = messages
    .filter((m) => m.type === 'agent_thinking' || m.type === 'stream_end' || m.type === 'stream_error')
    .map((m) => {
      if (m.type === 'agent_thinking') return `[${m.timestamp?.slice(11, 19) ?? '--'}] ${m.payload.agentName}: ${m.payload.message}`;
      if (m.type === 'stream_end') return `[${m.timestamp?.slice(11, 19) ?? '--'}] Done — ${m.payload.agentsUsed.join(', ')}`;
      if (m.type === 'stream_error') return `[${m.timestamp?.slice(11, 19) ?? '--'}] ERROR: ${m.payload.message}`;
      return '';
    });

  return (
    <div className="flex h-full flex-col border-t border-border bg-card">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex h-full flex-col">
        <div className="flex h-[30px] shrink-0 items-center justify-between border-b border-border px-2">
          <TabsList className="h-7 bg-transparent gap-0 p-0">
            {(['output', 'sql', 'results', 'approvals'] as const).map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="h-7 rounded-none border-b-2 border-transparent px-3 text-caption capitalize text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-foreground"
            onClick={toggle}
            aria-label="Close panel (⌘J)"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        <TabsContent value="output" className="mt-0 min-h-0 flex-1">
          <ScrollArea className="h-full p-2">
            <div className="space-y-0.5 font-mono text-caption text-muted-foreground">
              {outputLines.length === 0 ? (
                <span className="italic">No output yet.</span>
              ) : (
                outputLines.map((line, i) => <div key={i}>{line}</div>)
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="sql" className="mt-0 min-h-0 flex-1">
          <ScrollArea className="h-full p-2">
            {sqlHistory.length === 0 ? (
              <p className="text-caption italic text-muted-foreground">No SQL executed yet.</p>
            ) : (
              <div className="space-y-1">
                {sqlHistory.map((row) => (
                  <div key={row.id} className="font-mono text-caption space-y-0.5 border-b border-border pb-1">
                    <div className="flex items-center gap-2">
                      <span className={row.outcome === 'success' ? 'text-green-500' : 'text-destructive'}>
                        [{row.outcome}]
                      </span>
                      {row.durationMs != null && (
                        <span className="text-muted-foreground">{row.durationMs}ms</span>
                      )}
                      {row.rowCount != null && (
                        <span className="text-muted-foreground">{row.rowCount} rows</span>
                      )}
                      <span className="text-muted-foreground ml-auto">{row.executedAt.slice(11, 19)}</span>
                    </div>
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">
                      {row.sqlText}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="results" className="mt-0 min-h-0 flex-1">
          <ScrollArea className="h-full p-2">
            <p className="text-caption italic text-muted-foreground">No query results.</p>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="approvals" className="mt-0 min-h-0 flex-1">
          <ScrollArea className="h-full p-2">
            <p className="text-caption italic text-muted-foreground">No pending approvals.</p>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
