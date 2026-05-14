# AInderstanding — Agent Prompts & Per-Agent Spec

> **Scope:** Definícia všetkých 10 entries = 1 supervisor (`shell/orchestrator.ts`) + 9 LLM subagentov. MVP scope = 8 aktívnych LLM subagentov (bez `code-generator`; `code-generator` je Phase 2, Translate sub-modul). `translate-validator` nie je LLM agent — je to deterministický service (Python subprocess + SQL dialect runner + syntax parsers). Každý entry obsahuje model, systémový prompt template, granted tools, TypeScript output kontrakt, sampling parametre a stratégiu context injection.
>
> **Implementácia:** Každý sub-agent je volaný cez `@anthropic-ai/sdk` `messages.create()` s `stream: true`. Supervisor používa `tool_use` pre `invoke_subagent`. Sub-agenti sú izolovaní — nezdieľajú conversation history so supervisorom.

---

## Spoločné konvencie

### AgentContext (injektovaný do každého agenta)

```typescript
// core/types/agent.ts
type AgentContext = {
  workspaceId: string;
  sessionId: string;
  dataSourceId?: string;    // ak relevantné pre daného agenta
  activeModule: string;     // napr. 'explore', 'model'
  aiMode: 'auto' | 'documentation' | 'queries' | 'manual';
};
```

### invoke_subagent tool (supervisor → sub-agent)

Supervisor dispatchuje sub-agentov cez `invoke_subagent` tool use:

```typescript
type InvokeSubagentInput = {
  agent_name: SubagentName;
  task: string;             // prirodzený jazyk popis úlohy
  context: AgentContext;
  extra?: Record<string, unknown>; // agent-špecifický payload
};

type InvokeSubagentOutput = {
  agent_name: SubagentName;
  result: AgentResult;      // discriminated union podľa agenta (viď nižšie)
  duration_ms: number;
  tool_calls_count: number;
};
```

### Sampling params — defaults

| Tier | temperature | max_tokens | Dôvod |
|------|-------------|------------|-------|
| Deterministic (SQL, data ops) | `0` | `4096` | Reprodukovateľnosť; SQL nesmie sa líšiť medzi runs |
| Reasoning (návrhy, interviews) | `0.3` | `8192` | Mierna kreativita pri zachovaní kvality |
| Supervisor | `0` | `4096` | Orchestrácia musí byť deterministická |

---

## 1. Supervisor

**Model:** `claude-sonnet-4-6`
**Owner:** `shell/`
**Pattern:** Orchestrates all — klasifikuje intent, dispatchuje sub-agentov, koordinuje post-processing

### Sampling

```typescript
{ temperature: 0, max_tokens: 4096 }
```

### Granted tools

Supervisor dostane **read-only + orchestration** tools. Write tools sú **explicitne vylúčené**.

```
validate_sql
parse_lineage
materialize_models
run_tests
test_failure_handoff
update_coverage
assess_readiness
guarded_share_results        // jediný guarded tool supervisora
invoke_subagent              // dispatcher tool (nie MCP, internal)
```

### System prompt template

```
You are the supervisor agent for AIBIo AInderstanding workspace "{{workspaceName}}".

## Your role
Orchestrate specialized subagents to help the user build datamarts from their source databases.
You classify intent, dispatch agents, and coordinate post-processing. You do NOT write SQL,
documentation records, or test files directly — those are handled by specialized subagents.

## Workspace context
- Workspace ID: {{workspaceId}}
- Connected sources: {{sourcesSummary}}
- Active module: {{activeModule}}
- AI mode: {{aiMode}}
- Session ID: {{sessionId}}

## Dispatch rules
1. Classify intent FIRST using intent-classifier (sync, before LLM call).
2. If mode=manual_only → respond: "Manual mode active. Use the Monaco editor directly."
3. If mode=single_agent → invoke one subagent directly via invoke_subagent.
4. If mode=parallel → invoke multiple subagents via Promise.all.
5. If mode=multi_agent → use your reasoning to build a dispatch plan, then execute it.

## Post-processing (after each dispatch)
- After any model write: call parse_lineage then materialize_models if user confirmed.
- After materialization: call run_tests automatically.
- After test failure: call test_failure_handoff (max 3 retries per model).
- Note: update_coverage is called by docs-keeper internally — do NOT call it again after doc batch.

## Constraints
- Never call write_model_file, write_test_file, write_doc_record, update_doc_record, generate_snippet directly — use invoke_subagent.
- Never expose raw query result rows to the user unless guarded_share_results was approved.
- Serialize parallel approval gates — present one at a time to avoid UI confusion.
- Always emit stream_end SSE event when done, even on error (use stream_error first).

## Response style
Be concise. Summarize what agents did. Highlight what requires user review.
Do not narrate internal steps — report results.
```

### Context injection

```typescript
type SupervisorContext = {
  workspaceName: string;
  workspaceId: string;
  sessionId: string;
  activeModule: string;
  aiMode: string;
  sourcesSummary: string;  // "3 sources: erp (PostgreSQL, 42 tables), crm (MySQL, 18 tables), lookup (DuckDB, 5 tables)"
};
```

---

## 2. schema-explorer

**Model:** `claude-haiku-4-5`
**Owner:** `explore/`
**Pattern:** Sequential — introspect → read comments → detect changes → save

### Sampling

```typescript
{ temperature: 0, max_tokens: 4096 }
```

### Granted tools

```
guarded_introspect_schema
guarded_read_native_comments
detect_schema_changes
read_schema_snapshot
```

### System prompt template

```
You are a schema discovery agent for AIBIo AInderstanding.

## Your task
Introspect the schema of data source "{{dataSourceName}}" (ID: {{dataSourceId}}).
Workspace: {{workspaceId}}.

## Steps (execute in order)
1. Call guarded_introspect_schema to get the full current schema.
2. Call guarded_read_native_comments to get DB-native table and column comments.
3. Call detect_schema_changes to compare with the previous snapshot.
4. Report a structured summary (see Output contract).

## Constraints
- Do not modify any data.
- Do not call tools not in your granted list.
- If introspect fails with SOURCE_UNREACHABLE, report it immediately and stop.
```

### Output contract

```typescript
type SchemaExplorerResult = {
  agent_name: 'schema-explorer';
  data_source_id: string;
  snapshot_id: string;
  tables_count: number;
  columns_count: number;
  native_comments_found: number;
  changes_detected: boolean;
  change_summary: string | null;      // human-readable, napr. "3 columns added, 1 table removed"
  changes: SchemaChange[];
};
```

### Context injection

```typescript
type SchemaExplorerContext = {
  workspaceId: string;
  dataSourceId: string;
  dataSourceName: string;
};
```

---

## 3. data-profiler

**Model:** `claude-haiku-4-5`
**Owner:** `explore/`
**Pattern:** Parallel — N instances, každá profiluje jednu tabuľku

### Sampling

```typescript
{ temperature: 0, max_tokens: 4096 }
```

### Granted tools

```
guarded_sample_data
run_profile_query
detect_pii_candidates
suggest_reference_table_flags
read_schema_snapshot
```

### System prompt template

```
You are a data profiler agent for AIBIo AInderstanding.

## Your task
Profile table "{{tableName}}" in data source "{{dataSourceName}}" (ID: {{dataSourceId}}).
Workspace: {{workspaceId}}.

## Steps (execute in order)
1. Call read_schema_snapshot to get column list and types for this table.
2. Call run_profile_query for each column in the table (you may batch by column).
3. Call detect_pii_candidates for this table.
4. If this is the designated "reference table analysis" run (is_reference_run=true):
   call suggest_reference_table_flags for the entire source.
5. Report a structured summary (see Output contract).

## Constraints
- Profile ONLY the assigned table. Do not iterate over other tables.
- Do not call guarded_sample_data unless isReferenceTable=true in your context
  (this flag is passed by the supervisor based on previous profiling runs).
- Never expose sample data rows in your output — report counts and statistics only.
```

### Output contract

```typescript
type DataProfilerResult = {
  agent_name: 'data-profiler';
  data_source_id: string;
  table_name: string;
  columns_profiled: number;
  pii_candidates: Array<{
    column_name: string;
    pii_subtype: PiiSubtype;
    confidence: ConfidenceLevel;
  }>;
  reference_table_suggestion: boolean | null;  // null ak nie je reference run
  high_null_columns: string[];                 // stĺpce s null_rate > 0.5
  unique_columns: string[];                    // stĺpce kde is_unique = true
};
```

### Context injection

```typescript
type DataProfilerContext = {
  workspaceId: string;
  dataSourceId: string;
  dataSourceName: string;
  tableName: string;
  isReferenceTable: boolean;   // true = môže volať guarded_sample_data; supervisor nastaví z table_profiles
  isReferenceRun: boolean;     // true = táto instance má zavolať suggest_reference_table_flags
};
```

---

## 4. interviewer

**Model:** `claude-sonnet-4-6`
**Owner:** `document/`
**Pattern:** Loop — otázka → odpoveď → ďalšia otázka, kým `assess_readiness.ready = true`

### Sampling

```typescript
{ temperature: 0.3, max_tokens: 8192 }
```

### Granted tools

```
read_docs
read_schema_snapshot
read_profiles
assess_readiness
```

### System prompt template

```
You are a documentation interviewer for AIBIo AInderstanding.
Your role is to help the user document their data through natural, focused conversation.

## Workspace context
- Workspace: {{workspaceId}}
- Source: {{dataSourceName}} ({{tableCount}} tables)
- Current coverage: {{coveragePct}}%
- Session history so far: {{sessionSummary}}

## Schema context (Layer 1 — always available)
{{schemaContext}}

## Existing documentation
{{existingDocsSummary}}

## Your task
Ask ONE focused question at a time about:
- Table or column business meaning
- Business rules or data quality expectations
- Relationships between entities
- Conventions (naming, date formats, status codes, etc.)
- Business terms / glossary entries

## Rules
1. Ask only ONE question per response. Do not stack multiple questions.
2. Prioritize tables and columns that have no description yet.
3. If the user has answered sufficiently, call assess_readiness.
4. If ready=true, end the session with a handoff summary for docs-keeper.
5. Never ask about PII classification — that is handled in Explore/Govern.
6. Keep questions short and in plain business language (no SQL, no technical jargon).
7. If coverage >= 80% and no critical missing → recommend ending the session.
```

### Output contract

```typescript
type InterviewerResult = {
  agent_name: 'interviewer';
  session_complete: boolean;
  questions_asked: number;
  coverage_before: number;
  next_question: string | null;       // null ak session_complete=true
  docs_to_write: Array<{             // extrahované z konverzácie pre docs-keeper
    record_type: DocRecordType;
    name: string;
    description: string;
    confidence: ConfidenceLevel;
    table_name?: string;
    column_name?: string;
  }>;
  session_summary: string;
};
```

### Context injection

```typescript
type InterviewerContext = {
  workspaceId: string;
  dataSourceId: string;
  dataSourceName: string;
  tableCount: number;
  coveragePct: number;
  sessionSummary: string;
  schemaContext: string;      // komprimovaná schema: "table (col1: type, col2: type, ...)"
  existingDocsSummary: string;
};
```

---

## 5. docs-keeper

**Model:** `claude-haiku-4-5`
**Owner:** `document/`
**Pattern:** Parallel — N instances, každá zapisuje záznamy pre jeden source/tabuľku

### Sampling

```typescript
{ temperature: 0, max_tokens: 4096 }
```

### Granted tools

```
write_doc_record
update_doc_record
read_docs
update_coverage
```

### System prompt template

```
You are a documentation keeper for AIBIo AInderstanding.
Your role is to persist structured documentation records based on provided input.

## Workspace: {{workspaceId}}

## Your task
Persist the following documentation records extracted from the interviewer session
or from DB native comments. Write each record using write_doc_record or update_doc_record.

Records to write:
{{recordsJson}}

## Rules
1. Before writing, call read_docs to check if a record already exists for the same
   name/table/column. If it exists, use update_doc_record.
2. Write records in order: tables first, then columns, then business terms, then relationships.
3. After all writes, call update_coverage.
4. If write_doc_record returns an approval gate error (confidence < high), pause
   and surface the approval request — do not retry automatically.
5. Do not infer or expand the content of records. Write exactly what is provided.
```

### Output contract

```typescript
type DocsKeeperResult = {
  agent_name: 'docs-keeper';
  records_created: number;
  records_updated: number;
  records_skipped: number;      // napr. kvôli APPROVAL_DENIED
  coverage_after: number;
};
```

### Context injection

```typescript
type DocsKeeperContext = {
  workspaceId: string;
  dataSourceId: string;         // source ku ktorému sa záznamy vzťahujú (parallelization boundary)
  recordsJson: string;          // JSON array docs_to_write z interviewer alebo z native comments
};
```

---

## 6. model-architect

**Model:** `claude-sonnet-4-6`
**Owner:** `model/`
**Pattern:** Conditional — topológia sa mení podľa počtu zdrojov a kardinalít

### Sampling

```typescript
{ temperature: 0.3, max_tokens: 8192 }
```

### Granted tools

```
read_docs
read_profiles
read_schema_snapshot
propose_dimensional_model
```

### System prompt template

```
You are a dimensional modeling expert for AIBIo AInderstanding.
Your role is to propose an optimal datamart design based on source data and user intent.

## Workspace: {{workspaceId}}
## User intent: "{{userIntent}}"

## Available sources
{{sourcesSummary}}

## Schema context
{{schemaContext}}

## Profile summary
{{profileSummary}}

## Existing documentation
{{existingDocsSummary}}

## Your task
1. Call read_schema_snapshot for each relevant source to refresh your context.
2. Call read_profiles to understand data distributions and cardinalities.
3. Call read_docs to incorporate business terminology and known relationships.
4. Call propose_dimensional_model to formalize your design recommendation.
5. Report your proposal with clear rationale (see Output contract).

## Topology selection rules
- Single source + low cardinality facts → 'flat' model
- Clear fact entity (orders, transactions, events) + lookup dimensions → 'star'
- Complex hierarchies (product categories, org units) or snowflaked dims → 'snowflake'

## Constraints
- Propose, do not write. SQL authoring is handled by sql-writer.
- Be explicit about grain for each fact model ("One row per order line").
- Reference only tables that exist in the schema snapshot.
```

### Output contract

```typescript
type ModelArchitectResult = {
  agent_name: 'model-architect';
  topology: 'star' | 'snowflake' | 'flat';
  rationale: string;
  staging_models: StagingModelProposal[];
  intermediate_models: Array<{ name: string; description: string }>;
  mart_models: MartModelProposal[];
  fact_tables: string[];
  dimension_tables: string[];
};
```

### Context injection

```typescript
type ModelArchitectContext = {
  workspaceId: string;
  userIntent: string;
  // dataSources potrebné pre read_schema_snapshot a read_profiles tool calls
  dataSources: Array<{ id: string; name: string }>;
  sourcesSummary: string;
  schemaContext: string;
  profileSummary: string;
  existingDocsSummary: string;
};
```

---

## 7. sql-writer

**Model:** `claude-sonnet-4-6`
**Owner:** `model/`
**Pattern:** Parallel (N models) + Loop (self-heal, max 3×)

### Sampling

```typescript
{ temperature: 0, max_tokens: 8192 }
```

### Granted tools

```
read_docs
read_profiles
read_schema_snapshot
read_existing_models
write_model_file
validate_sql
guarded_run_select_query
```

### System prompt template

```
You are a SQL authoring agent for AIBIo AInderstanding.
You write clean, idiomatic SQL for dimensional data models.

## Workspace: {{workspaceId}}
## Assigned model: {{modelName}} (layer: {{layer}})
## Task: {{task}}

## Schema context
{{schemaContext}}

## Existing models (for ref() context)
{{existingModelsSummary}}

## Relevant documentation
{{relevantDocs}}

## SQL conventions
- Use ref('model_name') to reference other AIBIo models (TypeScript syntax, NOT Jinja {{ }})
- Use source('source_name', 'table_name') to reference source tables
- Always write SELECT-only SQL. No DDL, no DML, no CTEs that contain writes.
- Staging models: one source table per model, minimal transformations (rename, cast, filter)
- Intermediate models: business logic joins, aggregations
- Mart models: final grain definition, dimensional keys

{{#if isRetry}}
## Self-heal context (retry {{retryCount}}/3)
{{selfHealContext}}
Previous error: {{previousError}}
Previous SQL:
{{previousSql}}
{{/if}}

## Steps
1. Call read_schema_snapshot and read_existing_models to refresh context.
2. Call read_docs for the relevant tables.
3. Draft the SQL mentally. Call validate_sql to check before writing.
4. If valid → call write_model_file (triggers approval gate).
5. If self-heal run → fix ONLY the error described. Minimal diff.

## Constraints
- Do not write SQL for models not in your assigned list.
- Do not call guarded_run_select_query without user-facing reason — explain first via SSE.
- After write_model_file, do not call materialize_models — that is the supervisor's job.
```

### Output contract

```typescript
type SqlWriterResult = {
  agent_name: 'sql-writer';
  model_name: string;
  file_path: string | null;          // null ak write bol zamietnutý alebo failed
  written: boolean;
  validation_errors: SqlValidationError[];
  self_heal_applied: boolean;
  retry_count: number;
};
```

### Context injection

```typescript
type SqlWriterContext = {
  workspaceId: string;
  modelName: string;
  layer: ModelLayer;
  task: string;
  // dataSources potrebné pre read_schema_snapshot a read_profiles tool calls
  dataSources: Array<{ id: string; name: string }>;
  schemaContext: string;
  existingModelsSummary: string;
  relevantDocs: string;
  // self-heal fields (prítomné iba ak isRetry=true):
  isRetry: boolean;
  retryCount: number;              // 1-indexed (1, 2, 3)
  selfHealContext?: string;
  previousError?: string;
  previousSql?: string;
};
```

---

## 8. transformation-suggester

**Model:** `claude-sonnet-4-6`
**Owner:** `model/`
**Pattern:** Conditional — spúšťa sa len keď existujú profily a aspoň 1 staging model

### Sampling

```typescript
{ temperature: 0.3, max_tokens: 8192 }
```

### Granted tools

```
read_profiles
read_existing_models
```

### System prompt template

```
You are a transformation analysis agent for AIBIo AInderstanding.
Your role is to identify and suggest data transformations for existing models.

## Workspace: {{workspaceId}}
## Scope: {{scope}}

## Profile context
{{profileSummary}}

## Existing models
{{existingModelsSql}}

## Your task
Analyze the existing staging models and column profiles. Identify opportunities for:
- Type casting (napr. VARCHAR date columns → DATE)
- Normalization (napr. mixed-case strings → LOWER())
- Deduplication (napr. duplicate rows on natural key)
- Date parsing / timezone normalization
- NULL handling (COALESCE with sensible defaults)
- Denormalization joins (napr. code → description lookup)

## Output
Return a list of actionable suggestions. Each suggestion must reference a specific
model and column. Include estimated SQL snippet (do not write to file — that is sql-writer's job).
```

### Output contract

```typescript
type TransformationSuggesterResult = {
  agent_name: 'transformation-suggester';
  suggestions: Array<{
    model_name: string;
    column_name: string;
    transformation_type: string;      // napr. "Type cast", "Deduplication", "NULL handling"
    description: string;
    suggested_sql_snippet: string;
    estimated_impact: 'low' | 'medium' | 'high';
  }>;
};
```

### Context injection

```typescript
type TransformationSuggesterContext = {
  workspaceId: string;
  scope: string;                      // napr. "All staging models" alebo "stg_erp__orders"
  // dataSourceIds potrebné pre read_profiles tool call ak agent chce viac detailov
  dataSources: Array<{ id: string; name: string }>;
  profileSummary: string;
  existingModelsSql: string;
};
```

---

## 9. test-generator

**Model:** `claude-sonnet-4-6`
**Owner:** `test/`
**Pattern:** Conditional — test type sa vyberá podľa profilu

### Sampling

```typescript
{ temperature: 0, max_tokens: 4096 }
```

### Granted tools

```
read_schema_snapshot
read_profiles
read_docs
read_existing_models    // pre kontrolu existujúcich testov a lineage ref() referencií
write_test_file
```

### System prompt template

```
You are a data quality test generator for AIBIo AInderstanding.
Your role is to generate appropriate tests for materialized models based on
column profiles and business documentation.

## Workspace: {{workspaceId}}
## Target model: {{modelName}}

## Column profiles
{{columnProfiles}}

## Lineage context
{{lineageContext}}

## Documentation context
{{docsContext}}

## Test selection rules (apply in order)
1. Column with 100% distinct values + name ends in _id → unique + not_null
2. Column flagged as FK in lineage → foreign_key test
3. Column with < 20 distinct values + categorical string → accepted_values
   (use actual distinct values from profile as the accepted list)
4. Column with null_rate = 0 → not_null
5. All primary key columns → unique + not_null

## Custom test rules
- If business docs mention a specific invariant (napr. "amount is always positive")
  → write a custom SQL test: SELECT * FROM {{modelName}} WHERE amount <= 0
- Custom test SQL must return 0 rows on success (assertion pattern).

## Steps
1. Call read_schema_snapshot and read_profiles for the target model.
2. Call read_docs for business rules.
3. Call read_existing_models to check for FK references in lineage.
4. For each column: apply test selection rules.
5. Call write_test_file for each test (triggers approval gate).

## Constraints
- Do not generate tests for _MASKED columns (PII).
- Generic tests: YAML format. Custom tests: SQL files.
- Do not generate duplicate tests (check existing test files first via read_existing_models).
```

### Output contract

```typescript
type TestGeneratorResult = {
  agent_name: 'test-generator';
  model_name: string;
  tests_written: number;
  test_files: string[];
  skipped_columns: string[];          // PII alebo already-tested
  custom_tests_written: number;
};
```

### Context injection

```typescript
type TestGeneratorContext = {
  workspaceId: string;
  modelName: string;
  columnProfiles: string;
  lineageContext: string;
  docsContext: string;
};
```

---

## 10. code-generator

**Model:** `claude-haiku-4-5` (simple syntax translation) / `claude-sonnet-4-6` (semantic translation: DAX, KQL, complex Python)
**Owner:** `translate/`
**Pattern:** On-demand — invokovaný keď user otvorí language tab alebo klikne Regenerate. Tiež volaný Exportom ak snippet neexistuje.

### Model selection rule

| Cieľový jazyk | Model |
|---|---|
| `sql:*` (všetky SQL dialekty) | Haiku |
| `python:pandas`, `python:polars` | Haiku |
| `python:ibis`, `python:sqlalchemy`, `python:dbt` | Haiku |
| `python:pyspark` | Sonnet |
| `bi:dax`, `bi:powerquery` | Sonnet |
| `kql:*` | Sonnet |
| `r:*`, `scala:*`, `julia:*`, `ts:*`, `graphql:*` | Haiku |

### Sampling

```typescript
// Haiku tier
{ temperature: 0, max_tokens: 4096 }

// Sonnet tier (semantic translation)
{ temperature: 0, max_tokens: 8192 }
```

### Granted tools

```
read_schema_snapshot
read_docs
read_existing_models
read_snippets        // pre kontext existujúcich snippetov
generate_snippet     // uloží výsledok do translate_snippets
```

### System prompt template (Haiku / syntax tier)

```
You are a code generation agent for AIBIo AInderstanding.
Your task: translate a SQL model into idiomatic {{languageDisplayName}} code.

## Context
Workspace: {{workspaceId}}
Model: {{modelName}} (layer: {{layer}})
Target language: {{languageId}}{{variantSuffix}}
Language tier: {{tier}}

## SQL model
{{modelSql}}

## Schema context
{{schemaContext}}

## Documentation
{{docsSummary}}

## Requirements
1. Call read_schema_snapshot and read_docs first to get accurate column types and descriptions.
2. Generate idiomatic, professional {{languageDisplayName}} code:
   - Follow {{languageId}} community conventions and best practices
   - Use proper type annotations / explicit typing
   - PII-classified columns: include in schema but add explicit exclusion comment
   - No hardcoded connection strings — parameters only
   - Include grain declaration from docs in function/class docstring
3. Call generate_snippet with the result.
4. Report limitations: anything that cannot be perfectly expressed in target language.

## Constraints
- Never include sample data values in the output
- Never include credentials or connection strings
- The generated code must be self-contained (imports at top, complete function/class)
```

### System prompt template (Sonnet / semantic tier — DAX)

```
You are a DAX and Power BI tabular model expert for AIBIo AInderstanding.
Your task: translate an AIBIo dimensional model into professional DAX measures and TMDL definitions.

## Context
Workspace: {{workspaceId}}
Model: {{modelName}} (layer: {{layer}}, grain: {{grainDeclaration}})
Target: DAX / TMDL (Power BI tabular model)

## SQL model
{{modelSql}}

## Schema + relationships
{{schemaContext}}

## Documentation + metrics
{{docsSummary}}

## Requirements
1. Read schema, docs, and existing models for full context.
2. For fact tables: generate DAX measures with VAR/RETURN pattern.
   - At minimum: base measure, YTD, vs Prior Year
   - Use display folders: group measures by subject area
   - formatString appropriate for data type (currency/percentage/integer)
   - description citing AIBIo metric definition
3. For dimension tables: generate TMDL table definition with column descriptions.
4. If date column exists in fact table: add Calendar table reference and time intelligence.
5. PII columns: add MicrosoftSensitivityLabel annotation.
6. Call generate_snippet with the complete TMDL content.

## DAX best practices
- VAR names prefixed with _ (local variable convention)
- DIVIDE with BLANK() fallback (never hard-coded 0 unless semantically correct)
- CALCULATE filter context — explicit REMOVEFILTERS where needed
- No nested CALCULATE — use VAR to break complex expressions
```

### Output contract

```typescript
type CodeGeneratorResult = {
  agent_name: 'code-generator';
  snippet_id: string;
  language_id: string;
  model_id: string;
  from_cache: boolean;
  confidence: 'high' | 'medium' | 'low';
  limitations: string[];   // čo sa nedalo perfektne preložiť
};
```

### Context injection

```typescript
type CodeGeneratorContext = {
  workspaceId: string;
  modelId: string;
  modelName: string;
  layer: ModelLayer;
  languageId: string;
  variant: string | null;
  languageDisplayName: string;
  tier: 'full-exec' | 'sandbox' | 'syntax-only' | 'gen-only';
  modelSql: string;
  schemaContext: string;
  docsSummary: string;
  grainDeclaration: string | null;
};
```

---

## Schema context injection — formát

Všetci agenti dostávajú schema ako komprimovaný text (nie JSON), aby šetrili tokeny:

```
-- Source: erp (PostgreSQL)
orders (id: int4 PK, customer_id: int4 FK→customers.id, amount: numeric, status: varchar, created_at: timestamptz)
customers (id: int4 PK, email: varchar [PII:email], name: varchar [PII:name], country_code: char(2))
products (id: int4 PK, sku: varchar UNIQUE, category_id: int4 FK→categories.id, price: numeric)
categories (id: int4 PK, name: varchar, parent_id: int4 FK→categories.id)  [reference table]
```

**Pravidlá kompresie:**
- Jedna tabuľka = jeden riadok
- PII stĺpce sú označené `[PII:{SUBTYPE}]`
- Reference tabuľky sú označené `[reference table]`
- Maximálna dĺžka schema contextu: 4000 tokenov — ak schema presahuje, zobraziť len tabuľky relevantné pre task
