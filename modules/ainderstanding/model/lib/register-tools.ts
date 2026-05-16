import { registerTool } from '@/core/orchestration/tool-registry';
import { readExistingModels, validateSqlTool, parseLineage } from './mcp-tools';
import { materializeWorkspace } from './materializer';
import { getAgentContext } from '@/core/orchestration/context';

export function registerModelTools(): void {
  registerTool({
    name: 'mcp__aibio__read_existing_models',
    description: 'Return list of models for the workspace with SQL content. Always allowed.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string', description: 'Workspace UUID' },
        layer: {
          type: 'string',
          enum: ['staging', 'intermediate', 'marts'],
          description: 'Optional: filter by layer',
        },
      },
      required: ['workspace_id'],
    },
    allowedCallers: [
      'model-coordinator',
      'model-architect',
      'sql-writer',
      'transformation-suggester',
      'test-generator',
      'quality-coordinator',
    ],
    requiresApproval: null,
    handler: async ({ workspace_id, layer }) =>
      readExistingModels({
        workspace_id: workspace_id as string,
        layer: layer as 'staging' | 'intermediate' | 'marts' | undefined,
      }),
  });

  registerTool({
    name: 'mcp__aibio__validate_sql',
    description: 'Validate SQL syntax and ref() references. SELECT-only enforcement.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'SQL to validate' },
        workspace_id: { type: 'string', description: 'Workspace UUID (for ref() resolution)' },
      },
      required: ['sql'],
    },
    allowedCallers: ['sql-writer', 'model-coordinator', 'supervisor'],
    requiresApproval: null,
    handler: async ({ sql, workspace_id }) =>
      validateSqlTool({ sql: sql as string, workspace_id: workspace_id as string | undefined }),
  });

  registerTool({
    name: 'mcp__aibio__parse_lineage',
    description:
      'Re-parse all model SQL files, rebuild lineage_edges, return topo order and cycle detection.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string', description: 'Workspace UUID' },
      },
      required: ['workspace_id'],
    },
    allowedCallers: ['model-coordinator', 'supervisor'],
    requiresApproval: null,
    handler: async ({ workspace_id }) =>
      parseLineage({ workspace_id: workspace_id as string }),
  });

  registerTool({
    name: 'mcp__aibio__materialize_models',
    description: 'Run full-refresh materialization of models into datamart.duckdb. Emits SSE model_run_update events. Returns run_id immediately.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string', description: 'Workspace UUID' },
        model_names: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: specific model names. Omit for full build.',
        },
        full_refresh: {
          type: 'boolean',
          description: 'Always true in MVP (incremental not supported)',
        },
      },
      required: ['workspace_id'],
    },
    allowedCallers: ['model-coordinator', 'supervisor'],
    requiresApproval: null,
    handler: async ({ workspace_id, model_names }) => {
      const ctx = getAgentContext();
      const result = await materializeWorkspace({
        workspaceId: workspace_id as string,
        modelNames: model_names as string[] | undefined,
        sessionId: ctx?.sessionId,
      });
      return {
        run_id: result.runId,
        status: result.status,
        models_total: result.modelsTotal,
        models_succeeded: result.modelsSucceeded,
        models_failed: result.modelsFailed,
        duration_ms: result.durationMs,
      };
    },
  });

  // write_model_file — approval gated, sql-writer only
  registerTool({
    name: 'mcp__aibio__write_model_file',
    description: 'Write a SQL model file. Requires user approval (SqlDiffApprovalDialog). sql-writer only.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string' },
        model_name: { type: 'string', description: 'Snake_case model name (e.g. stg_artists)' },
        layer: { type: 'string', enum: ['staging', 'intermediate', 'marts'] },
        sql: { type: 'string', description: 'SELECT SQL for this model' },
        materialization: { type: 'string', enum: ['table', 'view'], default: 'table' },
        overwrite: { type: 'boolean', default: true },
      },
      required: ['workspace_id', 'model_name', 'layer', 'sql'],
    },
    allowedCallers: ['sql-writer'],
    requiresApproval: 'write_model_file',
    handler: async ({ workspace_id, model_name, layer, sql, materialization, overwrite }) => {
      const { validateSql: validateSqlFn } = await import('./sql-validator');
      const { createModel, writeModelSql, getModelByName } = await import('./model-service');
      const { parseAndRebuildLineage } = await import('./lineage-parser');
      const { awaitApproval, ApprovalDeniedError } = await import('@/core/orchestration/approval-gate');
      const { log } = await import('@/modules/ainderstanding/govern/lib/audit-logger');
      const ctx = getAgentContext();

      const wsId = workspace_id as string;
      const name = model_name as string;
      const layerVal = layer as 'staging' | 'intermediate' | 'marts';
      const sqlVal = sql as string;

      // Step 1: validate SQL
      const validation = await validateSqlFn(wsId, sqlVal);
      if (!validation.valid) {
        return {
          error: 'INVALID_SQL',
          errors: validation.errors,
          unresolved_refs: validation.unresolvedRefs,
        };
      }

      // Step 2: get previous SQL for diff
      const existing = getModelByName(wsId, name);
      const previousSql = existing ? await (async () => {
        try { return await (await import('./model-service')).readModelSql(wsId, existing.id); }
        catch { return ''; }
      })() : '';

      // Step 3: approval gate
      const { promise } = awaitApproval('write_model_file', {
        modelName: name,
        layer: layerVal,
        sqlDiff: sqlVal,
        previousSql,
      });
      const result = await promise;

      if (result.decision === 'denied') {
        log({
          workspaceId: wsId,
          sessionId: ctx?.sessionId ?? '',
          agentName: ctx?.agentName ?? 'sql-writer',
          actionType: 'write_model',
          outcome: 'approval_denied',
          detail: { modelName: name },
        });
        throw new ApprovalDeniedError('APPROVAL_DENIED', `User denied write for model: ${name}`);
      }

      // Step 4: write (use user-edited SQL from approval dialog if provided)
      const finalSql = result.reason ?? sqlVal;
      if (existing) {
        await writeModelSql(wsId, existing.id, finalSql);
        parseAndRebuildLineage(wsId, existing.id, finalSql);
        log({
          workspaceId: wsId,
          sessionId: ctx?.sessionId ?? '',
          agentName: ctx?.agentName ?? 'sql-writer',
          actionType: 'write_model',
          outcome: 'approval_granted',
          detail: { modelName: name, action: 'update' },
        });
        return { file_path: existing.filePath, model_id: existing.id, created: false };
      } else {
        const model = await createModel({
          workspaceId: wsId,
          name,
          layer: layerVal,
          materialization: (materialization as 'table' | 'view') ?? 'table',
          initialSql: finalSql,
        });
        parseAndRebuildLineage(wsId, model.id, finalSql);
        log({
          workspaceId: wsId,
          sessionId: ctx?.sessionId ?? '',
          agentName: ctx?.agentName ?? 'sql-writer',
          actionType: 'write_model',
          outcome: 'approval_granted',
          detail: { modelName: name, action: 'create' },
        });
        return { file_path: model.filePath, model_id: model.id, created: true };
      }
    },
  });

  // propose_dimensional_model — model-architect only
  registerTool({
    name: 'mcp__aibio__propose_dimensional_model',
    description: 'model-architect proposes a dimensional model structure (topology, staging/intermediate/mart model list). Schema validation gate — content is generated by LLM.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string' },
        data_source_id: { type: 'string' },
        user_intent: { type: 'string', description: 'User brief for the datamart' },
        topology: { type: 'string', enum: ['star', 'snowflake', 'flat'] },
        rationale: { type: 'string' },
        staging_models: { type: 'array', items: { type: 'object' } },
        intermediate_models: { type: 'array', items: { type: 'object' } },
        mart_models: { type: 'array', items: { type: 'object' } },
      },
      required: ['workspace_id', 'topology', 'rationale', 'staging_models', 'mart_models'],
    },
    allowedCallers: ['model-architect'],
    requiresApproval: null,
    handler: async (args) => {
      // Pass-through: validate structure and return as proposal for UI
      return {
        topology: args.topology,
        rationale: args.rationale,
        staging_models: args.staging_models ?? [],
        intermediate_models: args.intermediate_models ?? [],
        mart_models: args.mart_models ?? [],
      };
    },
  });
}
