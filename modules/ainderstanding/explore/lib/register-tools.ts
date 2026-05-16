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
}
