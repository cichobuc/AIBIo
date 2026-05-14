# Explore Sub-module — GOAL

*Working doc, slovensky. Verzia 0.1. Súčasť AInderstanding, pozri [parent GOAL](../AINDERSTANDING.md).*

---

## 1. Účel sub-modulu

**Explore robí discovery a profiling.** Keď pridáš source, Explore zistí čo v ňom je:

- Schema introspection (tabuľky, stĺpce, FK, native comments)
- Data profiling (NULL rates, cardinality, value distributions, samples)
- Reference table classification (čo sú číselníky, čo sú transactional)
- Per-column PII flagging (z naming heuristics + user override)

Explore **rešpektuje permission tiers z Govern** — defaultne ťahá iba schema metadata, samples len pri tabuľkách flagovaných ako reference.

---

## 2. Koncepty

- **Schema snapshot** — kompletný úplne deterministický snapshot DB schémy v JSON formáte. Tables, columns, types, FK, native comments.
- **Profile result** — per-tabuľka analytical summary: row count, per-column NULL rate, distinct count, top values, min/max, basic shape (numeric distribution, string length distribution, date range).
- **Reference table flag** — boolean per tabuľka *"this is reference/lookup data, samples safe to share with AI"*. User-controlled.
- **Sample sharing decision** — per-table override pre data exposure. Default DENY, opt-in cez reference flag.
- **PII candidate** — column flagovaný ako potenciálne PII na základe naming heuristics (`email`, `phone`, `ssn`, `birthdate`, ...). User confirms / overrides v Govern.

---

## 3. Scope

### In scope (MVP)

- Schema introspection cez Connect adapters (volá `introspectSchema()`)
- `data-profiler` subagent — paralelne profilne tabuľky
- Native comment read (Postgres `obj_description`, MSSQL `extended_properties.MS_Description`, etc.)
- Per-column profile (NULL %, distinct count, top values, value range)
- Numeric distribution histograms (bins z mean/std/range)
- String length distribution
- Date range identification
- **PII candidate detection** cez naming heuristics (keyword matching nad column names)
- Reference table flag UI
- Sample data fetch (limit-bound, len pre reference tables alebo s explicit user permission)
- Schema diff detection (re-introspect → highlight changes)
- Profile results storage + refresh UI

### Out of scope

- ML-based PII detection (heuristic stačí v MVP)
- Outlier detection / anomaly flagging
- Continuous monitoring / scheduled re-profiling
- Cross-source profile comparison (covered by Model)

---

## 4. Agenti

### `schema-explorer`

| Field | Value |
|---|---|
| Owner | Explore |
| Model | Haiku |
| Tools | `guarded_introspect_schema`, `guarded_read_native_comments`, `detect_schema_changes` |

**Účel:** automaticky po pridaní source-u introspectne schému, načíta native comments, detect-uje schema changes pri re-run. Output je cached `SchemaSnapshot`.

**Workflow:**
1. Call `introspect_schema` → tabuľky, columns, types, FK
2. Call `read_native_comments` → DBA-authored comments z DB metadata
3. Compare s previous snapshot (if any) → emit `schema_changes` entries
4. Vracia structured summary supervisor agentovi

### `data-profiler`

| Field | Value |
|---|---|
| Owner | Explore |
| Model | Haiku |
| Tools | `run_profile_query`, `detect_pii_candidates`, `suggest_reference_table_flags` |

**Účel:** paralelne profilne tabuľky. **Toto je kľúčový demonštrant Parallel pattern** — agent spustí N inštancií concurrent pre N tables.

**Workflow per table:**
1. Get row count
2. Per column: NULL count, distinct count, top 10 values
3. Numeric columns: min, max, mean, percentiles (10 bins)
4. String columns: length distribution
5. Date columns: min/max date
6. Run PII heuristic on column names
7. Write `table_profiles` + `column_profiles` entries

**Patterny demonštrované:**
- **Parallel** — `data-profiler` paralelne nad N tables (hlavná demonštrácia)
- **Conditional** — per column profiler volí inú stats query podľa data type (numeric vs string vs date)

---

## 5. Success criteria

1. **Schema introspection rýchla** — 50-table source introspectne pod 10 s, native comments inkludované
2. **Paralelný profiling funguje** — 10 tabuliek profiled paralelne, total wall time výrazne nižší než sequential
3. **PII candidate detection accuracy** — pre Chinook + Northwind correctly flagne `Email`, `Phone`, `BillingAddress`, `FirstName`, `LastName` (a ďalšie podobné)
4. **Reference table suggestions** — agent správne identifikuje `MediaType`, `Genre`, `Category` ako reference candidates
5. **Schema diff detection** — pridanie column do source DB sa správne identifikuje pri re-introspekcii, surfaced v UI
6. **Profile data accessible v UI** — drill-down per column zobrazí distribúciu, top values, NULL rate čitateľne

---

## 6. Phase plán

### Phase E1: Schema explorer + introspection storage — ~2 dni

- Drizzle schema (schema_snapshots, schema_changes)
- `schema-explorer` subagent
- MCP tools: `introspect_schema`, `read_native_comments`
- `SchemaExplorer` UI komponent
- Schema diff detection (compare against previous snapshot)
- `SchemaDiffViewer` UI

**Output:** user pridá source, vidí kompletnú schému + native comments + diff od posledného refresh.

### Phase E2: Data profiler + paralelné profiling — ~3 dni

- Drizzle schema (table_profiles, column_profiles)
- `data-profiler` subagent (s parallel invocation pattern)
- Per-type stats queries (numeric / string / date)
- PII heuristic detection
- Reference table suggestions
- `TableProfileView` + `ColumnProfileChart` UI komponenty
- `PIICandidatesPanel` UI
- Reference table toggle UI

**Output:** user klikne *"Profile all tables"* → vidí paralelny progress, distribúcie + top values per column, PII flagy on candidates, reference suggestions.

**Total Explore: ~5 dní.**

**Dependencies:** Phase C1 (Connect) hotová — potrebujeme source adapters.

**Blocks:** Model phases (Model potrebuje profile data pre suggesting transformations), Document phases (docs-keeper píše descriptions pomocou profile context).

---

## 7. Open questions

- **Sampling stratégia pre veľké tabuľky** — full table profile na 10M-row tabuľke je drahé. *Predbežne:* SAMPLE 10% pre tabuľky > 1M rows, exact pre menšie. User-configurable threshold.
- **PII heuristics aj content-based** — keyword na column name je rýchle ale unreliable. Content-based (regex on samples) je accurate ale **vyžaduje pozretie data čo porušuje GDPR-first princíp.** *Predbežne:* iba name-based v MVP, content-based ako opt-in feature post-MVP s explicit user permission.
- **Distribučné chart UX** — histogram pre numeric, top-N bar pre categorical, heatmap pre date — clear pre user? *Predbežne:* basic shadcn/ui charts + Tremor, polish later.

---

## 8. Riziká

- **Profiling rýchlosť** — N×M (tables × columns) queries môže byť veľa. *Mitigation:* paralel + per-source connection pool + smart batching (multiple column stats v jednom query).
- **PII false negatives** — heuristic missne unusual naming (`klientske_id`, `osobne_data_x`). *Mitigation:* user override v Govern, manual PII flagging vždy možné, prompt user pri detekcii ambivalentných columns.
- **Profile staleness** — DB sa medzitým mení. *Mitigation:* re-profile button, freshness indicator (last profiled X ago).
- **Sample data pre numeric stats môže byť approximation** — exact median/percentile na big table je expensive. *Mitigation:* approximate via reservoir sampling, jasný indicator *"approximate"* pri uncertain values.

---

## 9. Settings (Explore owned)

| Setting | Tier | Default | Notes |
|---|---|---|---|
| Auto-profile on source add | `[Core]` | Yes | Spustí `data-profiler` automaticky |
| Profile sample threshold | `[Polish]` | 1M rows | Above this, SAMPLE 10% |
| Top values per column | `[Polish]` | 10 | Storage size tradeoff |
| Schema change auto-detect | `[Core]` | Yes | Check on workspace open |
| PII heuristics enabled | `[Core]` | Yes | Auto-flag candidates |
| PII heuristics include content | `[Polish]` | No (GDPR) | Future opt-in |

---

## 10. Glossary (Explore-specific)

- **Schema snapshot** — point-in-time JSON serialization complete DB schema
- **Profile result** — analytical summary per-column distribution
- **Reference table** — lookup/code-list tabuľka (Genre, Status, Currency) ktorá obsahuje no PII a je safe to share samples s AI
- **PII candidate** — column flagovaný heuristic-om ako možný PII, user musí confirm

---

## 11. References

- Parent: [AINDERSTANDING.md](../AINDERSTANDING.md)
- Pravidlá sub-modulu: [RULES.md](./RULES.md)
- Architektúra (DB schema, UI components, hooks, PII confirm flow): [ARCHITECTURE.md](../ARCHITECTURE.md) — sekcia 6
- Foundation: [core/GOAL.md](../00-core/GOAL.md) — DB klient, MCP server
- Závisí od:
  - [connect/GOAL.md](../02-connect/GOAL.md) — source adapters
  - [govern/GOAL.md](../04-govern/GOAL.md) — guarded tools pre sample data access
- Konzumujú Explore:
  - [model/GOAL.md](../05-model/GOAL.md) — používa profile data pri transformation suggestions
  - [document/GOAL.md](../06-document/GOAL.md) — docs-keeper píše descriptions z profile context
  - [govern/GOAL.md](../04-govern/GOAL.md) — PII candidates feed column_permissions
- Top-level: [AIBIO.md](../AIBIO.md)
