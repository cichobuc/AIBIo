# Export — UI/UX špecifikácia

*Súčasť [UI_UX.md](../UI_UX.md) · Funkčný spec: [GOAL.md](./GOAL.md)*

---

URL: `/workspace/[id]/export`

## 1. Export Configuration Dialog

```
┌──────────────────────────────────────────────────────────────────────┐
│ ↗ Export to dbt                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  WORKSPACE SUMMARY                                                   │
│  Workspace: my_project  ·  Exported: [timestamp]                    │
│                                                                      │
│  ✅ 6 models (staging: 2, intermediate: 2, marts: 2)                 │
│  ✅ 20 tests (generic: 16, custom: 4)                                │
│  ✅ 8 table docs + 45 column docs                                    │
│  ✅ 5 business terms + 12 relationships                              │
│  ⚠️  2 columns unclassified — will be marked as L1 in export        │
│                                                                      │
│  EXPORT OPTIONS                                                      │
│  ☑ Models (SQL + YAML)                                               │
│  ☑ Tests                                                             │
│  ☑ Documentation (markdown + YAML)                                  │
│  ☑ Manifest (metadata)                                               │
│  ☑ Quickstart README                                                 │
│  ☐ Sample data  ⚠ Disabled — PII detected                           │
│                                                                      │
│  Target dialect   [DuckDB ▾]  (dbt-duckdb round-trip verified)      │
│  Archive format   [.zip ▾]                                           │
│                                                                      │
│  ℹ️  Export includes model definitions only. Materialized data is   │
│  rebuilt when you run `dbt run` with your own source connections.    │
│                                                                      │
│  [Cancel]              [Export & Download →]                         │
└──────────────────────────────────────────────────────────────────────┘
```

## 2. Export Progress (inline v tom istom dialógu)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ↗ Exporting...                                                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✅ Generating dbt_project.yml                                       │
│  ✅ Rendering 6 model SQL files                                      │
│  ✅ Generating model YAML (tests + docs)                             │
│  ✅ Rendering documentation markdown                                 │
│  ✅ Building business_glossary.md                                    │
│  ⟳ Packaging archive...                          ████████░░ 82%     │
│                                                                      │
│  ⚠️  Pre-flight: No PII column values in export ✓                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Post-Export Success State

Po dokončení balíčkovania — dialog zostane otvorený, mení sa obsah:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ↗ Export Complete                                                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✅  exported-my_project-2026-05-13T14-35.zip                        │
│      2.4 MB  ·  Exported at 14:35:02                                 │
│                                                                      │
│  CONTENTS                                                            │
│  6 models · 20 tests · 8 table docs · 45 column docs               │
│  5 business terms · 12 relationships · 3 conventions                │
│                                                                      │
│  ℹ️  This export is a point-in-time snapshot. Changes made after    │
│  this export are not reflected in the downloaded file.              │
│                                                                      │
│  NEXT STEPS                                                          │
│  1. Extract the archive                                              │
│  2. Create profiles.yml (template included in README.md)            │
│  3. Run: dbt deps && dbt run && dbt test                            │
│                                                                      │
│  [⬇ Download again]              [Close]                            │
└──────────────────────────────────────────────────────────────────────┘
```

Súbor sa automaticky stiahne pri prvom otvorení tohto stavu (browser download trigger). `[Download again]` umožní re-download bez nového exportu.

---

## 4. Blocked / Empty State

Keď workspace nemá hotové modely alebo testy — export dialog ukáže stav namiesto konfiguračných options:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ↗ Export to dbt                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  WORKSPACE READINESS                                                 │
│                                                                      │
│  ✅ Sources connected   (2 sources)                                  │
│  ✅ Schema profiled                                                  │
│  ✗  Models             0 models built — Export requires ≥1 model    │
│  ○  Tests              0 tests (optional but recommended)           │
│  ○  Documentation      0% coverage (optional)                       │
│                                                                      │
│  Export is available once you have at least one built model.        │
│                                                                      │
│  [Go to Model →]                          [Close]                   │
└──────────────────────────────────────────────────────────────────────┘
```

Stav jednotlivých checklistov:
- `✅` = hotové
- `○` = chýba ale voliteľné
- `✗` = chýba a blokuje export

Tlačidlo `[Export & Download →]` sa zobrazí len keď je aspoň 1 model built (`✅ Models`).

---

## 5. Export History

Sidebar v Export module zobrazuje predchádzajúce exporty ako read-only záznam:

```
┌──────────────────────────────────────────────────────────────────────┐
│ EXPORT SUMMARY                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  ...  (existujúci summary obsah)                                     │
│                                                                      │
│  [Export to dbt →]                                                   │
│                                                                      │
│  ── PREVIOUS EXPORTS ─────────────────────────────────────────────── │
│  ↗ 2026-05-13 14:35  6 models  20 tests  [⬇ Download]              │
│  ↗ 2026-05-12 09:12  4 models  12 tests  [⬇ Download]              │
│  ↗ 2026-05-10 16:44  2 models  8 tests   [⬇ Download]              │
└──────────────────────────────────────────────────────────────────────┘
```

Maximálne 10 posledných exportov (staršie sa automaticky odstraňujú). Každý export je uložený lokálne v `workspaces/{id}/exports/` kým ho user nevymaže alebo kým nedosiahne limit.
