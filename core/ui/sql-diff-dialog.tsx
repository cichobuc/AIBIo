'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { EditorProps } from '@monaco-editor/react';
import { Button, Badge, cn } from '@/core/ui';
import { Check, X, Edit2, Loader2, AlertCircle } from 'lucide-react';
import ReactDiffViewer from 'react-diff-viewer-continued';

const MonacoEditor = dynamic<EditorProps>(() => import('@monaco-editor/react').then((m) => m.Editor), {
  ssr: false,
});

interface Props {
  agentName: string;
  title: string;
  subtitle: string;
  badge?: string;
  newSql: string;
  previousSql?: string;
  countdown: string;
  remainingSec: number;
  approveLabel?: string;
  onApprove: (finalSql?: string) => void | Promise<void>;
  onDeny: () => void;
}

export function SqlDiffDialog({
  agentName,
  title,
  subtitle,
  badge,
  newSql,
  previousSql = '',
  countdown,
  remainingSec,
  approveLabel = 'Approve',
  onApprove,
  onDeny,
}: Props) {
  const [mode, setMode] = useState<'diff' | 'edit'>('diff');
  const [editedSql, setEditedSql] = useState(newSql);
  const [approving, setApproving] = useState(false);

  const isNew = !previousSql;
  const linesAdded = newSql.split('\n').length;
  const linesRemoved = previousSql.split('\n').length;

  const handleApprove = useCallback(async () => {
    setApproving(true);
    try {
      await onApprove(mode === 'edit' ? editedSql : undefined);
    } catch {
      setApproving(false);
    }
  }, [mode, editedSql, onApprove]);

  return (
    <div
      className={cn(
        'fixed bottom-[54px] left-0 right-0 z-40 mx-auto max-w-4xl',
        'bg-card border border-border rounded-t-lg shadow-xl',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <span className="text-xs font-semibold text-muted-foreground">◈ {agentName}</span>
        <span className="text-xs text-muted-foreground">—</span>
        <span className="text-xs font-medium">{title}</span>
        {badge && (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 ml-1">
            {badge}
          </Badge>
        )}
        <span className="font-mono text-xs text-primary ml-1">{subtitle}</span>
        <div className="ml-auto flex items-center gap-2">
          {remainingSec < 60 && (
            <span className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Auto-deny in {countdown}
            </span>
          )}
          {remainingSec >= 60 && (
            <span className="text-xs text-muted-foreground">{countdown}</span>
          )}
        </div>
      </div>

      {/* Tab switch */}
      <div className="flex gap-1 px-4 pt-2">
        <button
          onClick={() => setMode('diff')}
          className={cn(
            'text-xs px-3 py-1 rounded-t border-b-2 transition-colors',
            mode === 'diff'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Diff Preview
        </button>
        <button
          onClick={() => setMode('edit')}
          className={cn(
            'text-xs px-3 py-1 rounded-t border-b-2 transition-colors flex items-center gap-1',
            mode === 'edit'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Edit2 className="w-3 h-3" />
          Edit before approve
        </button>
      </div>

      {/* Content */}
      <div className="h-[280px] overflow-auto border-t">
        {mode === 'diff' ? (
          <div className="text-xs">
            <ReactDiffViewer
              oldValue={previousSql}
              newValue={newSql}
              splitView={!isNew}
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
                    codeFoldBackground: 'rgba(255,255,255,0.04)',
                    codeFoldGutterBackground: 'transparent',
                  },
                },
              }}
            />
          </div>
        ) : (
          <MonacoEditor
            height="280px"
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

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t bg-card/80">
        <span className="text-xs text-muted-foreground flex-1">
          {isNew ? `${linesAdded} lines added · New` : `~${linesAdded} lines added · ~${linesRemoved} lines removed`}
        </span>
        <span className="text-xs text-muted-foreground mr-2">⌨ Chat input disabled until you decide.</span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 text-destructive border-destructive/50 hover:bg-destructive/10"
          onClick={onDeny}
        >
          <X className="w-3.5 h-3.5" />
          Deny
        </Button>
        <Button
          variant="default"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={handleApprove}
          disabled={approving}
        >
          {approving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          {approveLabel}
        </Button>
      </div>
    </div>
  );
}
