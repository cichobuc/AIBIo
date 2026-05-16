'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Database } from 'lucide-react';
import { QueryTabBar } from './QueryTabBar';
import { SqlEditor } from './SqlEditor';
import { QueryResultPanel } from './QueryResultPanel';
import type { ExploreSource } from '../../lib/explore-data';

type Session = {
  id: string;
  workspaceId: string;
  dataSourceId: string;
  title: string | null;
  sqlDraft: string;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  workspaceId: string;
  initialSessions: Session[];
  sources: ExploreSource[];
  activeSessionId: string;
};

// Auto-save draft to API after this many ms of inactivity
const DRAFT_DEBOUNCE_MS = 1500;

export function QueryEditorContainer({ workspaceId, initialSessions, sources, activeSessionId }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initialSessions.map((s) => [s.id, s.sqlDraft])),
  );
  const [triggerRun, setTriggerRun] = useState(0);
  const draftTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  // Merge sessions added server-side (e.g. opened in another tab) into local state
  useEffect(() => {
    setSessions((prev) => {
      const prevIds = new Set(prev.map((s) => s.id));
      const additions = initialSessions.filter((s) => !prevIds.has(s.id));
      if (additions.length === 0) return prev;
      return [...prev, ...additions];
    });
    setDrafts((prev) => ({
      ...Object.fromEntries(
        initialSessions.filter((s) => !(s.id in prev)).map((s) => [s.id, s.sqlDraft]),
      ),
      ...prev,
    }));
  }, [initialSessions]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0] ?? null;
  const activeDraft = activeSession ? (drafts[activeSession.id] ?? activeSession.sqlDraft) : '';
  const activeSource = activeSession
    ? sources.find((s) => s.id === activeSession.dataSourceId) ?? null
    : null;

  const tabs = sessions.map((s, i) => ({ id: s.id, title: s.title, index: i }));

  const switchTab = useCallback(
    (id: string) => {
      const params = new URLSearchParams(sp.toString());
      params.set('query', id);
      params.delete('source');
      params.delete('table');
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, sp],
  );

  const closeTab = useCallback(
    async (id: string) => {
      await fetch(`/api/explore/${workspaceId}/sessions/${id}`, { method: 'DELETE' });
      const remaining = sessionsRef.current.filter((s) => s.id !== id);
      setSessions(remaining);
      const params = new URLSearchParams(sp.toString());
      const last = remaining[remaining.length - 1];
      if (last) {
        params.set('query', last.id);
      } else {
        params.delete('query');
      }
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [workspaceId, router, sp],
  );

  const handleDraftChange = useCallback(
    (sql: string) => {
      if (!activeSession) return;
      const id = activeSession.id;
      setDrafts((prev) => ({ ...prev, [id]: sql }));

      clearTimeout(draftTimers.current[id]);
      draftTimers.current[id] = setTimeout(() => {
        fetch(`/api/explore/${workspaceId}/sessions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sqlDraft: sql }),
        }).catch(() => {});
      }, DRAFT_DEBOUNCE_MS);
    },
    [activeSession, workspaceId],
  );

  const handleRun = useCallback(() => {
    setTriggerRun((n) => n + 1);
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of Object.values(draftTimers.current)) clearTimeout(timer);
    };
  }, []);

  if (!activeSession) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        No open query sessions.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col min-w-0">
      <QueryTabBar
        tabs={tabs}
        activeId={activeSession.id}
        onSelect={switchTab}
        onClose={closeTab}
      />

      {/* Source badge */}
      {activeSource && (
        <div className="flex h-6 shrink-0 items-center gap-1.5 border-b border-border px-3 bg-muted/10">
          <Database className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{activeSource.name}</span>
        </div>
      )}

      {/* Editor — 50% height */}
      <div className="min-h-0 flex-1 flex flex-col" style={{ flexBasis: '50%' }}>
        <SqlEditor
          key={activeSession.id}
          value={activeDraft}
          onChange={handleDraftChange}
          onRun={handleRun}
          workspaceId={workspaceId}
          sourceId={activeSession.dataSourceId}
          sessionId={activeSession.id}
        />
      </div>

      {/* Results panel — 50% height */}
      <div className="min-h-0 flex-1 flex flex-col" style={{ flexBasis: '50%' }}>
        <QueryResultPanel
          sessionId={activeSession.id}
          sourceId={activeSession.dataSourceId}
          workspaceId={workspaceId}
          sql={activeDraft}
          triggerRun={triggerRun}
        />
      </div>
    </div>
  );
}
