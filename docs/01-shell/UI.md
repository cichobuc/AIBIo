# Shell — UI/UX špecifikácia

*Súčasť [UI_UX.md](../UI_UX.md) · Funkčný spec: [GOAL.md](./GOAL.md)*

---

## 1. Shell — celkový layout

### Celková mapa

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  TOP BAR (48px)                                                                  │
│  ◈ AIBIo  /  AInderstanding  /  my_project         [● Auto ▾]  [⚙]  [?]  [○]  │
├────┬───────────────────────────────────────────────────┬───────────────────────┤
│    │  PRIMARY SIDEBAR (260px, resizable, collapsible)  │  AI CHAT PANEL        │
│ A  │                                                   │  (360px, resizable,   │
│ C  │  Obsah závisí od aktívneho modulu                 │  collapsible ⌘⇧A)     │
│ T  │  (schema navigator, model explorer, test tree...) │                       │
│ I  │                                                   │  ↕ SSE stream         │
│ V  │                                                   │  ↕ Approval cards     │
│ I  │                                                   │  ↕ Chat history       │
│ T  │                                                   │                       │
│ Y  ├───────────────────────────────────────────────────┤  ─────────────────── │
│    │  MAIN WORKSPACE (flex, tabbed, splittable)        │  Context selector     │
│ B  │                                                   │  [Prompt input]       │
│ A  │  [Tab 1] [Tab 2] [+]  ···  [⊟ Split]             │  [⌘↵ Send]            │
│ R  │  ─────────────────────────────────────────────    │                       │
│    │                                                   │                       │
│    │  <TAB CONTENT — mení sa podľa otvorenej entity>   │                       │
│    │                                                   │                       │
│    │                                                   │                       │
├────┴───────────────────────────────────────────────────┴───────────────────────┤
│  BOTTOM PANEL (180px, collapsible ⌘J)                                          │
│  [Output] [SQL] [Results] [Approvals (2)] [Audit Log] [Logs]          [∧] [∨] │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  <panel content>                                                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│  STATUS BAR (24px)                                                              │
│  ● Auto  │  warehouse.db  │  schema-explorer ⟳  │  ⚠ 3 unclassified  │  ⌘K  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Rozmery a správanie panelov

| Panel | Šírka/výška | Min | Max | Default | Skratka |
|-------|-------------|-----|-----|---------|---------|
| Activity bar | 48px | fixná | fixná | vždy | — |
| Primary sidebar | 260px | 180px | 480px | otvorený | ⌘B |
| Main workspace | flex | 400px | — | — | — |
| AI chat panel | 360px | 280px | 560px | otvorený | ⌘⇧A |
| Bottom panel | 180px | 100px | 400px | zatvorený | ⌘J |
| Status bar | 24px | fixná | fixná | vždy | — |

Všetky panely okrem activity bar a status bar majú **drag handle** na ich okraji pre resize.

---

## 2. Activity Bar

Úzky vertikálny strip (48px) na úplnom ľavom okraji. Ikony bez textu, tooltip on hover (delay 400ms). Aktívny stav = 2px accent border vľavo + zvýraznené pozadie (bg-elevated).

```
┌────┐
│ ◈  │  ← Logo / home (klik → workspace list)
├────┤
│ ⬡  │  Connect        "Manage data sources"
│ 🧭 │  Explore        "Schema & profiling"
│ 🛡 │  Govern         "GDPR & permissions"
│ ◻  │  Model          "Dimensional model"
│ 📄 │  Document       "Governance docs"
│ ✓  │  Test           "Data quality"
│ ↗  │  Export         "Export to dbt"
├────┤  separator
│ ⚙  │  Settings       (bottom, vždy viditeľné)
│ ?  │  Help / Docs
└────┘
```

**Stav modulu** — vedľa každej ikony môže byť malý badge:
- `●` zelený = všetko OK (fáza hotová, žiadne warningy)
- `⚠` žltý = potrebuje pozornosť (napr. unclassified columns v Govern, failed tests v Test)
- `○` sivý = fáza ešte nebehla

---

## 3. Primary Sidebar — per-modul navigátor

Obsah sa mení podľa aktívneho modulu. Všetky varianty majú:
- Search/filter input na vrchu
- Reload/refresh akciu v header
- Keyboard navigation (šípky, Enter pre otvorenie)

### 3.1 Connect — Workspace & Sources

```
┌──────────────────────────────────┐
│ DATA SOURCES              [⟳] [+]│
├──────────────────────────────────┤
│ 🔍 Filter sources...             │
│                                  │
│ ▼ 🗄 warehouse.db         ● Live │
│   Postgres · localhost:5432      │
│   ▶ Tables (12)                  │
│   ▶ Views (3)                    │
│   [Test connection]              │
│                                  │
│ ▶ 🗄 staging.duckdb       ● Live │
│ ▶ 🌐 northwind.db         ◌ Off  │
│                                  │
│ ──────────────────────────────── │
│ [+ Add Data Source]              │
└──────────────────────────────────┘
```

Status indikátory:
- `● Live` = zelený dot = spojenie aktívne
- `⚠ Slow` = žltý = latencia > 2s
- `✗ Error` = červený = connection failed
- `◌ Off` = sivý = konfigurovaný, nevyskúšaný

### 3.2 Explore — Schema Navigator

Toto je **srdce navigátora** — plno featured strom podobne ako DBeaver.

```
┌──────────────────────────────────┐
│ SCHEMA               [⟳] [⊕] [⚙]│
├──────────────────────────────────┤
│ 🔍 Filter tables & columns...    │
│                                  │
│ ▼ 🗄 warehouse.db                │
│   ▼ 📂 public                    │
│     ▼ 📋 orders             [L1] │
│       ├ id            INT PK     │
│       ├ customer_id   INT FK→    │
│       ├ amount        DEC   [L2] │
│       ├ status        VAR   [L1] │
│       └ created_at    TS    [L1] │
│     ▼ 📋 customers          [L2] │
│       ├ id            INT PK     │
│       ├ email         VAR   [L3] │  ← červený, PII
│       └ ...                      │
│     ▶ 📋 products           [L1] │
│     ▶ 📋 media_types [ref]  [L1] │  ← [ref] = reference table
│     ▶ 👁 v_sales_summary         │
│                                  │
│ ▶ 🗄 staging.duckdb              │
└──────────────────────────────────┘
```

**GDPR badges priamo v navigátore:**
- `[L1]` zelený = Layer 1 Schema metadata (default ALLOW)
- `[L2]` žltý = Layer 2 Sample dáta (default DENY, per-table opt-in)
- `[L3]` červený = Layer 3 Query results + PII (default DENY, per-query approval)
- `[?]` sivý = neklasifikované — klik otvára Govern tab

**Context menu na pravý klik na tabuľku:**
- Open in new tab
- Profile table
- Classify (GDPR)
- Mark as reference table
- Copy table name
- Add to AI context →

**Column hover actions:**
- `☐` checkbox (vľavo) → pridá do AI Context Selector
- `→` ikona → otvára column detail tab

### 3.3 Govern — Classification Navigator

```
┌──────────────────────────────────┐
│ GDPR OVERVIEW            [Export]│
├──────────────────────────────────┤
│ Filter: [All ▾] [⚠ Unset only]  │
│                                  │
│ COVERAGE                         │
│ ████████░░ 78%  classified       │
│                                  │
│ ▼ 🗄 warehouse.db                │
│   ▼ 📋 customers                 │
│     ✅ id           L1            │
│     🔒 email        L3 PII       │
│     ⚠️  phone        Unset        │  ← klik → inline classify
│     ✅ created_at   L1            │
│   ▶ 📋 orders       3 unset ⚠    │
│   ▶ 📋 products     ✅ all clear  │
│                                  │
│ [Classify All Unset →]           │
└──────────────────────────────────┘
```

### 3.4 Model — Model Explorer

```
┌──────────────────────────────────┐
│ MODELS                   [+] [▶] │
├──────────────────────────────────┤
│ 🔍 Filter models...              │
│                                  │
│ ▼ 🗄 staging                     │
│   ├ stg_orders      ✅ built     │
│   ├ stg_customers   ✅ built     │
│   └ stg_products    ⚠ stale      │
│ ▼ 📂 intermediate                │
│   ├ int_order_items ✅ built     │
│   └ int_customer_lv ● running    │  ← spinner
│ ▼ 📂 marts                       │
│   ├ dim_customer    ○ not built  │
│   ├ dim_product     ○ not built  │
│   └ fct_sales       ○ not built  │
│                                  │
│ Last build: 12 min ago           │
│ [Build All] [Build Selected]     │
└──────────────────────────────────┘
```

Build status per model:
- `✅ built` = zelený = materialized, aktuálne
- `⚠ stale` = žltý = build bol ale source sa zmenil
- `○ not built` = sivý = SQL existuje, nematerializované
- `● running` = pulse animácia = práve sa builduje
- `✗ failed` = červený = posledný build zlyhal

### 3.5 Document — Docs Navigator

```
┌──────────────────────────────────┐
│ DOCUMENTATION        Coverage    │
│                      ████░ 72%   │
├──────────────────────────────────┤
│ 🔍 Filter...                     │
│                                  │
│ ▼ 📋 Tables (8/10 documented)    │
│   ✅ orders          high conf   │
│   ✅ customers       med conf    │
│   ⚠️  products        low conf   │  ← klik → otvorí doc edit
│   ○  invoices        not started │
│   ...                            │
│                                  │
│ ▼ 📝 Business Terms (5)          │
│   ✅ Customer LTV                │
│   ✅ Net Revenue                 │
│   ○ Churn Rate                   │
│                                  │
│ ▶ 🔗 Relationships (12)          │
│ ▶ 📐 Conventions (3)             │
│                                  │
│ [Start Interview →]              │
└──────────────────────────────────┘
```

### 3.6 Test — Test Navigator

```
┌──────────────────────────────────┐
│ TESTS              Last run: 5m  │
│                    18✅ 2✗ 0⚡   │
├──────────────────────────────────┤
│ 🔍 Filter tests...               │
│                                  │
│ ▼ 📋 dim_customer (6 tests)      │
│   ✅ unique · id                 │
│   ✅ not_null · id               │
│   ✅ not_null · email            │
│   ✅ fk · source_customer_id     │
│   ✗  accepted_values · country   │  ← červené, klik = detail
│   ✅ custom · no_duplicates      │
│                                  │
│ ▼ 📋 fct_sales (4 tests)         │
│   ✗  not_null · amount          │
│   ✅ unique · sale_id            │
│   ...                            │
│                                  │
│ [Run All Tests] [Generate Tests]  │
└──────────────────────────────────┘
```

### 3.7 Export — Export Navigator

Jednoduchší sidebar — zobrazuje workspace summary čo bude exportované.

```
┌──────────────────────────────────┐
│ EXPORT SUMMARY                   │
├──────────────────────────────────┤
│ Workspace: my_project            │
│                                  │
│ ✅ 6 models                      │
│ ✅ 20 tests                      │
│ ✅ 8 table docs                  │
│ ✅ 5 business terms              │
│ ⚠️  2 unclassified columns        │
│                                  │
│ Export includes:                 │
│ ☑ Models (SQL + .yml)           │
│ ☑ Tests                         │
│ ☑ Documentation                 │
│ ☑ Manifest                      │
│ ☐ Sample data                    │  ← defaultne off
│                                  │
│ [Export to dbt →]                │
└──────────────────────────────────┘
```

---

## 4. AI Chat Panel

**Core differentiator AIBIo.** Pravý panel (360px), collapsible. Vždy prítomný naprieč všetkými modulmi. Supervisor agent číta aktívny modul z URL a kontextualizuje odpovede.

### 4.1 Celková štruktúra

```
┌──────────────────────────────────────┐
│ ✨ AI Assistant      [Mode ▾] [⊟]   │  ← header, mode selector, collapse
├──────────────────────────────────────┤
│  ACTIVE AGENTS (pri paralelnom         │
│  dispatchi):                          │
│  ⟳ schema-explorer  warehouse.db     │  ← animated spinner
│  ⟳ schema-explorer  staging.duckdb   │
├──────────────────────────────────────┤
│                                      │
│  [správy — scroll area]              │
│                                      │
│  ┌─ 👤 You ───────────────────────┐  │
│  │ Analyzuj orders tabuľku...     │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌─ ◈ schema-explorer (Haiku) ───┐  │
│  │ Načítavam schému...            │  │
│  │ ▓▓▓▓▓▓░░░░░ 55%               │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌─ APPROVAL REQUIRED ────────────┐  │
│  │ ⚠ Agent chce zobraziť sample   │  │
│  │ dát z `orders` (Layer 2)       │  │
│  │ [✓ Allow once]  [✗ Deny]       │  │
│  │ [☑ Allow for session]          │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌─ ◈ Assistant ─────────────────┐  │
│  │ Navrhované klasifikácie:       │  │
│  │ • `amount` → Layer 2 (finance) │  │
│  │ [Apply All] [Review Each]      │  │  ← action buttons v správe
│  └────────────────────────────────┘  │
│                                      │
├──────────────────────────────────────┤
│  CONTEXT BAR                         │
│  [orders ×] [customers ×] [+ Add]    │  ← vybrané entity pre AI kontext
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │ Ask about your data...         │  │
│  │                                │  │  ← textarea, auto-resize
│  └────────────────────────────────┘  │
│  [📎 Attach] [Context ⌘⇧C]  [⌘↵]   │
└──────────────────────────────────────┘
```

### 4.2 Message typy

**User message** — tmavšie pozadie, right-aligned avatar.

**Agent streaming message** — obsahuje:
- Agent name badge (`schema-explorer`, `model-architect`, atď.)
- Model badge (`Haiku` / `Sonnet`)
- Progress bar počas streamingu
- Collapsible tool call log (default: collapsed, expand chevron)

**Tool call log (collapsed):**
```
▶ 3 tool calls  [⌄ Show]
```

**Tool call log (expanded):**
```
▼ Tool calls
  ✓ guarded_introspect_schema  orders  →  48 columns
  ✓ read_native_comments  orders  →  3 comments found
  ✓ detect_pii_candidates  →  2 candidates flagged
```

**Action message** — správa s embedded CTA buttons:
```
┌─ ◈ model-architect ───────────────────────┐
│ Navrhovaný dimensional model:              │
│                                            │
│ Fact: fct_sales (orders + order_items)     │
│ Dim: dim_customer, dim_product             │
│                                            │
│ [✓ Approve & Start SQL Writing]            │
│ [✎ Modify proposal first]                 │
│ [✗ Reject, start over]                    │
└────────────────────────────────────────────┘
```

**System message** — italic, sivé:
```
~ Mode switched to Documentation. SQL agents disabled.
~ Session resumed from previous state.
```

### 4.3 Mode Selector dropdown (z headeru)

```
┌────────────────────────────────────┐
│  AI Mode                           │
│ ─────────────────────────────────  │
│  ● Auto          Všetci agenti    │  ← default
│  ○ Documentation  Len doc agenti  │
│  ○ Queries       Len SQL agenti   │
│  ○ Manual        Žiadni agenti    │
│                                    │
│  ℹ️  Mode affects which agents      │
│  the supervisor can dispatch.      │
└────────────────────────────────────┘
```

Pri **Manual mode** — chat input dostane disabled state s textom:
*"Manual mode — AI agents disabled. Edit files directly."*

---

## 5. Bottom Panel

Collapsible panel (⌘J). Defaultne zatvorený, automaticky sa otvorí keď:
- Prídu query results
- Spustí sa build/run
- Čaká approval v queue
- Príde log/error

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Output] [SQL] [Results] [Approvals (2)] [Audit Log] [Logs]  [∧][∨] │
├──────────────────────────────────────────────────────────────────────┤
```

### Tabs

**Output** — textový log agentných akcií, build progress:
```
[14:32:01] schema-explorer: Starting introspection on warehouse.db...
[14:32:03] schema-explorer: Found 12 tables, 48 columns, 8 FK relationships
[14:32:03] data-profiler: Spawning 12 parallel profiling instances...
[14:32:08] data-profiler: Completed 10/12 tables (83%)
```

**SQL** — posledný vykonaný SQL (z `guarded_run_select_query`), s copy button + re-run:
```sql
-- Generated by: sql-writer | 14:32:15 | orders
SELECT
    o.id,
    o.amount,
    c.name AS customer_name
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
WHERE o.created_at >= '2024-01-01'
LIMIT 100
```

**Results** — tabuľkový výstup query results. Obsahuje **Share with AI** akciu (Layer 3 flow):
```
┌──────────────────────────────────────────────────────────────┐
│ Query Results — 2,847 rows  (showing top 100)                │
│                                                              │
│  id  │  amount  │  customer_name  │  created_at             │
│ ─────┼──────────┼─────────────────┼──────────────────────── │
│  1   │  234.50  │  John Smith     │  2024-01-15             │
│  2   │  89.99   │  [MASKED]       │  2024-01-16             │  ← PII masked
│  ...                                                         │
│                                                              │
│ ⚠ AI nevidí tieto výsledky.                                  │
│ [Share top 10 rows with AI ↗]  [Share summary only ↗]       │
└──────────────────────────────────────────────────────────────┘
```

**Approvals (N)** — batch queue pre pending approvals (alternatíva k inline chat cards):
```
┌──────────────────────────────────────────────────────────────┐
│ PENDING APPROVALS (2)                                        │
│                                                              │
│ #1  ⚠ model-architect  →  View sample: orders.amount  Layer2 │
│     [✓ Allow] [✗ Deny] [☑ Allow for session]                 │
│                                                              │
│ #2  ⚠ sql-writer  →  Write: stg_orders.sql  (diff: +45 lines)│
│     [✓ Approve diff] [✎ Review first] [✗ Deny]              │
│                                                              │
│ [Approve All Safe ↓]  [Deny All ↓]                          │
└──────────────────────────────────────────────────────────────┘
```

**Audit Log** — read-only chronologický log AI access akcií:
```
14:31:05  schema-explorer  read_schema      warehouse.db          ✅ allowed
14:31:06  schema-explorer  read_native_com  warehouse.db.orders   ✅ allowed
14:31:08  data-profiler    run_profile_qry  orders (no sample)    ✅ allowed
14:31:10  data-profiler    sample_data      orders.amount         ✗ blocked (L2 DENY)
14:32:15  sql-writer       run_select_query orders — 2,847 rows   ✅ user_approved
```

**Logs** — raw server/SSE debug logy (vývojársky tab, môže byť skrytý v produkcii).

---

## 6. Status Bar

Spodná lišta (24px), fixná výška, každý element klikateľný.

```
● Auto mode  │  warehouse.db +2  │  schema-explorer ⟳  │  ⚠ 3 unclassified  │  ⌘K  │
```

| Segment | Klik akcia |
|---------|-----------|
| `● Auto mode` | Otvára Mode Selector dropdown |
| `warehouse.db +2` | Otvára Connect sidebar |
| `schema-explorer ⟳` | Otvára Output tab v Bottom Panel |
| `⚠ 3 unclassified` | Otvára Govern sidebar s Unset filter |
| `⌘K` | Otvára Command Palette |

---

## 7. Top Bar

Výška 48px. Tri zóny: left (breadcrumb), center (prázdne), right (actions).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ◈  /  my_project  /  Explore           [● Auto ▾]     [⚙]  [?]  [○ Lukáš] │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Breadcrumb** — klikateľné, klik na `my_project` → workspace switcher
- **AI Mode pill** — vždy viditeľný, dropdown pre zmenu
- **⚙ Settings** — workspace settings overlay
- **? Help** — otvára docs / onboarding
- **○ Avatar** — user menu (logout, profile, keyboard shortcuts)

---

## 8. Settings Panel

Trigger: `⌘,` alebo klik `⚙` v Top Bar alebo Activity Bar. Renderuje sa ako `Dialog` (shadcn) — centered overlay, backdrop blur. Rozmer: `860px × 580px`, neresizovateľné.

### 8.1 Celková štruktúra

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Settings — my_project                                               [×]      │
├─────────────────────────┬──────────────────────────────────────────────────  ┤
│  AI Behavior          ▶ │  <obsah aktívnej sekcie>                           │
│  Approval Gates         │                                                    │
│  Data & Profiling       │                                                    │
│  Models & SQL           │                                                    │
│  Documentation          │                                                    │
│  Testing                │                                                    │
│  Connections            │                                                    │
│  UI / UX                │                                                    │
│                         │                                                    │
├─────────────────────────┴────────────────────────────────────────────────────┤
│  ● Changes saved automatically                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

Ľavý sidebar (180px, fixný). Pravá content area (flex, scrollable). Defaultne otvorená sekcia: **AI Behavior**.

**Ukladanie:** Každá zmena sa odošle okamžite. `workspace_settings` stĺpce → `PATCH /api/workspaces/[workspaceId]/settings`. `approval_settings` stĺpce (§8.3) → `PATCH /api/workspaces/[workspaceId]/approval-settings`. `workspaces.ai_mode` (§8.2 Default AI mode) → `PATCH /api/workspaces/[workspaceId]`. Žiadny Save button.
Chyba pri save → červený inline error pod nastavenou hodnotou, predchádzajúca hodnota zostáva.

`[Polish]` tag vedľa názvu nastavenia = post-MVP, renderuje sa grayed-out, editovateľné ale neodporúčané meniť v MVP.

---

### 8.2 AI Behavior

Vlastník: `workspace_settings` (Shell). Kategória z AINDERSTANDING.md: *AI modes & behavior* + *UI/UX preferences*.

```
│  AI Behavior                                                                 │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Default AI mode                                                             │
│  Ako supervisor dispatchuje agentov po otvorení workspace.                  │
│  ┌────────────────────────┐                                                  │
│  │ Auto ▾                 │  (Auto / Documentation / Queries / Manual)       │
│  └────────────────────────┘                                                  │
│                                                                              │
│  Show tool calls in chat                                                     │
│  Zobrazí rozbaliteľné tool call logy v chat bublinách.                      │
│  ● On   ○ Off                                                                │
│                                                                              │
│  Max supervisor turns              [Polish]                                  │
│  Hard cap na agentic loop per session. Po dosiahnutí → automatické ukončenie.│
│  ┌──────┐                                                                    │
│  │  20  │  turns                                                             │
│  └──────┘                                                                    │
│                                                                              │
│  Session idle timeout              [Polish]                                  │
│  Nečinná session sa ukončí po tomto čase.                                   │
│  ┌──────┐                                                                    │
│  │  60  │  min                                                               │
│  └──────┘                                                                    │
│                                                                              │
│  Chat history retention            [Polish]                                  │
│  Počet správ zobrazených pri otvorení workspace (staršie načítateľné cez     │
│  "Load history").                                                            │
│  ┌──────┐                                                                    │
│  │ 100  │  messages                                                          │
│  └──────┘                                                                    │
```

---

### 8.3 Approval Gates

Vlastník: `approval_settings` (Govern). Kategória: *Approval gates*.

```
│  Approval Gates                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Default permission tier for new sources                                     │
│  Aká vrstva prístupu sa automaticky priradí keď sa pridá nový zdroj.        │
│  ┌──────────────────────────────┐                                            │
│  │ Metadata only ▾              │  (Metadata only / Reference samples /      │
│  └──────────────────────────────┘   Full samples / Query results)            │
│                                                                              │
│  Execute query                                                               │
│  Kedy pýtať súhlas pred spustením AI-generovaného SQL.                      │
│  ● Always ask   ○ Never ask   ○ Threshold-based                              │
│                                                                              │
│  Share query results with AI                                                 │
│  Kedy môže AI vidieť výsledky query (riadkové dáta).                        │
│  ● Always ask   ○ Never ask   ○ Auto-reference (row count only)              │
│                                                                              │
│  Write to documentation                                                      │
│  Kedy pýtať súhlas pred zapísaním doc záznamu.                              │
│  ○ Always ask   ● Threshold-based   ○ Never ask                              │
│                                                                              │
│  Schema introspection             [Polish]                                   │
│  Čítanie názvov tabuliek a stĺpcov — najbezpečnejšia operácia.             │
│  ● Never ask   ○ Always ask                                                  │
│                                                                              │
│  Approval timeout                     [Polish]                               │
│  Po uplynutí sa čakajúci approval automaticky zamietne.                     │
│  ┌──────┐                                                                    │
│  │ 300  │  sec                                                               │
│  └──────┘                                                                    │
│                                                                              │
│  ℹ️  Nastavenia platia workspace-wide. Per-source permission tier sa mení    │
│  v Govern → source detail. Per-table/column overrides sú tiež tam.          │
```

---

### 8.4 Data & Profiling

Vlastník: `workspace_settings`, nastavenia Explore sub-modulu.

```
│  Data & Profiling                                                            │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Auto-profile on source add                                                  │
│  Automaticky spustí profiling všetkých tabuliek po pridaní zdroja.         │
│  ● On   ○ Off                                                                │
│                                                                              │
│  Schema change auto-detect                                                   │
│  Sleduje zmeny schémy (nové/zmazané stĺpce) pri každom refreshi.           │
│  ● On   ○ Off                                                                │
│                                                                              │
│  PII heuristics                                                              │
│  Automaticky navrhuje PII kandidátov na základe názvov a typov stĺpcov.    │
│  ● On   ○ Off                                                                │
│                                                                              │
│  Profile sample threshold         [Polish]                                   │
│  Tabuľky nad tento limit sa profilujú na vzorke namiesto full scan.         │
│  ┌────────────┐                                                              │
│  │ 1 000 000  │  rows                                                        │
│  └────────────┘                                                              │
│                                                                              │
│  Top values per column            [Polish]                                   │
│  Počet najpočetnejších hodnôt uchovávaných v profile.                       │
│  ┌──────┐                                                                    │
│  │  10  │  values                                                            │
│  └──────┘                                                                    │
```

---

### 8.5 Models & SQL

Vlastník: `workspace_settings`, nastavenia Model sub-modulu.

```
│  Models & SQL                                                                │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Self-heal retries                                                           │
│  Maximálny počet automatických opráv po SQL build chybe.                   │
│  ┌──────┐                                                                    │
│  │   3  │  retries   (0 = self-heal vypnutý)                                │
│  └──────┘                                                                    │
│                                                                              │
│  Parallel build concurrency                                                  │
│  Počet modelov budovaných súčasne.                                          │
│  ┌──────┐                                                                    │
│  │   4  │  models                                                            │
│  └──────┘                                                                    │
```

---

### 8.6 Documentation

Vlastník: `workspace_settings`, nastavenia Document sub-modulu.

```
│  Documentation                                                               │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Auto-write docs                                                             │
│  Uloží AI-navrhnutú dokumentáciu automaticky ak spĺňa confidence threshold. │
│  ● On   ○ Off                                                                │
│                                                                              │
│  Include sample data in docs                                                 │
│  Či doc záznamy môžu obsahovať vzorové riadky z tabuľky.                   │
│  ○ Yes (subject to permission tier)   ● No   ○ Mock only                    │
│                                                                              │
│  Doc confidence threshold                                                    │
│  Minimálna dôvera AI aby sa doc uložil bez approval (ak auto-write On).     │
│  ┌────────────────────────┐                                                  │
│  │ High ▾                 │  (High / Medium / Low)                           │
│  └────────────────────────┘                                                  │
│                                                                              │
│  Doc verbosity                                                               │
│  Miera detailu generovaných doc záznamov.                                   │
│  ┌────────────────────────┐                                                  │
│  │ Standard ▾             │  (Minimal / Standard / Detailed)                 │
│  └────────────────────────┘                                                  │
```

---

### 8.7 Testing

Vlastník: `workspace_settings`, nastavenia Test sub-modulu.

```
│  Testing                                                                     │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Auto-run tests after materialize                                            │
│  Spustí test suite automaticky po každom úspešnom model build.              │
│  ● On   ○ Off                                                                │
│                                                                              │
│  AI test generation                                                          │
│  Povolí ai-test-generator subagenta navrhovať nové testy.                  │
│  ● On   ○ Off                                                                │
│                                                                              │
│  Test parallel concurrency        [Polish]                                   │
│  Počet testov spúšťaných súčasne.                                           │
│  ┌──────┐                                                                    │
│  │   8  │  tests                                                             │
│  └──────┘                                                                    │
│                                                                              │
│  Test execution timeout           [Polish]                                   │
│  ┌──────┐                                                                    │
│  │  30  │  sec  per test                                                     │
│  └──────┘                                                                    │
│                                                                              │
│  Failing PK samples               [Polish]                                   │
│  Počet failing primary key hodnôt zobrazených v test result detaile.        │
│  ┌──────┐                                                                    │
│  │   5  │  rows                                                              │
│  └──────┘                                                                    │
```

---

### 8.8 Connections

Vlastník: `workspace_settings` + `data_sources.connection_settings_json`, nastavenia Connect sub-modulu.

```
│  Connections                                                                 │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Default query timeout                                                       │
│  Workspace-wide fallback. Per-source override v Connect → source detail.    │
│  ┌──────┐                                                                    │
│  │  30  │  sec                                                               │
│  └──────┘                                                                    │
│                                                                              │
│  ℹ️  Connection credentials (host, port, user, password) sa editujú          │
│  priamo v Connect module → source detail → Edit connection.                 │
│  Tu sú len workspace-wide defaults.                                          │
```

---

### 8.9 UI / UX

Vlastník: `localStorage` (nie DB — panel state je per-browser, nie per-workspace-account).

```
│  UI / UX                                                                     │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Dark mode                                                                   │
│  Aplikácia je primárne dark-mode. Light mode je post-MVP.                   │
│  ● Dark   ○ Light  (grayed-out — not available yet)                          │
│                                                                              │
│  ℹ️  Panel sizes (sidebar, AI chat panel, bottom panel) sa ukladajú         │
│  automaticky do localStorage pri každom resize — nie je potrebné            │
│  ich nastavovať tu. Resetovať rozloženie: "Reset panel layout" button       │
│  v User menu (avatar → Reset layout).                                       │
```

---

### 8.10 Interakcia a stavy

**Navigácia v sidebari:**
- Klik na kategóriu → instant swap obsahu (žiadna animácia, len replace)
- Aktívna kategória: `bg-surface` + `2px accent-blue` border vľavo

**Validácia:**
- Numerické polia: min/max enforced inline, nevalidná hodnota = červený border + error text pod poľom, predchádzajúca hodnota zostáva v DB
- Enum selects/radios: nemôžu byť v neplatnom stave

**Save feedback:**
- Úspech: žiadna notifikácia (zmena je okamžitá, UI sa updatuje)
- Chyba: červený inline error + Sonner toast: *"Failed to save setting. Try again."*

**Zatváranie:**
- `×` button, `Esc`, klik mimo dialog → zatvorí
- Žiadne neuložené zmeny (ukladanie je okamžité) → žiadny "Discard changes?" confirm

---

## 9. Drag & Drop interactions

Tri DnD interakcie naprieč celou app. Implementačne: `ResizablePanelGroup` (shadcn) pre panely, natívny HTML5 drag pre taby, žiadna extra DnD knižnica pre MVP.

### 9.1 Panel resize (existujúce)

Všetky resizable panely (Primary Sidebar, AI Chat Panel, Bottom Panel) majú **drag handle** — tenký 4px hit area na ich okraji s `cursor: col-resize` / `cursor: row-resize`. Vizuálne: nezobrazený v idle stave, zvýrazní sa pri hover (`bg-border-default`) a active (`bg-accent-blue`).

Implementácia: `ResizablePanelGroup` + `ResizablePanel` + `ResizableHandle` zo shadcn/ui. Rozmer sa ukladá do `localStorage` pri `onLayout` callback.

### 9.2 Tab drag-to-split

Trigger: user **uchopí tab** v tab bare a **pretiahnev ho na okraj** hlavného workspace (left edge, right edge, top, bottom). Zobrazí sa drop zone overlay:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   ┌─────────────────┐    ┌──────────────────────────────────────────┐   │
│   │                 │    │                                          │   │
│   │  DROP ZONE      │ ←→ │  Current content                        │   │
│   │  (highlight)    │    │                                          │   │
│   │                 │    │                                          │   │
│   └─────────────────┘    └──────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Drop na left/right edge** → horizontal split (dva panely vedľa seba)
- **Drop na top/bottom edge** → vertical split (dva panely nad sebou)
- **Drop späť do tab bara** → presun tabu (reorder), žiadny split
- **Drag cancel** (`Esc`) → stav sa nezmení

Split view zachová oba taby v rovnakej workspace session. Zatvoriť split: `×` na split handleri alebo zatvoriť jeden tab.

### 9.3 Drag entity do AI Context Baru `[Polish]`

Post-MVP. User môže **uchopiť tabuľku alebo stĺpec** zo Schema Navigatora a **pretiahnuť ho do Context Baru** (nad chat inputom). Výsledok = rovnaký ako checkbox alebo context menu "Add to AI context".

Vizuálne: pri drag-start sa Context Bar zvýrazní (`border-accent-blue`), drop zone sa rozšíri. Pri drop → chip sa pridá do Context Baru s fade-in animáciou.

MVP pokrytie: hover checkbox (§3.2) a context menu sú dostatočné. DnD je convenience layer, nie blocker.
