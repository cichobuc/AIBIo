import { EventEmitter } from 'node:events';
import type { ApprovalGateType, ApprovalGateDetails } from '@/core/types/permissions';
import type { DocRecordType } from '@/core/types/agent';

export type BaseSSEEvent = {
  sessionId: string;
  workspaceId: string;
  timestamp: string; // ISO 8601
};

// --- Agent lifecycle ---

type AgentThinkingEvent = BaseSSEEvent & {
  type: 'agent_thinking';
  payload: { agentName: string; message: string };
};

type AgentMessageEvent = BaseSSEEvent & {
  type: 'agent_message';
  payload: {
    agentName: string;
    content: string;
    isPartial: boolean;
    messageId: string;
    role: 'user' | 'assistant';
  };
};

// --- Tool calls ---

type ToolCallEvent = BaseSSEEvent & {
  type: 'tool_call';
  payload: { agentName: string; toolName: string; toolCallId: string };
};

type ToolResultEvent = BaseSSEEvent & {
  type: 'tool_result';
  payload: { toolCallId: string; toolName: string; success: boolean; summary: string };
};

// --- Approval gates ---

type ApprovalRequiredEvent = BaseSSEEvent & {
  type: 'approval_required';
  payload: {
    requestId: string;
    gateType: ApprovalGateType;
    agentName: string;
    description: string;
    details: ApprovalGateDetails;
    timeoutAt: string; // ISO 8601
  };
};

type ApprovalResolvedEvent = BaseSSEEvent & {
  type: 'approval_resolved';
  payload: { requestId: string; decision: 'approved' | 'denied'; gateType: ApprovalGateType };
};

// --- Domain updates ---

type DocUpdateEvent = BaseSSEEvent & {
  type: 'doc_update';
  payload: { recordType: DocRecordType; recordId: string; name: string; action: 'created' | 'updated' };
};

type CoverageUpdateEvent = BaseSSEEvent & {
  type: 'coverage_update';
  payload: {
    coveragePct: number;
    byType: { tables: number; columns: number; businessTerms: number; relationships: number };
  };
};

type ModelRunUpdateEvent = BaseSSEEvent & {
  type: 'model_run_update';
  payload: {
    runId: string;
    modelName: string;
    status: 'running' | 'success' | 'error';
    durationMs?: number;
    error?: string;
    rowsAffected?: number;
  };
};

type TestRunUpdateEvent = BaseSSEEvent & {
  type: 'test_run_update';
  payload: {
    runId: string;
    testId: string;
    testName: string;
    status: 'running' | 'pass' | 'fail' | 'error';
    failureCount?: number;
    error?: string;
  };
};

type SchemaUpdateEvent = BaseSSEEvent & {
  type: 'schema_update';
  payload: {
    dataSourceId: string;
    dataSourceName: string;
    snapshotId: string;
    tablesAdded: number;
    tablesRemoved: number;
    columnsChanged: number;
  };
};

// --- Explore query session updates ---

type QuerySessionUpdatedEvent = BaseSSEEvent & {
  type: 'query_session_updated';
  payload: {
    sessionId: string;
    sqlDraft: string;
    hasUnrevertedAgentEdit: boolean;
    updatedBy: 'agent' | 'user';
  };
};

// --- Translate (Phase 2) ---

type SnippetGeneratedEvent = BaseSSEEvent & {
  type: 'snippet_generated';
  payload: {
    snippetId: string;
    modelId: string;
    languageId: string;
    confidence: 'high' | 'medium' | 'low';
    fromCache: boolean;
    limitationsCount: number;
  };
};

type SnippetTestResultEvent = BaseSSEEvent & {
  type: 'snippet_test_result';
  payload: {
    snippetId: string;
    languageId: string;
    status:
      | 'passed'
      | 'failed'
      | 'syntax_ok'
      | 'syntax_error'
      | 'runtime_error'
      | 'timeout'
      | 'generated_only';
    rowCountMatch: boolean | null;
    schemaMatch: boolean | null;
    dataEquivalent: boolean | null;
    durationMs: number;
  };
};

// --- Budget ---

type BudgetWarningEvent = BaseSSEEvent & {
  type: 'budget_warning';
  payload: { usedTokens: number; limitTokens: number; thresholdPct: number };
};

// --- Stream control ---

type StreamEndEvent = BaseSSEEvent & {
  type: 'stream_end';
  payload: { summary: string; agentsUsed: string[]; totalDurationMs: number };
};

type StreamErrorEvent = BaseSSEEvent & {
  type: 'stream_error';
  payload: { errorCode: string; message: string; agentName?: string; recoverable: boolean };
};

// PingEvent has no sessionId per spec — heartbeat only
type PingEvent = {
  type: 'ping';
};

// --- Discriminated union ---

export type SSEEvent =
  | AgentThinkingEvent
  | AgentMessageEvent
  | ToolCallEvent
  | ToolResultEvent
  | ApprovalRequiredEvent
  | ApprovalResolvedEvent
  | DocUpdateEvent
  | CoverageUpdateEvent
  | ModelRunUpdateEvent
  | TestRunUpdateEvent
  | SchemaUpdateEvent
  | QuerySessionUpdatedEvent
  | SnippetGeneratedEvent
  | SnippetTestResultEvent
  | BudgetWarningEvent
  | StreamEndEvent
  | StreamErrorEvent
  | PingEvent;

class WorkspaceSSEEmitter {
  private readonly bus = new EventEmitter();

  constructor() {
    this.bus.setMaxListeners(100);
  }

  emit(workspaceId: string, event: SSEEvent): void {
    this.bus.emit(`ws:${workspaceId}`, event);
  }

  subscribe(workspaceId: string, cb: (event: SSEEvent) => void): () => void {
    const channel = `ws:${workspaceId}`;
    this.bus.on(channel, cb);
    return () => this.bus.off(channel, cb);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __aibio_sse: WorkspaceSSEEmitter | undefined;
}

if (!global.__aibio_sse) {
  global.__aibio_sse = new WorkspaceSSEEmitter();
}

export const sseEmitter: WorkspaceSSEEmitter = global.__aibio_sse;
