# Translate Sub-module — GOAL

*Working doc, slovensky. Verzia 0.1. Súčasť AInderstanding, pozri [AINDERSTANDING.md](../AINDERSTANDING.md).*

---

## 1. Účel sub-modulu

**Translate rieši fundamentálny problém dátových tímov: každý člen tímu pracuje v inom jazyku.**

Data engineer píše SQL. Data scientist chce pandas. Power BI vývojár potrebuje DAX alebo Power Query M. Azure tím pracuje s KQL. Každý z nich potrebuje totožnú transformačnú logiku — len vyjadrenú inak.

AIBIo Translate **generuje profesionálny, idiomatický kód** tvojho data modelu v ľubovoľnom podporovanom jazyku, **spustí ho** a **overí**, že produkuje rovnaké výsledky ako DuckDB ground truth. Nie syntaktický preklad SQL — skutočný, best-practice kód v každom cieľovom jazyku, s okamžitou spätnou väzbou.

```
SQL model (DuckDB)  →  Python pandas  →  ✅ 42 rows, equivalent
                    →  Polars lazy     →  ✅ 42 rows, equivalent
                    →  KQL             →  ℹ️ Syntax OK (execution: ADX needed)
                    →  DAX             →  ℹ️ Syntax OK (execution: Power BI needed)
                    →  R / dplyr       →  📄 Generated (no validation)
```

Translate je **8. sub-modul AInderstanding**, funguje paralelne s Test a Document po dokončení Model.

---

## 2. Pozícia v AInderstanding

```
Connect → Explore → Govern
                         ↓
                       Model
                     ↙   ↓    ↘
               Test  Translate  Document
                         ↓
                       Export
```

- **Závisí od:** Model (SQL definície, lineage, grain), Explore (column types, profiles)
- **Produkuje pre:** Export (reuse generovaných snippetov), Document (code examples v docs)
- **Paralelný s:** Test, Document

---

## 3. Koncepty

- **Snippet** — vygenerovaný kód pre jeden model v jednom jazyku/variante
- **Language** — cieľový jazyk (DuckDB SQL, pandas, DAX, KQL...); definovaný v Language Registry
- **Variant** — špecifická forma jazyka (Python má varianty: pandas, polars, pyspark...)
- **Tier** — schopnosť Translate enginu pre daný jazyk: `full-exec` / `sandbox` / `syntax-only` / `gen-only`
- **Ground truth** — výsledok DuckDB SQL execúcie pre referenčné porovnanie
- **Equivalence test** — automatický test, či snippet produkuje rovnaký výsledok ako ground truth

---

## 4. Language tiers

| Tier | Čo sa deje | Výsledok |
|---|---|---|
| **full-exec** | Generate → Execute → Compare s ground truth | ✅ Equivalent / ❌ Mismatch / ⚠️ Error |
| **sandbox** | Generate → Execute v izolovanom prostredí (Docker/subprocess) → Compare | ✅ / ❌ / ⚠️ (pomalšie, optional setup) |
| **syntax-only** | Generate → Syntax validation (parser) | ℹ️ Syntax OK / ❌ Syntax Error |
| **gen-only** | Generate only, no validation | 📄 Generated |

---

## 5. Language Registry

Kompletný katalóg podporovaných jazykov. Detailné vzory a špecifikácie: [LANGUAGES.md](./LANGUAGES.md).

### SQL rodina

| Jazyk | ID | Tier | Mechanizmus |
|---|---|---|---|
| DuckDB SQL | `sql:duckdb` | full-exec | Natívny AIBIo engine |
| PostgreSQL | `sql:postgres` | full-exec | DuckDB postgres dialect + `COPY TO` ekvivalent |
| BigQuery (GoogleSQL) | `sql:bigquery` | full-exec | DuckDB bigquery dialect |
| Snowflake SQL | `sql:snowflake` | syntax-only | Snowflake SQL parser rules |
| Trino / Presto SQL | `sql:trino` | syntax-only | Trino syntax check |
| Spark SQL | `sql:sparksql` | full-exec | DuckDB Spark-compatible subset |
| dbt SQL (Jinja) | `sql:dbt` | syntax-only | Jinja template validation + ref() check |

### Python rodina

| Jazyk | ID | Tier | Mechanizmus |
|---|---|---|---|
| pandas | `python:pandas` | full-exec | uv subprocess → DataFrame.to_dict() → compare |
| Polars | `python:polars` | full-exec | uv subprocess → LazyFrame.collect() → compare |
| PySpark | `python:pyspark` | sandbox | Docker Spark container (optional setup) |
| SQLAlchemy 2.0 ORM | `python:sqlalchemy` | syntax-only | Mypy type check + alembic autogenerate dry-run |
| dbt Python model | `python:dbt` | syntax-only | dbt parse --select |
| ibis | `python:ibis` | full-exec | ibis DuckDB backend → compare |

### Microsoft BI

| Jazyk | ID | Tier | Mechanizmus |
|---|---|---|---|
| DAX (Power BI) | `bi:dax` | syntax-only | DAX expression parser (regex + structural rules) |
| Power Query M | `bi:powerquery` | syntax-only | M grammar parser |
| MDX | `bi:mdx` | gen-only | Legacy OLAP — generation only |
| XMLA / TMSL | `bi:tmsl` | gen-only | JSON generation only |

### Azure / Cloud Analytics

| Jazyk | ID | Tier | Mechanizmus |
|---|---|---|---|
| KQL (Azure Data Explorer) | `kql:adx` | syntax-only | KQL grammar parser |
| KQL (Sentinel / Log Analytics) | `kql:sentinel` | syntax-only | KQL + Sentinel-specific functions |
| Azure Synapse T-SQL | `sql:synapse` | syntax-only | T-SQL dialect check |

### Iné jazyky a frameworky

| Jazyk | ID | Tier | Mechanizmus |
|---|---|---|---|
| R / dplyr + tidyverse | `r:dplyr` | gen-only | R code generation |
| R / data.table | `r:datatable` | gen-only | R code generation |
| Scala / Spark | `scala:spark` | gen-only | Scala code generation |
| Julia / DataFrames.jl | `julia:df` | gen-only | Julia code generation |
| TypeScript / Prisma | `ts:prisma` | gen-only | Prisma schema + query generation |
| GraphQL (Hasura) | `graphql:hasura` | gen-only | Schema + query generation |

**Celkovo: 24 jazykov v registri.** Registry je otvorená — pridanie nového jazyka = nová `LanguageDefinition` bez zmeny existujúceho kódu.

---

## 6. Agenti

### `code-generator` (Haiku / Sonnet)

Zodpovedný za generovanie kódu v cieľovom jazyku.

```
Input:
  - model.sql (zdrojový SQL)
  - model.docs (popis, grain, column descriptions)
  - model.relationships (FK vzťahy)
  - target_language + variant
  - workspace.column_types (z Explore profiles)

Output:
  - generated_code: string
  - confidence: 'high' | 'medium' | 'low'
  - notes: string[]   // napr. "Snowflake QUALIFY not supported in target — used ROW_NUMBER workaround"
  - limitations: string[]  // napr. "Window function ROWS UNBOUNDED PRECEDING → Polars rolling()"
```

**Haiku pre:** SQL dialekty, jednoduché pandas/polars překlady, syntaktické úpravy  
**Sonnet pre:** DAX measures s time intelligence, KQL materialized view logika, komplexné Python transformácie, window functions

GDPR: agent dostáva iba schema + docs + grain — **nikdy sample data** (GDPR tier 1 only).

### `translate-validator` (deterministický, nie LLM)

Spúšťa vygenerovaný kód a porovnáva výsledky:
- Python tiers: `uv run --isolated` subprocess s timeout
- SQL tiers: DuckDB dialect execution
- Syntax tiers: parser validation
- Vracia `TranslateTestResult` (pozri sekciu 8)

---

## 7. UI a UX

Detailné špecifikácie: [translate/UI.md](./UI.md). Stručný prehľad:

### Translate Panel (embedded v Model module)

Každý model detail view dostáva záložku **"Code"** vedľa existujúcej "SQL" záložky:

```
┌─────────────────────────────────────────────────────────────────────┐
│  fct_sales                                         [SQL] [Code] [Tests] [Docs]  │
├─────────────────────────────────────────────────────────────────────┤
│  Language:  [DuckDB ▼]  [Python:pandas ▼]  [KQL ▼]  [+ Add]       │
│  Status:    ✅ Equivalent   ✅ Equivalent   ℹ️ Syntax OK             │
├──────────────────────────────────────────────────────────────────────┤
│  ┌─ Python: pandas ──────────────────────────────────────────────┐  │
│  │  import pandas as pd                                          │  │
│  │  from sqlalchemy import Engine, text                          │  │
│  │  ...                                                          │  │
│  │                                                  [Copy] [Run] │  │
│  └───────────────────────────────────────────────────────────────┘  │
│  ┌─ Result ──────────────────────────────────────────────────────┐  │
│  │  ✅ 42 rows | Schema match | Data equivalent (sampled 100)    │  │
│  │  Execution: 0.3s | Ground truth: 0.1s                        │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Translate Standalone Page

Celostránkové rozhranie pre power users — workspace-level multi-language view:

```
┌────────────────────────────────────────────────────────────────────┐
│  AInderstanding  /  Translate                                       │
├──────────────────┬─────────────────────────────────────────────────┤
│  Models          │  Language:  [Python: pandas  ▼]                  │
│  ─────────────── │  ─────────────────────────────────────────────── │
│  ○ stg_orders    │  ┌─ Monaco editor ─────────────────────────────┐ │
│  ○ stg_customers │  │  import pandas as pd                        │ │
│  ● fct_sales     │  │  from sqlalchemy import Engine, text        │ │
│  ○ dim_customer  │  │                                             │ │
│  ○ dim_product   │  │  def load_fct_sales(engine: Engine, ...):   │ │
│  ─────────────── │  │      ...                                    │ │
│  ✅ pandas       │  │                                             │ │
│  ✅ polars       │  └──────────────────────── [Copy] [Regenerate] ┘ │
│  ℹ️ dax          │  ┌─ Test ─────────────────────────────────────┐  │
│  ℹ️ kql          │  │  [▶ Run & Compare]                          │  │
│  📄 r/dplyr      │  │  ──────────────────────────────────────     │  │
│                  │  │  DuckDB:  42 rows  ●●●●●●●● 0.1s           │  │
│                  │  │  pandas:  42 rows  ●●●●●●●● 0.3s  ✅       │  │
│                  │  └────────────────────────────────────────────┘  │
└──────────────────┴─────────────────────────────────────────────────┘
```

### Workspace Overview (status grid)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Translate — All Models                                              │
├──────────────────┬──────────┬──────────┬──────────┬────────┬───────┤
│  Model           │ pandas   │ polars   │ DAX      │ KQL    │ R     │
├──────────────────┼──────────┼──────────┼──────────┼────────┼───────┤
│  stg_orders      │ ✅       │ ✅       │ ℹ️       │ ℹ️     │ 📄    │
│  stg_customers   │ ✅       │ ✅       │ —        │ ℹ️     │ 📄    │
│  fct_sales       │ ✅       │ ❌ diff  │ ℹ️       │ ℹ️     │ 📄    │
│  dim_customer    │ ✅       │ ✅       │ ℹ️       │ ℹ️     │ 📄    │
└──────────────────┴──────────┴──────────┴──────────┴────────┴───────┘
```

---

## 8. Execution a testovanie

### TranslateTestResult schema

```typescript
interface TranslateTestResult {
  snippetId: string
  language: LanguageId
  status: 'passed' | 'failed' | 'syntax_ok' | 'syntax_error' | 'runtime_error' | 'generated_only'
  groundTruth: {
    rowCount: number
    schema: ColumnDef[]
    // sample nie je súčasťou DB — dostupné iba počas behu testu (in-memory)
    durationMs: number
  } | null
  generated: {
    rowCount: number
    schema: ColumnDef[]
    // sample nie je súčasťou DB — dostupné iba počas behu testu (in-memory)
    durationMs: number
    stdout: string
    stderr: string
  } | null
  comparison: {
    schemaMatch: boolean
    rowCountMatch: boolean
    dataEquivalent: boolean             // sampled comparison, nie full scan
    columnDiffs: ColumnDiff[]
    rowDiffs: RowDiff[]                 // prvých 10 rozdielov, uložené v DB
  } | null
  error: string | null
  testedAt: string
}
```

> **DB mapping:** `TranslateTestResult` je runtime typ — mapuje sa na `translate_test_results` riadok. `rowDiffs` sú perzistované ako `row_diffs_json` (max 10 rozdielov, PII columns stripnuté). Sample dáta (`groundTruth.sample` / `generated.sample`) sú **in-memory only** — existujú iba počas porovnávania a nie sú uložené do DB z GDPR dôvodov.

### Python execution (full-exec tier)

```
1. Snippet uložený do temp file  /tmp/aibio_translate_{id}.py
2. uv run --no-project --with pandas,sqlalchemy --isolated python /tmp/aibio_translate_{id}.py
3. Stdout: JSON-serialized DataFrame (orient='records', max 500 rows)
4. Timeout: 30s (configurable per language)
5. Cleanup: temp file zmazaný po execúcii
6. Compare: pandas DataFrame vs DuckDB result → TranslateTestResult
```

### SQL dialect execution (full-exec tier)

```
1. Snippet preložený DuckDB dialect translaterom  
2. Spustený priamo cez existing DuckDB connection
3. Result porovnaný s pôvodným SQL výsledkom (row-for-row, sorted)
4. Timeout: 10s
```

### Syntax validation (syntax-only tier)

```
DAX:  regex + structural validator (CALCULATE/MEASURE/VAR nesting rules)
KQL:  KQL grammar parser (lightweight, bundled)
M:    M expression grammar parser
SQL:  DuckDB EXPLAIN bez execúcie (syntax check zadarmo)
```

---

## 9. Scope

### In scope (MVP)

- Language Registry s 24 jazykmi
- `code-generator` agent (Haiku/Sonnet) pre všetky jazyky
- Full-exec tiers: `sql:duckdb`, `sql:postgres`, `python:pandas`, `python:polars`, `python:ibis`
- Syntax-only tiers: `bi:dax`, `bi:powerquery`, `kql:adx`, `sql:snowflake`, `sql:dbt`
- Gen-only tiers: všetky ostatné (R, Scala, Julia, TypeScript, GraphQL, MDX)
- Embedded **Code Panel** v Model module (záložka "Code")
- Standalone **Translate page** v workspace navigácii
- Snippet cache (`translate_snippets` tabuľka)
- Test results store (`translate_test_results` tabuľka)
- Copy-to-clipboard pre každý snippet
- "Regenerate" button (nová AI generácia, staré výsledky archivované)
- Export modul **reuse snippetov** z Translate (ak existujú)

### Out of scope (MVP)

- PySpark sandbox (Docker dependency — follow-up Phase TR3)
- SQLAlchemy execution (potrebuje live DB connection — follow-up)
- Custom language plugin API (user-defined languages) — follow-up
- Snippet sharing / team library — follow-up
- Side-by-side diff view pre code changes — follow-up
- Auto-sync snippetov pri zmene SQL modelu (currently: manual regenerate) — follow-up

---

## 10. Success criteria

1. **Code generation funguje pre všetky 24 jazykov** — žiadny language ID nevráti error, každý vráti aspoň `gen-only` output
2. **Full-exec ekvivalencia** — pandas a polars snippety pre Chinook/Northwind demo workspace musia passovať ekvivalenciu pre ≥ 95% modelov
3. **Syntax validation neprodukuje false positives** — validné DAX/KQL/M generácie nesmú byť označené ako syntax error
4. **Performance** — snippet generácia (code-generator agent) ≤ 8s per model; Python execúcia ≤ 30s per model; SQL dialect execúcia ≤ 10s
5. **Snippet reuse v Export** — ak Translate snippety existujú, Export ich reuse bez ďalšieho LLM callu

---

## 11. Phase plán

### Phase TR1: Core engine + Python — ~3 dni

- Language Registry (TypeScript, extensible)
- `code-generator` agent (Haiku/Sonnet)
- Python full-exec tier: pandas + polars (`uv run --isolated` subprocess)
- ibis full-exec tier (DuckDB backend)
- `translate_snippets` + `translate_test_results` DB tables
- Snippet cache + invalidácia pri zmene SQL modelu
- Code Panel záložka v Model module (embedded)
- Copy + Regenerate UI

### Phase TR2: SQL dialekty + Syntax validation — ~2 dni

- SQL dialect full-exec tiers: postgres, bigquery, sparksql (DuckDB dialect translation)
- SQL syntax-only: snowflake, trino, dbt SQL
- DAX syntax validator
- KQL syntax validator
- M (Power Query) syntax validator
- Standalone Translate page
- Workspace Overview grid

### Phase TR3: Gen-only jazyky + Export integrácia — ~2 dni

- Gen-only tiers: R/dplyr, R/data.table, Scala Spark, Julia, TypeScript/Prisma, GraphQL, MDX, TMSL
- Export modul: snippet reuse logika
- PySpark sandbox (Docker, optional — skip ak Docker nie je dostupný)
- SQLAlchemy syntax validation

**Total Translate: ~7 dní.**

**Dependencies:** Phase M3 (Model) — potrebujeme hotové SQL modely + grain deklarácie pre generáciu.  
**Blocks:** Export Phase X2–X5 (Export reuse Translate snippetov namiesto vlastnej generácie).

---

## 12. Vplyv na ostatné moduly

### Export module

**Export X1 (MVP dbt export) je nezávislý od Translate** — generuje SQL súbory, `.yml` schémy, docs a deployment scripty deterministicky, bez `code-generator` agenta.

Export X2–X8 (post-MVP multi-format packaging) reuse-uje Translate snippety, ale **nevytvára vlastnú** code generation logiku:
- Ak existujú Translate snippety pre daný jazyk → Export ich zabalí do .zip
- Ak snippety neexistujú → Export spustí `code-generator` (rovnaký agent ako Translate používa)
- Export zostáva zodpovedný za: zip štruktúru, manifest.json, README, deployment scripty

### Model module

Model module dostáva embedded **Code Panel** (záložka "Code") — minimálna zmena v Model kóde, Translate je self-contained feature dodaná ako plug-in záložka.

### Document module

Document module môže referencovať Translate snippety ako **code examples** v generovaných docs (napr. "How to query this table in Python" sekcia v per-table docs).

---

## 13. Open questions

- **Snippet versioning** — pri zmene SQL modelu sú staré snippety stale. Auto-invalidácia (zmena SQL → snippety marked stale + regenerate prompt) vs manual. *Predbežne: auto-mark stale, manual regenerate (user kontroluje kedy a pre aké jazyky).*
- **Partial model support** — Translate pre staging modely je priamočiary. Pre mart modely so `ref()` dependencies — snippet musí spúšťať celú pipeline. *Riešenie: pre pandas/polars snippety — inline dependencies (unroll ref() do one function). Pre SQL dialekty — reuse DuckDB materialized tables.*
- **PySpark sandbox** — Docker dependency je ťažká prerekvizita. *Predbežne: optional setup, prominentne zdokumentovaný ako "requires Docker". Default: gen-only tier pre PySpark ak Docker nie je dostupný.*

---

## 14. Glossary

- **Snippet** — vygenerovaný kód pre model × jazyk × variant, uložený v DB
- **Ground truth** — DuckDB SQL execúcia pôvodného modelu — referenčný výsledok pre ekvivalenčné testy
- **Language Registry** — centrálny zoznam podporovaných jazykov s ich tier a konfiguráciou
- **Tier** — schopnosť validation/execution enginu pre daný jazyk
- **Equivalence test** — porovnanie výsledkov snippet vs ground truth (schema + row count + sample data)

---

## 15. References

- Parent: [AINDERSTANDING.md](../AINDERSTANDING.md)
- Language catalog: [LANGUAGES.md](./LANGUAGES.md)
- Business rules: [RULES.md](./RULES.md)
- Export integrácia: [../09-export/MULTIFORMAT.md](../09-export/MULTIFORMAT.md) — sekcia "Export × Translate"
- DB schema: [../DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) — `translate_snippets`, `translate_test_results` tables
- Agent prompts: [../AGENT_PROMPTS.md](../AGENT_PROMPTS.md) — `code-generator` sekcia (Section 10)
- Model module: [../05-model/GOAL.md](../05-model/GOAL.md) — Code Panel záložka
