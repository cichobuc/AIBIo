# TODO — Test (Data Quality Framework)

> **Phase:** T1 (core framework + runner) + T2 (AI agent + UI)
> **Status:** not started
> **Owner docs:** [GOAL.md](./GOAL.md), [RULES.md](./RULES.md), [UI.md](./UI.md)
> **Cross-refs:** ../ARCHITECTURE.md §6.6, ../DATABASE_SCHEMA.md §8 (tests, test_runs, test_results), ../MCP_TOOLS.md §Test, ../API_CONTRACT.md §test §SSE-test_run_update, ../AGENT_PROMPTS.md §9

## 1. Účel

dbt-like data quality framework. 4 generic tests (`unique`, `not_null`, `foreign_key`, `accepted_values`) + custom SQL tests. Auto-run po materializácii, parallel execution (concurrency 8), GDPR-aware failure reporting: AI dostane iba metadata (test name, table, column, failure reason, row count) — **nikdy** sample failed rows. Failure → sql-writer handoff pre model self-heal.

## 2. Stav existujúceho kódu

- [ ] Všetko — greenfield

## 3. Závislosti

- **Závisí od:** 00-core, 05-model (M1+M2+M3 — testy odkazujú na modely, ON DELETE CASCADE), 03-explore (profile data pre test-generator), 06-document (`valid_values` z `column_descriptions` pre `accepted_values`)
- **Blokuje:** 09-export (exportuje `.yml` test definície)

## 4. Implementačný checklist

### 4.1 DB schema (`modules/ainderstanding/test/db/schema.ts`)

- [ ] Tabuľka `tests` (DATABASE_SCHEMA.md §8):
  - `id` UUID PK, `workspace_id` FK CASCADE
  - `model_id` FK `models.id` **ON DELETE CASCADE** — test sa zmaže s modelom
  - `test_type` varchar NOT NULL (v schéme `test_type`, napr. `unique`, `not_null`, `foreign_key`, `accepted_values`, `custom`)
  - `column_names_json` text nullable — JSON array stĺpcov (v schéme, nie `table_name`/`column_name` separátne)
  - `config_json` text nullable — napr. `{ "to_table": "customers", "to_column": "id" }` pre FK test
  - `file_path` varchar nullable — pre custom testy (v schéme `file_path`, nie `sql_file_path`)
  - `severity` varchar default `error`
  - `created_by` varchar nullable — kto test vytvoril (agent/user)
  - `created_at`, `updated_at`
  - **Poznámka:** `is_enabled`, `test_name`, `table_name` nie sú v DATABASE_SCHEMA.md — ak potrebné, pridaj do schémy

- [ ] Tabuľka `test_runs` (DATABASE_SCHEMA.md §8):
  - `id` UUID PK, `workspace_id` FK CASCADE
  - `model_run_id` FK `model_runs.id` nullable — pre auto-run po materializácii
  - `triggered_by` varchar NOT NULL (v schéme `triggered_by`, napr. `auto_post_materialize`, `manual`, `agent`)
  - `status` enum(`running`, `passed`, `failed`, `error`) NOT NULL
  - `total_count`, `passed_count`, `failed_count`, `errored_count` integer (v schéme tieto názvy, nie `tests_total` atď.)
  - `started_at`, `finished_at` timestamp (v schéme `finished_at`, nie `completed_at`)
  - **Poznámka:** `session_id` nie je v DATABASE_SCHEMA.md

- [ ] Tabuľka `test_results` (DATABASE_SCHEMA.md §8):
  - `id` UUID PK, `test_run_id` FK CASCADE, `test_id` FK `tests.id`
  - `status` enum(`passed`, `failed`, `error`) NOT NULL
  - `failing_row_count` integer nullable (v schéme, nie `failure_count`)
  - `failing_pk_samples_json` text nullable — **iba PK hodnoty**, max `workspace_settings.failing_pk_samples_count` (5), **PII PK stĺpce vynechané** (v schéme, nie `failure_pks_json`)
  - `error_message` text nullable
  - `executed_at` timestamp (v schéme, nie `created_at`; `duration_ms` nie je v schéme)

- [ ] Migrácie

### 4.2 MCP tools (`modules/ainderstanding/test/lib/mcp-tools.ts`)

- [ ] `write_test_file` — gate: `awaitApproval('write_test_file', { testName, testKind, tableName, columnName, sql? })`; zapíše `.yml` alebo `.sql` súbor do `workspaces/{id}/tests/`; uloží `tests` záznam; `allowedCallers: ['test-generator']`
- [ ] `run_tests` — spustí testy (všetky alebo filter na model); SSE `test_run_update` per test; vráti `TestRunResult`; `allowedCallers: ['supervisor', 'test-generator']`
- [ ] `test_failure_handoff` — pripraví GDPR-aware failure summary pre sql-writer: `{ testName, tableName, columnName, failureCount, failureReason }` — **nikdy** sample rows; `allowedCallers: ['supervisor']`

### 4.3 Subagent (`modules/ainderstanding/test/agents/test-generator.ts`)

- [ ] `test-generator.ts` — conditional (volaný supervisorom po model approve alebo explicit request):
  - Model: `claude-sonnet-4-6`, temperature: `0`
  - System prompt: AGENT_PROMPTS.md §9
  - Granted tools: `write_test_file`, `read_existing_models`, `read_profiles`, `read_docs`
  - Test selection rules (BR-TST-*):
    - `unique`: iba ak `distinct_count / row_count >= 0.99` A column name končí `_id` alebo je PK
    - `not_null`: iba ak `null_rate < 0.01` (prakticky never-null)
    - `accepted_values`: iba ak `distinct_count <= 20` A top values pokrývajú ≥ 95% rows; values z `column_descriptions.valid_values` alebo z `top_values_json`
    - `foreign_key`: iba ak schema naznačuje FK (column name = `{referenced_table}_id`) A `null_rate < 0.1`
    - `custom`: pre business-specific validácie z docs, komplexné multi-column pravidlá

### 4.4 Lib (`modules/ainderstanding/test/lib/`)

- [ ] `test-compiler.ts` — kompiluje generic test definíciu do SQL:
  - `unique`: `SELECT {col}, COUNT(*) FROM {table} GROUP BY {col} HAVING COUNT(*) > 1`
  - `not_null`: `SELECT COUNT(*) FROM {table} WHERE {col} IS NULL`
  - `foreign_key`: `SELECT t.{col} FROM {table} t LEFT JOIN {ref_table} r ON t.{col} = r.{ref_col} WHERE r.{ref_col} IS NULL` + nullable handling
  - `accepted_values`: `SELECT DISTINCT {col} FROM {table} WHERE {col} NOT IN (values_list)` + NULL handling
  - **Bezpečnosť**: quoted identifiers (nie string interpolation), value escaping — SQL injection opravená (ARCHITECTURE.md, DATABASE_SCHEMA.md note)
  - Výstup: pure SQL string pre DuckDB execute

- [ ] `test-runner.ts`:
  - `runTestSuite(workspaceId, filter?: { modelId }): Promise<TestRunResult>`
  - Parallel execution: concurrency hardcoded 8 (pozri `workspace_settings.test_execution_timeout_sec` pre timeout — nie pre concurrency)
  - Per-test: compile SQL → execute v `datamart.duckdb` → count failures → collect max `workspace_settings.failing_pk_samples_count` (default 5) failing PKs z PK column iba
  - Timeout: `workspace_settings.test_execution_timeout_sec` (default 30s) per test → status `error`, message "Test timed out"
  - Aggregate: `tests_total`, `tests_passed`, `tests_failed`, `tests_errored`
  - SSE `test_run_update` per test: `{ testId, status, failureCount? }`
  - Persist do `test_runs` + `test_results`

- [ ] `sql-parser-gate.ts` — pre custom testy:
  - Identická logika ako Connect SQL gate (iba SELECT allowed)
  - Ak custom SQL nie je SELECT → reject s `SQL_REJECTED` pred uložením
  - Volané pri `write_test_file` pre `test_type='custom'`

- [ ] `failure-summarizer.ts`:
  - `summarizeForAI(testResult: TestResult, model: Model): FailureSummary`
  - Vráti: `{ testName, tableName, columnName?, failureCount, failureReason, pkColumnName, samplePks: string[] }`
  - `samplePks`: max 5 hodnôt, **PK column iba**, PII PK stĺpce → `["[PII_PK_EXCLUDED]"]`
  - Nikdy row data, nikdy non-PK column values (BR-TST-020)

### 4.5 UI komponenty

- [ ] `app/workspace/[workspaceId]/test/page.tsx`
- [ ] `modules/ainderstanding/test/components/TestResultsDashboard.tsx`:
  - Summary: total / passed / failed / error counts, overall status badge
  - Filter: model, test_type, severity, status
  - Per-test row: test_name, table, column, status chip, failure count, duration
  - Expand: TestFailureDetail
- [ ] `modules/ainderstanding/test/components/TestFailureDetail.tsx`:
  - Failure count + failure reason
  - Sample PKs list (max 5, PII notice: "PK values only — row data not shown for privacy")
  - GDPR notice banner: "Full row data is not shared with AI — only metadata"
  - "Trigger fix" button → supervisor handoff pre sql-writer self-heal
- [ ] `modules/ainderstanding/test/components/TestEditor.tsx`:
  - Pre custom SQL testy: Monaco editor (SQL mode)
  - Syntax validation tlačidlo
  - Severity toggle (error / warning)
- [ ] `modules/ainderstanding/test/components/TestApprovalDialog.tsx` — approval gate UI:
  - Test SQL preview (read-only, syntax highlighted)
  - Table + column info
  - Approve / Deny tlačidlá
- [ ] `modules/ainderstanding/test/components/TestRunningState.tsx` — animated state:
  - Progress bar (completed/total)
  - Live SSE updates: každý test flip to passed/failed
  - ETA estimate
- [ ] Empty states: "No tests yet — run test generator", "All tests passed ✓"

### 4.6 File storage

- [ ] `workspaces/{workspaceId}/tests/` — directory pre test súbory:
  - Generic testy: `schema.yml` s dbt-compatible syntax
  - Custom testy: `{test_name}.sql` — pure SQL
- [ ] `model-service.ts` (v 05-model) — pri `deleteModel` → ON DELETE CASCADE v DB, plus file cleanup v `tests/` adresári

### 4.7 Failure → sql-writer handoff

- [ ] Supervisor trigger condition (BR-TST-030):
  - `severity='error'` AND `self_heal_attempt < 3` (per model, nie per run)
  - Volaný automaticky po `run_tests` v `post-processing.ts` (shell)
- [ ] `test_failure_handoff` MCP tool → supervisor → sql-writer re-run so failure context
- [ ] Tracking: `model_runs.self_heal_attempt` counter, `parent_run_id` chain
- [ ] Denné maximum: max 3 self-heal per model per celkový run session

## 5. GDPR / Safety pravidlá (z RULES.md)

- [ ] BR-TST-001: testy spúšťajú sa v `datamart.duckdb` (materializovaný snapshot) — nie v live source DB
- [ ] BR-TST-010: custom SQL parser gate — SELECT only, pred uložením
- [ ] BR-TST-020: AI dostane iba metadata (test_name, table, column, failure_reason, failing_row_count) — nikdy sample failed rows ani raw values
- [ ] BR-TST-021: failing PKs — iba PK columns, max 5, PII PK stĺpce vynechané z listu
- [ ] BR-TST-030: failure → handoff threshold: severity=error AND attempt < 3
- [ ] BR-TST-040: warning severity neblokuje export ani ďalšie akcie — iba vizuálna

## 6. Verifikácia (end-to-end)

- [ ] **Auto-run po materializácii:** materialize → supervisor auto-calls `run_tests` → SSE `test_run_update` → TestResultsDashboard live
- [ ] **Generic test generate:** chat "generate tests for orders model" → test-generator dispatch → `write_test_file` approval → `.yml` súbor na disk → `tests` DB záznam
- [ ] **unique test compile:** `unique` test SQL kompiluje s quoted identifiers, GROUP BY HAVING COUNT > 1
- [ ] **FK test nullable:** FK stĺpec s NULL values → nullable handling v SQL (LEFT JOIN bez NULL exclusion → FAIL; s NULL exclusion → PASS pre platné FKs)
- [ ] **Failure report GDPR:** introduce deliberate unique violation → test fails → TestFailureDetail zobrazuje failure count + sample PKs, GDPR notice banner, NO row data
- [ ] **Custom test SQL gate:** pokus o INSERT v custom teste → `SQL_REJECTED` error pred uložením
- [ ] **Self-heal handoff:** error-severity test fail → supervisor automaticky invoke sql-writer so `test_failure_handoff` summary → sql-writer opraví SQL → re-materialize → re-test
- [ ] Unit tests: `npx vitest run modules/ainderstanding/test/__tests__/`

## 7. Odkazy

- [GOAL.md](./GOAL.md) — funkčný spec
- [RULES.md](./RULES.md) — business rules (BR-TST-*)
- [UI.md](./UI.md) — TestResultsDashboard UI, GDPR notice placement
- [../AGENT_PROMPTS.md §9](../AGENT_PROMPTS.md) — test-generator system prompt + selection rules
- [../DATABASE_SCHEMA.md §8](../DATABASE_SCHEMA.md) — `tests`, `test_runs`, `test_results`
- [../MCP_TOOLS.md](../MCP_TOOLS.md) — Test tools sekcia
- [05-model/TODO.md](../05-model/TODO.md) — ON DELETE CASCADE, self-heal loop, model_runs tracking
