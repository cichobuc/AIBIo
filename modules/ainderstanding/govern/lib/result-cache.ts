import { randomUUID } from 'node:crypto';
import type { QueryResult } from '@/core/types/workspace';

const TTL_MS = 300_000;

type CacheEntry = {
  rows: Record<string, unknown>[];
  columns: string[];
  sessionId: string;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

// BR-GOV-050: TTL 5 min, session-scoped
export function storeResult(
  sessionId: string,
  rows: Record<string, unknown>[],
  columns: string[],
): string {
  const resultHandle = randomUUID();
  cache.set(resultHandle, {
    rows,
    columns,
    sessionId,
    expiresAt: Date.now() + TTL_MS,
  });
  return resultHandle;
}

// BR-GOV-051: session-scoped — wrong session or expired returns null
export function getResult(resultHandle: string, sessionId: string): QueryResult | null {
  const entry = cache.get(resultHandle);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(resultHandle);
    return null;
  }
  if (entry.sessionId !== sessionId) return null;

  return {
    columns: entry.columns,
    rows: entry.rows,
    rowCount: entry.rows.length,
  };
}

export function evictSession(sessionId: string): void {
  for (const [handle, entry] of cache.entries()) {
    if (entry.sessionId === sessionId) cache.delete(handle);
  }
}
