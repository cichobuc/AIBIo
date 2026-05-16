'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/core/ui/sheet';
import { Badge } from '@/core/ui/badge';
import type { AuditOutcome } from '@/modules/ainderstanding/govern/db/schema';

export type AuditEntryFull = {
  id: string;
  agentName: string;
  actionType: string;
  tableName: string | null;
  columnNamesJson: string | null;
  sqlHash: string | null;
  sessionId: string;
  outcome: AuditOutcome;
  detailJson: string | null;
  createdAt: string;
};

const OUTCOME_COLORS: Record<string, string> = {
  allowed: 'bg-green-100 text-green-700',
  blocked: 'bg-red-100 text-red-700',
  approval_granted: 'bg-blue-100 text-blue-700',
  approval_denied: 'bg-orange-100 text-orange-700',
  timeout: 'bg-yellow-100 text-yellow-700',
};

type Props = {
  entry: AuditEntryFull | null;
  onClose: () => void;
};

export function AuditEntryDetailSheet({ entry, onClose }: Props) {
  return (
    <Sheet open={entry !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-80 flex flex-col gap-0 p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b">
          <SheetTitle className="text-sm font-medium">Audit entry</SheetTitle>
          {entry && (
            <p className="text-[10px] text-muted-foreground font-mono">{entry.id}</p>
          )}
        </SheetHeader>

        {entry && (
          <div className="flex-1 overflow-auto px-4 py-4 space-y-3 text-xs">
            <Row label="Time">{new Date(entry.createdAt).toLocaleString()}</Row>
            <Row label="Agent"><span className="font-mono">{entry.agentName}</span></Row>
            <Row label="Action"><Badge variant="secondary" className="text-[10px]">{entry.actionType}</Badge></Row>
            <Row label="Outcome">
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${OUTCOME_COLORS[entry.outcome] ?? 'bg-muted text-muted-foreground'}`}>
                {entry.outcome}
              </span>
            </Row>
            {entry.tableName && <Row label="Table"><span className="font-mono">{entry.tableName}</span></Row>}
            {entry.columnNamesJson && (
              <Row label="Columns">
                <div className="font-mono text-[11px] break-all">{entry.columnNamesJson}</div>
              </Row>
            )}
            {entry.sqlHash && (
              <Row label="SQL hash">
                <span className="font-mono text-[10px] text-muted-foreground break-all">{entry.sqlHash}</span>
              </Row>
            )}
            <Row label="Session">
              <span className="font-mono text-[10px] text-muted-foreground break-all">{entry.sessionId}</span>
            </Row>
            {entry.detailJson && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Detail</p>
                <pre className="text-[11px] bg-muted/40 rounded p-2 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                  {(() => { try { return JSON.stringify(JSON.parse(entry.detailJson), null, 2); } catch { return entry.detailJson; } })()}
                </pre>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="flex-1 break-words">{children}</span>
    </div>
  );
}
