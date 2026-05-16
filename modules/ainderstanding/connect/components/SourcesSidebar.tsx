'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, PlusCircle, Loader2 } from 'lucide-react';
import { Input } from '@/core/ui/input';
import { ScrollArea } from '@/core/ui/scroll-area';
import { cn } from '@/core/ui';
import type { DataSource, DataSourceStatus, Workspace, ConnectionTestResult } from '@/core/types/workspace';

type Props = {
  workspaceId: string;
  workspace: Workspace;
  sources: DataSource[];
  counts: Record<string, number>;
};

function StatusDot({ status, testing }: { status: DataSourceStatus; testing: boolean }) {
  if (testing) return <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />;
  if (status === 'active') return <span className="shrink-0 text-[10px] text-green-500">●</span>;
  if (status === 'error') return <span className="shrink-0 text-[10px] text-red-500">✗</span>;
  return <span className="shrink-0 text-[10px] text-muted-foreground">◌</span>;
}

export function SourcesSidebar({ workspaceId, workspace, sources, counts }: Props) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, DataSourceStatus>>(
    () => Object.fromEntries(sources.map((s) => [s.id, s.status])),
  );
  const [testing, setTesting] = useState<Set<string>>(new Set());

  const q = search.toLowerCase();
  const filtered = sources.filter((s) => !q || s.name.toLowerCase().includes(q));

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleTest = useCallback(
    async (source: DataSource) => {
      if (testing.has(source.id)) return;
      setTesting((prev) => new Set(prev).add(source.id));
      setStatuses((prev) => ({ ...prev, [source.id]: 'pending' }));
      try {
        const res = await fetch(`/api/data-sources/${workspaceId}/${source.id}/test`, {
          method: 'POST',
        });
        const data = (await res.json()) as { result: ConnectionTestResult };
        setStatuses((prev) => ({
          ...prev,
          [source.id]: data.result.success ? 'active' : 'error',
        }));
      } catch {
        setStatuses((prev) => ({ ...prev, [source.id]: 'error' }));
      } finally {
        setTesting((prev) => {
          const next = new Set(prev);
          next.delete(source.id);
          return next;
        });
      }
    },
    [workspaceId, testing],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2">
        <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {workspace.name}
        </p>
      </div>
      <div className="border-b px-3 py-2">
        <Input
          placeholder="Search sources…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs"
        />
      </div>
      <ScrollArea className="flex-1">
        {filtered.length === 0 && (
          <p className="p-4 text-center text-xs text-muted-foreground">
            {search ? 'No sources match' : 'No data sources yet'}
          </p>
        )}
        {filtered.map((source) => {
          const isExpanded = expanded.has(source.id);
          const tableCount = counts[source.id] ?? null;
          const status = statuses[source.id] ?? 'pending';
          const isTesting = testing.has(source.id);

          return (
            <div key={source.id}>
              <button
                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent/50"
                onClick={() => toggleExpanded(source.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                )}
                <StatusDot status={status} testing={isTesting} />
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {source.name}
                </span>
              </button>
              {isExpanded && (
                <div className="pb-1 pl-8">
                  {tableCount !== null && (
                    <p className="px-2 py-0.5 text-xs text-muted-foreground">
                      Tables ({tableCount})
                    </p>
                  )}
                  <button
                    className={cn(
                      'flex items-center gap-1 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground',
                      isTesting && 'cursor-not-allowed opacity-50',
                    )}
                    onClick={() => handleTest(source)}
                    disabled={isTesting}
                  >
                    {isTesting && <Loader2 className="h-3 w-3 animate-spin" />}
                    Test connection
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </ScrollArea>
      <div className="border-t p-2">
        <Link
          href={`/workspace/${workspaceId}/connect/new`}
          className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          Add Data Source
        </Link>
      </div>
    </div>
  );
}
