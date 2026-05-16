'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { Input } from '@/core/ui/input';
import { Badge } from '@/core/ui/badge';
import { AuditEntryDetailSheet } from './AuditEntryDetailSheet';
import type { AuditEntryFull } from './AuditEntryDetailSheet';
import type { AuditActionType, AuditOutcome } from '@/modules/ainderstanding/govern/db/schema';

const ACTION_LABELS: Record<AuditActionType, string> = {
  read_schema: 'Schema read',
  read_sample: 'Sample read',
  run_query: 'Query run',
  share_results: 'Results shared',
  write_doc: 'Doc written',
  write_model: 'Model written',
  write_test: 'Test written',
};

const OUTCOME_STYLES: Record<AuditOutcome, string> = {
  allowed: 'bg-green-100 text-green-700',
  blocked: 'bg-red-100 text-red-700',
  approval_granted: 'bg-blue-100 text-blue-700',
  approval_denied: 'bg-orange-100 text-orange-700',
  timeout: 'bg-yellow-100 text-yellow-700',
};

type Props = {
  audits: AuditEntryFull[];
  currentFilters: {
    agent?: string;
    action?: string;
    outcome?: string;
    q?: string;
  };
};

export function AuditLogViewer({ audits, currentFilters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<AuditEntryFull | null>(null);

  const push = (updates: Record<string, string>) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('tab', 'audit');
    for (const [k, v] of Object.entries(updates)) {
      if (v) sp.set(k, v); else sp.delete(k);
    }
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  };

  const agentNames = Array.from(new Set(audits.map((a) => a.agentName))).filter(Boolean);

  return (
    <>
      <div className="flex flex-col gap-3 h-full">
        {/* Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Select
            value={currentFilters.agent ?? 'all'}
            onValueChange={(v) => push({ agent: v === 'all' ? '' : v })}
          >
            <SelectTrigger className="h-7 text-xs w-32">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All agents</SelectItem>
              {agentNames.map((n) => (
                <SelectItem key={n} value={n} className="text-xs font-mono">{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={currentFilters.action ?? 'all'}
            onValueChange={(v) => push({ action: v === 'all' ? '' : v })}
          >
            <SelectTrigger className="h-7 text-xs w-32">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All actions</SelectItem>
              {(Object.entries(ACTION_LABELS) as [AuditActionType, string][]).map(([k, label]) => (
                <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={currentFilters.outcome ?? 'all'}
            onValueChange={(v) => push({ outcome: v === 'all' ? '' : v })}
          >
            <SelectTrigger className="h-7 text-xs w-32">
              <SelectValue placeholder="All outcomes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All outcomes</SelectItem>
              {(Object.keys(OUTCOME_STYLES) as AuditOutcome[]).map((k) => (
                <SelectItem key={k} value={k} className="text-xs">{k.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            className="h-7 text-xs w-36"
            placeholder="Search table…"
            defaultValue={currentFilters.q ?? ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') push({ q: (e.target as HTMLInputElement).value });
            }}
          />
        </div>

        {/* Entries */}
        <div className="flex-1 overflow-auto">
          {audits.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No audit entries match current filters.</p>
          ) : (
            <div className="space-y-0.5">
              {audits.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 text-xs border-b py-1.5 cursor-pointer hover:bg-muted/30 transition-colors px-1"
                  onClick={() => setSelected(entry)}
                >
                  <span className="text-muted-foreground text-[10px] shrink-0 w-20">
                    {new Date(entry.createdAt).toLocaleTimeString()}
                  </span>
                  <span className="text-muted-foreground font-mono w-28 overflow-hidden text-ellipsis whitespace-nowrap shrink-0">
                    {entry.agentName}
                  </span>
                  <Badge variant="secondary" className="text-[10px] shrink-0 px-1">
                    {ACTION_LABELS[entry.actionType as AuditActionType] ?? entry.actionType}
                  </Badge>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1 text-muted-foreground">
                    {entry.tableName ?? '—'}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                      OUTCOME_STYLES[entry.outcome as AuditOutcome] ?? 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {entry.outcome}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground border-t pt-1">
          {audits.length} entr{audits.length !== 1 ? 'ies' : 'y'} — read-only (append-only log)
        </p>
      </div>

      <AuditEntryDetailSheet entry={selected} onClose={() => setSelected(null)} />
    </>
  );
}
