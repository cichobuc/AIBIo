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

type WriteModelPayload = { modelName: string; layer: string; sqlDiff: string };
type WriteTestPayload = { testType: 'generic' | 'custom'; modelName: string; testPreview: string };

type Props = {
  agentName: string;
  gateType: 'write_model_file' | 'write_test_file';
  payload: WriteModelPayload | WriteTestPayload;
  countdown: string;
  remainingSec: number;
  totalSec?: number;
  onApprove: (reason: string) => void;
  onDeny: () => void;
};

function isWriteModel(p: WriteModelPayload | WriteTestPayload): p is WriteModelPayload {
  return 'sqlDiff' in p;
}

export function WriteFileGate({
  agentName,
  gateType,
  payload,
  countdown,
  remainingSec,
  totalSec = 300,
  onApprove,
  onDeny,
}: Props) {
  const [reason, setReason] = useState('');
  const isModel = gateType === 'write_model_file';

  const title = isModel ? 'Write model SQL file?' : 'Write test file?';
  const description = isModel
    ? `${agentName} wants to write SQL for model`
    : `${agentName} wants to write a test`;

  return (
    <AlertDialog open>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-layer-3" />
            <span>{title}</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-body">
            <span className="font-mono text-accent-ai">{agentName}</span>
            {' — '}
            {description}
            {isWriteModel(payload) && (
              <span>
                {' '}
                <span className="font-medium text-foreground">{payload.modelName}</span>
                {' '}
                <Badge variant="secondary" className="text-[10px]">{payload.layer}</Badge>
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          {isWriteModel(payload) && payload.sqlDiff && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">SQL preview</p>
              <pre className="text-[11px] font-mono bg-secondary border border-border rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap">
                {payload.sqlDiff}
              </pre>
            </div>
          )}

          {!isWriteModel(payload) && payload.testPreview && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Test preview</p>
              <pre className="text-[11px] font-mono bg-secondary border border-border rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap">
                {payload.testPreview}
              </pre>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Reason (required)</label>
            <Textarea
              className="text-xs h-16 resize-none"
              placeholder="Why should this file be written?"
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
