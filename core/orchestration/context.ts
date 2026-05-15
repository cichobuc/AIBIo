import { AsyncLocalStorage } from 'node:async_hooks';
import type { AgentContext } from '@/core/types/agent';
import { sseEmitter } from './streaming';

export type { AgentContext };

export class BudgetExceededError extends Error {
  constructor(
    public readonly usedTokens: number,
    public readonly limitTokens: number,
  ) {
    super(`Token budget exceeded: ${usedTokens} / ${limitTokens}`);
    this.name = 'BudgetExceededError';
  }
}

const storage = new AsyncLocalStorage<AgentContext>();

export function withAgentContext<T>(ctx: AgentContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

export function getAgentContext(): AgentContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error(
      'No AgentContext in scope — wrap the call with withAgentContext(ctx, fn). ' +
        'If this fires in a Next.js Route Handler, ensure AsyncLocalStorage is not running in Edge Runtime.',
    );
  }
  return ctx;
}

export function tryGetAgentContext(): AgentContext | undefined {
  return storage.getStore();
}

// Records token usage for the current agent context.
// Emits 'budget_warning' SSE at 80% threshold and throws BudgetExceededError at 100%.
export function recordTokenUsage(inputTokens: number, outputTokens: number): void {
  const ctx = storage.getStore();
  if (!ctx) return;

  ctx.tokenCounter.input += inputTokens;
  ctx.tokenCounter.output += outputTokens;

  const used = ctx.tokenCounter.input + ctx.tokenCounter.output;
  const limit = ctx.tokenLimit;
  const pct = used / limit;

  if (pct >= 1) {
    sseEmitter.emit(ctx.workspaceId, {
      type: 'stream_error',
      sessionId: ctx.sessionId,
      workspaceId: ctx.workspaceId,
      timestamp: new Date().toISOString(),
      payload: { errorCode: 'BUDGET_EXCEEDED', message: 'Token budget exceeded', recoverable: false },
    });
    throw new BudgetExceededError(used, limit);
  }

  if (pct >= 0.8) {
    sseEmitter.emit(ctx.workspaceId, {
      type: 'budget_warning',
      sessionId: ctx.sessionId,
      workspaceId: ctx.workspaceId,
      timestamp: new Date().toISOString(),
      payload: { usedTokens: used, limitTokens: limit, thresholdPct: Math.round(pct * 100) },
    });
  }
}
