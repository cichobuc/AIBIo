# Model — UI/UX špecifikácia

*Súčasť [UI_UX.md](../UI_UX.md) · Funkčný spec: [GOAL.md](./GOAL.md)*

---

URL: `/workspace/[id]/model`

## 1. Model Explorer + SQL Editor Tab

```
┌──────────────────────────────────────────────────────────────────────┐
│ ◻ stg_orders (staging)                   [▶ Run] [💾 Save] [⋮]     │
├──────────────────────────────────────────────────────────────────────┤
│  EDITOR (Monaco)                                                     │
│  ─────────────────────────────────────────────────────────────────── │
│   1  -- staging model: stg_orders                                   │
│   2  SELECT                                                          │
│   3    id::INTEGER             AS order_id,                          │
│   4    customer_id::INTEGER    AS customer_id,                       │
│   5    amount::DECIMAL(10, 2)  AS amount,                            │
│   6    status::VARCHAR         AS status,                            │
│   7    created_at::TIMESTAMP   AS created_at                         │
│   8  FROM source('warehouse', 'orders')                              │
│                                                                      │
│  LINEAGE CONTEXT (sidebar v editore)   [⊟ collapse]                 │
│  ┌──────────────────────────────────┐                               │
│  │ source('warehouse', 'orders')    │                               │
│  │  → stg_orders         [current] │                               │
│  │    → int_order_items            │                               │
│  │      → fct_sales                │                               │
│  └──────────────────────────────────┘                               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## 2. SQL Diff Approval Dialog (modal pre AI write)

Vždy keď `sql-writer` chce zapísať alebo prepísať model file:

```
┌──────────────────────────────────────────────────────────────────────┐
│  ◈ sql-writer — Write Model File                                     │
│  ─────────────────────────────────────────────────────────────────── │
│  Model: stg_orders.sql                                               │
│                                                                      │
│  DIFF PREVIEW                                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  + -- staging model: stg_orders                              │   │
│  │  + SELECT                                                     │   │
│  │  +   id::INTEGER           AS order_id,                      │   │
│  │  +   customer_id::INTEGER  AS customer_id,                   │   │
│  │  +   amount::DECIMAL(10,2) AS amount,                        │   │
│  │  +   status                AS status,                        │   │
│  │  +   created_at::TIMESTAMP AS created_at                     │   │
│  │  + FROM source('warehouse', 'orders')                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  45 lines added · 0 removed · New file                               │
│                                                                      │
│  ⌨ Chat input disabled until you decide.                            │
│                                                                      │
│  [✓ Approve & Write File]   [✎ Edit in Monaco first]   [✗ Deny]    │
└──────────────────────────────────────────────────────────────────────┘
```

## 3. Lineage DAG Tab

```
┌──────────────────────────────────────────────────────────────────────┐
│ ◻ Lineage DAG                    [Auto-layout] [Zoom: 100%] [Export]│
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [src: warehouse.db]    [stg_orders]   [int_order_items] [fct_sales] │
│         │                    │                 │               │      │
│  ┌──────────┐  ─────────▶  ┌─────────┐  ▶  ┌──────────┐  ▶  ┌──┐  │
│  │ orders   │               │stg_order│      │int_order │      │fct│  │
│  │ (source) │               │         │      │_items    │      │sale│ │
│  └──────────┘               └─────────┘      └──────────┘      └──┘  │
│                                                                      │
│  [src: warehouse.db]    [stg_customers]                              │
│         │                    │                                       │
│  ┌──────────┐  ─────────▶  ┌──────────────┐                        │
│  │customers │               │ stg_customers│                        │
│  └──────────┘               └──────────────┘                        │
│                                    │                                 │
│                                    ▼                                 │
│                              ┌──────────┐                            │
│                              │dim_custom│                            │
│                              └──────────┘                            │
│                                                                      │
│  [+ Add Model]  [AI Suggest Missing Connections ✨]                  │
└──────────────────────────────────────────────────────────────────────┘
```

Klik na node → otvára model SQL tab. Farby node:
- Modrý = source (external DB)
- Sivý = staging
- Žltý = intermediate
- Zelený = mart (final)
- Červený = failed build
- Pulse animácia = building

## 4. Model Run History — Bottom Panel Output Tab

Model build logy sa zobrazujú v globálnom Bottom Paneli, tab **Output** (⌘J). Bottom Panel sa automaticky otvorí pri spustení buildu.

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Output] [SQL] [Results] [Approvals (2)] [Audit Log] [Logs]  [∧][∨] │
├──────────────────────────────────────────────────────────────────────┤
│ ▶ Model Runs                                    [Build All] [⌘⇧B]  │
│                                                                      │
│  #5  14:35:02  Full build   ✅ 6/6 models  12.3s                    │
│  #4  14:20:15  Full build   ✗  3/6 models  8.1s  [View error]       │  ← klik expanduje
│  #3  12:05:33  Single: stg_orders  ✅  1.2s                         │
│  #2  ...                                                             │
│                                                                      │
│ ▼ #4 Error details                                                   │
│   [14:20:18] int_order_items: column "discount" does not exist       │
│   Self-heal attempt 1/3: sql-writer analyzing...                     │
│   [14:20:22] Proposed fix: add COALESCE(discount, 0)                 │
│   [Approve fix]  [Skip model]                                        │
└──────────────────────────────────────────────────────────────────────┘
```

Streamovaný build output v reálnom čase:
```
[14:35:00] Starting full build (6 models)...
[14:35:00] Source pull: warehouse.db → 3 tables (orders, customers, products)
[14:35:01] [staging] stg_orders ⟳ building...
[14:35:01] [staging] stg_customers ⟳ building...  (parallel)
[14:35:02] [staging] stg_orders ✅ 1.1s
[14:35:02] [staging] stg_customers ✅ 0.9s
[14:35:02] [intermediate] int_order_items ⟳ building...
...
```

## 5. New Model Creation Flow

Trigger: `[+]` button v Model Explorer sidebar, alebo `[+ Add Model]` v Lineage DAG.

```
┌──────────────────────────────────────────────────────────────────────┐
│ + New Model                                                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Model name                                                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ e.g. "stg_orders", "dim_customer", "fct_sales"               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  Naming prefix: stg_ = staging · int_ = intermediate                │
│                 dim_ = dimension · fct_ = fact                      │
│                                                                      │
│  Layer (auto-detected z prefixu, editovateľné)                      │
│  (●) staging    (○) intermediate    (○) marts                       │
│                                                                      │
│  Start with                                                          │
│  (●) Empty SQL editor (blank file)                                  │
│  (○) AI draft — sql-writer navrhne SQL podľa zdroja                 │
│                                                                      │
│  [Cancel]                   [Create model →]                        │
└──────────────────────────────────────────────────────────────────────┘
```

Po `[Create model →]`:
- Vytvorí prázdny SQL súbor v `workspaces/{id}/models/{layer}/{name}.sql`
- Otvára Monaco editor tab s prázdnym editátorom (alebo spustí `sql-writer` ak bola zvolená AI draft option)
- Lineage DAG sa updatuje po prvom save ktorý obsahuje `ref()` referenciu

**Empty state Model module (žiadne modely):**

```
┌──────────────────────────────────────────────────────────────────────┐
│ ◻ Models                                                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│          ○  No models yet                                            │
│                                                                      │
│          Build your dimensional model: staging → intermediate        │
│          → marts. AI can propose the entire structure.              │
│                                                                      │
│          [Ask AI to propose model →]   [+ Create manually]         │
│                                                                      │
│          ℹ️  Requires profiled data. Go to Explore first.           │
│          [Go to Explore →]                                           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. AI Context v Model module

Model SQL súbory sú hodnotný kontext pre AI — pridávajú sa cez `[Add to AI context ☐]` button v Model Explorer tree (hover na model name), alebo cez `⌘⇧C` Context Selector Modal.

Dostupné context typy z Model:
- `◻ model (SQL)` — kompletný SQL obsah modelu (Layer 1, vždy allowed)
- `◻ model (lineage)` — dependency chain modelu (upstream + downstream refs)

---

## 7. Materialized Data Preview Tab

Po úspešnom builde — kliknutím na model v strome:

```
┌──────────────────────────────────────────────────────────────────────┐
│ 👁 dim_customer (preview)         1,204 rows  [Re-build] [Test]     │
├──────────────────────────────────────────────────────────────────────┤
│  Showing top 100 rows  ·  Built: 14:35:02                           │
│                                                                      │
│  customer_id │ full_name     │ email           │ lifetime_value     │
│  ────────────┼───────────────┼─────────────────┼────────────────── │
│  1           │ John Smith    │ [EMAIL_MASKED]   │ $2,847.50         │
│  2           │ Jane Doe      │ [EMAIL_MASKED]   │ $1,234.00         │
│  ...                                                                 │
│                                                                      │
│  ⚠ AI nevidí tieto výsledky.                                        │
│  [Share top 10 rows with AI ↗]  [Share summary only ↗]             │
└──────────────────────────────────────────────────────────────────────┘
```
