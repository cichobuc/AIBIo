import { registerTool } from '@/core/orchestration/tool-registry';
import { getAdapterForSource } from '@/modules/ainderstanding/connect/lib/adapters/get-adapter';
import {
  detectSchemaChanges,
  readSchemaSnapshot,
  readProfiles,
  detectPiiCandidates,
  suggestReferenceTableFlags,
  runProfileQuery,
} from './mcp-tools';
import {
  getOpenSessions,
  getSession,
  applyAgentEdit,
} from './query-sessions';
import { getSource } from '@/modules/ainderstanding/connect/lib/data-source-service';
import { awaitApproval } from '@/core/orchestration/approval-gate';
import { getAgentContext } from '@/core/orchestration/context';
import { sseEmitter } from '@/core/orchestration/streaming';
import type { SchemaSnapshot } from '@/core/types/workspace';

export function registerExploreTools(): void {
  registerTool({
    name: 'mcp__aibio__detect_schema_changes',
    description: 'Persist a new schema snapshot and diff it against the previous one. Returns counts of added/removed/modified tables and columns.',
    inputSchema: {
      type: 'object',
      properties: {
        dataSourceId: { type: 'string' },
        snapshot: { type: 'object', description: 'SchemaSnapshot JSON object' },
      },
      required: ['dataSourceId', 'snapshot'],
    },
    allowedCallers: ['schema-explorer'],
    requiresApproval: null,
    handler: async ({ dataSourceId, snapshot }) => {
      return detectSchemaChanges(dataSourceId as string, snapshot as SchemaSnapshot);
    },
  });

  registerTool({
    name: 'mcp__aibio__read_schema_snapshot',
    description: 'Read the latest schema snapshot for a data source. Layer 1 — no permission check.',
    inputSchema: {
      type: 'object',
      properties: {
        dataSourceId: { type: 'string' },
      },
      required: ['dataSourceId'],
    },
    allowedCallers: [
      'schema-explorer',
      'data-profiler',
      'explore-coordinator',
      'interviewer',
      'model-architect',
      'sql-writer',
      'test-generator',
      'code-generator-syntax',
      'code-generator-semantic',
    ],
    requiresApproval: null,
    handler: async ({ dataSourceId }) => {
      return readSchemaSnapshot(dataSourceId as string);
    },
  });

  registerTool({
    name: 'mcp__aibio__read_profiles',
    description: 'Read table and column profiles for a data source. Layer 1 — no permission check.',
    inputSchema: {
      type: 'object',
      properties: {
        dataSourceId: { type: 'string' },
      },
      required: ['dataSourceId'],
    },
    allowedCallers: [
      'data-profiler',
      'model-architect',
      'sql-writer',
      'interviewer',
      'test-generator',
      'transformation-suggester',
      'code-generator-syntax',
      'code-generator-semantic',
    ],
    requiresApproval: null,
    handler: async ({ dataSourceId }) => {
      return readProfiles(dataSourceId as string);
    },
  });

  registerTool({
    name: 'mcp__aibio__detect_pii_candidates',
    description: 'Detect PII candidate columns by name-based heuristics only (BR-XPL-003). Returns list with isPiiCandidate and reason.',
    inputSchema: {
      type: 'object',
      properties: {
        columnNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'Column names to check',
        },
      },
      required: ['columnNames'],
    },
    allowedCallers: ['data-profiler', 'schema-explorer'],
    requiresApproval: null,
    handler: async ({ columnNames }) => {
      return detectPiiCandidates(columnNames as string[]);
    },
  });

  registerTool({
    name: 'mcp__aibio__suggest_reference_table_flags',
    description: 'Suggest tables that qualify as reference tables (row_count < 10k, low cardinality, no PII). Returns suggestions — user must confirm in UI.',
    inputSchema: {
      type: 'object',
      properties: {
        dataSourceId: { type: 'string' },
      },
      required: ['dataSourceId'],
    },
    allowedCallers: ['data-profiler', 'schema-explorer'],
    requiresApproval: null,
    handler: async ({ dataSourceId }) => {
      return suggestReferenceTableFlags(dataSourceId as string);
    },
  });

  registerTool({
    name: 'mcp__aibio__run_profile_query',
    description: 'Run column profiling for a table via Govern internal-adapter. No approval gate — profiling is a system operation. PII masking applied before storage.',
    inputSchema: {
      type: 'object',
      properties: {
        dataSourceId: { type: 'string' },
        tableName: { type: 'string' },
        thresholdRows: { type: 'number', description: 'Sampling threshold (default 1M)' },
        topN: { type: 'number', description: 'Top N values per column (default 20)' },
      },
      required: ['dataSourceId', 'tableName'],
    },
    allowedCallers: ['data-profiler'],
    requiresApproval: null,
    handler: async ({ dataSourceId, tableName, thresholdRows, topN }) => {
      const { adapter } = getAdapterForSource(dataSourceId as string);
      try {
        await runProfileQuery({
          dataSourceId: dataSourceId as string,
          tableName: tableName as string,
          adapter,
          thresholdRows: thresholdRows as number | undefined,
          topN: topN as number | undefined,
        });
        return { ok: true, tableName };
      } finally {
        await adapter.close();
      }
    },
  });

  registerTool({
    name: 'mcp__aibio__list_query_sessions',
    description: 'List all open SQL query cards (sessions) in the current workspace. Returns the active card and any other open cards. Use this to understand what the user has open before proposing edits.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
      },
      required: ['workspaceId'],
    },
    allowedCallers: ['query-card-editor', 'supervisor'],
    requiresApproval: null,
    handler: async ({ workspaceId }) => {
      const ctx = getAgentContext();
      const sessions = getOpenSessions(workspaceId as string);
      return sessions.map((s) => {
        let sourceName = s.dataSourceId;
        try {
          sourceName = getSource(s.dataSourceId).name;
        } catch {}
        return {
          id: s.id,
          title: s.title ?? null,
          dataSourceId: s.dataSourceId,
          dataSourceName: sourceName,
          sqlDraft: s.sqlDraft,
          hasUnrevertedAgentEdit: s.hasUnrevertedAgentEdit,
          isActive: s.id === ctx.activeQuerySessionId,
        };
      });
    },
  });

  registerTool({
    name: 'mcp__aibio__read_query_session',
    description: 'Read the full SQL content of a specific query card by session ID. Use this to inspect a non-active card before editing it.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        sessionId: { type: 'string' },
      },
      required: ['workspaceId', 'sessionId'],
    },
    allowedCallers: ['query-card-editor', 'supervisor'],
    requiresApproval: null,
    handler: async ({ workspaceId, sessionId }) => {
      const session = getSession(sessionId as string, workspaceId as string);
      if (!session) return { error: 'SESSION_NOT_FOUND' };
      let sourceName = session.dataSourceId;
      try {
        sourceName = getSource(session.dataSourceId).name;
      } catch {}
      return {
        id: session.id,
        title: session.title ?? null,
        dataSourceId: session.dataSourceId,
        dataSourceName: sourceName,
        sqlDraft: session.sqlDraft,
        sqlBaseline: session.sqlBaseline,
        hasUnrevertedAgentEdit: session.hasUnrevertedAgentEdit,
        lastAgentEditAt: session.lastAgentEditAt,
      };
    },
  });

  registerTool({
    name: 'mcp__aibio__edit_query_session',
    description: 'Propose and apply an edit to an open SQL query card. Requires user approval via diff dialog. The user can modify the SQL before approving. Always explain the rationale for the change.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        sessionId: { type: 'string', description: 'ID of the query session to edit' },
        proposedSql: { type: 'string', description: 'The new SQL content to propose' },
        rationale: { type: 'string', description: 'Brief explanation of what was changed and why' },
      },
      required: ['workspaceId', 'sessionId', 'proposedSql', 'rationale'],
    },
    allowedCallers: ['query-card-editor'],
    requiresApproval: 'edit_query_session',
    handler: async ({ workspaceId, sessionId, proposedSql }) => {
      const session = getSession(sessionId as string, workspaceId as string);
      if (!session) return { error: 'SESSION_NOT_FOUND' };

      let sourceName = session.dataSourceId;
      try {
        sourceName = getSource(session.dataSourceId).name;
      } catch {}

      const ctx = getAgentContext();
      const sessionTitle = session.title ?? `Query Card`;

      const { promise } = awaitApproval('edit_query_session', {
        sessionId: session.id,
        sessionTitle,
        dataSourceName: sourceName,
        previousSql: session.sqlDraft,
        newSql: proposedSql as string,
      });

      const result = await promise;
      if (result.decision === 'denied') {
        return { ok: false, reason: 'denied' };
      }

      // Use user-edited SQL if they modified it in the dialog, otherwise the proposed SQL.
      const finalSql = result.reason ?? (proposedSql as string);
      applyAgentEdit(session.id, workspaceId as string, finalSql);

      sseEmitter.emit(workspaceId as string, {
        type: 'query_session_updated',
        sessionId: ctx.sessionId,
        workspaceId: workspaceId as string,
        timestamp: new Date().toISOString(),
        payload: {
          sessionId: session.id,
          sqlDraft: finalSql,
          hasUnrevertedAgentEdit: true,
          updatedBy: 'agent',
        },
      });

      return { ok: true, sessionId: session.id, appliedSql: finalSql };
    },
  });
}
