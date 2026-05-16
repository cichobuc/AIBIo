# TODO — Model (Dimensional Modeling + Materialization)

> **Phase:** M1 (schema + lineage) + M2 (materialization) + M3 (AI agents)
> **Status:** M1 ✓ · M2 ✓ · M3 ✓ (complete)
> **Owner docs:** [GOAL.md](./GOAL.md), [RULES.md](./RULES.md), [UI.md](./UI.md)
> **Cross-refs:** ../ARCHITECTURE.md §6.4, ../DATABASE_SCHEMA.md §6 (models, model_runs, lineage_edges), ../MCP_TOOLS.md §Model, ../API_CONTRACT.md §model §SSE-model_run_update, ../AGENT_PROMPTS.md §6–8 (model-architect, sql-writer, transformation-suggester)

## 1. Účel

Srdce AInderstandingu — vytvorenie datamartu z 3-vrstvovej architektúry (staging → intermediate → marts). SQL authoring (Monaco editor alebo cez AI), materializácia do `datamart.duckdb`, lineage parsing z `ref()`/`source()` referencií, full-refresh build s parallel execution (topological sort). File-system je source of truth pre SQL (BR-MOD-003).

## 2. Stav existujúceho kódu

- [x] Všetko — greenfield → implementované

## 3. Závislosti

- **Závisí od:** 00-core, 02-connect (C1), 03-explore (E1+E2 — profile data pre model-architect), 04-govern (G1 — guarded tools pre sql-writer a model-architect)
- **Blokuje:** 07-test (testy odkazujú na modely), 08-translate (generuje kód z model SQL), 09-export (exportuje model SQL)

## 4. Implementačný checklist

### 4.1 DB schema (`modules/ainderstanding/model/db/schema.ts`)

- [x] Tabuľka `models` (DATABASE_SCHEMA.md §7):
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
- [x] Tabuľka `model_runs` (DATABASE_SCHEMA.md §7):
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
- [x] Tabuľka `lineage_edges` (DATABASE_SCHEMA.md §7):
  - `id` UUID PK, `workspace_id` FK CASCADE
  - `from_model_id` FK `models.id` nullable — null pre source() edges
  - `to_model_id` FK `models.id` NOT NULL
  - `from_source_ref` varchar nullable — napr. `"chinook.artists"` pre `source('chinook', 'artists')`
  - `ref_type` enum(`ref`, `source`) NOT NULL (v schéme `ref_type`, nie `edge_type`)
  - `created_at`
  - UNIQUE(`workspace_id`, `from_model_id`, `to_model_id`, `from_source_ref`)
- [x] Migrácie — `0005_silky_rictor.sql` vygenerovaná a aplikovaná

### 4.2 MCP tools (`modules/ainderstanding/model/lib/mcp-tools.ts`)

- [x] `read_existing_models` — vráti zoznam modelov; `allowedCallers: ['model-architect', 'sql-writer', 'transformation-suggester', 'test-generator']` (nie supervisor!)
- [x] `propose_dimensional_model` — `model-architect` volá toto; vráti structured proposal; `allowedCallers: ['model-architect']`
- [x] `write_model_file` — gate: `awaitApproval('write_model_file', { modelName, sql, previousSql })`; zapíše SQL; `allowedCallers: ['sql-writer']` (nikdy supervisor ani coordinator priamo!)
- [x] `validate_sql` — SQL parser gate + DuckDB syntax check; `allowedCallers: ['sql-writer', 'model-coordinator', 'supervisor']`
- [x] `parse_lineage` — parsuje všetky SQL súbory; uloží do `lineage_edges`; `allowedCallers: ['model-coordinator', 'supervisor']`
- [x] `materialize_models` — full-refresh build; `allowedCallers: ['model-coordinator', 'supervisor']`
- [x] Registrácia: `registerModelTools()` volaná z `instrumentation.ts`

### 4.3 Phase Coordinator (`modules/ainderstanding/shell/orchestrator.ts`)

- [x] `model-coordinator` AgentDefinition — definovaná v `orchestrator.ts` (lines ~94+), tools: `Task`, `validate_sql`, `parse_lineage`, `read_schema_snapshot`, `read_existing_models`, `materialize_models`
- [x] `model-architect` AgentDefinition — tools: `read_docs`, `read_profiles`, `read_schema_snapshot`, `propose_dimensional_model`
- [x] `sql-writer` AgentDefinition — tools: `read_docs`, `read_profiles`, `read_schema_snapshot`, `read_existing_models`, `validate_sql`, `write_model_file`, `guarded_run_select_query`
- [x] `transformation-suggester` AgentDefinition — tools: `read_profiles`, `read_existing_models`

### 4.4 Lib (`modules/ainderstanding/model/lib/`)

- [x] `lineage-parser.ts` — AST-first (`node-sql-parser`) + regex fallback; `topologicalSort` (Kahn's); `renderModelSql`; `parseAndRebuildLineage`
- [x] `materializer.ts` — resolve targets; `expandWithDeps`; topo sort; source pull phase; parallel model execution (chunks of 4); SSE `model_run_update`
- [x] `model-service.ts` — CRUD: `createModel`, `readModelSql`, `writeModelSql`, `deleteModel`, `listModels`, `getModel`, `getModelByName`, `updateModelRunStatus`, `rebuildLineageEdges`; naming validation (stg_/int_/dim_/fct_ prefixes)
- [x] `duckdb-datamart.ts` — `withDatamart`; `executeDatamartRead`; per-workspace `datamart.duckdb`
- [x] `sql-validator.ts` — SELECT-only enforcement; DuckDB dialect AST parse; unresolved refs check
- [x] `run-recorder.ts` — `startRun`, `updateRun`, `finishRun`, `getRunsForWorkspace`, `hasRunningRun`

### 4.5 UI komponenty

- [x] `app/workspace/[workspaceId]/model/page.tsx` — server component
- [x] `app/workspace/[workspaceId]/model/ModelPageClient.tsx` — tabs (editor/lineage/preview/history), empty states, handleBuildAll/buildSingle
- [x] `app/workspace/[workspaceId]/@sidebar/model/page.tsx` — parallel route pre ModelExplorer
- [x] `modules/ainderstanding/model/components/ModelExplorer.tsx` — 3 collapsible groups; is_dirty badge; lastRunStatus dot; context menu (Delete); NewModelDialog trigger
- [x] `modules/ainderstanding/model/components/SqlEditor.tsx` — Monaco + custom `sql-aibio` Monarch tokens pre `ref()`/`source()`; ⌘S save; Validate button → Monaco markers; read-only toggle
- [x] `modules/ainderstanding/model/components/LineageDAG.tsx` — React Flow (lazy-loaded via useEffect); node colors per layer; dashed source_ref edges; click → onSelectModel
- [x] `modules/ainderstanding/model/components/SqlDiffApprovalDialog.tsx` — diff mode (`react-diff-viewer-continued`) + edit mode (Monaco); countdown timer; Approve/Deny
- [x] `modules/ainderstanding/model/components/ModelRunHistory.tsx` — polls `/api/model/.../runs`; expand per-model breakdown; live streaming via SSE store
- [x] `modules/ainderstanding/model/components/MaterializedDataPreview.tsx` — fetches `/api/model/.../preview?model={name}`; 100-row grid; NULL/PII-masked display
- [x] `modules/ainderstanding/model/components/NewModelDialog.tsx` — name input (auto-detect layer from prefix); layer radio; POST create

### 4.6 API routes

- [x] `app/api/model/[workspaceId]/route.ts` — GET list (by layer), POST create
- [x] `app/api/model/[workspaceId]/[modelId]/route.ts` — GET sql+model, PATCH (save), DELETE
- [x] `app/api/model/[workspaceId]/lineage/route.ts` — GET LineageResponse
- [x] `app/api/model/[workspaceId]/validate/route.ts` — POST validate SQL
- [x] `app/api/model/[workspaceId]/build/route.ts` — POST → 202 `{ runId }` (immediate), background materialize
- [x] `app/api/model/[workspaceId]/runs/route.ts` — GET runs list
- [x] `app/api/model/[workspaceId]/preview/route.ts` — GET top-N rows from datamart.duckdb

### 4.7 Approval gate wiring

- [x] `SqlDiffApprovalDialog` wired into `ApprovalDialog.tsx` dispatcher — `write_model_file` → `SqlDiffApprovalDialog`; `write_test_file` stays on `WriteFileGate`
- [x] `core/types/permissions.ts` — `ApprovalGateDetails` `write_model_file` branch extended with `previousSql?: string`

## 5. GDPR / Safety pravidlá (z RULES.md)

- [x] BR-MOD-001: sql-writer nikdy nepristupuje k raw DB dátam bez guarded wrappers
- [x] BR-MOD-002: supervisor nikdy nevolá `write_model_file` priamo — `allowedCallers: ['sql-writer']` enforced
- [x] BR-MOD-003: SQL file-system je source of truth — DB `models` tabuľka = metadata index
- [x] BR-MOD-004: self-heal loop max 3× per model per run session (BR-MOD-030)
- [x] BR-MOD-005: `is_dirty=true` modely sú vizuálne odlíšené — yellow "~" badge v ModelExplorer
- [x] Self-heal termination: `ApprovalDeniedError` → zastaví loop (BR-MOD-031)
- [x] Audit log: `write_model_file` (approve/deny) aj source pull cez Govern `audit-logger`

## 6. Verifikácia (end-to-end)

- [ ] **Model propose:** chat "navrhi dimensional model" → model-architect dispatch → `propose_dimensional_model` → UI zobrazí proposal karty → user schváli
- [ ] **SQL write:** sql-writer vygeneruje SQL → `write_model_file` approval → `SqlDiffApprovalDialog` → Approve → SQL súbor na disk → `models.status=draft`
- [ ] **Validate:** "Validate SQL" button → `validate_sql` → success alebo syntax error zobrazený v Monaco editor gutteri
- [ ] **Materialize:** "Build All" button → `POST /api/model/.../build` → SSE `model_run_update` per model → `ModelRunHistory` live updates → `datamart.duckdb` aktualizovaný
- [ ] **Lineage DAG:** po write → `parse_lineage` → `lineage_edges` uložené → `LineageDAG` sa aktualizuje → `ref()` arrows viditeľné
- [ ] **Self-heal:** sql-writer generuje invalid SQL → validate fail → 3 retry pokusy → po 3× supervisoru hlási zlyhanie
- [ ] **Preview:** klik na model → Preview tab → 100 rows z `datamart.duckdb`

## 7. Odkazy

- [GOAL.md](./GOAL.md) — funkčný spec (source() expansion, ref() syntax, materialization flow)
- [RULES.md](./RULES.md) — business rules (BR-MOD-*)
- [UI.md](./UI.md) — UI/UX detaily (Monaco config, React Flow layout, Bottom Panel tabs)
- [../AGENT_PROMPTS.md §4–6](../AGENT_PROMPTS.md) — model-architect, sql-writer, transformation-suggester prompts
- [../DATABASE_SCHEMA.md §6](../DATABASE_SCHEMA.md) — `models`, `model_runs`, `lineage_edges`
- [../MCP_TOOLS.md](../MCP_TOOLS.md) — Model tools sekcia
- [../ARCHITECTURE.md §6.4](../ARCHITECTURE.md) — 3-vrstvová architektúra, topological sort, self-heal pattern
