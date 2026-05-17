'use client';

import { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import type { SSEEvent } from '@/core/orchestration/streaming';

const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000];

export function useSSEStream(workspaceId: string) {
  const addMessage = useWorkspaceStore((s) => s.addMessage);
  const setPendingApproval = useWorkspaceStore((s) => s.setPendingApproval);
  const addActiveAgent = useWorkspaceStore((s) => s.addActiveAgent);
  const removeActiveAgent = useWorkspaceStore((s) => s.removeActiveAgent);
  const setSession = useWorkspaceStore((s) => s.setSession);
  const setBottomPanelOpen = useWorkspaceStore((s) => s.setBottomPanelOpen);
  const setLastQuerySessionUpdate = useWorkspaceStore((s) => s.setLastQuerySessionUpdate);

  const retryRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const lastPingRef = useRef(Date.now());

  useEffect(() => {
    if (!workspaceId) return;

    function connect() {
      esRef.current?.close();
      const es = new EventSource(`/api/stream/${workspaceId}`);
      esRef.current = es;
      lastPingRef.current = Date.now();

      es.onopen = () => {
        retryRef.current = 0;
      };

      es.onmessage = (e) => {
        lastPingRef.current = Date.now();
        let event: SSEEvent;
        try {
          event = JSON.parse(e.data) as SSEEvent;
        } catch {
          return;
        }
        if (event.type === 'ping') return;
        dispatchEvent(event);
      };

      es.onerror = () => {
        es.close();
        if (retryRef.current < BACKOFF_DELAYS.length) {
          setTimeout(connect, BACKOFF_DELAYS[retryRef.current]);
          retryRef.current++;
        }
      };
    }

    connect();

    // Detect stale connection (>30s without ping → reconnect)
    const staleness = setInterval(() => {
      if (Date.now() - lastPingRef.current > 30_000) {
        retryRef.current = 0;
        connect();
      }
    }, 15_000);

    return () => {
      esRef.current?.close();
      clearInterval(staleness);
    };
  }, [workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  function dispatchEvent(event: SSEEvent) {
    addMessage(event);

    switch (event.type) {
      case 'agent_thinking':
        addActiveAgent({ agentName: event.payload.agentName, message: event.payload.message });
        break;
      case 'stream_end':
        setSession(false);
        useWorkspaceStore.getState().activeAgents.forEach((a) => removeActiveAgent(a.agentName));
        break;
      case 'stream_error':
        setSession(false);
        break;
      case 'approval_required':
        setPendingApproval(event.payload);
        break;
      case 'approval_resolved':
        setPendingApproval(null);
        break;
      case 'model_run_update':
      case 'test_run_update':
        setBottomPanelOpen(true);
        break;
      case 'query_session_updated':
        setLastQuerySessionUpdate(event.payload);
        break;
    }
  }
}
