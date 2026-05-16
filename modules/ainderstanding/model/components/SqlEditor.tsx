'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { OnMount, EditorProps } from '@monaco-editor/react';
import { Button, Badge, cn } from '@/core/ui';
import { toast } from 'sonner';
import { Save, CheckCircle, AlertCircle, Edit2, Loader2 } from 'lucide-react';
import type { Model } from '../db/schema';

const MonacoEditor = dynamic<EditorProps>(() => import('@monaco-editor/react').then((m) => m.Editor), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      Loading editor…
    </div>
  ),
});

interface ValidationMarker {
  line: number;
  column: number;
  message: string;
}

interface Props {
  model: Model;
  workspaceId: string;
  initialSql: string;
  onSaved?: () => void;
}

export function SqlEditor({ model, workspaceId, initialSql, onSaved }: Props) {
  const [sql, setSql] = useState(initialSql);
  const [readOnly, setReadOnly] = useState(!model.isDirty);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [markers, setMarkers] = useState<ValidationMarker[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monacoRef = useRef<any>(null);
  const providerRef = useRef<{ dispose: () => void } | null>(null);
  const handleSaveRef = useRef<() => Promise<void>>(async () => {});

  const applyMarkers = useCallback((errs: ValidationMarker[]) => {
    if (!editorRef.current || !monacoRef.current) return;
    const monaco = monacoRef.current;
    const mks = errs.map((e) => ({
      startLineNumber: e.line,
      endLineNumber: e.line,
      startColumn: e.column,
      endColumn: e.column + 20,
      message: e.message,
      severity: monaco.MarkerSeverity.Error,
    }));
    monaco.editor.setModelMarkers(editorRef.current.getModel(), 'sql-validator', mks);
  }, []);

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Register AIBIo SQL tokenizer overlay for ref() and source()
      try {
        monaco.languages.register({ id: 'sql-aibio' });
        monaco.languages.setMonarchTokensProvider('sql-aibio', {
          tokenizer: {
            root: [
              [/\bref\s*\(/, 'keyword.aibio'],
              [/\bsource\s*\(/, 'keyword.aibio'],
              [/'[^']*'/, 'string'],
              [/"[^"]*"/, 'string'],
              [/--[^\n]*/, 'comment'],
              [/\bSELECT\b|\bFROM\b|\bWHERE\b|\bJOIN\b|\bGROUP\s+BY\b|\bORDER\s+BY\b/i, 'keyword'],
            ],
          },
        });
      } catch {
        // Already registered
      }

      // ⌘S / Ctrl+S to save — use ref so the shortcut always calls the latest handleSave
      editor.addCommand(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (monaco as any).KeyMod.CtrlCmd | (monaco as any).KeyCode.KeyS,
        () => void handleSaveRef.current(),
      );

      // Cleanup autocomplete provider on remount
      providerRef.current?.dispose();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    return () => {
      providerRef.current?.dispose();
    };
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/model/${workspaceId}/${model.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Saved');
      onSaved?.();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [workspaceId, model.id, sql, onSaved]);

  // Keep ref current so the Monaco Cmd+S binding always calls the latest handleSave
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  const handleValidate = useCallback(async () => {
    setValidating(true);
    try {
      const res = await fetch(`/api/model/${workspaceId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, workspaceId }),
      });
      if (!res.ok) throw new Error('Validation request failed');
      const data = (await res.json()) as {
        valid: boolean;
        errors: ValidationMarker[];
        unresolved_refs: string[];
      };
      setMarkers(data.errors);
      applyMarkers(data.errors);
      if (data.valid) {
        toast.success('SQL is valid');
      } else {
        toast.error(`${data.errors.length} error(s) found`);
      }
    } catch {
      toast.error('Validation failed');
    } finally {
      setValidating(false);
    }
  }, [workspaceId, sql, applyMarkers]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-card">
        <span className="font-mono text-xs text-muted-foreground flex-1 truncate">
          {model.name}.sql
        </span>
        {model.isDirty && (
          <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-500 h-5 px-1.5">
            Unsaved changes
          </Badge>
        )}
        {markers.length > 0 && (
          <AlertCircle className="w-3.5 h-3.5 text-destructive" />
        )}
        {readOnly && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={() => setReadOnly(false)}
          >
            <Edit2 className="w-3 h-3" />
            Edit
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1"
          onClick={handleValidate}
          disabled={validating}
        >
          {validating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <CheckCircle className="w-3 h-3" />
          )}
          Validate
        </Button>
        {!readOnly && (
          <Button
            variant="default"
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </Button>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <MonacoEditor
          height="100%"
          language="sql"
          theme="vs-dark"
          value={sql}
          onChange={(v) => setSql(v ?? '')}
          onMount={handleMount}
          options={{
            readOnly,
            minimap: { enabled: false },
            automaticLayout: true,
            wordWrap: 'on',
            tabSize: 2,
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            renderWhitespace: 'selection',
          }}
        />
      </div>
    </div>
  );
}
