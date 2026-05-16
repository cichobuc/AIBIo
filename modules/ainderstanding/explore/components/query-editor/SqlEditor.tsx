'use client';

import { useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { OnMount, EditorProps } from '@monaco-editor/react';

const MonacoEditor = dynamic<EditorProps>(() => import('@monaco-editor/react').then((m) => m.Editor), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      Loading editor…
    </div>
  ),
});

type SchemaTable = { name: string; columns: string[] };

type Props = {
  value: string;
  onChange: (sql: string) => void;
  onRun: () => void;
  workspaceId: string;
  sourceId: string;
  sessionId: string;
};

export function SqlEditor({ value, onChange, onRun, workspaceId, sourceId, sessionId }: Props) {
  const schemaRef = useRef<SchemaTable[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providerRef = useRef<{ dispose: () => void } | null>(null);

  const fetchSchema = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/explore/${workspaceId}/autocomplete-schema?source=${encodeURIComponent(sourceId)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { tables: SchemaTable[] };
        schemaRef.current = data.tables ?? [];
      }
    } catch {}
  }, [workspaceId, sourceId]);

  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      // Register SQL autocomplete provider
      const provider = monaco.languages.registerCompletionItemProvider('sql', {
        triggerCharacters: ['.', ' ', '\n'],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        provideCompletionItems(model: any, position: any) {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          // Check if typing after a dot (column completion)
          const lineText = model.getLineContent(position.lineNumber);
          const beforeCursor = lineText.slice(0, position.column - 1);
          const dotMatch = beforeCursor.match(/(\w+)\.$/);

          if (dotMatch) {
            const tableName = dotMatch[1].toLowerCase();
            const table = schemaRef.current.find((t) => t.name.toLowerCase() === tableName);
            if (table) {
              return {
                suggestions: table.columns.map((col) => ({
                  label: col,
                  kind: monaco.languages.CompletionItemKind.Field,
                  insertText: col,
                  range,
                })),
              };
            }
          }

          // Table name completion
          return {
            suggestions: schemaRef.current.map((t) => ({
              label: t.name,
              kind: monaco.languages.CompletionItemKind.Module,
              insertText: t.name,
              range,
            })),
          };
        },
      });

      providerRef.current = provider;

      // Ctrl+Enter / Cmd+Enter to run
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        onRun,
      );
    },
    [onRun],
  );

  // Cleanup provider on unmount
  useEffect(() => {
    return () => {
      providerRef.current?.dispose();
    };
  }, []);

  return (
    <MonacoEditor
      key={sessionId}
      height="100%"
      language="sql"
      theme="vs-dark"
      value={value}
      onChange={(v) => onChange(v ?? '')}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 2,
        automaticLayout: true,
      }}
    />
  );
}
