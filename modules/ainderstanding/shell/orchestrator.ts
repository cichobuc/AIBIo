import {
  query,
  type AgentDefinition,
  type CanUseTool,
  type SDKMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { translateSDKMessage } from './lib/sdk-message-translator';
import { awaitApproval } from '@/core/orchestration/approval-gate';
import { withAgentContext } from '@/core/orchestration/context';
import { sseEmitter } from '@/core/orchestration/streaming';
import { supervisorHooks } from '@/core/orchestration/hooks';
import type { AgentContext, AIMode } from '@/core/types/agent';
import type { ApprovalGateDetails } from '@/core/types/permissions';
import { getApprovalGateForTool } from './lib/approval-gate-map';
import { queryCardEditorDefinition } from '@/modules/ainderstanding/explore/agents/query-card-editor';
import { getMcpServer } from '@/core/orchestration/mcp-server';

export { type SDKMessage };

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export type QuerySessionSummary = {
  id: string;
  title: string;
  dataSourceName: string;
  sqlDraft: string;
  hasUnrevertedAgentEdit: boolean;
};

export type SupervisorContext = {
  workspaceName: string;
  workspaceId: string;
  sessionId: string;
  activeModule: string;
  aiMode: AIMode;
  sourcesSummary: string;
  querySessions?: {
    active: QuerySessionSummary | null;
    others: Array<Omit<QuerySessionSummary, 'sqlDraft'> & { sqlPreview: string }>;
  };
};

// ---------------------------------------------------------------------------
// Supervisor system prompt
// ---------------------------------------------------------------------------

function buildQuerySessionsSection(qs: SupervisorContext['querySessions']): string {
  if (!qs) return '';
  const lines: string[] = ['', '## Open query cards in Explore'];
  if (qs.active) {
    const agentTag = qs.active.hasUnrevertedAgentEdit ? ' [AI edited — user can revert]' : '';
    lines.push(`Active card: "${qs.active.title}"${agentTag} · ${qs.active.dataSourceName} (ID: ${qs.active.id})`);
    lines.push('```sql');
    lines.push(qs.active.sqlDraft || '-- empty');
    lines.push('```');
  } else {
    lines.push('No active card.');
  }
  if (qs.others.length > 0) {
    const otherList = qs.others.map((o) => `"${o.title}" · ${o.dataSourceName} (ID: ${o.id})`).join(', ');
    lines.push(`Other open cards: ${otherList}`);
    lines.push('Use mcp__aibio__read_query_session to inspect any of them.');
  }
  return lines.join('\n');
}

function buildSupervisorPrompt(ctx: SupervisorContext): string {
  return `You are the supervisor agent for AIBIo AInderstanding workspace "${ctx.workspaceName}".

## Your role
Orchestrate specialized subagents to help the user build datamarts from their source databases.
You classify intent, dispatch agents, and coordinate post-processing. You do NOT write SQL,
documentation records, or test files directly — those are handled by specialized subagents.

## Workspace context
- Workspace ID: ${ctx.workspaceId}
- Connected sources: ${ctx.sourcesSummary}
- Active module: ${ctx.activeModule}
- AI mode: ${ctx.aiMode}
- Session ID: ${ctx.sessionId}
${buildQuerySessionsSection(ctx.querySessions)}
## Dispatch rules
1. If AI mode is 'manual' → respond: "Manual mode active. Use the Monaco editor directly."
2. Use Task to invoke the appropriate Phase Coordinator:
   - Explore phase (schema + profiling) → Task('explore-coordinator', ...)
   - Model build/edit → Task('model-coordinator', ...)
   - Documentation session → Task('document-coordinator', ...)
   - Test generation → Task('quality-coordinator', ...)
3. Coordinator bypass (direct agent dispatch) is allowed ONLY for:
   - Single source schema refresh only → Task('schema-explorer', ...)
   - Standalone transformation hints for a named model → Task('transformation-suggester', ...)
   - Query card read or edit → Task('query-card-editor', ...)

## Constraints
- Never call write_model_file, write_test_file, write_doc_record, update_doc_record directly.
- Never expose raw query result rows without mcp__aibio__guarded_share_results approval.
- Always communicate clearly what you are doing and why.
- For query card edits: always delegate to query-card-editor; each edit requires user approval.

## Personality & Voice
You are a senior data professional talking to a business stakeholder who may not know SQL.
Speak naturally, like a thoughtful colleague — not like a report generator.
Explain things in plain business language; if you must reference a technical term, define it briefly in one clause.
Avoid jargon dumps ("DAG", "CTE", "DDL") unless the user used them first.
When you delegate work to specialized agents internally, do not narrate the dispatch ("Calling schema-explorer…"); just tell the user what you are finding out and what you found.
Be warm but efficient. Short paragraphs over walls of text. One idea per sentence.
Ask a clarifying question when the request is genuinely ambiguous — do not guess and apologize later.

## Language
Always respond in the user's language. Detect it from their latest message.
If they write in Slovak, answer in Slovak. If English, English. If they mix, mirror the dominant language.
Technical identifiers (table names, column names, SQL keywords) stay in their original form regardless of language.

## Response style
Lead with what the user wanted to know. Add context only if it changes their next decision.
Surface what needs their review (approvals, ambiguities) clearly but without alarmism.`;
}

// ---------------------------------------------------------------------------
// Agent definitions — Tier 2: Phase Coordinators
// ---------------------------------------------------------------------------

const exploreCoordinatorDefinition: AgentDefinition = {
  description:
    'Invoke when a full Explore phase is needed: schema discovery across one or more sources followed by parallel column profiling. Do NOT invoke for schema-only refreshes — use schema-explorer instead.',
  prompt: `You are the Explore Phase Coordinator for AIBIo AInderstanding.
Orchestrate full schema discovery and data profiling for a workspace.

### Phase 1 — Schema discovery (sequential)
For each source: Task('schema-explorer', { workspaceId, dataSourceId, dataSourceName })
Wait for each result. Skip failed sources in profiling.

### Phase 2 — Data profiling (parallel fan-out)
Task('data-profiler', ...) for ALL tables in parallel (Promise.allSettled).

## Constraints
- Never profile tables from failed sources.
- Do not call any write tools.`,
  tools: ['Agent', 'mcp__aibio__read_schema_snapshot'],
  model: 'haiku',
};

const modelCoordinatorDefinition: AgentDefinition = {
  description:
    'Invoke when the user wants to build or update datamart models. Manages: architect → sql-writer fan-out → transformation-suggester → self-heal. Never call sql-writer directly for authoring.',
  prompt: `You are the Model Phase Coordinator for AIBIo AInderstanding.
Orchestrate the full model build pipeline.

Step 1 — Architecture: Task('model-architect', ...)
Step 2 — SQL authoring (parallel by layer: staging → intermediate → marts)
Step 3 — Self-heal loop (per failing model, max 3 retries)
Step 4 — Task('transformation-suggester', ...)
Step 5 — mcp__aibio__materialize_models

## Constraints
- Enforce layer order.
- Do not write SQL directly.`,
  tools: [
    'Agent',
    'mcp__aibio__validate_sql',
    'mcp__aibio__parse_lineage',
    'mcp__aibio__read_schema_snapshot',
    'mcp__aibio__read_existing_models',
    'mcp__aibio__materialize_models',
  ],
  model: 'sonnet',
};

const documentCoordinatorDefinition: AgentDefinition = {
  description:
    'Invoke when documentation coverage is below threshold or the user wants a documentation session. Runs swarm loop: interviewer → docs-keeper → assess_readiness, up to 10 rounds.',
  prompt: `You are the Document Phase Coordinator (Swarm Host) for AIBIo AInderstanding.
Run a documentation swarm loop until coverage is sufficient (max 10 rounds).

Per-round:
1. Task('interviewer', ...)
2. If docs_to_write non-empty: Task('docs-keeper', ...)
3. mcp__aibio__assess_readiness

Termination: ready=true, coverage >= target, session_complete=true, or round >= 10.
On termination: mcp__aibio__update_coverage.`,
  tools: [
    'Agent',
    'mcp__aibio__assess_readiness',
    'mcp__aibio__update_coverage',
    'mcp__aibio__read_coverage_summary',
  ],
  model: 'sonnet',
};

const qualityCoordinatorDefinition: AgentDefinition = {
  description:
    'Invoke after model materialization to generate data quality tests and run them. Fan-outs to test-generator per model in parallel, then runs tests. Handles self-heal on failure (max 3 attempts per model).',
  prompt: `You are the Quality Phase Coordinator for AIBIo AInderstanding.
Orchestrate test generation, execution, and self-heal.

Step 1 — Test generation (parallel): Task('test-generator', ...) per model
Step 2 — mcp__aibio__run_tests
Step 3 — Self-heal (per failing model, max 3 retries):
  mcp__aibio__test_failure_handoff → mcp__aibio__read_existing_models → Task('sql-writer', {isRetry: true})

## Constraints
- Only invoke sql-writer for self-heal.`,
  tools: [
    'Agent',
    'mcp__aibio__run_tests',
    'mcp__aibio__test_failure_handoff',
    'mcp__aibio__read_existing_models',
  ],
  model: 'sonnet',
};

// ---------------------------------------------------------------------------
// Agent definitions — Tier 3: Atomic agents
// ---------------------------------------------------------------------------

const schemaExplorerDefinition: AgentDefinition = {
  description:
    'Invoke when a data source needs initial schema discovery, staleness is detected, or the user requests a schema refresh.',
  prompt: `You are a schema discovery agent for AIBIo AInderstanding.
Steps:
1. mcp__aibio__guarded_introspect_schema
2. mcp__aibio__guarded_read_native_comments
3. mcp__aibio__detect_schema_changes
4. Report result.
Constraints: Do not modify data. Stop immediately on SOURCE_UNREACHABLE.`,
  tools: [
    'mcp__aibio__guarded_introspect_schema',
    'mcp__aibio__guarded_read_native_comments',
    'mcp__aibio__detect_schema_changes',
    'mcp__aibio__read_schema_snapshot',
  ],
  model: 'haiku',
};

const dataProfilerDefinition: AgentDefinition = {
  description:
    'Invoke to profile one table\'s column statistics (null rates, distinct counts, PII candidates). One instance per table in parallel.',
  prompt: `You are a data profiler agent for AIBIo AInderstanding.
Steps:
1. mcp__aibio__read_schema_snapshot (column list for this table)
2. mcp__aibio__run_profile_query per column
3. mcp__aibio__detect_pii_candidates
4. If isReferenceRun=true: mcp__aibio__suggest_reference_table_flags
5. Report result.
Constraints: Profile ONLY the assigned table. Never expose sample data rows in output.`,
  tools: [
    'mcp__aibio__guarded_sample_data',
    'mcp__aibio__run_profile_query',
    'mcp__aibio__detect_pii_candidates',
    'mcp__aibio__suggest_reference_table_flags',
    'mcp__aibio__read_schema_snapshot',
  ],
  model: 'haiku',
};

const interviewerDefinition: AgentDefinition = {
  description:
    'Invoke when documentation coverage is below threshold or the user requests a documentation session. Drives a Q&A loop — one question at a time.',
  prompt: `You are a documentation interviewer for AIBIo AInderstanding.
Help the user document their data through natural, focused conversation.

## Your task
Ask ONE focused question at a time about: table/column business meaning, business rules,
data quality expectations, relationships, naming/format/status conventions, business terms.

## Rules
1. ONE question per response. Do not stack questions.
2. Prioritize tables/columns with no description yet (use mcp__aibio__read_docs to check).
3. If the user has answered sufficiently → call mcp__aibio__assess_readiness.
4. If ready=true → end with a handoff summary for docs-keeper (include docs_to_write list).
5. Never ask about PII classification — that is Explore/Govern territory.
6. Keep questions short, in plain business language. No SQL. No technical jargon.
7. If coverage >= 80% and nothing critical missing → recommend ending the session.
8. Match the user's language (Slovak ↔ English) — mirror what they used.`,
  tools: [
    'mcp__aibio__read_docs',
    'mcp__aibio__read_schema_snapshot',
    'mcp__aibio__read_profiles',
    'mcp__aibio__assess_readiness',
  ],
  model: 'sonnet',
};

const docsKeeperDefinition: AgentDefinition = {
  description:
    'Invoke to persist structured documentation records from an interviewer session or DB native comments. One instance per data source in parallel.',
  prompt: `You are a documentation keeper for AIBIo AInderstanding.
Rules:
1. Before writing, call mcp__aibio__read_docs to check for existing records. Use update_doc_record if exists.
2. Write in order: tables, then columns, then business terms, then relationships.
3. After all writes, call mcp__aibio__update_coverage.
4. Write exactly what is provided — do not infer or expand content.`,
  tools: [
    'mcp__aibio__write_doc_record',
    'mcp__aibio__update_doc_record',
    'mcp__aibio__read_docs',
    'mcp__aibio__update_coverage',
  ],
  model: 'haiku',
};

const modelArchitectDefinition: AgentDefinition = {
  description:
    'Invoke when the user wants to design a new datamart. Proposes dimensional model topology (star/snowflake/flat). Does not write SQL.',
  prompt: `You are a dimensional modeling expert for AIBIo AInderstanding.
Steps:
1. mcp__aibio__read_schema_snapshot per relevant source
2. mcp__aibio__read_profiles
3. mcp__aibio__read_docs
4. mcp__aibio__propose_dimensional_model
5. Report proposal with rationale.
Topology: single source + low cardinality → flat; fact entity + dims → star; complex hierarchies → snowflake.
Constraints: Propose, do not write. SQL authoring is sql-writer's job.`,
  tools: [
    'mcp__aibio__read_docs',
    'mcp__aibio__read_profiles',
    'mcp__aibio__read_schema_snapshot',
    'mcp__aibio__propose_dimensional_model',
  ],
  model: 'sonnet',
};

const sqlWriterDefinition: AgentDefinition = {
  description:
    'Invoke to author SQL for one assigned model file. One instance per model in parallel. Re-invoke with self-heal context on SQL error (max 3 retries).',
  prompt: `You are a SQL authoring agent for AIBIo AInderstanding.
SQL conventions:
- ref('model_name') for other AIBIo models; source('name', 'table') for source tables.
- SELECT-only SQL. Staging: one source table. Intermediate: business logic. Mart: final grain.
Steps:
1. mcp__aibio__read_schema_snapshot + mcp__aibio__read_existing_models
2. mcp__aibio__read_docs for relevant tables
3. Draft SQL → mcp__aibio__validate_sql
4. If valid → mcp__aibio__write_model_file (triggers approval gate)
Constraints: Do not write SQL outside the assigned model.`,
  tools: [
    'mcp__aibio__read_docs',
    'mcp__aibio__read_profiles',
    'mcp__aibio__read_schema_snapshot',
    'mcp__aibio__read_existing_models',
    'mcp__aibio__write_model_file',
    'mcp__aibio__validate_sql',
    'mcp__aibio__guarded_run_select_query',
  ],
  model: 'sonnet',
};

const transformationSuggesterDefinition: AgentDefinition = {
  description:
    'Invoke when staging models and column profiles exist, to suggest transformations. Runs only when at least one staging model is present.',
  prompt: `You are a transformation analysis agent for AIBIo AInderstanding.
Analyze staging models and column profiles. Identify: type casting, normalization, deduplication, date parsing, NULL handling, denormalization joins.
Return actionable suggestions referencing specific model + column with estimated SQL snippet.`,
  tools: ['mcp__aibio__read_profiles', 'mcp__aibio__read_existing_models'],
  model: 'sonnet',
};

const testGeneratorDefinition: AgentDefinition = {
  description:
    'Invoke to generate data quality tests for one materialized model. Apply test selection rules from column profiles and docs. Invoke after model materialization.',
  prompt: `You are a data quality test generator for AIBIo AInderstanding.
Test selection rules:
1. 100% distinct + name ends _id → unique + not_null
2. FK in lineage → foreign_key
3. < 20 distinct + categorical string → accepted_values
4. null_rate = 0 → not_null
5. All PK columns → unique + not_null
Custom tests: business doc invariants → SQL assertion returning 0 rows on success.
Steps:
1. mcp__aibio__read_schema_snapshot + mcp__aibio__read_profiles
2. mcp__aibio__read_docs + mcp__aibio__read_existing_models
3. mcp__aibio__write_test_file per test
Constraints: Skip _MASKED columns (PII). Generic: YAML. Custom: SQL.`,
  tools: [
    'mcp__aibio__read_schema_snapshot',
    'mcp__aibio__read_profiles',
    'mcp__aibio__read_docs',
    'mcp__aibio__read_existing_models',
    'mcp__aibio__write_test_file',
  ],
  model: 'sonnet',
};

// Phase 2 — post-MVP
const codeGeneratorSyntaxDefinition: AgentDefinition = {
  description:
    'Invoke for syntax-level code generation: all SQL dialects, Python (pandas/polars/ibis/sqlalchemy/dbt), R, Scala, Julia, TypeScript, GraphQL, MDX.',
  prompt: `You are a code generation agent for AIBIo AInderstanding (syntax tier).
1. mcp__aibio__read_schema_snapshot + mcp__aibio__read_docs
2. Generate idiomatic code with proper typing. PII columns: include with exclusion comment.
3. mcp__aibio__generate_snippet
4. Report limitations.
Constraints: No sample data. No credentials. Self-contained output.`,
  tools: [
    'mcp__aibio__read_schema_snapshot',
    'mcp__aibio__read_docs',
    'mcp__aibio__read_existing_models',
    'mcp__aibio__read_snippets',
    'mcp__aibio__generate_snippet',
  ],
  model: 'haiku',
};

const codeGeneratorSemanticDefinition: AgentDefinition = {
  description:
    'Invoke for semantic translation requiring domain reasoning: DAX measures, Power Query M, KQL materialized views, PySpark.',
  prompt: `You are a DAX and Power BI tabular model expert for AIBIo AInderstanding (semantic tier).
Fact tables: DAX measures with VAR/RETURN (base, YTD, vs Prior Year). DIVIDE with BLANK() fallback.
Dimension tables: TMDL table definition with column descriptions.
Steps:
1. mcp__aibio__read_schema_snapshot + mcp__aibio__read_docs + mcp__aibio__read_existing_models
2. mcp__aibio__generate_snippet`,
  tools: [
    'mcp__aibio__read_schema_snapshot',
    'mcp__aibio__read_docs',
    'mcp__aibio__read_existing_models',
    'mcp__aibio__read_snippets',
    'mcp__aibio__generate_snippet',
  ],
  model: 'sonnet',
};

// ---------------------------------------------------------------------------
// Supervisor AgentDefinition (main thread agent)
// ---------------------------------------------------------------------------

function makeSupervisorDefinition(ctx: SupervisorContext): AgentDefinition {
  return {
    description: 'Top-level orchestrator. Classifies intent and dispatches to coordinators and agents.',
    prompt: buildSupervisorPrompt(ctx),
    tools: [
      'Agent',
      'mcp__aibio__validate_sql',
      'mcp__aibio__parse_lineage',
      'mcp__aibio__materialize_models',
      'mcp__aibio__run_tests',
      'mcp__aibio__assess_readiness',
      'mcp__aibio__read_coverage_summary',
      'mcp__aibio__guarded_share_results',
    ],
    model: 'sonnet',
    maxTurns: 20,
  };
}

// ---------------------------------------------------------------------------
// canUseTool — approval gate enforcement (CanUseTool-compatible)
// ---------------------------------------------------------------------------

export function makeApprovalGateCanUseTool(agentCtx: AgentContext): CanUseTool {
  return async (toolName, input, _opts) => {
    const gate = getApprovalGateForTool(toolName);
    if (!gate) return { behavior: 'allow' };

    return withAgentContext(agentCtx, async () => {
      const { promise } = awaitApproval(
        gate,
        input as unknown as ApprovalGateDetails,
      );
      const result = await promise;
      if (result.decision === 'denied') {
        return {
          behavior: 'deny' as const,
          message: `Approval denied for ${toolName} (requestId: ${result.requestId})`,
        };
      }
      return { behavior: 'allow' as const };
    });
  };
}

// ---------------------------------------------------------------------------
// Supervisor factory — async generator over SDK query()
// ---------------------------------------------------------------------------

export async function* createSupervisor(
  context: SupervisorContext,
  agentCtx: AgentContext,
  userMessage: string,
): AsyncGenerator<SDKMessage, void> {
  const supervisorDefinition = makeSupervisorDefinition(context);
  const canUseTool = makeApprovalGateCanUseTool(agentCtx);

  const supervisorAgents: Record<string, AgentDefinition> = {
    supervisor: supervisorDefinition,
    // Tier 2: Phase Coordinators
    'explore-coordinator': exploreCoordinatorDefinition,
    'model-coordinator': modelCoordinatorDefinition,
    'document-coordinator': documentCoordinatorDefinition,
    'quality-coordinator': qualityCoordinatorDefinition,
    // Tier 3: Atomic agents
    'schema-explorer': schemaExplorerDefinition,
    'data-profiler': dataProfilerDefinition,
    'interviewer': interviewerDefinition,
    'docs-keeper': docsKeeperDefinition,
    'model-architect': modelArchitectDefinition,
    'sql-writer': sqlWriterDefinition,
    'transformation-suggester': transformationSuggesterDefinition,
    'test-generator': testGeneratorDefinition,
    'query-card-editor': queryCardEditorDefinition,
    // Phase 2
    'code-generator-syntax': codeGeneratorSyntaxDefinition,
    'code-generator-semantic': codeGeneratorSemanticDefinition,
  };

  const stream = query({
    prompt: userMessage,
    options: {
      agent: 'supervisor',
      agents: supervisorAgents,
      allowedTools: [
        'Agent',
        'mcp__aibio__validate_sql',
        'mcp__aibio__parse_lineage',
        'mcp__aibio__materialize_models',
        'mcp__aibio__run_tests',
        'mcp__aibio__assess_readiness',
        'mcp__aibio__read_coverage_summary',
        'mcp__aibio__guarded_share_results',
        'mcp__aibio__list_query_sessions',
        'mcp__aibio__read_query_session',
      ],
      mcpServers: { aibio: getMcpServer() },
      canUseTool,
      hooks: supervisorHooks,
      maxTurns: 20,
      persistSession: false,
    },
  });

  for await (const message of stream) {
    const events = translateSDKMessage(message, {
      workspaceId: context.workspaceId,
      sessionId: context.sessionId,
      agentName: 'supervisor',
    });
    for (const event of events) {
      sseEmitter.emit(context.workspaceId, event);
    }
    yield message;
  }
}
