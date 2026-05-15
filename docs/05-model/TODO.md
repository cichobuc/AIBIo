# TODO — Model (Dimensional Modeling + Materialization)

> **Phase:** M1 (schema + lineage) + M2 (materialization) + M3 (AI agents)
> **Status:** not started
> **Owner docs:** [GOAL.md](./GOAL.md), [RULES.md](./RULES.md), [UI.md](./UI.md)
> **Cross-refs:** ../ARCHITECTURE.md §6.4, ../DATABASE_SCHEMA.md §6 (models, model_runs, lineage_edges), ../MCP_TOOLS.md §Model, ../API_CONTRACT.md §model §SSE-model_run_update, ../AGENT_PROMPTS.md §6–8 (model-architect, sql-writer, transformation-suggester)

## 1. Účel

Srdce AInderstandingu — vytvorenie datamartu z 3-vrstvovej architektúry (staging → intermediate → marts). SQL authoring (Monaco editor alebo cez AI), materializácia do `datamart.duckdb`, lineage parsing z `ref()`/`source()` referencií, full-refresh build s parallel execution (topological sort). File-system je source of truth pre SQL (BR-MOD-003).

## 2. Stav existujúceho kódu

- [ ] Všetko — greenfield

## 3. Závislosti

- **Závisí od:** 00-core, 02-connect (C1), 03-explore (E1+E2 — profile data pre model-architect), 04-govern (G1 — guarded tools pre sql-writer a model-architect)
- **Blokuje:** 07-test (testy odkazujú na modely), 08-translate (generuje kód z model SQL), 09-export (exportuje model SQL)

## 4. Implementačný checklist

### 4.1 DB schema (`modules/ainderstanding/model/db/schema.ts`)

- [ ] Tabuľka `models` (DATABASE_SCHEMA.md §7):
  - `id` UUID PK, `workspace_id` FK `workspaces.id` CASCADE
  - `name` varchar NOT NULL (snake_case, UNIQUE per workspace)
  - `layer` enum(`staging`, `intermediate`, `mart`) NOT NULL
  - `file_path` varchar NOT NULL — relatívna cesta v `workspaces/{id}/models/{layer}/` (v schéme `file_path`, nie `sql_file_path`)
  - `description` text nullable
  - `is_dirty` boolean default `false` — true ak SQL zmenený manuálne bez re-materializácie
  - `last_run_status` varchar nullable — posledný run status (v schéme, nie `status`)
  - `last_run_at` timestamp nullable — (v schéme, nie `last_materialized_at`)
  - `created_at`, `updated_at`
  - **Poznámka:** `materialization` enum a `status` enum nie sú v DATABASE_SCHEMA.md — ak sú potrebné, najprv pridaj do schémy
- [ ] Tabuľka `model_runs` (DATABASE_SCHEMA.md §7):
  - `id` UUID PK, `workspace_id` FK CASCADE
  - `triggering_model_id` FK `models.id` nullable — ktorý model spustil run
  - `parent_run_id` FK `model_runs.id` nullable — pre self-heal retry chain
  - `run_scope` varchar nullable — napr. `full`, `single:model_name`
  - `status` enum(`running`, `success`, `error`) NOT NULL
  - `models_affected_json` text nullable — JSON array mien modelov v tomto rune
  - `started_at`, `finished_at` timestamp (v schéme `finished_at`, nie `completed_at`)
  - `error_message` text nullable (v schéme `error_message`, nie `error_summary`)
  - `self_heal_attempt` integer default `0` — max 3
  - **Poznámka:** `session_id`, `models_total/succeeded/failed` nie sú v DATABASE_SCHEMA.md — pre tieto pridaj do schémy ak sú potrebné pre UI
- [ ] Tabuľka `lineage_edges` (DATABASE_SCHEMA.md §7):
  - `id` UUID PK, `workspace_id` FK CASCADE
  - `from_model_id` FK `models.id` nullable — null pre source() edges
  - `to_model_id` FK `models.id` NOT NULL
  - `from_source_ref` varchar nullable — napr. `"chinook.artists"` pre `source('chinook', 'artists')`
  - `ref_type` enum(`ref`, `source`) NOT NULL (v schéme `ref_type`, nie `edge_type`)
  - `created_at`
  - UNIQUE(`workspace_id`, `from_model_id`, `to_model_id`, `from_source_ref`)
- [ ] Migrácie

### 4.2 MCP tools (`modules/ainderstanding/model/lib/mcp-tools.ts`)

- [ ] `read_existing_models` — vráti zoznam modelov; `allowedCallers: ['model-architect', 'sql-writer', 'transformation-suggester', 'test-generator']` (nie supervisor!)
- [ ] `propose_dimensional_model` — `model-architect` volá toto; vráti structured proposal; `allowedCallers: ['model-architect']`
- [ ] `write_model_file` — gate: `awaitApproval('write_model_file', { modelName, sql })`; zapíše SQL; `allowedCallers: ['sql-writer']` (nikdy supervisor ani coordinator priamo!)
- [ ] `validate_sql` — SQL parser gate + DuckDB syntax check; `allowedCallers: ['sql-writer', 'model-coordinator', 'supervisor']`
- [ ] `parse_lineage` — parsuje všetky SQL súbory; uloží do `lineage_edges`; `allowedCallers: ['model-coordinator', 'supervisor']` (model-coordinator volá po `write_model_file` PostToolUse; supervisor cross-phase)
- [ ] `materialize_models` — full-refresh build; `allowedCallers: ['supervisor']` (cross-phase operácia)

### 4.3 Phase Coordinator (`modules/ainderstanding/model/agents/model-coordinator.ts`)

- [ ] `model-coordinator.ts` — Tier 2 coordinator, orchestruje model-architect → N×sql-writer → transformation-suggester:
  - Model: `"sonnet"`, temperature: `0`
  - System prompt: AGENT_PROMPTS.md §1c (`model-coordinator`)
  - Tools: `['Task', 'mcp__aibio__validate_sql', 'mcp__aibio__parse_lineage', 'mcp__aibio__read_schema_snapshot', 'mcp__aibio__read_existing_models', 'mcp__aibio__materialize_models']`
  - Flow: `Task('model-architect')` → parallel `Task('sql-writer')` × N (per topology layer) → `Task('transformation-suggester')` (ak user žiada hints) → self-heal loop (max 3 retries per model)
  - PostToolUse hook (na coordinator úrovni): po každom `write_model_file` → `parse_lineage`
  - Retry state: drží `{ retryCount: Map<modelName, number> }` v coordinator context window
  - Po max retries exhausted: escalate to supervisor s error report, nie silent fail

### 4.4 Atomic Agents (`modules/ainderstanding/model/agents/`)

- [ ] `model-architect.ts` — volaný `model-coordinator`-om (nie supervisorom priamo):
  - Model: `"sonnet"`, temperature: `0`
  - System prompt: AGENT_PROMPTS.md §4
  - Granted tools: `read_existing_models`, `propose_dimensional_model`, `read_profiles`, `read_docs`, `read_schema_snapshot`
  - Flow: načíta profily + docs → navrhne 3-vrstvovú architektúru → `propose_dimensional_model`
  - **Nikdy** `write_model_file` priamo

- [ ] `sql-writer.ts` — volaný `model-coordinator`-om paralelne (nie supervisorom priamo):
  - Model: `"sonnet"`, temperature: `0`
  - System prompt: AGENT_PROMPTS.md §5
  - Granted tools: `read_existing_models`, `validate_sql`, `write_model_file` (s approval gate), `guarded_run_select_query`, `read_profiles`, `read_docs`, `read_schema_snapshot`
  - Parallel: N instances, jedna per model v rámci rovnakej topological úrovne
  - Self-heal loop: `validate_sql` fail → opraviť → max 3× (retry state tracking v `model-coordinator`)
  - Self-heal termination: `ApprovalDeniedError` zastaví loop (BR-GOV-022)
  - `parent_run_id` + `self_heal_attempt` tracking v `model_runs`

- [ ] `transformation-suggester.ts` — volaný `model-coordinator`-om alebo supervisorom (direct dispatch, BR-SHL-024b):
  - Model: `"sonnet"`, temperature: `0.3`
  - System prompt: AGENT_PROMPTS.md §6
  - Granted tools: `read_existing_models`, `read_profiles`, `validate_sql`
  - **Nikdy** `write_model_file` — iba navrhuje

### 4.4 Lib (`modules/ainderstanding/model/lib/`)

- [ ] `lineage-parser.ts`:
  - Parsuje `ref('model_name')` a `source('source_name', 'table_name')` z SQL textu
  - `node-sql-parser` AST + regex fallback pre CTE patterns
  - Vráti `LineageEdge[]` pre uloženie do `lineage_edges`
  - Detect circular references (DFS) — error ak nájde cyklus

- [ ] `materializer.ts`:
  - `materializeWorkspace(workspaceId): Promise<ModelRunResult>`
  - Topological sort `lineage_edges` (Kahn's algorithm)
  - Paralelné execution v rámci rovnakej "level" (concurrency 4 — `parallel_build_concurrency`)
  - **Source pull phase**: `_src__{source_name}__{table_name}` CTE — `guarded_run_select_query` → vytvorí DuckDB view
  - **Model execution**: nahradí `ref('x')` → DuckDB table ref; `source('s','t')` → `_src__s__t`; spustí v DuckDB
  - Persist do `datamart.duckdb` (súbor v `workspaces/{id}/`)
  - SSE `model_run_update` per model: `{ modelName, status: 'running'|'success'|'error', durationMs }`
  - Update `models.last_run_at`, `models.last_run_status`, `models.is_dirty=false` po úspešnom materialize

- [ ] `model-service.ts`:
  - `readModelSql(modelId): string` — číta z file-systému, nie z DB
  - `writeModelSql(modelId, sql): void` — zapíše do file-systému, nastaví `is_dirty=true`
  - `createModel(workspace, name, layer): Model` — vytvorí prázdny SQL súbor + DB záznam
  - `deleteModel(modelId): void` — zmaže file + DB záznam + ON DELETE CASCADE pre tests
  - `invalidateTranslateSnippets(modelId): void` — ak SQL zmena, nastaví `translate_snippets.stale=true` pre daný model

### 4.5 UI komponenty

- [ ] `app/workspace/[workspaceId]/model/page.tsx` — hlavná stránka
- [ ] `modules/ainderstanding/model/components/ModelExplorer.tsx` — tree view v primary sidebar:
  - 3 skupiny: Staging / Intermediate / Marts
  - Per-model: status chip (draft/valid/error), `is_dirty` badge ("Unsaved changes"), last materialized timestamp
  - Kontextové menu: Rename, Delete, Set materialization type
- [ ] `modules/ainderstanding/model/components/SqlEditor.tsx` — Monaco Editor:
  - SQL language mode s `ref()` a `source()` highlighting (custom token rules)
  - Read-only pre supervisor-generated SQL kým user neklikne "Edit"
  - "Validate" button → `validate_sql` MCP tool volanie
  - Save (⌘S) → `writeModelSql` → `is_dirty=true` badge
- [ ] `modules/ainderstanding/model/components/LineageDAG.tsx` — React Flow (`@xyflow/react`):
  - Farby nodov: modrá=source, sivá=staging, žltá=intermediate, zelená=mart, červená=error
  - Edges: directed arrows (`ref()` → solid, `source()` → dashed)
  - Klik na node → otvorí `SqlEditor` pre daný model
  - Minimap + zoom controls
  - Auto-layout (dagre alebo ELK)
- [ ] `modules/ainderstanding/model/components/SqlDiffApprovalDialog.tsx` — zobrazuje sa pri `write_model_file` approval gate:
  - Left: pôvodný SQL (read-only)
  - Right: navrhovaný SQL (read-only)
  - Diff highlighting (pridané zelené, zmazané červené)
  - Tlačidlá: Approve / Edit (otvori editable Monaco) / Deny
- [ ] `modules/ainderstanding/model/components/ModelRunHistory.tsx` — Bottom Panel "Run Results" tab:
  - Zoznam posledných N runs s celkovým statusom a trvaním
  - Expand per-model breakdown: status, durationMs, error message
  - Self-heal chain: `parent_run_id` → zobrazuje retry chain
- [ ] `modules/ainderstanding/model/components/MaterializedDataPreview.tsx` — "Data" tab v Bottom Panel:
  - Po úspešnom materialize: DuckDB SELECT z `datamart.duckdb`
  - Vyžaduje Layer 3 approval (`guarded_run_select_query`) ak user chce vidieť výsledky
  - Grid: max 100 riadkov, PII masked
- [ ] `modules/ainderstanding/model/components/NewModelDialog.tsx` — create model:
  - Name input (kebab-case validácia)
  - Layer selector (staging / intermediate / mart)
  - Materialization type (view / table)

## 5. GDPR / Safety pravidlá (z RULES.md)

- [ ] BR-MOD-001: sql-writer nikdy nepristupuje k raw DB dátam bez guarded wrappers
- [ ] BR-MOD-002: supervisor nikdy nevolá `write_model_file` priamo
- [ ] BR-MOD-003: SQL file-system je source of truth — DB `models` tabuľka = metadata index
- [ ] BR-MOD-004: self-heal loop max 3× per model per run session
- [ ] BR-MOD-005: `is_dirty=true` modely sú vizuálne odlíšené — user vidí warning pred re-materializáciou
- [ ] Self-heal termination: `ApprovalDeniedError` → zastaví loop, supervisor informuje usera, **nie SQL chyba** (BR-GOV-022)
- [ ] "Write portable SQL" inštrukcia: sql-writer píše SQL kompatibilné s DuckDB ale bez DuckDB-only syntax kde možné

## 6. Verifikácia (end-to-end)

- [ ] **Model propose:** chat "navrhi dimensional model" → model-architect dispatch → `propose_dimensional_model` → UI zobrazí proposal karty → user schváli
- [ ] **SQL write:** sql-writer vygeneruje SQL → `write_model_file` approval → `SqlDiffApprovalDialog` → Approve → SQL súbor na disk → `models.status=draft`
- [ ] **Validate:** "Validate SQL" button → `validate_sql` → success alebo syntax error zobrazený v Monaco editor gutteri
- [ ] **Materialize:** chat "materialize" alebo "Run" button → `materialize_models` → SSE `model_run_update` per model → `ModelRunHistory` live updates → DuckDB file aktualizovaný
- [ ] **Lineage DAG:** po write → `parse_lineage` → `lineage_edges` uložené → `LineageDAG` sa aktualizuje → `ref()` arrows viditeľné
- [ ] **Self-heal:** sql-writer generuje invalid SQL → validate fail → 3 retry pokusy → po 3× supervisoru hlási zlyhanie
- [ ] **Translate invalidation:** po manuálnej zmene SQL → `invalidateTranslateSnippets` → Translate záložka zobrazí "Stale" badge

## 7. Odkazy

- [GOAL.md](./GOAL.md) — funkčný spec (source() expansion, ref() syntax, materialization flow)
- [RULES.md](./RULES.md) — business rules (BR-MOD-*)
- [UI.md](./UI.md) — UI/UX detaily (Monaco config, React Flow layout, Bottom Panel tabs)
- [../AGENT_PROMPTS.md §4–6](../AGENT_PROMPTS.md) — model-architect, sql-writer, transformation-suggester prompts
- [../DATABASE_SCHEMA.md §6](../DATABASE_SCHEMA.md) — `models`, `model_runs`, `lineage_edges`
- [../MCP_TOOLS.md](../MCP_TOOLS.md) — Model tools sekcia
- [../ARCHITECTURE.md §6.4](../ARCHITECTURE.md) — 3-vrstvová architektúra, topological sort, self-heal pattern
