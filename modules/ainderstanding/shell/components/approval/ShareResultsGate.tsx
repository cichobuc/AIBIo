'use client';

import { useState } from 'react';
import { Lock, Timer } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/core/ui/alert-dialog';
import { Textarea } from '@/core/ui/textarea';
import { Badge } from '@/core/ui/badge';
import { Progress } from '@/core/ui/progress';

type Props = {
  agentName: string;
  rowCount: number;
  columns: string[];
  queryPreview: string;
  countdown: string;
  remainingSec: number;
  totalSec?: number;
  onApprove: (reason: string) => void;
  onDeny: () => void;
};

export function ShareResultsGate({
  agentName,
  rowCount,
  columns,
  queryPreview,
  countdown,
  remainingSec,
  totalSec = 300,
  onApprove,
  onDeny,
}: Props) {
  const [reason, setReason] = useState('');

  return (
    <AlertDialog open>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-layer-3" />
            <span>Share query results with AI?</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-body">
            <span className="font-mono text-accent-ai">{agentName}</span>
            {' is requesting access to raw query results. '}
            <span className="text-muted-foreground">PII columns will be masked before sharing.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[11px]">{rowCount.toLocaleString()} rows</Badge>
            {columns.slice(0, 8).map((c) => (
              <Badge key={c} variant="outline" className="text-[10px] font-mono">{c}</Badge>
            ))}
            {columns.length > 8 && (
              <Badge variant="outline" className="text-[10px]">+{columns.length - 8} more</Badge>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground italic">{queryPreview}</p>

          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Reason (required)</label>
            <Textarea
              className="text-xs h-16 resize-none"
              placeholder="Why is the AI accessing this data?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-caption text-layer-3">
              <Timer className="h-3 w-3" />
              <span>Auto-deny in {countdown}</span>
            </div>
            <Progress value={remainingSec} max={totalSec} className="h-1 bg-layer-3/20 [&>div]:bg-layer-3" />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDeny}>Deny</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onApprove(reason)}
            disabled={!reason.trim()}
          >
            Approve — one-time
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
