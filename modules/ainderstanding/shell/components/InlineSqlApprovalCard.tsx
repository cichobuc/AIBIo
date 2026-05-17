'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { EditorProps } from '@monaco-editor/react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { Button, Badge } from '@/core/ui';
import { Check, X, Edit2, Loader2, AlertCircle } from 'lucide-react';
import { useCountdown } from '../hooks/useCountdown';
import { useWorkspaceStore } from '../store/workspace-store';

const MonacoEditor = dynamic<EditorProps>(
  () => import('@monaco-editor/react').then((m) => m.Editor),
  { ssr: false },
);

type EditQuerySessionDetails = {
  sessionId: string;
  sessionTitle: string;
  dataSourceName: string;
  previousSql: string;
  newSql: string;
};

type Props = {
  requestId: string;
  agentName: string;
  timeoutAt: string;
  details: EditQuerySessionDetails;
};

export function InlineSqlApprovalCard({ requestId, agentName, timeoutAt, details }: Props) {
  const [mode, setMode] = useState<'diff' | 'edit'>('diff');
  const [editedSql, setEditedSql] = useState(details.newSql);
  const [resolving, setResolving] = useState(false);
  const setPendingApproval = useWorkspaceStore((s) => s.setPendingApproval);
  const { display: countdown, remaining } = useCountdown(timeoutAt);

  const resolve = useCallback(
    async (decision: 'approved' | 'denied', finalSql?: string) => {
      setResolving(true);
      try {
        await fetch(`/api/approvals/${requestId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision, ...(finalSql ? { reason: finalSql } : {}) }),
        });
        setPendingApproval(null);
      } catch {
        setResolving(false);
      }
    },
    [requestId, setPendingApproval],
  );

  const handleApprove = useCallback(
    () => void resolve('approved', mode === 'edit' ? editedSql : undefined),
    [resolve, mode, editedSql],
  );

  const handleDeny = useCallback(() => void resolve('denied'), [resolve]);

  return (
    <div className="rounded-lg border border-layer-1/40 bg-layer-1/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-layer-1/20">
        <span className="text-caption font-mono text-accent-ai">◈ {agentName}</span>
        <span className="text-caption text-muted-foreground">— SQL card edit</span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
          {details.sessionTitle}
        </Badge>
        <span className="ml-auto text-caption">
          {remaining < 60 ? (
            <span className="flex items-center gap-1 text-destructive">
              <AlertCircle className="w-3 h-3" />
              {countdown}
            </span>
          ) : (
            <span className="text-muted-foreground">{countdown}</span>
          )}
        </span>
      </div>

      <div className="flex gap-1 px-3 pt-1.5">
        <button
          onClick={() => setMode('diff')}
          className={`text-caption px-2 py-0.5 border-b-2 transition-colors ${
            mode === 'diff'
              ? 'border-accent-ai text-accent-ai'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Diff
        </button>
        <button
          onClick={() => setMode('edit')}
          className={`text-caption px-2 py-0.5 border-b-2 transition-colors flex items-center gap-1 ${
            mode === 'edit'
              ? 'border-accent-ai text-accent-ai'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Edit2 className="w-3 h-3" />
          Edit
        </button>
      </div>

      <div className="h-[200px] overflow-auto border-t border-layer-1/10">
        {mode === 'diff' ? (
          <div className="text-xs">
            <ReactDiffViewer
              oldValue={details.previousSql}
              newValue={details.newSql}
              splitView={!!details.previousSql}
              hideLineNumbers={false}
              useDarkTheme
              styles={{
                variables: {
                  dark: {
                    diffViewerBackground: 'transparent',
                    addedBackground: 'rgba(34,197,94,0.12)',
                    removedBackground: 'rgba(239,68,68,0.12)',
                    addedGutterBackground: 'rgba(34,197,94,0.2)',
                    removedGutterBackground: 'rgba(239,68,68,0.2)',
                    gutterBackground: 'transparent',
                  },
                },
              }}
            />
          </div>
        ) : (
          <MonacoEditor
            height="200px"
            language="sql"
            theme="vs-dark"
            value={editedSql}
            onChange={(v) => setEditedSql(v ?? '')}
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              tabSize: 2,
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        )}
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-layer-1/20">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-caption gap-1 text-destructive border-destructive/50 hover:bg-destructive/10"
          onClick={handleDeny}
          disabled={resolving}
        >
          <X className="w-3.5 h-3.5" />
          Deny
        </Button>
        <Button
          variant="default"
          size="sm"
          className="h-7 text-caption gap-1 ml-auto"
          onClick={handleApprove}
          disabled={resolving}
        >
          {resolving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          Approve & Apply
        </Button>
      </div>
    </div>
  );
}
