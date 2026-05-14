# Export — Multi-Format Packaging

*Verzia 0.2. Rozšírenie Phase X1 (dbt/SQL export) o packaging pre ďalšie jazyky.  
DÔLEŽITÉ: Generácia a testovanie kódu v jednotlivých jazykoch patrí do **[Translate sub-module](../08-translate/GOAL.md)**. Export je iba packaging a delivery layer.*

---

## 1. Vzťah Translate ↔ Export

```
Translate module
  └─ code-generator agent → snippety (pandas, DAX, KQL, M, R, ...)
       └─ snippet cache v DB (translate_snippets)
            ↓
           Export module
             └─ reuse snippetov → zobalí do .zip s deployment artifacts
```

**Translate** = interaktívna generácia + testovanie kódu v ľubovoľnom jazyku  
**Export** = packaging snippetov do deployment-ready .zip archívu

Export **nevytvára vlastnú code generation logiku**. Ak snippet existuje → reuse. Ak neexistuje → zavolá rovnaký `code-generator` agent ako Translate, potom zabalí.

---

## 2. Podporované export pakety

Každý formát produkuje samostatný `.zip` archív:

| Export pakket | Obsah | Translate tier |
|---|---|---|
| `dbt/SQL` | dbt project (.yml, .sql, tests, docs) | — (deterministický, bez AI) |
| `python-pandas` | Python package (pandas + SQLAlchemy) | full-exec |
| `python-polars` | Python package (Polars lazy) | full-exec |
| `python-pyspark` | Python package (PySpark) | sandbox/gen-only |
| `python-sqlalchemy` | SQLAlchemy ORM models | syntax-only |
| `python-dbt` | dbt Python models | syntax-only |
| `powerquery` | Power Query M files (.pq) | syntax-only |
| `dax-tmdl` | TMDL folder + .bim | syntax-only |
| `kql` | KQL scripts + deployment | syntax-only |
| `r-dplyr` | R package (dplyr) | gen-only |
| `scala-spark` | Scala object files (Spark) | gen-only |

---

## 3. Export zip štruktúry

### Python package (pandas / polars)

```
exported-{workspace}-{ts}-python-{variant}.zip
├── pyproject.toml               # uv-compatible (bez hatchling)
├── README.md
├── .env.example                 # connection placeholders
├── src/{workspace_name}/
│   ├── __init__.py
│   ├── config.py                # pydantic-settings
│   ├── db.py                    # engine factory
│   ├── staging/
│   │   └── stg_{src}__{tbl}.py # snippet z Translate cache
│   └── marts/
│       ├── dim_{name}.py
│       └── fct_{name}.py
└── tests/
    └── test_{model}.py
```

### Power Query M

```
exported-{workspace}-{ts}-powerquery.zip
├── README.md
├── Parameters.pq                # connection placeholders
├── SharedFunctions.pq
├── staging/
│   └── stg_{src}__{tbl}.pq     # snippet z Translate cache
└── marts/
    ├── dim_{name}.pq
    └── fct_{name}.pq
```

### DAX / TMDL

```
exported-{workspace}-{ts}-dax-tmdl.zip
├── README.md
├── definition/                  # TMDL folder (Tabular Editor 3)
│   ├── database.tmdl
│   ├── model.tmdl
│   ├── tables/
│   │   ├── Calendar.tmdl        # auto-generated calendar
│   │   ├── dim_{name}.tmdl
│   │   ├── fct_{name}.tmdl
│   │   └── _Measures.tmdl
│   └── relationships/
│       └── relationships.tmdl
├── legacy/
│   └── model.bim                # BISM JSON pre staršie nástroje
└── deployment/
    ├── deploy.ps1               # PowerShell + XMLA
    └── settings.json.example
```

### KQL

```
exported-{workspace}-{ts}-kql.zip
├── README.md
├── 00_setup/
│   ├── 01_create_tables.kql
│   ├── 02_ingestion_mappings.kql
│   └── 03_update_policies.kql
├── functions/
│   └── fn_stg_{src}_{tbl}.kql  # snippet z Translate cache
├── materialized_views/
│   └── mv_{mart}.kql
├── queries/
│   └── {mart}_examples.kql
└── deployment/
    ├── deploy.sh                # Azure CLI, set -euo pipefail
    └── settings.json.example
```

---

## 4. Export pipeline (multi-format)

```
User: Export → vyberie format → klikne Export
  ↓
ExportService.run(workspaceId, format):
  1. WorkspaceSnapshotBuilder.build(workspaceId)         [deterministický]
  2. PrefightScan.checkNoPiiLeak(snapshot)               [guard]
  3. Per model × language:
     a. TranslateSnippetCache.get(modelId, languageId)
        → ak HIT a nie stale → reuse snippet             [rýchle]
        → ak MISS alebo stale → CodeGenerator.generate() [LLM call]
  4. FormatPackager.build(format, snippets, snapshot)    [deterministický]
     → zip štruktúra + manifest.json + README + deployment scripts
  5. ZipArchiveBuilder.finalize()
  6. SSE progress events počas kroku 3-5
  ↓
client: download .zip
```

**Performance:** Ak Translate snippety existujú pre všetky modely → Export je skoro bez LLM callов, rýchly (~5s). Ak snippety chýbajú → LLM generation per model (~8s/model).

---

## 5. manifest.json (multi-format rozšírenie)

```json
{
  "aibio_version": "0.1.0",
  "export_timestamp": "2026-05-14T10:30:00Z",
  "workspace_name": "northwind_datamart",
  "export_format": "python-pandas",
  "source_count": 2,
  "model_count": 8,
  "doc_coverage_pct": 87.5,
  "snippets_from_cache": 6,
  "snippets_generated": 2,
  "pii_columns_excluded": ["customers.email", "customers.phone"],
  "notes": [
    "2 snippets regenerated (stale after model change on 2026-05-14)",
    "PySpark export degraded to gen-only (Docker not configured)"
  ]
}
```

---

## 6. Fázový plán (aktualizovaný)

| Fáza | Obsah | Odhad | Závisí od |
|---|---|---|---|
| **X1** | dbt/SQL export | ~2d | M3, T2, D3 |
| **TR1** | Translate: Python full-exec | ~3d | M3 |
| **TR2** | Translate: SQL dialekty + syntax validation (DAX, KQL, M) | ~2d | TR1 |
| **TR3** | Translate: gen-only jazyky + Export integrácia | ~2d | TR2 |
| **X2** | Export: Python package (reuse TR1 snippetov) | ~1d | TR1 |
| **X3** | Export: Power Query M package (reuse TR2 snippetov) | ~1d | TR2 |
| **X4** | Export: DAX/TMDL package (reuse TR2 snippetov) | ~1.5d | TR2 |
| **X5** | Export: KQL package (reuse TR2 snippetov) | ~1d | TR2 |
| **X6** | Export UI: format selector | ~0.5d | X2-X5 |

**Total: ~14 dní** (Translate: ~7d + Export packaging: ~5d + UI: ~2d).  
Pôvodný MULTIFORMAT.md odhadoval ~17d bez Translate modulu — teraz je to presnejšie rozdelené.

---

## 7. Čo Export nevykonáva

Export nevytvára:
- Code generation logiku — patrí do Translate (`code-generator` agent)
- Execution/testing logiku — patrí do Translate (`translate-validator`)
- Language Registry — patrí do Translate
- Interaktívny code editor — patrí do Translate (Code Panel + Translate Page)

Export vytvára:
- Zip archív so správnou štruktúrou per formát
- `manifest.json` s metadátami
- `README.md` s quickstart inštrukciami
- Deployment scripty (`.sh`, `.ps1`)
- Boilerplate súbory (`pyproject.toml`, `dbt_project.yml`, `Parameters.pq`)

---

## 8. References

- Translate sub-module (kód a jazyky): [../08-translate/GOAL.md](../08-translate/GOAL.md)
- Language catalog: [../08-translate/LANGUAGES.md](../08-translate/LANGUAGES.md)
- dbt/SQL export spec: [GOAL.md](./GOAL.md)
- Business rules: [RULES.md](./RULES.md)
