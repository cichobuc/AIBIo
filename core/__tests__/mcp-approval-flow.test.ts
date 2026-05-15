import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerTool, getTool, getAllTools } from '@/core/orchestration/tool-registry';
import {
  awaitApproval,
  resolveApproval,
  hasPendingGate,
  wasAlreadyResolved,
  cleanupPendingGates,
  ApprovalDeniedError,
} from '@/core/orchestration/approval-gate';
import { withAgentContext } from '@/core/orchestration/context';
import type { AgentContext } from '@/core/types/agent';

function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    workspaceId: 'ws-test',
    agentName: 'supervisor',
    sessionId: 'sess-test',
    aiMode: 'auto',
    activeModule: 'shell',
    tokenCounter: { input: 0, output: 0 },
    tokenLimit: 100_000,
    ...overrides,
  };
}

describe('tool-registry — registerTool / callTool round-trip', () => {
  it('registers and invokes a tool', async () => {
    registerTool({
      name: 'test_echo',
      allowedCallers: ['supervisor'],
      requiresApproval: null,
      description: 'Echoes input',
      inputSchema: {
        type: 'object' as const,
        properties: { msg: { type: 'string' } },
        required: ['msg'],
      },
      handler: async (input: Record<string, unknown>) => ({ echo: input['msg'] }),
    });

    const tool = getTool('test_echo');
    expect(tool).toBeDefined();
    const result = await tool!.handler({ msg: 'hello' }, makeCtx());
    expect(result).toEqual({ echo: 'hello' });
  });

  it('getAllTools returns registered tools', () => {
    const tools = getAllTools();
    expect(tools.some((t) => t.name === 'test_echo')).toBe(true);
  });
});

describe('awaitApproval — happy path (approve)', () => {
  afterEach(() => cleanupPendingGates());

  it('resolves approved when resolveApproval is called with approved', async () => {
    const { promise, requestId } = await withAgentContext(makeCtx(), async () => {
      return awaitApproval('write_model_file', {
        modelName: 'stg_orders',
        layer: 'staging',
        sqlDiff: '+ SELECT ...',
      });
    });

    expect(hasPendingGate(requestId)).toBe(true);

    resolveApproval(requestId, 'approved');

    const result = await promise;
    expect(result.decision).toBe('approved');
    expect(result.requestId).toBe(requestId);
    expect(hasPendingGate(requestId)).toBe(false);
    expect(wasAlreadyResolved(requestId)).toBe(true);
  });
});

describe('awaitApproval — deny path', () => {
  afterEach(() => cleanupPendingGates());

  it('resolves denied when resolveApproval is called with denied', async () => {
    const { promise, requestId } = await withAgentContext(makeCtx(), async () => {
      return awaitApproval('execute_query', { sql: 'SELECT 1', dataSourceName: 'chinook' });
    });

    resolveApproval(requestId, 'denied');

    const result = await promise;
    expect(result.decision).toBe('denied');
    expect(result.requestId).toBe(requestId);
  });
});

describe('awaitApproval — parallel isolation (AsyncLocalStorage)', () => {
  afterEach(() => cleanupPendingGates());

  it('three concurrent awaitApproval calls each get their own requestId', async () => {
    const ctxA = makeCtx({ agentName: 'schema-explorer', sessionId: 'sess-a' });
    const ctxB = makeCtx({ agentName: 'data-profiler', sessionId: 'sess-b' });
    const ctxC = makeCtx({ agentName: 'sql-writer', sessionId: 'sess-c' });

    const gateA = await withAgentContext(ctxA, async () =>
      awaitApproval('write_model_file', {
        modelName: 'dim_a',
        layer: 'marts',
        sqlDiff: '+a',
      }),
    );
    const gateB = await withAgentContext(ctxB, async () =>
      awaitApproval('write_model_file', {
        modelName: 'dim_b',
        layer: 'marts',
        sqlDiff: '+b',
      }),
    );
    const gateC = await withAgentContext(ctxC, async () =>
      awaitApproval('execute_query', { sql: 'SELECT 1', dataSourceName: 'northwind' }),
    );

    expect(new Set([gateA.requestId, gateB.requestId, gateC.requestId]).size).toBe(3);
    expect(hasPendingGate(gateA.requestId)).toBe(true);
    expect(hasPendingGate(gateB.requestId)).toBe(true);
    expect(hasPendingGate(gateC.requestId)).toBe(true);

    resolveApproval(gateA.requestId, 'approved');
    resolveApproval(gateB.requestId, 'denied');
    resolveApproval(gateC.requestId, 'approved');

    const [rA, rB, rC] = await Promise.all([gateA.promise, gateB.promise, gateC.promise]);
    expect(rA.decision).toBe('approved');
    expect(rB.decision).toBe('denied');
    expect(rC.decision).toBe('approved');
  });
});

describe('awaitApproval — timeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    cleanupPendingGates();
  });

  it('resolves denied after timeout', async () => {
    const SHORT_TIMEOUT = 5_000;

    const { promise } = await withAgentContext(makeCtx(), async () => {
      return awaitApproval(
        'execute_query',
        { sql: 'SELECT *', dataSourceName: 'test-db' },
        { timeoutMs: SHORT_TIMEOUT },
      );
    });

    vi.advanceTimersByTime(SHORT_TIMEOUT + 100);

    const result = await promise;
    expect(result.decision).toBe('denied');
  });
});
