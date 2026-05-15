# AInderstanding — MCP Tools Catalog

> **Scope:** Definícia všetkých 29 MCP tools registrovaných v AInderstanding (26 MVP + 3 Translate post-MVP). Každý tool obsahuje TypeScript typy pre input/output, zoznam agentov s prístupom, requirement na approval gate, a error kódy.
>
> **Registration:** Sub-moduly volajú `registerTool()` pri startup. `getToolsForAgent(agentName)` vracia iba tools kde `allowedCallers.includes(agentName)`. Platí pre všetky tri tiere: supervisor (Tier 1), Phase Coordinators (Tier 2), atomic agents (Tier 3). Rýchly lookup: [Tool Ownership Matrix](#tool-ownership-matrix).

---

## Quick Reference

| Tool | Owner | Called by | Gate |
|------|-------|-----------|------|
| `guarded_introspect_schema` | Govern | `schema-explorer` | — |
| `guarded_read_native_comments` | Govern | `schema-explorer` | — |
| `guarded_sample_data` | Govern | `data-profiler` | — |
| `guarded_run_select_query` | Govern | `sql-writer` | `execute_query` |
| `guarded_share_results` | Govern | `supervisor` | `share_results_with_ai` |
| `detect_schema_changes` | Explore | `schema-explorer` | — |
| `run_profile_query` | Explore | `data-profiler` | — |
| `detect_pii_candidates` | Explore | `data-profiler` | — |
| `suggest_reference_table_flags` | Explore | `data-profiler` | — |
| `read_schema_snapshot` | Explore | `explore-coordinator`, `model-coordinator`, `schema-explorer`, `data-profiler`, `model-architect`, `sql-writer`, `test-generator`, `interviewer`, `code-generator-*` *(Phase 2)* | — |
| `read_profiles` | Explore | `model-architect`, `sql-writer`, `transformation-suggester`, `test-generator`, `interviewer` | — |
| `read_docs` | Document | `model-architect`, `sql-writer`, `test-generator`, `interviewer`, `docs-keeper`, `code-generator-*` *(Phase 2)* | — |
| `read_existing_models` | Model | `model-coordinator`, `model-architect`, `sql-writer`, `transformation-suggester`, `test-generator`, `quality-coordinator`, `code-generator-*` *(Phase 2)* | — |
| `propose_dimensional_model` | Model | `model-architect` | — |
| `write_model_file` | Model | `sql-writer` | `write_model_file` |
| `validate_sql` | Model | `sql-writer`, `model-coordinator`, `supervisor` | — |
| `parse_lineage` | Model | `model-coordinator`, `supervisor` | — |
| `materialize_models` | Model | `model-coordinator`, `supervisor` | — |
| `write_test_file` | Test | `test-generator` | `write_test_file` |
| `run_tests` | Test | `quality-coordinator`, `supervisor` | — |
| `test_failure_handoff` | Test | `quality-coordinator` | — |
| `write_doc_record` | Document | `docs-keeper` | `write_to_docs` (conditional) |
| `update_doc_record` | Document | `docs-keeper` | `write_to_docs` (conditional) |
| `update_coverage` | Document | `document-coordinator`, `docs-keeper` | — |
| `assess_readiness` | Document | `document-coordinator`, `interviewer`, `supervisor` | — |
| `read_coverage_summary` | Document | `document-coordinator`, `supervisor` | — |
| `generate_snippet` | Translate | `code-generator-*` | — | *(Phase 2, post-MVP)* |
| `read_snippets` | Translate | `code-generator-*`, `supervisor` | — | *(Phase 2, post-MVP)* |
| `run_snippet_test` | Translate | `supervisor` | — | *(Phase 2, post-MVP)* |

**Gate legend:** `execute_query` · `share_results_with_ai` · `write_model_file` · `write_test_file` · `write_to_docs`

---

## Spoločné typy

```typescript
// Zdieľané v core/types/mcp.ts

type ApprovalGateType =
  | 'execute_query'
  | 'share_results_with_ai'
  | 'write_model_file'
  | 'write_test_file'
  | 'write_to_docs';

type ConfidenceLevel = 'low' | 'medium' | 'high';
type DocSource = 'db_native' | 'ai_generated' | 'user_authored' | 'user_confirmed';
type DocRecordType = 'table' | 'column' | 'business_term' | 'relationship' | 'convention';
type ModelLayer = 'staging' | 'intermediate' | 'marts';
type Materialization = 'table' | 'view';
type PiiSubtype = 'email' | 'phone' | 'national_id' | 'address' | 'ip' | 'name' | 'date_of_birth' | 'iban' | 'other';
type TestKind = 'unique' | 'not_null' | 'foreign_key' | 'accepted_values';
type RunStatus = 'success' | 'error' | 'running' | 'queued';
```

---

## Spoločné error kódy

Každý tool môže vrniť tieto chyby okrem tool-špecifických:

| Kód | Popis |
|-----|-------|
| `PERMISSION_DENIED` | Govern permission check failed pre daný data source / tabuľku |
| `SOURCE_UNREACHABLE` | Nie je možné pripojiť sa k source DB |
| `APPROVAL_DENIED` | Používateľ zamietol approval gate |
| `APPROVAL_TIMEOUT` | Approval gate timeout (300 s bez odpovede) |
| `RESOURCE_NOT_FOUND` | workspace_id / data_source_id / model_name neexistuje |
| `INTERNAL_ERROR` | Nečakané zlyhanie — logovať a surfovať používateľovi |

---

## Govern-guarded Tools

Tieto tools sú **jedinou platnou cestou** pre prístup agentov k source dátam. Priamy import adaptérov je blokovaný ESLint pravidlom.

---

### `guarded_introspect_schema`

Načíta kompletnú schému source DB cez príslušný adapter. Vykoná preflight permission check.

**Owner:** `govern/` | **Caller:** `schema-explorer`

```typescript
// Input
type GuardedIntrospectSchemaInput = {
  data_source_id: string;
};

// Output
type GuardedIntrospectSchemaOutput = {
  snapshot_id: string;                // UUID nového záznamu uloženého do schema_snapshots
  tables: Array<{
    name: string;
    schema: string;                   // DB schema name (napr. "public", "dbo")
    native_comment: string | null;
    columns: Array<{
      name: string;
      data_type: string;              // natívny DB typ ("varchar(255)", "int4", ...)
      nullable: boolean;
      is_primary_key: boolean;
      is_foreign_key: boolean;
      foreign_key_references: {
        table: string;
        column: string;
      } | null;
      native_comment: string | null;
    }>;
  }>;
};
```

**Errors:** `PERMISSION_DENIED` · `SOURCE_UNREACHABLE`

---

### `guarded_read_native_comments`

Načíta natívne DB komentáre (TABLE COMMENT / COLUMN COMMENT). Slúži na predvyplnenie dokumentácie s `confidence=high`.

**Owner:** `govern/` | **Caller:** `schema-explorer`

```typescript
type GuardedReadNativeCommentsInput = {
  data_source_id: string;
  table_names?: string[];             // ak chýba → všetky tabuľky
};

type GuardedReadNativeCommentsOutput = {
  comments: Array<{
    table: string;
    column: string | null;            // null = komentár je na tabuľke
    comment: string;
  }>;
};
```

**Errors:** `PERMISSION_DENIED` · `SOURCE_UNREACHABLE`

---

### `guarded_sample_data`

Načíta vzorku riadkov zo source tabuľky. PII stĺpce sú automaticky maskované. Vyžaduje `permission_tier >= 'with_reference_samples'` (pre reference tabuľky) alebo `'with_full_samples'` (pre ostatné).

**Owner:** `govern/` | **Caller:** `data-profiler`

```typescript
type GuardedSampleDataInput = {
  data_source_id: string;
  table_name: string;
  limit?: number;                     // default: 100, max: 500
};

type GuardedSampleDataOutput = {
  columns: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
  pii_masked_columns: string[];       // stĺpce nahradené "[{PII_SUBTYPE}_MASKED]"
  row_count: number;
  permission_tier_used: string;
};
```

**Errors:** `PERMISSION_DENIED` · `SOURCE_UNREACHABLE`

---

### `guarded_run_select_query`

Spustí SELECT na source DB. **Nevracia riadky agentovi** — iba metadata. Výsledok je cachovaný pod `query_result_id` pre prípadné `guarded_share_results`. Vyžaduje approval gate `execute_query`.

**Owner:** `govern/` | **Caller:** `sql-writer` | **Gate:** `execute_query`

```typescript
type GuardedRunSelectQueryInput = {
  data_source_id: string;
  sql: string;
  session_id: string;
};

type GuardedRunSelectQueryOutput = {
  query_result_id: string;            // UUID cachovaného výsledku
  row_count: number;
  columns: string[];
  execution_ms: number;
};
```

**Errors:** `PERMISSION_DENIED` · `SOURCE_UNREACHABLE` · `INVALID_SQL` · `QUERY_EXECUTION_ERROR` · `APPROVAL_DENIED` · `APPROVAL_TIMEOUT`

Tool-špecifický error:

| Kód | Popis |
|-----|-------|
| `INVALID_SQL` | SQL parser gate odmietol non-SELECT príkaz |
| `QUERY_EXECUTION_ERROR` | SELECT zlyhal na source DB (syntax / timeout / privilege) |

**Query result cache:** Výsledok je uložený in-memory (`Map<string, QueryResult>` v server procese) pod vrátenim `query_result_id`. Nie je perzistovaný do SQLite — zámerom je GDPR: raw query výsledky sa neukladajú dlhšie ako je nevyhnutné. Cache expiruje pri reštarte servera alebo po volaní `guarded_share_results` pre tú istú session.

---

### `guarded_share_results`

Zdieľa cachovaný výsledok query s agentom. Vyžaduje approval gate `share_results_with_ai`. Môže byť volaný len pre `query_result_id` z tej istej session.

**Owner:** `govern/` | **Caller:** `supervisor` | **Gate:** `share_results_with_ai`

```typescript
type GuardedShareResultsInput = {
  query_result_id: string;
  session_id: string;
};

type GuardedShareResultsOutput = {
  columns: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
  row_count: number;
  cached_at: string;                  // ISO 8601
};
```

**Errors:** `RESOURCE_NOT_FOUND` · `APPROVAL_DENIED` · `APPROVAL_TIMEOUT`

---

## Explore Tools

---

### `detect_schema_changes`

Porovná novú SchemaSnapshot so predošlou a vráti zoznam zmien. Volaný po každom `guarded_introspect_schema`.

**Owner:** `explore/` | **Caller:** `schema-explorer`

```typescript
type DetectSchemaChangesInput = {
  data_source_id: string;
  new_snapshot_id: string;            // snapshot práve uložený do DB
};

type SchemaChange = {
  change_type:
    | 'table_added'
    | 'table_removed'
    | 'column_added'
    | 'column_removed'
    | 'column_type_changed'
    | 'column_nullability_changed';
  table: string;
  column?: string;
  old_value?: string;
  new_value?: string;
};

type DetectSchemaChangesOutput = {
  has_changes: boolean;
  previous_snapshot_id: string | null;
  changes: SchemaChange[];
};
```

**Errors:** `RESOURCE_NOT_FOUND` (new_snapshot_id)

---

### `run_profile_query`

Spustí štatistické profiling queries pre jeden stĺpec. Volaný paralelne pre N stĺpcov jednej tabuľky.

**Owner:** `explore/` | **Caller:** `data-profiler`

```typescript
type RunProfileQueryInput = {
  data_source_id: string;
  table_name: string;
  column_name: string;
};

type RunProfileQueryOutput = {
  row_count: number;
  null_count: number;
  null_rate: number;                  // 0.0 – 1.0
  distinct_count: number;
  is_unique: boolean;
  min_value: string | null;
  max_value: string | null;
  avg_value: number | null;           // len pre numerické typy
  sample_values: string[];            // max 10 vzorkových hodnôt (non-PII)
  histogram: Array<{
    bucket: string;
    count: number;
  }> | null;                          // len pre kategorické / dátumové stĺpce
};
```

**Errors:** `SOURCE_UNREACHABLE` · `RESOURCE_NOT_FOUND` · `QUERY_EXECUTION_ERROR`

*`QUERY_EXECUTION_ERROR`: profiling query zlyhala na source DB (napr. unsupported type, insufficient privilege).*

**Implementačná poznámka — Govern prístup:** Handler `run_profile_query` pristupuje k source DB cez interný Govern adapter accessor (`govern/lib/internal-adapter.ts`) — nie cez raw Connect adapter (blokovaný ESLint pravidlom) a nie cez `guarded_run_select_query` (to by vyžadovalo `execute_query` approval gate pre každý stĺpec → approval fatigue). Profiling volania sú zaznamenané do `audit_entries` ako `action_type='read_schema'`.

**PII bezpečnosť:** `sample_values` v outpute sú automaticky vyprázdnené (`[]`) pre stĺpce, ktorých názvy zodpovedajú PII heuristikám — rovnaké regex patterns ako `detect_pii_candidates`. Toto je pre-filter bez content inspection aplikovaný pred spustením query, takže PII hodnoty sa nikdy neuložia do `column_profiles.top_values_json`.

---

### `detect_pii_candidates`

Heuristická PII detekcia z názvov stĺpcov (regex pattern matching). **Neinspektuje obsah dát.** Výsledky sú uložené do `column_profiles.pii_candidate`.

**Owner:** `explore/` | **Caller:** `data-profiler`

```typescript
type DetectPiiCandidatesInput = {
  data_source_id: string;
  table_name: string;
};

type PiiCandidate = {
  column_name: string;
  pii_subtype: PiiSubtype;
  confidence: ConfidenceLevel;
  matched_pattern: string;            // regex pattern ktorý triggernul detekciu
};

type DetectPiiCandidatesOutput = {
  candidates: PiiCandidate[];
};
```

**Errors:** `RESOURCE_NOT_FOUND`

---

### `suggest_reference_table_flags`

Na základe počtu riadkov a distribúcie hodnôt navrhne, ktoré tabuľky sú reference/lookup tabuľky. Návrhy sú prezentované používateľovi cez PIICandidatesPanel — nie automaticky aplikované. Používateľ potvrdzuje flag vo Explore UI; uloženie do `table_profiles.is_reference_table` prebieha cez Next.js server action (nie cez MCP tool).

**Owner:** `explore/` | **Caller:** `data-profiler`

```typescript
type SuggestReferenceTableFlagsInput = {
  data_source_id: string;
};

type ReferenceTableSuggestion = {
  table_name: string;
  is_reference_table: boolean;
  row_count: number;
  reasoning: string;                  // napr. "Low row count (42) + short string values suggest lookup table"
};

type SuggestReferenceTableFlagsOutput = {
  suggestions: ReferenceTableSuggestion[];
};
```

**Errors:** `RESOURCE_NOT_FOUND`

---

### `read_schema_snapshot`

Načíta SchemaSnapshot z SQLite cache. Read-only; nevyžaduje permission check (metadata Layer 1).

**Owner:** `explore/` | **Callers:** `explore-coordinator` · `model-coordinator` · `schema-explorer` · `data-profiler` · `model-architect` · `sql-writer` · `test-generator` · `interviewer` · `code-generator-*` *(Phase 2)*

```typescript
type ReadSchemaSnapshotInput = {
  data_source_id: string;
  snapshot_id?: string;               // ak chýba → najnovší snapshot
};

type ReadSchemaSnapshotOutput = {
  snapshot_id: string;
  data_source_id: string;
  captured_at: string;                // ISO 8601
  tables: Array<{
    name: string;
    schema: string;
    native_comment: string | null;
    row_count_estimate: number | null;
    columns: Array<{
      name: string;
      data_type: string;
      nullable: boolean;
      is_primary_key: boolean;
      is_foreign_key: boolean;
      foreign_key_references: { table: string; column: string } | null;
      native_comment: string | null;
      pii_candidate: boolean;
      pii_subtype: PiiSubtype | null;
    }>;
  }>;
};
```

**Errors:** `RESOURCE_NOT_FOUND`

---

### `read_profiles`

Načíta výsledky profiling z SQLite cache.

**Owner:** `explore/` | **Callers:** `model-architect` · `sql-writer` · `transformation-suggester` · `test-generator` · `interviewer`

```typescript
type ReadProfilesInput = {
  data_source_id: string;
  table_name?: string;                // ak chýba → všetky tabuľky
};

type ReadProfilesOutput = {
  profiles: Array<{
    table_name: string;
    profiled_at: string;              // ISO 8601
    row_count: number;
    columns: Array<{
      column_name: string;
      data_type: string;
      null_rate: number;
      distinct_count: number;
      is_unique: boolean;
      min_value: string | null;
      max_value: string | null;
      avg_value: number | null;
      sample_values: string[];
      pii_candidate: boolean;
      pii_subtype: PiiSubtype | null;
    }>;
  }>;
};
```

**Errors:** `RESOURCE_NOT_FOUND`

---

## Document Tools

---

### `read_docs`

Načíta governance dokumenty z SQLite. Dostupné všetkým read-only agentom pre kontext.

**Owner:** `document/` | **Callers:** `model-architect` · `sql-writer` · `test-generator` · `interviewer` · `docs-keeper` · `code-generator-*` *(Phase 2)*

```typescript
type ReadDocsInput = {
  workspace_id: string;
  data_source_id?: string;
  table_name?: string;
  record_type?: DocRecordType;        // filter; ak chýba → všetky typy
};

type DocRecord = {
  id: string;
  record_type: DocRecordType;
  name: string;
  description: string | null;
  source: DocSource;
  confidence: ConfidenceLevel | null;
  // type-specific fields:
  data_source_id?: string;
  table_name?: string;
  column_name?: string;
  pii_classification?: 'none' | 'pii' | 'sensitive' | null;
  pii_subtype?: PiiSubtype | null;
  created_at: string;
  updated_at: string;
};

type ReadDocsOutput = {
  records: DocRecord[];
  total_count: number;
};
```

**Errors:** `RESOURCE_NOT_FOUND`

---

### `write_doc_record`

Vytvorí nový dokumentačný záznam. Approval gate `write_to_docs` je vyžadovaný **podmienečne**: iba keď `confidence < 'high'`. Záznamy s `confidence='high'` (napr. z natívnych DB komentárov) sú zapisované bez approval.

**Owner:** `document/` | **Caller:** `docs-keeper` | **Gate:** `write_to_docs` (ak `confidence < workspace_settings.doc_confidence_threshold`; default `high`)

```typescript
type WriteDocRecordInput = {
  workspace_id: string;
  record_type: DocRecordType;
  name: string;
  description: string;
  source: DocSource;
  confidence: ConfidenceLevel;
  // Kontextové polia podľa record_type:
  data_source_id?: string;            // pre table / column
  table_name?: string;                // pre column
  column_name?: string;               // pre column
  pii_classification?: 'none' | 'pii' | 'sensitive';
  pii_subtype?: PiiSubtype;
};

type WriteDocRecordOutput = {
  record_id: string;
  created: true;
  coverage_delta: number;             // zmena coverage % (napr. +0.3)
};
```

**Errors:** `APPROVAL_DENIED` · `APPROVAL_TIMEOUT` · `RESOURCE_NOT_FOUND`

---

### `update_doc_record`

Aktualizuje existujúci dokumentačný záznam. Rovnaká podmienečná approval logika ako `write_doc_record`.

**Owner:** `document/` | **Caller:** `docs-keeper` | **Gate:** `write_to_docs` (ak `confidence < workspace_settings.doc_confidence_threshold`; default `high`)

```typescript
type UpdateDocRecordInput = {
  record_id: string;
  description?: string;
  confidence?: ConfidenceLevel;
  source?: DocSource;
  pii_classification?: 'none' | 'pii' | 'sensitive';
  pii_subtype?: PiiSubtype;
};

type UpdateDocRecordOutput = {
  record_id: string;
  updated: true;
  coverage_delta: number;
};
```

**Errors:** `APPROVAL_DENIED` · `APPROVAL_TIMEOUT` · `RESOURCE_NOT_FOUND`

---

### `update_coverage`

Prepočíta coverage skóre pre workspace. Volaný `docs-keeper` po každom úspešnom `write_doc_record` / `update_doc_record` (trigger z `document-coordinator` PostToolUse hook). Volaný `document-coordinator` pri ukončení swarm loop.

**Owner:** `document/` | **Callers:** `document-coordinator` · `docs-keeper`

```typescript
type UpdateCoverageInput = {
  workspace_id: string;
};

type UpdateCoverageOutput = {
  coverage_pct: number;               // 0.0 – 100.0
  by_type: {
    tables: number;                   // % pokrytých tabuliek (váha 40%)
    columns: number;                  // % pokrytých stĺpcov (váha 35%)
    business_terms: number;           // % (váha 15%)
    relationships: number;            // % (váha 10%)
  };
};
```

**Errors:** `RESOURCE_NOT_FOUND`

---

### `assess_readiness`

Vráti export readiness hodnotenie. `document-coordinator` ho volá na konci každého Swarm Loop kola na rozhodnutie o pokračovaní alebo ukončení. `supervisor` a `interviewer` ho používajú na high-level readiness check.

**Owner:** `document/` | **Callers:** `document-coordinator` · `interviewer` · `supervisor`

```typescript
type AssessReadinessInput = {
  workspace_id: string;
};

type ReadinessMissing = {
  type: DocRecordType | 'model' | 'test';
  name: string;
  reason: string;
};

type AssessReadinessOutput = {
  ready: boolean;                     // true ak coverage >= 80% a žiadne critical missing
  score: number;                      // 0–100
  missing_critical: ReadinessMissing[];
  recommendations: string[];
};
```

**Errors:** `RESOURCE_NOT_FOUND`

---

### `read_coverage_summary`

Načíta aktuálne coverage skóre bez prepočtu. Read-only; používaný supervisorom a `document-coordinator` na reporting a rozhodovanie.

**Owner:** `document/` | **Callers:** `document-coordinator` · `supervisor`

```typescript
type ReadCoverageSummaryInput = {
  workspace_id: string;
};

type ReadCoverageSummaryOutput = {
  coverage_pct: number;               // 0.0 – 100.0
  by_type: {
    tables: number;
    columns: number;
    business_terms: number;
    relationships: number;
  };
  computed_at: string;                // ISO 8601 — čas posledného update_coverage
};
```

**Errors:** `RESOURCE_NOT_FOUND`

---

## Model Tools

---

### `read_existing_models`

Načíta zoznam existujúcich modelov vrátane ich SQL. Používané pre kontext pri generovaní nových modelov.

**Owner:** `model/` | **Callers:** `model-coordinator` · `model-architect` · `sql-writer` · `transformation-suggester` · `test-generator` · `quality-coordinator` · `code-generator-*` *(Phase 2)*

```typescript
type ReadExistingModelsInput = {
  workspace_id: string;
  layer?: ModelLayer;                 // ak chýba → všetky vrstvy
};

type ExistingModel = {
  model_id: string;
  name: string;
  layer: ModelLayer;
  file_path: string;
  sql: string;
  materialization: Materialization;
  last_run_at: string | null;
  last_run_status: RunStatus | null;
};

type ReadExistingModelsOutput = {
  models: ExistingModel[];
};
```

**Errors:** `RESOURCE_NOT_FOUND`

---

### `propose_dimensional_model`

Na základe user intentu a profilov navrhne topológiu dimenzionálneho modelu. Výsledok je prezentovaný používateľovi na schválenie — `model-architect` ho nepíše priamo do súborov.

**Owner:** `model/` | **Caller:** `model-architect`

```typescript
type ProposeDimensionalModelInput = {
  workspace_id: string;
  data_source_id: string;
  user_intent: string;                // napr. "I want to analyze sales by region and product"
};

type StagingModelProposal = {
  name: string;                       // napr. "stg_erp__orders"
  source_table: string;
  description: string;
};

type MartModelProposal = {
  name: string;
  type: 'fact' | 'dimension';
  description: string;
  grain: string;                      // napr. "One row per order line"
};

type ProposeDimensionalModelOutput = {
  topology: 'star' | 'snowflake' | 'flat';
  rationale: string;
  staging_models: StagingModelProposal[];
  intermediate_models: Array<{ name: string; description: string }>;
  mart_models: MartModelProposal[];
  fact_tables: string[];
  dimension_tables: string[];
};
```

**Errors:** `RESOURCE_NOT_FOUND`

---

### `write_model_file`

Zapíše SQL model súbor na filesystem. Vyžaduje approval gate `write_model_file`. Supervisor **nemôže** tento tool volať priamo — iba `sql-writer`.

**Owner:** `model/` | **Caller:** `sql-writer` | **Gate:** `write_model_file`

```typescript
type WriteModelFileInput = {
  workspace_id: string;
  model_name: string;                 // bez prípony, napr. "stg_erp__orders"
  layer: ModelLayer;
  sql: string;
  materialization?: Materialization;  // default: 'table'
  overwrite?: boolean;                // default: false
};

type WriteModelFileOutput = {
  file_path: string;                  // napr. "workspaces/{id}/models/staging/stg_erp__orders.sql"
  model_id: string;
  created: boolean;                   // false = overwrite
};
```

**Errors:** `APPROVAL_DENIED` · `APPROVAL_TIMEOUT` · `INVALID_SQL` · `FILE_EXISTS_NO_OVERWRITE`

Tool-špecifický error:

| Kód | Popis |
|-----|-------|
| `INVALID_SQL` | SQL parser gate odmietol non-SELECT príkaz |
| `FILE_EXISTS_NO_OVERWRITE` | Súbor existuje a `overwrite=false` |

---

### `validate_sql`

Preflight syntax check + parser gate bez spustenia. Synchronný, nevyžaduje approval.

**Owner:** `model/` | **Callers:** `sql-writer` · `model-coordinator` · `supervisor`

```typescript
type ValidateSqlInput = {
  sql: string;
  workspace_id?: string;             // pre validáciu ref() / source() references
};

type SqlValidationError = {
  message: string;
  line?: number;
  column?: number;
};

type ValidateSqlOutput = {
  valid: boolean;
  errors: SqlValidationError[];
  has_non_select_statements: boolean;
  unresolved_refs: string[];          // ref() / source() ktoré neexistujú v workspace
};
```

**Errors:** `RESOURCE_NOT_FOUND` (ak je workspace_id zadané a neexistuje)

---

### `parse_lineage`

Reparsuje všetky model SQL súbory, extrahuje `ref()` a `source()` referencie, a uloží hrany do `lineage_edges`.

**Owner:** `model/` | **Callers:** `model-coordinator` · `supervisor`

`model-coordinator` volá `parse_lineage` ako PostToolUse hook po každom `write_model_file` (rebuild lineage pre aktuálnu fázu). Supervisor volá ho po cross-phase materializácii.

```typescript
type ParseLineageInput = {
  workspace_id: string;
};

type LineageEdge = {
  from_model: string;
  to_model: string;
  ref_type: 'ref' | 'source';
};

type ParseLineageOutput = {
  edges: LineageEdge[];
  orphaned_models: string[];          // modely bez predchodcu ani nasledovníka
  cycles_detected: boolean;
  topological_order: string[];        // dependency poradie pre materializáciu
};
```

**Errors:** `RESOURCE_NOT_FOUND`

Tool-špecifický error:

| Kód | Popis |
|-----|-------|
| `LINEAGE_CYCLE` | Cirkulárna závislosť `ref()` detekovaná — materializácia nie je možná |

---

### `materialize_models`

Spustí 2-phase materializáciu (source pull → model execution v topologickom poradí). Emituje `model_run_update` SSE eventy priebežne.

**Owner:** `model/` | **Callers:** `model-coordinator` · `supervisor`

```typescript
type MaterializeModelsInput = {
  workspace_id: string;
  model_names?: string[];             // ak chýba → všetky modely
  full_refresh?: boolean;             // default: false (incremental where supported)
};

type MaterializeModelsOutput = {
  run_id: string;
  started_at: string;
  models_queued: string[];            // v topologickom poradí
};
```

**Errors:** `RESOURCE_NOT_FOUND` · `LINEAGE_CYCLE`

*Priebežné výsledky sú doručené cez SSE `model_run_update` eventy, nie cez tool output.*

---

## Test Tools

---

### `write_test_file`

Zapíše YAML/SQL test definíciu na filesystem. Supervisor **nemôže** tento tool volať — iba `test-generator`.

**Owner:** `test/` | **Caller:** `test-generator` | **Gate:** `write_test_file`

```typescript
type WriteTestFileInput =
  | {
      workspace_id: string;
      test_type: 'generic';
      model_name: string;
      column_name: string;
      test_kind: TestKind;
      config?: {
        // pre foreign_key:
        to?: string;
        field?: string;
        // pre accepted_values:
        values?: string[];
      };
    }
  | {
      workspace_id: string;
      test_type: 'custom';
      assertion_name: string;
      sql: string;                    // SQL ktorý vráti 0 riadkov = PASS
    };

type WriteTestFileOutput = {
  file_path: string;
  test_id: string;
};
```

**Errors:** `APPROVAL_DENIED` · `APPROVAL_TIMEOUT` · `INVALID_SQL` (pre custom testy)

---

### `run_tests`

Spustí test runner. Emituje `test_run_update` SSE eventy pre každý test výsledok.

**Owner:** `test/` | **Callers:** `quality-coordinator` · `supervisor`

`quality-coordinator` volá po každom `test-generator` write (inline test-run + self-heal loop). Supervisor volá pri cross-phase `materialize_models` → auto-run.

```typescript
type RunTestsInput = {
  workspace_id: string;
  model_name?: string;                // ak chýba → všetky testy
  test_ids?: string[];                // ak chýba → všetky testy pre model_name alebo workspace
};

type RunTestsOutput = {
  run_id: string;
  started_at: string;
  tests_queued: number;
};
```

**Errors:** `RESOURCE_NOT_FOUND`

---

### `test_failure_handoff`

Predá kontext o zlyhaní modelu (SQL chyba pri materializácii alebo test failure) agentovi `sql-writer` pre self-heal loop. Max 3 retry per model.

**Owner:** `test/` | **Caller:** `quality-coordinator`

`quality-coordinator` je výhradný caller — self-heal je intra-phase operácia vlastnená koordinátorom. Supervisor nevolá tento tool priamo (BR-SHL-001/002).

```typescript
type TestFailureHandoffInput = {
  workspace_id: string;
  model_name: string;
  error_message: string;
  error_line?: number;
  model_sql: string;
  run_id: string;
  retry_count: number;               // 0-indexed; ak >= 3 → tool vráti error
};

type TestFailureHandoffOutput = {
  handoff_accepted: boolean;
  session_id: string;
};
```

**Errors:** `RESOURCE_NOT_FOUND`

Tool-špecifický error:

| Kód | Popis |
|-----|-------|
| `MAX_RETRIES_EXCEEDED` | `retry_count >= 3` — self-heal loop ukončený, error surfovaný používateľovi |

---

## Translate Tools

### `generate_snippet`

Generuje kód pre model v cieľovom jazyku cez `code-generator` agent a uloží výsledok do `translate_snippets`.

**Owner:** `translate/` | **Caller:** `code-generator` | **Gate:** none

`code-generator-syntax` / `code-generator-semantic` volajú tento tool po vygenerovaní kódu, aby persistovali výsledok. Supervisor *nevolá* `generate_snippet` priamo — deleguje na `code-generator-*` atomic agenta cez built-in `Task` tool, ktorý následne volá `generate_snippet`.

```typescript
type GenerateSnippetInput = {
  workspace_id: string;
  model_id: string;
  language_id: string;    // napr. 'python:pandas', 'bi:dax', 'kql:adx'
  variant?: string;       // ak jazyk má varianty
  force_regenerate?: boolean;  // true = ignoruj cache, vždy regeneruj
};

type GenerateSnippetOutput = {
  snippet_id: string;
  code: string;
  language_id: string;
  confidence: 'high' | 'medium' | 'low';
  limitations: string[];
  from_cache: boolean;    // true ak reused existujúci non-stale snippet
  stale: boolean;
};
```

**Errors:** `RESOURCE_NOT_FOUND` (model_id), `INVALID_LANGUAGE_ID` (neznámy language_id)

---

### `read_snippets`

Číta existujúce snippety pre model (alebo všetky modely v workspace).

**Owner:** `translate/` | **Callers:** `code-generator-*` · `supervisor` | **Gate:** none

```typescript
type ReadSnippetsInput = {
  workspace_id: string;
  model_id?: string;       // ak null → všetky modely v workspace
  language_id?: string;    // filter podľa jazyka
  include_stale?: boolean; // default false
};

type SnippetSummary = {
  snippet_id: string;
  model_id: string;
  language_id: string;
  variant: string | null;
  confidence: 'high' | 'medium' | 'low';
  stale: boolean;
  generated_at: string;
  last_test_status: string | null;
};

type ReadSnippetsOutput = {
  snippets: SnippetSummary[];
  total: number;
};
```

---

### `run_snippet_test`

Spustí ekvivalenčný test pre snippet — porovná output s DuckDB ground truth.

**Owner:** `translate/` | **Caller:** `supervisor` | **Gate:** none

```typescript
type RunSnippetTestInput = {
  snippet_id: string;
  timeout_ms?: number;    // default 30000 (30s)
};

type RunSnippetTestOutput = {
  test_result_id: string;
  snippet_id: string;
  status: 'passed' | 'failed' | 'syntax_ok' | 'syntax_error' | 'runtime_error' | 'timeout' | 'generated_only';
  ground_truth_row_count: number | null;
  generated_row_count: number | null;
  schema_match: boolean | null;
  row_count_match: boolean | null;
  data_equivalent: boolean | null;
  column_diffs: Array<{ column: string; gt_type: string; gen_type: string }>;
  row_diffs: Array<{ row_index: number; column: string; gt_value: unknown; gen_value: unknown }>;
  duration_ms: number;
  error: string | null;
};
```

**Errors:** `RESOURCE_NOT_FOUND` (snippet_id), `EXECUTION_TIMEOUT` (timeout_ms dosiahnutý)

Tool-špecifický error:

| Kód | Popis |
|-----|-------|
| `EXECUTION_TIMEOUT` | Python subprocess alebo SQL execúcia presiahla timeout |
| `SANDBOX_UNAVAILABLE` | Docker nie je dostupný pre `sandbox` tier jazyky |
| `INVALID_TIER` | `gen-only` tier nie je možné testovať |

---

## Registrácia tools

Sub-moduly registrujú tools v `{module}/lib/mcp-tools.ts` pri inicializácii:

```typescript
// Príklad: govern/lib/mcp-tools.ts
import { registerTool } from '@/core/orchestration/tool-registry';

registerTool({
  name: 'guarded_introspect_schema',
  description: 'Introspect source database schema with permission pre-check.',
  inputSchema: {
    type: 'object',
    properties: {
      data_source_id: { type: 'string' },
    },
    required: ['data_source_id'],
  },
  handler: guardedIntrospectSchemaHandler,
  allowedCallers: ['schema-explorer'],
  requiresApproval: null,
});
```

`core/orchestration/tool-registry.ts` exportuje `getToolsForAgent(agentName)` — vracia len tools kde `allowedCallers.includes(agentName)`.

---

## Tool Ownership Matrix

Rýchly lookup kto môže volať čo. Write tools majú výhradne jedného atomic agent callera — žiaden coordinator ani supervisor ich nevolá priamo (CR-MCP-003).

| Tool | supervisor | explore-coord. | model-coord. | doc-coord. | quality-coord. | Atomic agent(s) |
|------|:---:|:---:|:---:|:---:|:---:|---|
| `guarded_introspect_schema` | — | — | — | — | — | `schema-explorer` |
| `guarded_read_native_comments` | — | — | — | — | — | `schema-explorer` |
| `guarded_sample_data` | — | — | — | — | — | `data-profiler` |
| `guarded_run_select_query` | — | — | — | — | — | `sql-writer` |
| `guarded_share_results` | ✓ | — | — | — | — | — |
| `detect_schema_changes` | — | — | — | — | — | `schema-explorer` |
| `run_profile_query` | — | — | — | — | — | `data-profiler` |
| `detect_pii_candidates` | — | — | — | — | — | `data-profiler` |
| `suggest_reference_table_flags` | — | — | — | — | — | `data-profiler` |
| `read_schema_snapshot` | — | ✓ | ✓ | — | — | `schema-explorer`, `data-profiler`, `model-architect`, `sql-writer`, `test-generator`, `interviewer` |
| `read_profiles` | — | — | — | — | — | `model-architect`, `sql-writer`, `transformation-suggester`, `test-generator`, `interviewer` |
| `read_docs` | — | — | — | — | — | `model-architect`, `sql-writer`, `test-generator`, `interviewer`, `docs-keeper` |
| `read_existing_models` | — | — | ✓ | — | ✓ | `model-architect`, `sql-writer`, `transformation-suggester`, `test-generator` |
| `propose_dimensional_model` | — | — | — | — | — | `model-architect` |
| `write_model_file` | — | — | — | — | — | `sql-writer` (**write**) |
| `validate_sql` | ✓ | — | ✓ | — | — | `sql-writer` |
| `parse_lineage` | ✓ | — | ✓ | — | — | — |
| `materialize_models` | ✓ | — | ✓ | — | — | — |
| `write_test_file` | — | — | — | — | — | `test-generator` (**write**) |
| `run_tests` | ✓ | — | — | — | ✓ | — |
| `test_failure_handoff` | — | — | — | — | ✓ | — |
| `write_doc_record` | — | — | — | — | — | `docs-keeper` (**write**) |
| `update_doc_record` | — | — | — | — | — | `docs-keeper` (**write**) |
| `update_coverage` | — | — | — | ✓ | — | `docs-keeper` |
| `assess_readiness` | ✓ | — | — | ✓ | — | `interviewer` |
| `read_coverage_summary` | ✓ | — | — | ✓ | — | — |
