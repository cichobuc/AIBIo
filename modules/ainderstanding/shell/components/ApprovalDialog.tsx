'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Lock, Timer } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
  Button,
  cn,
} from '@/core/ui';
import { useWorkspaceStore } from '../store/workspace-store';

const FULL_MODAL_GATES = new Set(['share_results_with_ai', 'write_model_file', 'write_test_file']);

function useCountdown(timeoutAt: string | undefined) {
  const [remaining, setRemaining] = useState(300);

  useEffect(() => {
    if (!timeoutAt) return;
    const update = () => {
      const secs = Math.max(0, Math.round((new Date(timeoutAt).getTime() - Date.now()) / 1000));
      setRemaining(secs);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [timeoutAt]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function resolveApproval(requestId: string, decision: 'approved' | 'denied') {
  await fetch(`/api/approvals/${requestId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
}

export function ApprovalDialog() {
  const pendingApproval = useWorkspaceStore((s) => s.pendingApproval);
  const setPendingApproval = useWorkspaceStore((s) => s.setPendingApproval);
  const countdown = useCountdown(pendingApproval?.timeoutAt);

  if (!pendingApproval) return null;

  const isFullModal = FULL_MODAL_GATES.has(pendingApproval.gateType);

  async function handle(decision: 'approved' | 'denied') {
    await resolveApproval(pendingApproval!.requestId, decision);
    setPendingApproval(null);
  }

  if (isFullModal) {
    return (
      <AlertDialog open>
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-layer-3" />
              <span>Approval Required</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-body">
              <span className="font-mono text-accent-ai">{pendingApproval.agentName}</span>{' '}
              {pendingApproval.description}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {'sql' in pendingApproval.details && (
            <div className="rounded border border-border bg-secondary p-3 font-mono text-caption overflow-auto max-h-40">
              <pre className="whitespace-pre-wrap">{(pendingApproval.details as { sql: string }).sql}</pre>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-caption text-layer-2">
            <Timer className="h-3 w-3" />
            <span>Timeout in {countdown}</span>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => void handle('denied')}>Deny</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handle('approved')}>Approve</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Level 2: Bottom Banner
  return (
    <div className="fixed bottom-[54px] left-0 right-0 z-40 border-t border-layer-2/50 bg-layer-2/10 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-layer-2 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-body text-foreground">
            <span className="font-mono text-accent-ai">{pendingApproval.agentName}</span>
            {' — '}{pendingApproval.description}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-caption text-layer-2">Timeout: {countdown}</span>
          <Button
            size="sm"
            className="h-7 text-caption bg-layer-1/20 text-layer-1 border border-layer-1/50 hover:bg-layer-1/30"
            onClick={() => void handle('approved')}
          >
            Execute
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-caption text-muted-foreground hover:text-foreground"
            onClick={() => void handle('denied')}
          >
            Deny
          </Button>
        </div>
      </div>
    </div>
  );
}
