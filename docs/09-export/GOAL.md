# Export Sub-module — GOAL

*Working doc, slovensky. Verzia 0.1. Súčasť AInderstanding, pozri [parent GOAL](../AINDERSTANDING.md).*

---

## 1. Účel sub-modulu

**Export zabezpečuje no-lock-in promise AIBIo.**

User má **plné právo zobrať svoju datamart definíciu a odísť** — či už do dbt-core, do iného AI BI nástroja, alebo manuálne spustiť SQL skripty mimo AIBIo. Export generuje **dbt-compatible structure** ktorá funguje out-of-the-box po `dbt run`.

Toto je krátky sub-modul (~2 dni), ale **kľúčový pre AIBIo product positioning** — *"AIBIo is good citizen v existing data ecosystem, nie lock-in island"*.

---

## 2. Koncepty

- **Export package** — `.zip` archív s kompletnou datamart definíciou v dbt-compatible structure
- **dbt project** — standard dbt project layout (dbt_project.yml + models/ + tests/ + ...)
- **Export profile** — set settings ktoré controllujú čo sa exportuje (modely / tests / docs / všetko, pre-výsledné dáta áno/nie)
- **Manifest** — auxiliary metadata file v exporte ktorý popisuje origin (AInderstanding version, export timestamp, source counts)

---

## 3. Scope

### In scope (MVP)

- One-click export → `.zip` download
- **dbt-compatible structure v exporte:**

```
exported-datamart-{workspace-name}-{timestamp}.zip
├── dbt_project.yml                              # auto-generated
├── sources.yml                                  # sources definované AInderstanding-om
├── models/
│   ├── staging/{source}/
│   │   ├── stg_{source}__{table}.sql
│   │   └── stg_{source}__{table}.yml           # docs + tests per column
│   ├── intermediate/
│   └── marts/
│       ├── dim_{name}.sql
│       ├── dim_{name}.yml
│       └── ...
├── tests/
│   ├── generic/                                 # inline v model yml files
│   └── custom/*.sql
├── docs/
│   ├── README.md                                # auto-generated overview
│   ├── lineage.md                               # textual lineage docs
│   ├── business_glossary.md
│   ├── conventions.md
│   └── tables/{name}.md                        # per-table detail docs
├── manifest.json                                # AIBIo metadata
└── README.md                                    # quickstart pre dbt-core
```

- Auto-generated `.yml` per model so structured docs (description per column, tests inline)
- Business glossary a conventions v markdown
- `manifest.json` so AIBIo metadata (version, export timestamp, governance summary)
- README.md v `.zip` so quickstart instructions ako spustiť cez dbt-core
- Export iba **definition** (models, tests, docs) — **NIE materialized DuckDB data** (data sa rebuild-uje keď user dbt-run-ne)
- `ref('name')` v SQL konvertovaný na Jinja `{{ ref('name') }}` pre dbt compatibility

### Phase 2 — post-MVP (X2–X5, multi-format)

Ďalšie export formáty sú definované v **[MULTIFORMAT.md](./MULTIFORMAT.md)**:

- **Python** (Phase X2) — pandas / SQLAlchemy 2.0 / Polars / PySpark / dbt-Python; kompletný Python package s `pyproject.toml`, config, pipeline a testami
- **Power Query M** (Phase X3) — `.pq` súbory per query (connection, staging, mart, shared functions); parametrizované, query-folding-aware, pre Power BI, Excel, ADF
- **DAX / TMDL** (Phase X4) — TMDL folder structure + `.bim` JSON; AI-generované measures s time intelligence, KPI, display folders; Calendar auto-generácia
- **KQL** (Phase X5) — `.kql` scripty: create table, ingestion mapping, stored functions, materialized views, ukážkové queries; deployment bash script pre Azure CLI

Každý formát produkuje profesionálny, idomaticky správny kód — nie len syntaktický preklad SQL. Pre DAX, KQL a M Export reuse-uje `code-generator` agenta z **Translate** modulu (Sonnet tier) pre sémantické obohacenie (measures, aggregations, transformácie). Translate snippety sú zdrojom pravdy — Export ich reuse-uje z cache; generuje ich on-demand len ak chýbajú.

### Out of scope

- Export do Dataform, custom YAML, JSON catalog formátov — follow-up
- Cloud catalog integration (push do DataHub, Atlan, OpenMetadata APIs) — follow-up
- Selective re-import späť do AIBIo (z modified projektu) — follow-up
- Export including materialized data (`.parquet` files alongside) — follow-up
- MDX (multidimensional expressions pre SSAS OLAP cubes) — follow-up (TMDL/DAX pokrýva tabular modely, MDX pre legacy OLAP je niche)

---

## 4. Agenti

**Phase X1 (dbt/SQL):** Žiadni subagenti. Export je pure deterministický transformation z AIBIo internal state → dbt-compatible zip.

**Phase X2–X5 (multi-format):** Export **nespúšťa vlastného agenta** — reuse-uje `code-generator` z **Translate** modulu. Export pipeline najprv skontroluje `translate_snippets` cache; ak snippet existuje a nie je stale, zabalí ho priamo. Ak chýba, zavolá `generate_snippet` MCP tool (= invoke `code-generator`). Agent dostáva iba schema + docs — žiadne sample data (GDPR). Fallback: ak generácia zlyhá, export pokračuje deterministicky bez snippetu s varovaním v `manifest.json`. Detaily: [MULTIFORMAT.md](./MULTIFORMAT.md).

---

## 5. Success criteria

1. **Export funguje na full demo workspace** — Chinook + Northwind, ~6 modelov, ~10 testov, ~20 doc records → `.zip` archive generated do 5 s
2. **Round-trip: exported `.zip` funguje s dbt-core** — extract → setup profiles.yml → `dbt deps && dbt run && dbt test` → všetky modely materialize successfully, všetky testy passnú
3. **Docs sú human-readable** — niekto kto nevie že AIBIo existuje vie pochopiť čo datamart robí len z `docs/` markdown files
4. **Manifest je correct** — `manifest.json` má accurate counts a metadata
5. **No data leak** — exportovaný zip neobsahuje PII column samples ani query results (iba schema + SQL + docs)

---

## 6. Phase plán

### Celkový Export roadmap

| Fáza | Obsah | Odhad |
|---|---|---|
| X1 | dbt/SQL export | ~2d |
| X2 | Python export | ~3d |
| X3 | Power Query M export | ~2d |
| X4 | DAX / TMDL export | ~3d |
| X5 | KQL export | ~2d |
| X6 | Export UI — format selector | ~1d |
| X7 | `code-generator` integrácia cez Translate module | ~2d |
| X8 | Round-trip testy + CI | ~2d |

**MVP (X1): ~2 dni.** Post-MVP (X2–X8): ~15 dní. Detaily X2–X8: [MULTIFORMAT.md](./MULTIFORMAT.md).

### Phase X1: dbt-compatible export — ~2 dni

- Drizzle-agnostic export logic (read full workspace state cez existing hooks)
- ZIP archive builder
- dbt_project.yml renderer
- sources.yml renderer
- model.yml renderer (s tests inline + meta fields z governance docs)
- Markdown renderers (lineage, glossary, conventions, per-table)
- Manifest builder
- Quickstart README template
- ExportDialog UI

**Output:** user klikne *"Export workspace"* → `.zip` download → unzip + `dbt run` mimo AIBIo funguje.

**Total Export: ~2 dni.**

**Dependencies:** Phase M3 (Model), Phase T2 (Test), Phase D3 (Document) — všetky needed pre kompletný export content.

**Blocks:** Phase DEMO (screencast — Akt 7 ukazuje export).

---

## 7. Open questions

- **Import workflow** — v MVP iba export. Re-import (modified zip → späť do AIBIo) je referenced v README.md ale **out of MVP scope**. Plán: follow-up feature.
- **Dialect translation** — exported SQL je v DuckDB dialect. Pre round-trip cez `dbt-duckdb` to funguje out-of-the-box (success criterion č. 2 predpokladá DuckDB ako target). Pre ostatné adaptery (dbt-postgres, dbt-snowflake) môžu byť potrebné úpravy DuckDB-špecifickej syntaxe. MVP success criterion je testovaný s `dbt-duckdb`. Ostatné adaptery sú best-effort, s jasnou poznámkou v export README.
- **Profiles.yml.example** — security risk ak generujeme s actual credentials. *Mitigation:* profiles.yml.example má placeholder credentials (`{{ env_var('PG_PASSWORD') }}`), user nahradí pre svoju setup.
- **Compression level** — `.zip` je default. *Predbežne ok*, large datamarts môžu potrebovať `.tar.gz`, polish.

---

## 8. Riziká

- **Round-trip nefunguje** — exported zip nefunguje s dbt-core. *Mitigation:* CI integration test používa `dbt-duckdb` adapter. Test flow: export Chinook workspace → unzip → `dbt run --profiles-dir . --target duckdb` → `dbt test` → assert 0 failures. Pre dbt-postgres je best-effort, `sql-writer` má "write portable SQL" instrukciu.
- **Sensitive data leak v export** — manifest accidentally includes PII column values, alebo SQL files majú hardcoded sample values from profiling. *Mitigation:* preflight scan exported content pre suspicious patterns (PII regex), unit tests pre export sanitization.
- **Large archive size** — datamart s 200 modelmi má značný archive. *Mitigation:* compression, progress indicator, async download.
- **Stale export** — user exportne, potom robí zmeny v AIBIo, predpokladá že export reflects current state. *Mitigation:* export timestamp v file name + manifest, jasná message *"export is point-in-time snapshot"*.

---

## 9. Settings (Export owned)

| Setting | Tier | Default | Notes |
|---|---|---|---|
| Include tests | `[Core]` | Yes | Tests in .yml + custom SQL |
| Include docs | `[Core]` | Yes | Markdown narrative + .yml meta |
| Include manifest | `[Core]` | Yes | AIBIo metadata + summary |
| Export format | `[Polish]` | `.zip` | Future: `.tar.gz`, `dbt-init` template |
| Target dialect | `[Polish]` | DuckDB (source) | Future: translate to postgres / snowflake / etc. |
| Profiles.yml.example | `[Core]` | Yes (placeholder credentials) | Quickstart help |

---

## 10. Glossary (Export-specific)

- **Export package** — `.zip` archive s kompletnou datamart definíciou
- **dbt-compatible structure** — folder layout matchujúci `dbt_project.yml` conventions, runnable cez `dbt run` out of the box
- **Manifest** — `manifest.json` s AIBIo metadata (version, export timestamp, source counts, governance summary)
- **Round-trip** — full cycle: export z AIBIo → modify externally → re-import (MVP: export only, re-import follow-up)
- **Quickstart** — README.md v exporte ktorý vysvetľuje ako spustiť mimo AIBIo

---

## 11. References

- Parent: [AINDERSTANDING.md](../AINDERSTANDING.md)
- Architektúra (dbt_project.yml generácia, model YAML format, export kód): [ARCHITECTURE.md](../ARCHITECTURE.md) — sekcia 6
- Foundation: [core/GOAL.md](../00-core/GOAL.md) — DB klient (read-only, žiadne writes)
- Závisí od (konzumuje state z):
  - [connect/GOAL.md](../02-connect/GOAL.md) — sources.yml content
  - [model/GOAL.md](../05-model/GOAL.md) — SQL files + lineage
  - [test/GOAL.md](../07-test/GOAL.md) — tests in .yml + custom SQL
  - [document/GOAL.md](../06-document/GOAL.md) — docs markdowns + meta v model.yml
  - [translate/GOAL.md](../08-translate/GOAL.md) — snippet cache + `code-generator` agent pre multi-format packaging *(Phase 2, post-MVP; X1 nevyžaduje Translate)*
- Top-level: [AIBIO.md](../AIBIO.md)
