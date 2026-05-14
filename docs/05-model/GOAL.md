# Model Sub-module — GOAL

*Working doc, slovensky. Verzia 0.1. Súčasť AInderstanding, pozri [parent GOAL](../AINDERSTANDING.md).*

---

## 1. Účel sub-modulu

**Model je srdce AInderstandingu.** Tu vzniká samotný datamart:

- Dimensional model architecture (čo je dim, čo je fact, akú topológiu)
- SQL authoring (staging → intermediate → marts layers)
- Transformations (cleaning, joins, derivations, business logic)
- Materialization (build all models do `datamart.duckdb`)
- Lineage tracking (z `ref()` referencií medzi modelmi)
- Full refresh (incremental je out of MVP)
- **Manuálny SQL editor** (Monaco) — user vie editovať priamo, AI nemá monopol

Model je primárny owner **3 z 9 subagentov** AInderstandingu a má najväčší implementation effort.

---

## 2. Koncepty

- **Model** — jeden SQL file ktorý definuje target tabuľku. Layer štruktúra (dbt convention):
  - **staging** (`stg_*`) — 1:1 mirror sourcu s basic cleaning (typing, renaming, deduplication)
  - **intermediate** (`int_*`) — joins, business logic, intermediate transformations
  - **marts** (`dim_*`, `fct_*`) — final consumable tables (dimensional model)
- **Materialization** — proces ktorým sa model spec (SQL file) zmení na physical table v `datamart.duckdb`
- **Lineage** — graf dependencies medzi modelmi, derived z `ref()` references v SQL
- **Model run** — jedna execution materialization-u (jeden alebo všetky modely), s logs + status + errors
- **Transformation step** — logická jednotka v rámci model SQL: filter, join, aggregate, derive column, type cast, ...
- **Self-heal loop** — keď SQL run zlyhá, `sql-writer` dostane error context a opraví, max 3 retries
- **`ref('model_name')`** — dbt-compatible syntax pre reference inej model. Pri materialization expanded na actual table name v DuckDB.
- **`source('src', 'table')`** — reference na tabuľku v externej source DB. Materializer stiahne source tabuľky do DuckDB pred exekúciou modelov (source pull phase).

---

## 3. Scope

### In scope (MVP)

- 3-layer dimensional model architecture (staging / intermediate / marts)
- Model file storage v `workspaces/{id}/models/` ako SQL súbory (source of truth)
- `ref('model_name')` a `source('src', 'table')` syntax (TypeScript-parsed, nie Jinja `{{ }}`)
- Auto-generated lineage graph z parsovania `ref()` references
- **Lineage DAG view** ako visual UI komponent
- `sql-writer` subagent — píše modely
- `model-architect` subagent — navrhuje dimensional schema
- `transformation-suggester` subagent — navrhuje cleaning/transformation kroky based on profile
- **Monaco SQL editor** pre manuálnu editáciu (3 paths: AI / Manual / Mixed)
- AI write with approval gates — SQL diff preview pred zapísaním do model file
- Full refresh materialization: source pull phase → model execution v dependency order
- Per-model materialization (run single model + its dependencies)
- SQL self-heal loop (retry max 3× on execution error)
- Model run history (čo bežalo, kedy, success/fail, logs)

### Out of scope

- **Incremental refresh** (full refresh only v MVP, incremental follow-up)
- Snapshot strategy (SCD Type 2 zmienené v navrhoch, nie implementované v MVP)
- Materialized views beyond DuckDB tables
- Cross-database operations (everything materializes v local DuckDB)
- Power Query-style "Applied Steps" panel (visual step-by-step pipeline) — polish, post-MVP
- Drag-drop visual join builder — polish, post-MVP

---

## 4. Agenti

### `model-architect`

| Field | Value |
|---|---|
| Owner | Model |
| Model | Sonnet |
| Tools | `read_docs` (Document), `read_profiles` (Explore), `propose_dimensional_model` |

**Účel:** dostane brief od user-a (*"sprav unified Customer datamart z Chinook + Northwind"*) + schémy + profiles + business terms z Document. Vráti high-level dimensional model proposal: čo bude fact, čo dim, akú SCD strategy navrhuje, akú topológiu (star/snowflake/flat).

**Graceful empty docs:** ak `read_docs` vráti prázdny výsledok (Document fáza ešte nebehla), `model-architect` pracuje so schémou + profilmi bez business kontextu a explicitne to označí v outpute — *"No business context available yet. Proposal based on schema only."*

**Output:** structured plan, ktorý je zobrazený userovi pre approval pred SQL writing.

### `sql-writer`

| Field | Value |
|---|---|
| Owner | Model |
| Model | Sonnet |
| Tools | `read_docs`, `read_profiles`, `read_schema_snapshot`, `read_existing_models`, `write_model_file` (s approval gate), `guarded_run_select_query` |

**Účel:** keď je high-level model approved, `sql-writer` píše konkrétny SQL **per layer**. Beží paralelne pre N modelov pri full datamart build. **Vždy ide cez approval gate** — vráti SQL diff, user schvaľuje, až potom write_model_file zapíše.

**Self-heal flow:** pri SQL execution error dostane error message ako tool result, navrhuje fix, znova vyzýva approval. Max 3 retries. Ak user zamietne approval (`ApprovalDeniedError`), self-heal sa **nespustí** — build sa zastaví s `approval_denied` statusom (nie SQL chyba). Toto rozlíšenie zabraňuje retry loopom na user-intentional cancel.

### `transformation-suggester`

| Field | Value |
|---|---|
| Owner | Model |
| Model | Sonnet |
| Tools | `read_profiles`, `read_existing_models` |

**Účel:** navrhuje transformation steps based na profile data. *"Stĺpec `phone` má 30% NULL a 50% formátov - navrhujem normalize do E.164."* *"Stĺpec `customer_id` má 5 duplicates - DEDUPLIKUJEME po latest record."*

**Output:** structured suggestions, ktoré sa môžu apply manuálne user-om alebo cez `sql-writer` po confirmation.

### Patterny demonštrované v Model

- **Parallel** — `sql-writer` paralelne nad N modelmi v rovnakej layer (staging models nezávisia od seba)
- **Sequential** — staging → intermediate → marts dependency order
- **Loop** — SQL self-heal (error → fix → retry, max 3×) + chat refinement (user feedback → spec update)
- **Conditional** — `model-architect` volí topology podľa data shape (single source flat vs multi-source star vs complex snowflake)

---

## 5. Success criteria

1. **End-to-end datamart build** — z Chinook + Northwind sources → AI navrhne model → user schváli → `sql-writer` paralelne napíše staging SQL → materializácia úspešná → vidíme final tables v DuckDB
2. **Self-heal funguje** — úmyselne zlý column reference v SQL → 1. run failne → `sql-writer` dostane error → opraví → 2. run úspešný (bez user intervention)
3. **Parallel build measurable** — 6-model staging layer buildi rýchlejšie ako 6× sequential build (log timing)
4. **Lineage DAG renderuje correctly** — visual graph zobrazí dependency strukture staging → intermediate → marts
5. **Manuálny edit cez Monaco** — user prepne na manual mode, edit-uje SQL priamo, save → AI rešpektuje nový obsah pri ďalšom volaní
6. **Approval gate funguje** — AI nikdy nezapíše model file bez user click na "Approve diff"

---

## 6. Phase plán

### Phase M1: Model storage + basic SQL editor + lineage — ~3 dni

- Drizzle schema (models, model_runs, lineage_edges)
- File-system storage v `workspaces/{id}/models/`
- Lineage parser (`ref()` extraction)
- `ModelExplorer` UI (tree view po layers)
- `SqlEditor` UI (Monaco basic)
- `LineageDAG` UI (React Flow)
- Manual save model file → trigger lineage rebuild

**Output:** user vie manuálne vytvoriť/editovať SQL súbory, vidieť ich v tree view + lineage DAG. **Bez AI zatiaľ.**

### Phase M2: Materialization engine + run history — ~2 dni

- `materializer` (topological sort + DuckDB execution)
- `model_runs` storage + UI panel
- "Build all" / "Build single model" buttons
- Materialized data preview (top 100 rows per table)
- Error handling + graceful failures

**Output:** user vie spustiť full datamart build, vidí logs, môže preview-nuť materialized data.

### Phase M3: AI subagenti + approval gates — ~2 dni

- `model-architect` subagent
- `sql-writer` subagent + parallel invocation
- `transformation-suggester` subagent
- MCP tools (`propose_dimensional_model`, `write_model_file` s approval gate)
- `SqlDiffApprovalDialog` UI
- Self-heal loop logic (max 3 retries)

**Output:** user dá brief → agent navrhne model → user schváli → agent napíše SQL paralelne → user schvaľuje diffs → materialize → datamart hotový.

**Total Model: ~7 dní.**

**Dependencies:** Phase C1 (Connect), Phase E1+E2 (Explore — needs profile data), Phase G1 (Govern — needs permission framework).

**Blocks:** Phase T1 (Test runs against materialized models), Phase D1 (Document — `model-architect` referencuje docs), Phase X1 (full integration).

---

## 7. Open questions

- **Refresh strategy refinement** — full refresh always, alebo user-toggleable per model? *Predbežne:* always full v MVP, per-model incremental ako biggest follow-up feature.
- **DuckDB schema namespacing** — všetky modely v `main` schema, alebo per workspace separate? *Rozhodnuté (BR-MOD-060):* per workspace separate DuckDB file (`datamart.duckdb`), modely v `main`.
- **`ref()` syntax** — ~~rozhodnuté:~~ AIBIo používa `ref('name')` a `source('src', 'tbl')` priamo v SQL bez Jinja `{{ }}`. TypeScript parser spracuje tokeny. Export konvertuje na Jinja syntax pre dbt compatibility.
- **Model documentation v SQL files vs separate** — *Rozhodnuté:* docs žijú v Document sub-module DB (nie v `.yml` súboroch v MVP), ale **export** generuje `.yml` súbory pre dbt compatibility.
- **Source pull row limit** — pri source tabuľke > 500k rows UI zobrazí warning pred build-om. Nie je blokujúce. Post-MVP: streaming/incremental extraction.
- **Visual transformation builder** — Power Query "Applied Steps" panel — *predbežne:* post-MVP, MVP je SQL-first.

---

## 8. Riziká

- **SQL parsing fragility** — `ref()` regex môže missnúť edge cases (multi-line, dynamic strings). *Mitigation:* use AST parser (`node-sql-parser` extended), unit tests so známymi tricky patterns.
- **Materialization order edge cases** — circular dependencies, missing refs. *Mitigation:* validation pred build (topological sort failne fast), clear error messages userovi.
- **DuckDB out-of-memory pre big datamart** — v MVP single-file DuckDB local. *Mitigation:* per-model row limit warning, sampling option per source.
- **Parallel SQL writer prompt drift** — pri paralelnom invocation N inštancií, every môže navrhnúť slightly inú konvenciu (naming, casting). *Mitigation:* system prompt shared, konvencie explicitne specified, post-write linter check.
- **Self-heal infinite loop fallback** — agent recycluje rovnakú chybu. *Mitigation:* hard max 3 retries, po failure jasná error message + návrh manual fix.
- **Manual edit conflict** — AI written file je manuálne editovaný, AI ho znova rewrites. *Mitigation:* dirty-state tracking, AI rešpektuje manual edits (won't overwrite without explicit confirmation).

---

## 9. Settings (Model owned)

| Setting | Tier | Default | Notes |
|---|---|---|---|
| SQL editor theme | `[Polish]` | Match app | Light / Dark |
| AI write requires approval | `[Core]` | Yes (locked) | Cannot disable v MVP |
| Self-heal max retries | `[Core]` | 3 | 0-5 range |
| Parallel build concurrency | `[Core]` | 4 | Max concurrent model builds |
| Auto-rebuild lineage on save | `[Core]` | Yes | Vždy on |
| Materialization strategy | `[Polish]` | Full refresh | Per model: full / view (DuckDB view) |

---

## 10. Glossary (Model-specific)

- **Model** — jeden SQL súbor v `models/{layer}/` ktorý definuje target tabuľku v datamarte
- **Layer** — convention pre kategorizáciu modelov: staging (1:1 source mirror), intermediate (transformations), marts (final consumable)
- **Lineage** — DAG ktorý ukazuje dependency vzťahy medzi modelmi (z `ref()` references)
- **`ref('model_name')`** — dbt-compatible syntax pre reference inej model. Pri materialization expanded na actual table name.
- **Materialization** — proces ktorým sa model SQL exekútil a vytvoril physical table v `datamart.duckdb`
- **Model run** — jedna inštancia spustenia materializácie (single model alebo all), s logs a status
- **Self-heal loop** — automatic retry cyklus pri SQL execution failure, AI dostane error a navrhne fix, max 3 retries
- **Source pull phase** — krok 1 materializácie: stiahnutie source tabuliek do DuckDB `_src__*` staging tables pred exekúciou modelov

---

## 11. References

- Parent: [AINDERSTANDING.md](../AINDERSTANDING.md)
- Pravidlá sub-modulu: [RULES.md](./RULES.md)
- Architektúra (DB schema, lineage parser, materializer, file storage, UI komponenty): [ARCHITECTURE.md](../ARCHITECTURE.md) — sekcie 6, 13, 14
- Foundation: [core/GOAL.md](../00-core/GOAL.md) — MCP server, approval gate, SSE | [shell/GOAL.md](../01-shell/GOAL.md) — supervisor dispatch
- Závisí od:
  - [connect/GOAL.md](../02-connect/GOAL.md) — source adapters pre staging models
  - [explore/GOAL.md](../03-explore/GOAL.md) — profile data informuje transformations
  - [govern/GOAL.md](../04-govern/GOAL.md) — permission framework, approval gates
- Konzumujú Model:
  - [test/GOAL.md](../07-test/GOAL.md) — testy bežia voči materialized models
  - [document/GOAL.md](../06-document/GOAL.md) — `model-architect` reads docs / `docs-keeper` writes docs about models
  - [export/GOAL.md](../09-export/GOAL.md) — exportuje model SQL súbory v dbt-compat structure
  - [translate/GOAL.md](../08-translate/GOAL.md) — pridáva "Code" záložku do model detail view (multi-language snippet generation) *(Phase 2, post-MVP)*
- Top-level: [AIBIO.md](../AIBIO.md)
