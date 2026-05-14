# Test — UI/UX špecifikácia

*Súčasť [UI_UX.md](../UI_UX.md) · Funkčný spec: [GOAL.md](./GOAL.md)*

---

URL: `/workspace/[id]/test`

## 1. Test Results Dashboard

```
┌──────────────────────────────────────────────────────────────────────┐
│ ✓ Test Results                  Last run: 14:35:10   [Run All]      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✅ 18    ✗ 2    ⚡ 0    ⚠ 0                                        │
│  passed  failed  error  warn                                        │
│                                                                      │
│  ──────────────────────────────────────────────────────────────      │
│  Filter: [All models ▾] [All types ▾] [Failed only]                 │
│  ──────────────────────────────────────────────────────────────      │
│                                                                      │
│  ▼ 📋 dim_customer  (4/5 passed)                                    │
│    ✅ unique · customer_id              0.003s                       │
│    ✅ not_null · customer_id            0.002s                       │
│    ✅ not_null · email                  0.004s                       │
│    ✅ fk · source_customer_id           0.008s                       │
│    ✗  accepted_values · country         0.012s  [⌄ Detail]         │
│                                                                      │
│  ▼ 📋 fct_sales  (14/15 passed)                                     │
│    ✗  not_null · amount                0.005s  [⌄ Detail]          │
│    ✅ unique · sale_id                  0.003s                       │
│    ...                                                               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## 2. Test Failure Detail (expandovateľný)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ✗ accepted_values · dim_customer.country          [Fix with AI ✨]  │
├──────────────────────────────────────────────────────────────────────┤
│  Severity: warn                                                      │
│  Failing rows: 47 rows out of 1,204                                  │
│                                                                      │
│  Accepted values: ['US', 'UK', 'CA', 'DE', 'FR']                    │
│  Found unexpected: 'USA' (23×), 'United States' (18×), 'GB' (6×)   │
│                                                                      │
│  Sample failing PKs:                                                 │
│  customer_id: 47, 89, 134, 201, 356  (+42 more)                     │
│                                                                      │
│  ⚠ GDPR: Full row content not shown. PK IDs only.                   │
│                                                                      │
│  [Send to sql-writer for fix ✨]  [Update accepted values]  [Skip]  │
└──────────────────────────────────────────────────────────────────────┘
```

## 3. Test Editor (pre manuálne pridanie testov)

```
┌──────────────────────────────────────────────────────────────────────┐
│ + New Test                                                           │
├──────────────────────────────────────────────────────────────────────┤
│  Model:   [fct_sales ▾]                                              │
│  Column:  [amount ▾]                                                 │
│  Type:    [not_null ▾]  (unique / not_null / foreign_key /          │
│                          accepted_values / custom SQL)               │
│                                                                      │
│  Config (pre accepted_values):                                       │
│  Values: ['active', 'cancelled', 'pending']                         │
│                                                                      │
│  Severity: (●) error  (○) warn                                      │
│                                                                      │
│  [Preview test SQL]  [Save Test]                                     │
└──────────────────────────────────────────────────────────────────────┘
```

## 4. AI Test Generation Flow

```
┌─ ◈ test-generator (Sonnet) ───────────────────────────────────────┐
│ Analysed schema + profiles for `dim_customer`.                     │
│ Proposed 5 tests:                                                   │
│                                                                     │
│ ☐ unique · customer_id  (100% distinct in profile → PK candidate)  │
│ ☐ not_null · customer_id  (required field)                         │
│ ☐ not_null · email  (PII, required for CRM)                        │
│ ☐ fk · source_id → warehouse.customers.id                          │
│ ☐ accepted_values · country  (14 distinct values in profile)       │
│                                                                     │
│ [☑ Select All]  [✓ Save Selected]  [✗ Discard]                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Empty State

Keď ešte neexistujú žiadne materialized modely (Test čaká na Model):

```
┌──────────────────────────────────────────────────────────────────────┐
│ ✓ Tests                                                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│          ○  No models to test yet                                    │
│                                                                      │
│          Tests run against materialized models. Build your          │
│          models first — tests will auto-run after each build.       │
│                                                                      │
│          [Go to Model →]                                             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

Keď modely existujú ale žiadne testy ešte nie sú definované:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ✓ Tests                                                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│          ○  No tests defined                                         │
│                                                                      │
│          6 models built, 0 tests. AI can suggest tests based        │
│          on your schema and profile data.                           │
│                                                                      │
│          [Generate tests with AI ✨]   [+ Add manually]            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. Running State

Zobrazí sa počas test run — dashboard sa mení real-time:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ✓ Test Results                         Running... [■ Stop]          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ⟳ 12 running    ✅ 6 passed    ✗ 0 failed    ⚡ 0 error            │
│  ─────────────────────────────────────────── Progress  ██████░ 60%  │
│                                                                      │
│  ▼ 📋 dim_customer  (running)                                        │
│    ✅ unique · customer_id              0.003s                       │
│    ✅ not_null · customer_id            0.002s                       │
│    ⟳  not_null · email                 running...                   │
│    ⟳  fk · source_customer_id          running...                   │
│    ⟳  accepted_values · country        running...                   │
│                                                                      │
│  ▶ 📋 fct_sales  (queued)                                           │
│    ○ 10 tests pending...                                             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

Bottom Panel Output tab streamuje test logy počas behu:
```
[14:36:00] Starting test run (20 tests across 4 models)...
[14:36:00] [dim_customer] unique.customer_id ✅ 0.003s
[14:36:00] [dim_customer] not_null.customer_id ✅ 0.002s
[14:36:01] [dim_customer] fk.source_customer_id ⟳ running...
```

---

## 7. AI Context v Test module

Test výsledky môžu byť pridané do AI kontextu pre debugging — cez `[Add to AI context ☐]` button v Test Results Dashboard, alebo cez `⌘⇧C` Context Selector Modal.

Dostupné context typy z Test:
- `✓ test results (model)` — pass/fail summary pre daný model (Layer 1, bez raw row obsahu)
- `✓ test failure detail` — failing row count + sample PK IDs (GDPR-safe, bez full row content)
