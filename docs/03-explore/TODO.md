# TODO — Explore (Schema Discovery + Data Profiling)

> **Phase:** E1 (schema discovery) + E2 (data profiling + PII detection)
> **Status:** E1 + E2 done (schema discovery, profiling, PII detection, UI)
> **Owner docs:** [GOAL.md](./GOAL.md), [RULES.md](./RULES.md), [UI.md](./UI.md)
> **Cross-refs:** ../ARCHITECTURE.md §6.2, ../DATABASE_SCHEMA.md §3 (snapshots, profiles), ../MCP_TOOLS.md §Explore, ../API_CONTRACT.md §Explore, ../AGENT_PROMPTS.md §2–3

## 1. Účel

Po pridaní source-u introspectne schému (schema-explorer agent), paralelne profiluje tabuľky (data-profiler agent), detekuje PII kandidátov name-based heuristikou, navrhuje reference table flagy, sleduje schema diffy. Explore **iba navrhuje** — Govern vynucuje. Source of truth pre `is_reference_table` a `column_profiles` je Explore, ale klasifikácia do `column_permissions` patrí Govern.

## 2. Stav existujúceho kódu

- [ ] Všetko — greenfield

## 3. Závislosti

- **Závisí od:** 00-core (db klient), 02-connect (SourceAdapter — Explore volá cez Govern internal-adapter), 04-govern G1 (guarded wrappers musia existovať pred E2 profilermi)
- **Blokuje:** 04-govern G2 (UI dashboardy potrebujú PII candidates), 05-model (profile data), 06-document (docs-keeper číta profile kontext)

## 4. Implementačný checklist

### 4.1 DB schema (`modules/ainderstanding/explore/db/schema.ts`)

- [x] Tabuľka `schema_snapshots` (DATABASE_SCHEMA.md §3):
  - `id` UUID PK, `data_source_id` FK `data_sources.id` CASCADE
  - `snapshot_json` text NOT NULL — serializovaný SchemaSnapshot
  - `table_count`, `column_count` integer
  - `taken_at` timestamp NOT NULL
- [x] Tabuľka `schema_changes` (DATABASE_SCHEMA.md §3):
  - `id` UUID PK, `data_source_id` FK
  - `from_snapshot_id`, `to_snapshot_id` FK `schema_snapshots.id`
  - `change_type` enum(`table_added`, `table_removed`, `column_added`, `column_removed`, `column_type_changed`, `column_nullable_changed`)
  - `table_name`, `column_name` nullable, `detail_json`
  - `detected_at` timestamp
- [x] Tabuľka `table_profiles` (DATABASE_SCHEMA.md §3):
  - `id` UUID PK, `data_source_id` FK, `table_name` varchar NOT NULL
  - `row_count` bigint, `is_reference_table` boolean default `false`
  - `sample_permission_override` boolean nullable — null = follow source-level, true/false = override
  - `profiled_at` timestamp nullable
  - UNIQUE(`data_source_id`, `table_name`)
- [x] Tabuľka `column_profiles` (DATABASE_SCHEMA.md §3):
  - `id` UUID PK, `table_profile_id` FK CASCADE, `data_source_id`, `table_name`, `column_name`
  - `data_type` varchar, `null_count`, `null_rate` decimal
  - `distinct_count` bigint, `top_values_json` text (max 20 values, PII pre-filtered)
  - `min_val`, `max_val`, `mean_val` decimal nullable (pre numerické)
  - `percentiles_json` text nullable (p25/p50/p75/p95)
  - `string_length_distribution_json` text nullable
  - `pii_candidate` boolean default `false`
  - `pii_candidate_reason` text nullable — napr. "column name matches 'email' pattern"
  - UNIQUE(`table_profile_id`, `column_name`) — `data_source_id`/`table_name` sú denorm pre efektivitu (poznámka v DATABASE_SCHEMA.md §3)

### 4.2 MCP tools (`modules/ainderstanding/explore/lib/mcp-tools.ts`)

Tieto tools registrujú subagenti Explore, nie Govern. Prístup k dátam cez Govern guarded wrappers alebo cez internal-adapter (pre profiling).

- [x] `detect_schema_changes` — porovná aktuálny snapshot s predchádzajúcim, uloží do `schema_changes`, vráti `{ added, removed, modified }` count
- [x] `run_profile_query` — pristupuje cez Govern `internal-adapter` (NIE priamo cez Connect adapter, NIE cez `guarded_run_select_query`); pred uložením do `top_values_json` aplikuje PII pre-filter (stĺpce kde `pii_candidate=true` alebo `column_permissions.pii_classification IS NOT NULL` sú redacted)
- [x] `detect_pii_candidates` — regex name-based heuristika na column names; `allowedCallers: ['data-profiler', 'schema-explorer']`
- [x] `suggest_reference_table_flags` — kritériá: `row_count < 10000 AND distinct_count/row_count < 0.8 AND pii_candidate=false` na žiadnom stĺpci; vráti zoznam table suggestions, **nepíše** priamo do DB (user musí potvrdiť)
- [x] `read_schema_snapshot` — čítanie konkrétneho snapshot_json (Layer 1 — žiadny permission check)
- [x] `read_profiles` — čítanie `table_profiles` + `column_profiles` (Layer 1 — žiadny permission check)

### 4.3 Phase Coordinator (`modules/ainderstanding/explore/agents/explore-coordinator.ts`)

- [ ] `explore-coordinator.ts` — Tier 2 coordinator, orchestruje sequential schema → parallel profiling:
  - Model: `"haiku"`, temperature: `0`
  - System prompt: AGENT_PROMPTS.md §1b (`explore-coordinator`)
  - Tools: `['Task', 'mcp__aibio__read_schema_snapshot']`
  - Flow:
    1. `Task('schema-explorer', { dataSourceId })` — sequential, počka na snapshot
    2. `read_schema_snapshot` → získa zoznam tabuliek
    3. Parallel `Task('data-profiler', { dataSourceId, tableBatch })` × N batches (concurrency 4)
  - Vráti supervisorovi kompaktný súhrn `{ tablesDiscovered, tablesProfiled, piiCandidatesFound }`

### 4.4 Atomic Agents (`modules/ainderstanding/explore/agents/`)

- [ ] `schema-explorer.ts` — volaný `explore-coordinator`-om (alebo supervisorom pre single-source direct dispatch — BR-SHL-024a):
  - Model: `"haiku"`
  - System prompt: AGENT_PROMPTS.md §2
  - Granted tools: `guarded_introspect_schema`, `guarded_read_native_comments`, `detect_schema_changes`, `read_schema_snapshot`
  - Flow: introspect → persist snapshot → diff s predchádzajúcim → SSE `schema_update`
  - Jeden invoke per source

- [ ] `data-profiler.ts` — volaný `explore-coordinator`-om paralelne:
  - Model: `"haiku"`
  - System prompt: AGENT_PROMPTS.md §3
  - Granted tools: `guarded_sample_data`, `run_profile_query`, `detect_pii_candidates`, `suggest_reference_table_flags`, `read_schema_snapshot`
  - Flow: load snapshot → pre každú tabuľku v batchi: `run_profile_query` → `detect_pii_candidates` → `suggest_reference_table_flags`
  - Concurrency limit: `workspace_settings.parallel_build_concurrency` (default 4)
  - **Nikdy** `guarded_run_select_query` — len `run_profile_query` cez internal-adapter

### 4.4 Lib (`modules/ainderstanding/explore/lib/`)

- [x] `profile-runner.ts` — per-type stats queries:
  - Numeric: COUNT, NULL count, MIN, MAX, AVG, percentiles (p25/p50/p75/p95)
  - String: NULL count, distinct count, avg/min/max length, length distribution
  - Date: NULL count, MIN date, MAX date, distinct count
  - All: top 20 distinct values (cez COUNT GROUP BY LIMIT 20) — PII pre-filter applies
- [x] `pii-heuristics.ts` — keyword/regex list na column names (BR-XPL-003: **iba name-based**, nikdy content-based):
  - Exact match: `email`, `phone`, `ssn`, `ip_address`, `password`, `secret`, `token`
  - Contains: `birth`, `iban`, `account`, `card_num`, `credit`, `address`, `passport`, `license`
  - Suffix match: `_id` s `person`/`user`/`customer` prefix
  - Vráti `{ isPiiCandidate: boolean, reason: string }`
- [x] `sampling-strategy.ts` — SAMPLE 10% pre tabuľky nad `profile_sample_threshold_rows` (default 1M); DuckDB TABLESAMPLE SYSTEM syntax
- [x] `schema-differ.ts` — diff dvoch `SchemaSnapshot` JSON objektov; vráti `SchemaDiff { added, removed, modified }` s type-safe change records

### 4.5 UI komponenty (`app/workspace/[workspaceId]/explore/`)

- [x] `page.tsx` — Explore landing s dvomi panelmi: SchemaExplorer (left) + detail (right)
- [x] `modules/ainderstanding/explore/components/SchemaExplorer.tsx` — tree view:
  - Koreň: data source name
  - Úroveň 2: tabuľky s row_count badge + reference_table chip
  - Klik → otvoriť TableDetailTab
  - Search/filter nad tabuľkami
- [ ] `modules/ainderstanding/explore/components/TableDetailTab.tsx` — stĺpcový zoznam + data preview panel:
  - 3 stavy: Layer 2 DENY (zobrazí "Samples denied — not a reference table"), Reference allowed (sample grid), Layer 3 approval needed (tlačidlo "Request access")
- [ ] `modules/ainderstanding/explore/components/ReferenceTableSampleView.tsx` — data grid pre reference table samples (max 100 riadkov, PII stĺpce masked)
- [x] `modules/ainderstanding/explore/components/ColumnProfileDetailTab.tsx`:
  - Distribučný histogram (lightweight-charts bar chart)
  - Top values zoznam (PII stĺpce: "[MASKED]")
  - Null rate progress bar
  - Min/max/mean badges
  - PII candidate warning chip ak `pii_candidate=true`
- [x] `modules/ainderstanding/explore/components/SchemaDiffViewer.tsx` — diff panel:
  - Zelená: pridané tabuľky/stĺpce
  - Červená: zmazané
  - Žltá: zmenené typy
  - Timestamp + "Review changes" CTA
- [x] `modules/ainderstanding/explore/components/PIICandidatesPanel.tsx` — bottom panel:
  - Zoznam všetkých `pii_candidate=true` stĺpcov naprieč zdrojmi
  - Per-candidate: Confirm PII (→ otvorí Govern ClassifyColumn flow) / Dismiss
  - Badge count v SideNav Explore ikone
- [ ] Empty states: "Schema not loaded yet — Run schema discovery", "Not profiled yet", "Profiling in progress…"

## 5. GDPR / Safety pravidlá (z RULES.md)

- [x] BR-XPL-001: Explore nikdy nepristupuje k dátam priamo cez Connect adapter (len cez Govern wrappers alebo internal-adapter)
- [x] BR-XPL-002: sample dáta default DENY — iba reference tables alebo per-query Layer 3 approval
- [x] BR-XPL-003: PII detection iba name-based — content-based by porušilo GDPR-first (napr. scan SSN values)
- [x] BR-XPL-004: PII candidate = suggestion — Govern enforce (BR-GOV-032); Explore nikdy samo nepíše do `column_permissions`
- [ ] BR-XPL-030: reference flag user-controlled — `suggest_reference_table_flags` iba navrhuje, user potvrdzuje v UI
- [ ] BR-XPL-050: PII review workflow — user musí potvrdiť každý candidate v PIICandidatesPanel predtým než ide do Govern
- [ ] `top_values_json`: PII stĺpce (kde `pii_candidate=true`) sú redacted pred uložením do DB — `"[REDACTED]"` namiesto hodnôt

## 6. Verifikácia (end-to-end)

- [ ] **Schema discovery:** chat "Explore schema for source X" → schema-explorer dispatch → `schema_snapshots` záznam uložený → SchemaExplorer tree sa naplní
- [ ] **Schema diff:** zmeniť schému na DB → re-run discovery → `SchemaDiffViewer` ukazuje diff
- [ ] **Profiling:** chat "Profile all tables" → data-profiler N instances → `column_profiles` uložené → `ColumnProfileDetailTab` zobrazuje histogram
- [ ] **PII candidate:** stĺpec `customer_email` → `pii_candidate=true` v DB → `PIICandidatesPanel` zobrazí badge → Confirm otvori Govern ClassifyColumn
- [ ] **Reference table suggestion:** tabuľka s < 10k rows, nízka kardinalita, žiadne PII → `suggest_reference_table_flags` vráti ju → user potvrdí → `is_reference_table=true` → `ReferenceTableSampleView` dostupný
- [ ] **Sampling:** tabuľka > 1M rows → `sampling-strategy` aplikuje TABLESAMPLE 10% → profiling prebehne v rozumnom čase
- [ ] Unit tests: `npx vitest run modules/ainderstanding/explore/__tests__/`

## 7. Odkazy

- [GOAL.md](./GOAL.md) — funkčný spec
- [RULES.md](./RULES.md) — business rules (BR-XPL-*)
- [UI.md](./UI.md) — UI/UX detaily
- [../AGENT_PROMPTS.md §2–3](../AGENT_PROMPTS.md) — schema-explorer a data-profiler system prompts
- [../DATABASE_SCHEMA.md §3](../DATABASE_SCHEMA.md) — `schema_snapshots`, `schema_changes`, `table_profiles`, `column_profiles`
- [../MCP_TOOLS.md](../MCP_TOOLS.md) — Explore tool registry sekcia
- [04-govern/TODO.md](../04-govern/TODO.md) — internal-adapter pre `run_profile_query`, `column_permissions` ownership
