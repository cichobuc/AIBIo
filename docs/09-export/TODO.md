# TODO — Export (No-lock-in Packaging)

> **Phase:** X1 (dbt/SQL MVP) + X2–X8 (multi-format, post-MVP)
> **Status:** not started
> **Owner docs:** [GOAL.md](./GOAL.md), [RULES.md](./RULES.md), [UI.md](./UI.md), [MULTIFORMAT.md](./MULTIFORMAT.md)
> **Cross-refs:** ../ARCHITECTURE.md §6.8, ../DATABASE_SCHEMA.md (žiadne vlastné tabuľky), ../MCP_TOOLS.md §Export (reuse Translate tools), ../API_CONTRACT.md §export (chýba — TREBA PRIDAŤ!)

## 1. Účel

No-lock-in promise — balíčkuje celý datamart do `.zip` archívu s deployment-ready štruktúrou. Export je **packaging layer**: exportuje iba definície (SQL/YAML/Markdown/config), **nie materialized data**. X1 MVP = dbt-compatible ZIP (deterministické, žiadne AI). X2–X8 = multi-format (reuse `code-generator` z Translate). Export je read-only konzument ostatných modulov — žiadne vlastné DB tabuľky.

## 2. Stav existujúceho kódu

- [ ] Všetko — greenfield

## 3. Závislosti

- **Závisí od:** 00-core, 02-connect (sources.yml metadata), 05-model (SQL + lineage), 07-test (`.yml` + custom `.sql`), 06-document (docs + coverage), 08-translate (snippet cache + `code-generator` pre X2–X8)
- **Blokuje:** nič — Export je terminal modul

## 4. Implementačný checklist

### 4.1 DB schema

- [ ] **Žiadne vlastné tabuľky** pre X1 MVP (read-only konzument)
- [ ] Voliteľne pre X2+ post-MVP: `exports` history table:
  - `id` UUID PK, `workspace_id` FK, `format` varchar, `file_path` varchar
  - `exported_at` timestamp, `metadata_json` text (manifest súhrn)
  - Max 10 exportov per workspace (staré mazať)

### 4.2 API endpointy (TREBA PRIDAŤ DO API_CONTRACT.md!)

- [ ] `app/api/export/[workspaceId]/build/route.ts` — POST:
  - Body: `{ format: 'dbt' | 'python-pandas' | ... }`
  - Spustí `workspace-snapshot-builder` + príslušný `format-packager`
  - Streamuje progress cez SSE alebo vráti synchronne pre malé workspaces (< 50 modelov)
  - Vráti `{ exportId, downloadUrl, format, generatedAt }`
- [ ] `app/api/export/[workspaceId]/history/route.ts` — GET: zoznam posledných exportov
- [ ] `app/api/export/[workspaceId]/download/[exportId]/route.ts` — GET: download ZIP súboru

### 4.3 Lib — X1 MVP (`modules/ainderstanding/export/lib/`)

- [ ] `workspace-snapshot-builder.ts` — zostaví workspace snapshot pre export:
  - Načíta: všetky modely (SQL zo súborov), lineage edges, tests, doc records, source metadata
  - Vráti `WorkspaceSnapshot` objekt — point-in-time (timestamp v file name)
  - `preflight-scan` pred zostavením

- [ ] `preflight-scan.ts` — validácia pred exportom:
  - Aspoň 1 model existuje (inak block s `ExportBlockedState`)
  - Žiadne `is_dirty` modely (warning, nie block)
  - PII pattern scan: hľadá PII hodnoty v SQL textoch (napr. hardcoded values) — advisory warning
  - Vráti `PreflightResult { canExport, warnings: string[], errors: string[] }`

- [ ] `zip-archive-builder.ts` — zostaví ZIP z prepared súborov:
  - `archiver` npm package alebo Node.js `fs.createWriteStream` + `zlib`
  - Uloží do `workspaces/{id}/exports/{timestamp}_{format}.zip`
  - Max 10 exportov — starý mazať pri prekročení

- [ ] `renderers/` — šablóny pre dbt format (X1):
  - [ ] `dbt-project-renderer.ts` — `dbt_project.yml` (project name, version, model paths, materialization defaults)
  - [ ] `sources-renderer.ts` — `models/staging/sources.yml` (per data source, per table)
  - [ ] `model-yml-renderer.ts` — `models/{layer}/{model_name}.yml` (description, columns, tests z `tests` tabuľky)
  - [ ] `markdown-renderer.ts` — 4 Markdown súbory:
    - `docs/lineage.md` — lineage graph textovo (source → staging → intermediate → mart)
    - `docs/glossary.md` — business terms
    - `docs/conventions.md` — naming + business conventions
    - `docs/{table_name}.md` — per-table description + columns (pre každú mart tabuľku)
  - [ ] `manifest-renderer.ts` — `manifest.json` (metadata o exporte)

- [ ] `jinja-converter.ts` — konverzia AInderstanding syntax → dbt Jinja:
  - `ref('model_name')` → `{{ ref('model_name') }}`
  - `source('source_name', 'table_name')` → `{{ source('source_name', 'table_name') }}`
  - Pure string replace (regex) — žiadna AST analýza potrebná

- [ ] `format-packagers/dbt.ts` — X1 dbt packager (orchestrácia renderov):
  1. Render `dbt_project.yml`
  2. Pre každý source → `sources.yml`
  3. Pre každý model → SQL s Jinja conversion + `model.yml`
  4. Render docs Markdown
  5. Render `manifest.json`
  6. Pridať `profiles.yml.example` (s placeholder values — nikdy skutočné credentials!)
  7. Pridať `README.md` s quickstart inštrukciami (pip install dbt-duckdb, dbt run)
  8. ZIP archivovanie

### 4.4 Lib — X2–X8 post-MVP (`modules/ainderstanding/export/lib/format-packagers/`)

Pre každý formát: skontroluj snippet cache (`read_snippets`) → cache hit: reuse; cache miss: invoke `code-generator-syntax` / `code-generator-semantic` cez `Task` tool; ak generation failne: warning v `manifest.json`, export pokračuje bez tohto formátu.

- [ ] `format-packagers/python.ts` — X2 (pandas/polars/pyspark/sqlalchemy/dbt):
  - Per model: snippet z cache alebo generate
  - `pyproject.toml` s dependenciami
  - `README.md` s `uv run` inštrukciami
  - Adresárová štruktúra: `src/{project_name}/{layer}/{model_name}.py`

- [ ] `format-packagers/powerquery.ts` — X3:
  - `.pq` súbory pre každý staging model
  - `Parameters.pq` s konfigurovateľnými parametrami (server, database — placeholder)
  - `SharedFunctions.pq` so zdieľanými transformáciami
  - `README.md` s import inštrukciami do Power BI

- [ ] `format-packagers/dax-tmdl.ts` — X4:
  - TMDL folder štruktúra (tables, measures, relationships)
  - `.bim` (tabular model JSON)
  - `Calendar.tmdl` (auto-generated date dimension)
  - `deploy.ps1` s placeholder Azure credentials
  - Kompatibilné s Tabular Editor 3

- [ ] `format-packagers/kql.ts` — X5:
  - `.create-merge table` statements
  - Materialized view definitions
  - `deploy.sh` s Azure CLI príkazmi + placeholder credentials
  - README: "Requires Azure Data Explorer cluster"

### 4.5 Manifest `manifest.json` fields

- [ ] Povinné fields:
  - `aibio_version`, `export_timestamp`, `workspace_name`, `export_format`
  - `source_count`, `model_count`, `test_count`, `doc_coverage_pct`
  - `model_layers: { staging, intermediate, mart }` counts
  - `snippets_from_cache` (int), `snippets_generated` (int) — pre X2–X8
  - `pii_columns_excluded: string[]` — zoznam stĺpcov vynechaných kvôli PII
  - `warnings: string[]` — napr. dirty models, missing snippets
  - `notes: string[]` — napr. "Round-trip tested with dbt-duckdb 1.x"

### 4.6 UI komponenty

- [ ] `app/workspace/[workspaceId]/export/page.tsx`
- [ ] `modules/ainderstanding/export/components/ExportConfigurationDialog.tsx`:
  - Format selector: dbt (MVP, odporúčaný badge), Python variants, Power Query, DAX/TMDL, KQL
  - Warning pre X2–X8: "Requires Translate module — generates snippets first"
  - "Export" button
- [ ] `modules/ainderstanding/export/components/ExportProgress.tsx`:
  - Per-step progress: Snapshot → Preflight → Generate snippets (ak X2–X8) → Package → ZIP → Done
  - Warnings inline (napr. "2 dirty models included")
- [ ] `modules/ainderstanding/export/components/PostExportSuccess.tsx`:
  - Download button (ZIP súbor)
  - Summary: model count, test count, doc coverage %
  - `manifest.json` preview (collapsible)
  - "Export history" link
- [ ] `modules/ainderstanding/export/components/ExportBlockedState.tsx`:
  - Zobrazí sa ak preflight fails (0 modelov) alebo iná blocker podmienka
  - Jasný dôvod + CTA (napr. "Create your first model")
- [ ] `modules/ainderstanding/export/components/ExportHistory.tsx`:
  - Zoznam posledných 10 exportov: format, timestamp, download link
  - Per-export: re-download ak súbor stále existuje
- [ ] `modules/ainderstanding/export/components/FormatSelector.tsx` — vizuálny výber formátu s tier info a pre-requisite warning

### 4.7 Templates (`modules/ainderstanding/export/templates/`)

- [ ] `README-dbt.md` — template pre dbt quickstart (placeholders: `{project_name}`, `{source_count}`, `{model_count}`)
- [ ] `profiles.yml.example` — dbt profiles príklad s **placeholder** credentials (nikdy skutočné!)
- [ ] `README-python.md` — template pre Python quickstart
- [ ] `deploy.ps1` — PowerShell template pre DAX/TMDL deploy (placeholders)
- [ ] `deploy.sh` — Bash template pre KQL deploy (placeholders)
- [ ] `pyproject.toml` — template pre Python package (placeholders pre dependencies per format)
- [ ] `Parameters.pq` — Power Query parameters template (placeholders)

## 5. GDPR / Safety pravidlá (z RULES.md)

- [ ] BR-XPT-001: Export iba definície — žiadne materialized data, žiadne `aibio.db` metadata
- [ ] BR-XPT-002: preflight PII scan na SQL texty — advisory warning ak nájde podozrivé hodnoty
- [ ] BR-XPT-003: `profiles.yml.example` obsahuje iba placeholder credentials — nikdy skutočné (hook `check-sensitive-data.sh` to blokuje)
- [ ] BR-XPT-004: point-in-time snapshot — export je frozen v čase generovania, nie live
- [ ] BR-XPT-020: `code-generator` pre X2–X8 dostáva iba schema, nie sample data (rovnaká izolácia ako BR-TRN-001)
- [ ] BR-XPT-021: `pii_columns_excluded` v manifest.json — transparentnosť čo bolo vynechané
- [ ] Round-trip success criterion: MVP testovaný s `dbt-duckdb` iba (nie iné dialekty)

## 6. Verifikácia (end-to-end)

- [ ] **X1 Preflight block:** workspace bez modelov → Export page zobrazí `ExportBlockedState`
- [ ] **X1 dbt export:** workspace s 3 modelmi, 5 testami, doc coverage 45% → Export → ZIP obsahuje:
  - `dbt_project.yml` s správnym project name
  - `models/staging/*.sql` s `{{ source() }}` Jinja
  - `models/intermediate/*.sql` s `{{ ref() }}` Jinja
  - `models/**/*.yml` s test definíciami
  - `docs/lineage.md`, `docs/glossary.md`, `docs/conventions.md`
  - `manifest.json` s korektným doc_coverage_pct=45
  - `profiles.yml.example` s placeholdermi (žiadne reálne hodnoty)
- [ ] **dbt round-trip:** unzip → `dbt run --profiles-dir .` s DuckDB profile → succeed
- [ ] **Dirty model warning:** model s `is_dirty=true` → manifest.json obsahuje warning, export pokračuje
- [ ] **PII column excluded:** stĺpec `customer_email` (PII) → v generovanom kóde X2 označený ako excluded → `manifest.json.pii_columns_excluded` ho obsahuje
- [ ] **X2 Python cache hit:** snippet existuje v Translate cache → export pre `python:pandas` nerobí LLM call
- [ ] **X2 Python cache miss:** snippet neexistuje → `code-generator` invoke → snippet vygenerovaný → zahrnutý v ZIP

## 7. Odkazy

- [GOAL.md](./GOAL.md) — funkčný spec
- [RULES.md](./RULES.md) — business rules (BR-XPT-*)
- [UI.md](./UI.md) — Export flow UI, format selector
- [MULTIFORMAT.md](./MULTIFORMAT.md) — 11 packaging formátov, štruktúra per formát
- [../DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) — žiadne vlastné tabuľky; čítanie z iných modulov
- [../API_CONTRACT.md](../API_CONTRACT.md) — **TREBA PRIDAŤ** Export endpointy do API_CONTRACT.md!
- [08-translate/TODO.md](../08-translate/TODO.md) — `read_snippets`, `code-generator` pre X2–X8
- [05-model/TODO.md](../05-model/TODO.md) — SQL súbory, lineage edges
- [07-test/TODO.md](../07-test/TODO.md) — test definície pre `.yml` export
