# TODO — Translate (Multi-language Code Generation)

> **Phase:** TR1 (registry + Python full-exec) + TR2 (SQL dialects + syntax validators) + TR3 (gen-only languages + standalone UI)
> **Status:** not started
> **Owner docs:** [GOAL.md](./GOAL.md), [RULES.md](./RULES.md), [UI.md](./UI.md), [LANGUAGES.md](./LANGUAGES.md)
> **Cross-refs:** ../ARCHITECTURE.md §6.7, ../DATABASE_SCHEMA.md §9 (translate_snippets, translate_test_results), ../MCP_TOOLS.md §Translate, ../API_CONTRACT.md §translate, ../AGENT_PROMPTS.md §10

## 1. Účel

Generuje profesionálny, idiomatický kód pre data model v 24 jazykoch a overuje ekvivalenciu vs DuckDB ground truth (deterministicky — `translate-validator` nie je LLM). Snippet cache s históriou 5 verzií, stale invalidation pri zmene model SQL. Embedded "Code" záložka v Model module + standalone Translate page. Export module **reuse** snippetov z Translate — nevytvorí vlastnú code generation logiku.

## 2. Stav existujúceho kódu

- [ ] Všetko — greenfield

## 3. Závislosti

- **Závisí od:** 00-core, 05-model (M3 — SQL definície, grain, layers), 03-explore (column types pre code generation)
- **Blokuje:** 09-export Phase X2–X5 (reuse snippet cache a `code-generator`)

## 4. Implementačný checklist

### 4.1 DB schema (`modules/ainderstanding/translate/db/schema.ts`)

- [ ] Tabuľka `translate_snippets` (DATABASE_SCHEMA.md §10):
  - `id` UUID PK, `workspace_id` FK CASCADE
  - `model_id` FK `models.id` CASCADE nullable (null = standalone translate)
  - `language_id` varchar NOT NULL — napr. `python:pandas`, `bi:dax` (z Language Registry)
  - `variant` varchar nullable — napr. `with_pandas_2`, `legacy` pre alternatívne vzory
  - `code` text NOT NULL — vygenerovaný kód (v schéme `code`, nie `content`)
  - `confidence` varchar nullable — napr. `high`, `medium` (validita prekladu)
  - `limitations_json` text nullable — JSON zoznam obmedzení/disclaimer
  - `stale` boolean default `false` (v schéme `stale`, nie `is_stale`) — true ak model SQL zmenený
  - `generated_at` timestamp (v schéme, nie `created_at`)
  - `generator_version` varchar (v schéme, nie `generated_by` enum)
  - `version` integer NOT NULL default `1`
  - `deleted_at` timestamp nullable — soft-delete pre history (posledných 5 verzií)
  - UNIQUE(`workspace_id`, `model_id`, `language_id`, `version`)
  - **Poznámka:** `is_custom`, `custom_note`, `updated_at` nie sú v DATABASE_SCHEMA.md

- [ ] Tabuľka `translate_test_results` (DATABASE_SCHEMA.md §10) — Phase 2:
  - `id` UUID PK, `snippet_id` FK CASCADE
  - `status` varchar NOT NULL — napr. `passed`, `failed`, `error`
  - `ground_truth_row_count` integer, `ground_truth_schema_json` text — DuckDB referencia
  - `generated_row_count` integer nullable, `generated_schema_json` text nullable
  - `schema_match` boolean nullable, `row_count_match` boolean nullable, `data_equivalent` boolean nullable
  - `column_diffs_json` text nullable — JSON diff stĺpcov (bez PII values)
  - `row_diffs_json` text nullable — JSON diff rows, PII columns stripped (BR-TRN-021)
  - `error` text nullable (v schéme `error`, nie `error_message`)
  - `duration_ms` integer nullable
  - `tested_at` timestamp NOT NULL
  - **Poznámka:** `tier` nie je v DATABASE_SCHEMA.md — pridaj ak potrebné pre filtering

### 4.2 Language Registry (`modules/ainderstanding/translate/registry/`)

- [ ] `index.ts` — centrálny Map s 24 `LanguageDefinition` entries:
  ```ts
  interface LanguageDefinition {
    id: string           // 'python:pandas'
    displayName: string  // 'Python (pandas)'
    tier: 'full_exec' | 'sandbox' | 'syntax_only' | 'gen_only'
    agentModel: 'haiku' | 'sonnet'  // Haiku pre priame preklady, Sonnet pre sémantické
    executor?: 'duckdb' | 'python' | 'docker'
    syntaxValidator?: string  // path k validator module
    fileExtension: string
    packageHints: string[]  // imports ktoré agent má použiť
  }
  ```

- [ ] 24 language definition súborov (`registry/{lang-id}.ts`) — podľa LANGUAGES.md:

  **SQL rodina (7):**
  - [ ] `sql:duckdb` — tier `full_exec`, executor `duckdb`, ground truth
  - [ ] `sql:postgres` — tier `full_exec`, executor `duckdb` (DuckDB postgres extension)
  - [ ] `sql:bigquery` — tier `full_exec`, executor `duckdb` (scan syntax)
  - [ ] `sql:snowflake` — tier `syntax_only`, syntaxValidator `sql-validator`
  - [ ] `sql:trino` — tier `syntax_only`, syntaxValidator `sql-validator`
  - [ ] `sql:sparksql` — tier `full_exec`, executor `duckdb`
  - [ ] `sql:dbt` — tier `syntax_only` (Jinja templates, nie runtime)

  **Python rodina (6):**
  - [ ] `python:pandas` — tier `full_exec`, executor `python`, agentModel `haiku`
  - [ ] `python:polars` — tier `full_exec`, executor `python`, agentModel `haiku`
  - [ ] `python:pyspark` — tier `sandbox` (Docker), fallback `gen_only`, agentModel `sonnet`
  - [ ] `python:sqlalchemy` — tier `syntax_only`, agentModel `haiku`
  - [ ] `python:dbt` — tier `syntax_only` (Jinja), agentModel `haiku`
  - [ ] `python:ibis` — tier `full_exec`, executor `python`, agentModel `haiku`

  **Microsoft BI (4):**
  - [ ] `bi:dax` — tier `syntax_only`, syntaxValidator `dax-validator`, agentModel `sonnet` (sémantický)
  - [ ] `bi:powerquery` — tier `syntax_only`, syntaxValidator `m-validator`, agentModel `sonnet`
  - [ ] `bi:mdx` — tier `gen_only`, agentModel `sonnet`
  - [ ] `bi:tmsl` — tier `gen_only`, agentModel `haiku`

  **Azure / Cloud (3):**
  - [ ] `kql:adx` — tier `syntax_only`, syntaxValidator `kql-validator`, agentModel `sonnet`
  - [ ] `kql:sentinel` — tier `syntax_only`, syntaxValidator `kql-validator`, agentModel `sonnet`
  - [ ] `sql:synapse` — tier `syntax_only`, agentModel `haiku`

  **Iné (6):**
  - [ ] `r:dplyr` — tier `gen_only`, agentModel `haiku`
  - [ ] `r:datatable` — tier `gen_only`, agentModel `haiku`
  - [ ] `scala:spark` — tier `gen_only`, agentModel `haiku`
  - [ ] `julia:df` — tier `gen_only`, agentModel `haiku`
  - [ ] `ts:prisma` — tier `gen_only`, agentModel `haiku`
  - [ ] `graphql:hasura` — tier `gen_only`, agentModel `haiku`

### 4.3 MCP tools (`modules/ainderstanding/translate/lib/mcp-tools.ts`)

- [ ] `generate_snippet` — invoke `code-generator` pre cieľový jazyk; kontrola snippet cache (cache hit → vráti cached); ak miss → generácia → uloženie; `allowedCallers: ['supervisor', 'code-generator']`
- [ ] `read_snippets` — vráti snippets pre model s históriou (posledných 5 verzií); `allowedCallers: ['supervisor', 'code-generator', 'export']`
- [ ] `run_snippet_test` — Phase 2 (post-MVP): spustí `translate-validator`; vráti ekvivalenciu výsledok; `allowedCallers: ['supervisor']`

### 4.4 API endpointy

- [ ] `app/api/translate/[workspaceId]/generate/route.ts` — POST:
  - Body: `{ modelId, languageId, forceRegenerate?: boolean }`
  - Cache check → ak hit a nie stale → vráť cached snippet
  - Invoke `code-generator` agent cez SSE (streaming response)
  - SSE: `snippet_generated { languageId, snippetId }`
- [ ] `app/api/translate/[workspaceId]/snippets/route.ts` — GET:
  - Query: `?modelId=&languageId=`
  - Vráti `TranslateSnippet[]` s history (soft-deleted verzie)
- [ ] `app/api/translate/[workspaceId]/test/route.ts` — POST (Phase 2):
  - Spustí `translate-validator`
  - SSE: `snippet_test_result { snippetId, rowsMatch, columnsMatch, error? }`

### 4.5 Subagenti (`modules/ainderstanding/translate/agents/`)

- [ ] `code-generator.ts` — Haiku alebo Sonnet podľa `LanguageDefinition.agentModel`:
  - System prompt: AGENT_PROMPTS.md §10
  - Granted tools: `read_existing_models`, `read_profiles`, `read_docs`, `read_snippets`
  - Input kontext (BR-TRN-001 — **nikdy** sample_values ani query results):
    - Model SQL definícia
    - Schema (table names, column names, data types)
    - Grain description z docs
    - Idiomatické vzory pre cieľový jazyk (z LANGUAGES.md)
    - PII columns označené — `PiiColumnFilter` aplikovaný pred LLM call
  - Output: kompletný, spustiteľný kód (nie skeleton)
  - Uloží snippet cez `generate_snippet` → cache

- [ ] `translate-validator.ts` — **deterministický, nie LLM**:
  - Pre `full_exec` tier: spustí DuckDB kód (SQL dialekty) alebo `uv subprocess` (Python)
  - Pre `syntax_only` tier: syntax-only validátor (žiadne execution)
  - Pre `sandbox` tier: Docker run (ak Docker dostupný) alebo fallback na `gen_only`
  - Pre `gen_only` tier: žiadna validácia — iba generácia
  - Porovná výsledky s DuckDB ground truth: row count + column names (nie row data)
  - Mismatch = informatívny, neblokujúci výsledok

### 4.6 Lib (`modules/ainderstanding/translate/lib/`)

- [ ] `code-executor.ts` — Python subprocess cez `uv`:
  - `executeInSubprocess(code: string, timeout: 30000): ExecutionResult`
  - Izolovaný: **no network** (--network none flag), **no FS write** mimo temp dir
  - uv venv pre izoláciu dependencií
  - Výsledok: stdout/stderr + exit code + duration
  - Timeout 30s → error

- [ ] `syntax-validators/` — per-language syntax-only validators:
  - [ ] `sql-validator.ts` — `node-sql-parser` AST parse, vráti `{ valid, errors }`
  - [ ] `dax-validator.ts` — regex-based pre DAX syntax (Power BI DAX parser library ak dostupná)
  - [ ] `m-validator.ts` — Power Query M syntax check
  - [ ] `kql-validator.ts` — KQL syntax check

- [ ] `pii-column-filter.ts` — **povinný pred každým LLM call**:
  - Načíta `column_permissions` z Govern
  - Nahradí PII column names v schema s `[{PII_TYPE}_COLUMN]` placeholder
  - `filterSchemaForAI(schema: SchemaSnapshot, columnPermissions: ColumnPermission[]): FilteredSchema`
  - Nikdy PII values (sample_values, query results) — iba schema metadata sú OK po filter

- [ ] `snippet-cache.ts`:
  - `getSnippet(workspaceId, modelId, languageId): TranslateSnippet | null` — null ak stale alebo neexistuje
  - `storeSnippet(snippet): void` — verzia++ ak existuje, soft-delete starú (max 5 verzií)
  - `invalidateForModel(modelId): void` — nastaví `stale=true` pre všetky snippets daného modelu

### 4.7 UI komponenty

- [ ] `app/workspace/[workspaceId]/model/page.tsx` — pridať "Code" záložku do Bottom Panel (embedded v Model)
- [ ] `modules/ainderstanding/translate/components/CodePanel.tsx` — embedded v Model Bottom Panel:
  - `LanguageSelector` — dropdown/tabs (zobraziť iba prvých 8 bežných jazykov; "More" expander)
  - `MonacoSnippetEditor` — read-only default, "Edit" button → custom mode + badge "Custom"
  - Status badge: "Generated" / "Stale" (model SQL zmenený) / "Custom"
  - "Regenerate" button pre stale snippets
  - Copy button
  - Snippet history dropdown (posledných 5 verzií)

- [ ] `app/workspace/[workspaceId]/translate/page.tsx` — standalone Translate page:
  - `WorkspaceOverviewGrid` — karta per model, per jazyk: status (generated/stale/not-generated)
  - Filter: layer (staging/intermediate/mart), language group (SQL/Python/BI/Cloud/Other)
  - Bulk generate button

- [ ] `modules/ainderstanding/translate/components/WorkspaceOverviewGrid.tsx` — grid view:
  - Riadky: modely, stĺpce: jazykové skupiny
  - Bunka: zelená checkmark (generated), žltá (stale), šedá (not generated), červená (error)
  - Klik → otvori CodePanel pre daný model+jazyk

- [ ] `modules/ainderstanding/translate/components/LanguageSelector.tsx`:
  - localStorage persistencia per workspace (pamätá si posledný vybraný jazyk)
  - Tier badge: "Executable" / "Syntax" / "Generated"

## 5. GDPR / Safety pravidlá (z RULES.md)

- [ ] BR-TRN-001: `code-generator` dostáva iba tier-1 dáta (schema, types, SQL, docs, grain) — **nikdy** sample_values, query results, PII column values
- [ ] BR-TRN-002: `PiiColumnFilter` povinný pred každým LLM call — žiadne PII column names v prompte
- [ ] BR-TRN-003: PII columns označené v generovanom kóde ako `# PII column — excluded from output`
- [ ] BR-TRN-010: uv subprocess izolovaný — no network, no FS write mimo temp dir
- [ ] BR-TRN-020: mismatch medzi snippetom a ground truth = informatívny, neblokujúci
- [ ] BR-TRN-021: row diffs pri ekvivalenčnom testovaní — PII columns stripped z comparison

## 6. Verifikácia (end-to-end)

- [ ] **TR1 — pandas generate:** Model SQL existuje → "Code" záložka → vyber `python:pandas` → "Generate" → `code-generator` (Haiku) → snippet zobrazený v Monaco editor
- [ ] **Cache hit:** vygeneruj raz → vyber znova → žiadny LLM call, instant load
- [ ] **Stale invalidation:** zmeniť model SQL → `CodePanel` zobrazí "Stale" badge → "Regenerate" → nová verzia
- [ ] **PII filter:** model obsahuje PII stĺpec → generovaný kód má `# PII column — excluded` comment namiesto stĺpca
- [ ] **TR2 — DAX syntax validate:** vygeneruj `bi:dax` → syntax validator → valid/error report
- [ ] **TR2 — full-exec Python:** spustí `python:ibis` cez uv subprocess → výsledok porovnaný s DuckDB ground truth
- [ ] **TR3 — Standalone page:** otvorí `WorkspaceOverviewGrid` → generuje bulk pre 3 modely × 4 jazyky → grid sa naplní
- [ ] **History:** 6 regenerácií → 5 verzií zachovaných, najstaršia soft-deleted
- [ ] Unit tests: `npx vitest run modules/ainderstanding/translate/__tests__/`

## 7. Odkazy

- [GOAL.md](./GOAL.md) — funkčný spec
- [RULES.md](./RULES.md) — business rules (BR-TRN-*)
- [UI.md](./UI.md) — CodePanel embedding, WorkspaceOverviewGrid layout
- [LANGUAGES.md](./LANGUAGES.md) — 24 jazykov s idiomatickými vzormi per jazyk
- [../AGENT_PROMPTS.md §10](../AGENT_PROMPTS.md) — code-generator system prompt
- [../DATABASE_SCHEMA.md §9](../DATABASE_SCHEMA.md) — `translate_snippets`, `translate_test_results`
- [../MCP_TOOLS.md](../MCP_TOOLS.md) — Translate tools sekcia
- [09-export/TODO.md](../09-export/TODO.md) — Export reuse `read_snippets` + `code-generator`
