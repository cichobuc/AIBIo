export type CoordinatorName =
  | 'explore-coordinator'
  | 'model-coordinator'
  | 'document-coordinator'
  | 'quality-coordinator';

export type AtomicAgentName =
  | 'schema-explorer'
  | 'data-profiler'
  | 'interviewer'
  | 'docs-keeper'
  | 'model-architect'
  | 'sql-writer'
  | 'transformation-suggester'
  | 'test-generator'
  | 'code-generator-syntax'
  | 'code-generator-semantic'
  | 'query-card-editor';

/** @deprecated Use AtomicAgentName — kept for incremental migration */
export type SubagentName = AtomicAgentName;

export type ActorName = AtomicAgentName | CoordinatorName | 'supervisor';

import type { AIMode } from './workspace';
export type { AIMode };

export type TokenCounter = {
  input: number;
  output: number;
};

export type AgentContext = {
  workspaceId: string;
  agentName: ActorName;
  sessionId: string;
  aiMode: AIMode;
  activeModule: string;
  activeQuerySessionId?: string | null;
  tokenCounter: TokenCounter;
  tokenLimit: number;
};

export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type DocSource = 'db_native' | 'ai_generated' | 'user_authored' | 'user_confirmed';
export type DocRecordType = 'table' | 'column' | 'business_term' | 'relationship' | 'convention';
export type ModelLayer = 'staging' | 'intermediate' | 'marts';
export type Materialization = 'table' | 'view' | 'incremental';
export type RunStatus = 'success' | 'error' | 'running' | 'queued';
export type TestKind = 'unique' | 'not_null' | 'foreign_key' | 'accepted_values';
