# Export Sub-module — Business Rules

*BR-XPT = Export Business Rules. Verzia 0.2. Pozri [GOAL](./GOAL.md) a [MULTIFORMAT.md](./MULTIFORMAT.md) pre kontext.*

---

## Bezpečnosť a no-data-leak

**BR-XPT-001** — Export obsahuje iba definície — žiadne dáta, žiadne metadáta  
Condition: Obsah export archívu  
Rule: `.zip` obsahuje iba definície (SQL súbory, YAML, Markdown). **Nie sú zahrnuté:** DuckDB `datamart.duckdb` (materialized dáta), `aibio.db` (SQLite metadata — run history, audit log, profile cache). Dáta sa rebuild-ujú po `dbt run` mimo AIBIo.

**BR-XPT-002** — Export neobsahuje PII column values  
Condition: Obsah export archívu  
Rule: Model `.sql` súbory, `.yml` metadata, ani Markdown docs nesmú obsahovať sample values z PII-classified columns. Preflight scan pred zabalením ZIP overí absenciu podozrivých patterns.

**BR-XPT-003** — `profiles.yml.example` má placeholder credentials  
Condition: `profiles.yml.example` v exporte  
Rule: Obsahuje iba placeholder hodnoty (`{{ env_var('PG_PASSWORD') }}`). Nikdy reálne credentials zo `data_sources` tabuľky.

**BR-XPT-004** — Export je point-in-time snapshot  
Condition: Každý export  
Rule: Export reflektuje stav workspace v momente exportu. Timestamp je súčasťou file name aj `manifest.json`. Neskoršie zmeny v AIBIo nie sú retroaktívne zahrnuté.

---

## dbt compatibility rules

**BR-XPT-010** — `ref('name')` → Jinja `{{ ref('name') }}` konverzia  
Condition: SQL súbory v exporte  
Rule: TypeScript-style `ref('model_name')` tokeny sú konvertované na Jinja `{{ ref('model_name') }}` v exportovaných `.sql` súboroch. Pôvodné AIBIo SQL súbory zostávajú nezmenené.

**BR-XPT-011** — Export štruktúra je dbt-compatible  
Condition: Štruktúra ZIP archívu  
Rule: `models/staging/{source}/`, `models/intermediate/`, `models/marts/` sú povinné. `dbt_project.yml` musí byť valid a obsahovať `model-paths: ["models"]`. Exportovaný projekt musí byť spustiteľný cez `dbt run` bez manuálnych úprav.

**BR-XPT-012** — MVP target dialect je DuckDB  
Condition: SQL kompatibilita  
Rule: Success criterion = round-trip cez `dbt-duckdb`. DuckDB-špecifická syntax je povolená. README.md explicitne uvádza že iné adaptery (dbt-postgres, dbt-snowflake) sú best-effort.

**BR-XPT-013** — Tests: generic inline v `.yml`, custom v `tests/custom/`  
Condition: Export obsah testov  
Rule: Generic testy (`unique`, `not_null`, `foreign_key`, `accepted_values`) sú exportované inline do model `.yml` súborov. Custom SQL testy idú do `tests/custom/*.sql`.

---

## Export process rules

**BR-XPT-020** — Export je deterministický  
Condition: Rovnaký workspace state → viacnásobný export  
Rule: Výstup je identický okrem timestamp a UUID v manifest. Žiadny non-determinizmus v generovanom obsahu.

**BR-XPT-021** — dbt/SQL export nepotrebuje AI agenta  
Condition: Export operácia pre formát `dbt`  
Rule: dbt/SQL export je pure deterministická transformácia — žiadny LLM call. Pre multi-format export (Python, M, DAX, KQL) Export reuse-uje `code-generator` agenta z Translate modulu — najprv z cache (`translate_snippets`), on-demand generácia len ak snippet chýba. Export musí byť dokončiteľný aj bez agenta (fallback path).

**BR-XPT-021b** — `code-generator` dostáva iba schema, nie sample data  
Condition: Každý LLM call v rámci exportu (cez `generate_snippet`)  
Rule: `PiiColumnFilter` stripuje z `WorkspaceSnapshot` všetky `sample_values` pred odovzdaním agentovi. Agent dostáva: column names, types, descriptions, grain declarations, relationship definitions, metric definitions. Nikdy: sample rows, profiling cache values, query results. (Identické s BR-TRN-001 v translate/RULES.md.)

**BR-XPT-022** — Large archive → async download s progress  
Condition: Export trvá dlhšie (veľký workspace)  
Rule: UI zobrazí async progress indicator. Export prebehne na serveri — nie blokujúci UI request.

---

## Scope rules

**BR-XPT-030** — Export je all-or-nothing v MVP  
Condition: Export operácia  
Rule: Export zahrňuje všetky modely, testy a docs z workspace — nie selective subset. Žiadny partial export (napr. len staging models alebo len docs) nie je dostupný v MVP.

**BR-XPT-031** — Re-import nie je dostupný v MVP  
Condition: Exportovaný dbt projekt modifikovaný externe  
Rule: Re-import (modifikovaný ZIP späť do AIBIo) je out of MVP scope. Export README.md na to upozorňuje. Toto zabráni user-ovi predpokladať round-trip workflow.

---

## manifest.json rules

**BR-XPT-040** — manifest.json musí obsahovať povinné polia  
Condition: Každý export  
Rule: `manifest.json` musí obsahovať minimálne: `{ aibio_version, export_timestamp, workspace_name, export_format, export_variant, source_count, model_count, test_count, doc_coverage_pct, snippets_from_cache, snippets_generated, pii_columns_excluded[] }`. Chýbajúce povinné pole = export error pred zabalením ZIP. Pre dbt/SQL export: `snippets_from_cache: 0, snippets_generated: 0`.

**BR-XPT-041** — `snippets_from_cache` a `snippets_generated` sú povinné  
Condition: manifest.json  
Rule: `snippets_from_cache` = počet snippetov reuse-ovaných z `translate_snippets` cache. `snippets_generated` = počet on-demand generovaných počas exportu. Obe polia sú `0` pre dbt/SQL export. Fallback (snippet generácia zlyhala) = zapísaný do `notes[]` v manifeste.

---

## Multi-format packaging rules (BR-XPT-1xx)

*Pravidlá pre obsah a štruktúru export balíčkov. Pravidlá pre code generation a snippet kvalitu sú v [../08-translate/RULES.md](../08-translate/RULES.md).*

**BR-XPT-100** — Python package musí byť uv-compatible  
Condition: Python export balíček  
Rule: `pyproject.toml` bez `hatchling` (CLAUDE.md). `uv sync` v generovanom projekte musí prebehne bez chyby. `.env.example` obsahuje iba placeholders, nikdy reálne connection stringy.

**BR-XPT-101** — Power Query M: credentials vždy v `Parameters.pq`  
Condition: Power Query M export  
Rule: Všetky connection details (server, database, schema) sú parametre z `Parameters.pq`. Žiadna iná query nemá hardcoded connection string. `Parameters.pq` má placeholder hodnoty.

**BR-XPT-102** — DAX/TMDL: Calendar tabuľka je povinná  
Condition: DAX export + fact tabuľka s datetime column  
Rule: Export vždy generuje `Calendar.tmdl`. Relationship `fct_*.date → Calendar.Date` musí byť prítomná. `.bim` `compatibilityLevel` ≥ 1500.

**BR-XPT-103** — KQL: `.create-merge table` namiesto `.create table`  
Condition: KQL export  
Rule: Idempotentné deployment — `.create table` zlyháva pri re-deploy. Každý mart model má materialized view s `backfill=true`. `deploy.sh` má `set -euo pipefail`.

**BR-XPT-104** — Každý export balíček obsahuje README a manifest  
Condition: Každý non-dbt export  
Rule: `README.md` opisuje čo balíček obsahuje, ako ho použiť a aké závislosti sú potrebné. `manifest.json` obsahuje povinné polia vrátane `snippets_from_cache` a `snippets_generated`.
