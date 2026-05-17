'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Database, Play } from 'lucide-react';
import { QueryTabBar } from './QueryTabBar';
import { SqlEditor } from './SqlEditor';
import { Button } from '@/core/ui';
import { useExploreStore } from '../../store/explore-store';
import { useWorkspaceStore } from '@/modules/ainderstanding/shell/store/workspace-store';
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
  const setActiveQuerySessionId = useExploreStore((s) => s.setActiveQuerySessionId);

  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initialSessions.map((s) => [s.id, s.sqlDraft])),
  );
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

  // Persist active session into store so ExplorePageClient can restore it on re-mount
  const activeSessionId_ = activeSession?.id ?? null;
  useEffect(() => {
    if (activeSessionId_) setActiveQuerySessionId(activeSessionId_);
  }, [activeSessionId_, setActiveQuerySessionId]);

  const running = useExploreStore(
    (s) => (activeSession ? s.querySessions[activeSession.id]?.running ?? false : false),
  );

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
      useExploreStore.getState().clearQueryState(id);
      const remaining = sessionsRef.current.filter((s) => s.id !== id);
      setSessions(remaining);
      const params = new URLSearchParams(sp.toString());
      const last = remaining[remaining.length - 1];
      if (last) {
        params.set('query', last.id);
        setActiveQuerySessionId(last.id);
      } else {
        params.delete('query');
        setActiveQuerySessionId(null);
      }
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [workspaceId, router, sp, setActiveQuerySessionId],
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

  const handleRun = useCallback(async () => {
    if (!activeSession) return;
    const sessionId = activeSession.id;
    const sql = activeDraft;
    if (!sql.trim()) return;

    const exploreStore = useExploreStore.getState();
    if (exploreStore.querySessions[sessionId]?.running) return;

    useWorkspaceStore.getState().setBottomPanelOpen(true);
    useWorkspaceStore.getState().setBottomPanelTab('results');

    exploreStore.startQuery(sessionId, sql, activeSession.dataSourceId);

    try {
      const res = await fetch(`/api/explore/${workspaceId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, sourceId: activeSession.dataSourceId, sql }),
      });
      const data = await res.json();
      if (!res.ok) {
        useExploreStore.getState().setQueryError(sessionId, data);
      } else {
        useExploreStore.getState().setQueryResult(sessionId, data);
      }
    } catch (e) {
      useExploreStore.getState().setQueryError(sessionId, { error: 'query_failed', detail: String(e) });
    }
  }, [activeSession, activeDraft, workspaceId]);

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

      {/* Source badge + Run button */}
      <div className="flex h-6 shrink-0 items-center gap-1.5 border-b border-border px-3 bg-muted/10">
        {activeSource && (
          <>
            <Database className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{activeSource.name}</span>
          </>
        )}
        <Button
          size="sm"
          variant="default"
          className="ml-auto h-5 text-[11px] gap-1 px-1.5"
          disabled={running || !activeDraft.trim()}
          onClick={handleRun}
        >
          <Play className="h-2.5 w-2.5" />
          {running ? 'Running…' : 'Run'}
        </Button>
      </div>

      {/* Editor — full height */}
      <div className="min-h-0 flex-1">
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
    </div>
  );
}
