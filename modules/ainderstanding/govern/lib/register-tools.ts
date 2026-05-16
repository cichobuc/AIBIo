import { registerTool } from '@/core/orchestration/tool-registry';
import { getAdapterForSource } from '@/modules/ainderstanding/connect/lib/adapters/get-adapter';
import {
  guardedIntrospectSchema,
  guardedReadNativeComments,
  guardedSampleData,
  guardedRunSelectQuery,
  guardedShareResults,
} from './mcp-tools';

export function registerGovernTools(): void {
  registerTool({
    name: 'mcp__aibio__guarded_introspect_schema',
    description: 'Layer 1 — introspect schema of a data source. Always allowed. Audited.',
    inputSchema: {
      type: 'object',
      properties: {
        dataSourceId: { type: 'string', description: 'Data source UUID' },
      },
      required: ['dataSourceId'],
    },
    allowedCallers: ['schema-explorer', 'supervisor'],
    requiresApproval: null,
    handler: async ({ dataSourceId }) => {
      const { adapter } = getAdapterForSource(dataSourceId as string);
      try {
        return await guardedIntrospectSchema({ dataSourceId: dataSourceId as string, adapter });
      } finally {
        await adapter.close();
      }
    },
  });

  registerTool({
    name: 'mcp__aibio__guarded_read_native_comments',
    description: 'Layer 1 — read native DB comments from a data source. Always allowed. Audited.',
    inputSchema: {
      type: 'object',
      properties: {
        dataSourceId: { type: 'string', description: 'Data source UUID' },
      },
      required: ['dataSourceId'],
    },
    allowedCallers: ['schema-explorer', 'docs-keeper'],
    requiresApproval: null,
    handler: async ({ dataSourceId }) => {
      const { adapter } = getAdapterForSource(dataSourceId as string);
      try {
        return await guardedReadNativeComments({ dataSourceId: dataSourceId as string, adapter });
      } finally {
        await adapter.close();
      }
    },
  });

  registerTool({
    name: 'mcp__aibio__guarded_sample_data',
    description: 'Layer 2 — sample rows from a reference table. Requires permission tier >= with_reference_samples AND isReferenceTable=true. PII masked.',
    inputSchema: {
      type: 'object',
      properties: {
        dataSourceId: { type: 'string' },
        tableName: { type: 'string' },
        isReferenceTable: { type: 'boolean' },
      },
      required: ['dataSourceId', 'tableName', 'isReferenceTable'],
    },
    allowedCallers: ['data-profiler', 'model-architect'],
    requiresApproval: null,
    handler: async ({ dataSourceId, tableName, isReferenceTable }) => {
      const { adapter } = getAdapterForSource(dataSourceId as string);
      try {
        return await guardedSampleData({
          dataSourceId: dataSourceId as string,
          tableName: tableName as string,
          isReferenceTable: isReferenceTable as boolean,
          adapter,
        });
      } finally {
        await adapter.close();
      }
    },
  });

  registerTool({
    name: 'mcp__aibio__guarded_run_select_query',
    description: 'Layer 3 — execute a SELECT query. Requires user approval. Returns only metadata (rowCount, columns, resultHandle) — never raw rows.',
    inputSchema: {
      type: 'object',
      properties: {
        dataSourceId: { type: 'string' },
        sql: { type: 'string', description: 'SELECT statement to execute' },
      },
      required: ['dataSourceId', 'sql'],
    },
    allowedCallers: ['sql-writer'],
    requiresApproval: 'execute_query',
    handler: async ({ dataSourceId, sql }) => {
      const { adapter, name } = getAdapterForSource(dataSourceId as string);
      try {
        return await guardedRunSelectQuery({
          dataSourceId: dataSourceId as string,
          dataSourceName: name,
          sql: sql as string,
          adapter,
        });
      } finally {
        await adapter.close();
      }
    },
  });

  registerTool({
    name: 'mcp__aibio__guarded_share_results',
    description: 'Layer 3 — share cached query results with the AI. Requires user approval. Applies PII masking.',
    inputSchema: {
      type: 'object',
      properties: {
        dataSourceId: { type: 'string' },
        resultHandle: { type: 'string' },
        tableName: { type: 'string', description: 'Optional — used for PII masking lookup' },
      },
      required: ['dataSourceId', 'resultHandle'],
    },
    allowedCallers: ['supervisor'],
    requiresApproval: 'share_results_with_ai',
    handler: async ({ dataSourceId, resultHandle, tableName }) => {
      return guardedShareResults({
        dataSourceId: dataSourceId as string,
        resultHandle: resultHandle as string,
        tableName: tableName as string | undefined,
      });
    },
  });
}
