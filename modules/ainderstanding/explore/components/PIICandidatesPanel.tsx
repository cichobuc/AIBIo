'use client';

import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { ScrollArea } from '@/core/ui/scroll-area';

type PiiCandidate = {
  dataSourceId: string;
  tableName: string;
  columnName: string;
  piiCandidateReason: string | null;
};

type Props = {
  candidates: PiiCandidate[];
  onConfirm: (candidate: PiiCandidate) => void;
  onDismiss: (candidate: PiiCandidate) => void;
};

export function PIICandidatesPanel({ candidates, onConfirm, onDismiss }: Props) {
  if (candidates.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground text-center">
        No PII candidates detected
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium">PII Candidates</span>
          <Badge variant="destructive" className="text-[10px]">{candidates.length}</Badge>
        </div>
        {candidates.map((c, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-2 rounded border bg-card text-xs"
          >
            <div className="flex-1 min-w-0">
              <p className="font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                {c.tableName}.<span className="text-destructive">{c.columnName}</span>
              </p>
              {c.piiCandidateReason && (
                <p className="text-muted-foreground text-[10px] mt-0.5">{c.piiCandidateReason}</p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2"
                onClick={() => onConfirm(c)}
              >
                Classify
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] px-2 text-muted-foreground"
                onClick={() => onDismiss(c)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
