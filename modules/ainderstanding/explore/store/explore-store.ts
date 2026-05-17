'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  truncated: boolean;
  historyId: string;
};

type QueryError = {
  error: string;
  reason?: string;
  offendingTables?: string[];
  detail?: string;
};

export type QuerySessionState = {
  running: boolean;
  result: QueryResult | null;
  error: QueryError | null;
  sql: string;
  sourceId: string;
};

interface ExploreState {
  activeQuerySessionId: string | null;
  querySessions: Record<string, QuerySessionState>;
  setActiveQuerySessionId: (id: string | null) => void;
  startQuery: (sessionId: string, sql: string, sourceId: string) => void;
  setQueryResult: (sessionId: string, result: QueryResult | null) => void;
  setQueryError: (sessionId: string, error: QueryError | null) => void;
  clearQueryState: (sessionId: string) => void;
}

export const useExploreStore = create<ExploreState>()(
  persist(
    (set) => ({
      activeQuerySessionId: null,
      querySessions: {},
      setActiveQuerySessionId: (id) => set({ activeQuerySessionId: id }),
      startQuery: (sessionId, sql, sourceId) =>
        set((s) => ({
          querySessions: {
            ...s.querySessions,
            [sessionId]: { running: true, result: null, error: null, sql, sourceId },
          },
        })),
      setQueryResult: (sessionId, result) =>
        set((s) => {
          const prev = s.querySessions[sessionId];
          return {
            querySessions: {
              ...s.querySessions,
              [sessionId]: { running: false, error: null, sql: prev?.sql ?? '', sourceId: prev?.sourceId ?? '', result },
            },
          };
        }),
      setQueryError: (sessionId, error) =>
        set((s) => {
          const prev = s.querySessions[sessionId];
          return {
            querySessions: {
              ...s.querySessions,
              [sessionId]: { running: false, result: null, sql: prev?.sql ?? '', sourceId: prev?.sourceId ?? '', error },
            },
          };
        }),
      clearQueryState: (sessionId) =>
        set((s) => {
          const next = { ...s.querySessions };
          delete next[sessionId];
          return { querySessions: next };
        }),
    }),
    {
      name: 'aibio-explore',
      partialize: (s) => ({ activeQuerySessionId: s.activeQuerySessionId }),
    },
  ),
);
