# Document — UI/UX špecifikácia

*Súčasť [UI_UX.md](../UI_UX.md) · Funkčný spec: [GOAL.md](./GOAL.md)*

---

URL: `/workspace/[id]/document`

## 1. Layout — Document je špeciálny

Document má iné rozloženie ako ostatné moduly: **chat je primárny workflow**, docs panel je sekundárny. Preto GlobalChatPanel v pravom sidepaneli hrá ústrednejšiu rolu.

```
┌────────────────────────────────────┬───────────────────────────────────┐
│  DOCS PANEL (left, mení sa)        │  AI CHAT (right, primárne)         │
│  560px                             │  plný chat panel s doc kontextom   │
│  ┌──────────────────────────────┐  │                                    │
│  │ 📋 orders                    │  │  ┌─ ◈ interviewer (Sonnet) ──────┐ │
│  │ description:                 │  │  │ Vidím že tabuľka `customers` │ │
│  │ "Order records from..."      │  │  │ nemá ownerа. Kto je za ňu    │ │
│  │ [DB native] ● high           │  │  │ zodpovedný?                  │ │
│  │                              │  │  └──────────────────────────────┘ │
│  │ owner: (empty) ⚠             │  │                                    │
│  │ domain: Sales                │  │  ┌─ 👤 You ────────────────────┐  │
│  │ classification: Internal     │  │  │ Finance team vlastní customers│ │
│  │ tags: transactions, core     │  │  └────────────────────────────┘  │
│  │                              │  │                                    │
│  │ COLUMNS (8/8)    coverage ██ │  │  ┌─ ◈ docs-keeper (Haiku) ────┐  │
│  │ id       ✅ documented       │  │  │ ✓ Saved: customers.owner   │  │
│  │ amount   ⚠ low confidence   │  │  │   = "Finance team"          │  │
│  │ ...                          │  │  │ (user_confirmed · high)     │  │
│  └──────────────────────────────┘  │  └────────────────────────────┘  │
└────────────────────────────────────┴───────────────────────────────────┘
```

## 2. Doc Record Detail View

Drill-down view pre jeden doc record (table alebo column):

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📋 customers — Table Documentation                     [✎ Edit]     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  description          [DB native] ● high conf                       │
│  "Customer master data imported from CRM system."                    │
│                                                                      │
│  business_definition  [AI gen] ● med conf          [⚠ Review]      │
│  "Unique set of all customers who have made at least one purchase."  │
│                                                                      │
│  owner                [User confirmed] ● high conf                  │
│  "Finance team"                                                      │
│                                                                      │
│  classification       [User confirmed] ● high conf                  │
│  Restricted (contains PII)                                           │
│                                                                      │
│  domain               [AI gen] ● med conf                           │
│  Sales / CRM                                                         │
│                                                                      │
│  tags                                                                │
│  [customers] [core] [pii] [crm]  [+ Add tag]                        │
│                                                                      │
│  COLUMNS COVERAGE  ████████░░ 75% (6/8 documented)                  │
│                                                                      │
│  [Ask AI to complete gaps →]                                         │
└──────────────────────────────────────────────────────────────────────┘
```

**Source attribution badges:**
- `[DB native]` modrý = z DB komentáru
- `[AI gen]` fialový = AI inference
- `[User confirmed]` zelený = explicitne user potvrdil v chate
- `[User authored]` tmavozelený = user napísal priamo v edit forme

## 3. Coverage Dashboard

Zobrazí sa v Document landing view (keď nie je otvorený konkrétny record):

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📊 Documentation Coverage                                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  OVERALL SCORE    72%  ████████████████████░░░░░░                    │
│  ⚠ Target: 70%  ✅ Reached!                                         │
│                                                                      │
│  Tables         40%  →  8/10  ██████████████████████████████░░  92% │
│  Columns        35%  →  45/82 ██████████████████░░░░░░░░░░░░  55%  │
│  Business Terms 15%  →  5/5   ██████████████████████████████  100% │
│  Relationships  10%  →  6/12  ███████████████░░░░░░░░░░░░░░   50%  │
│                                                                      │
│  TOP GAPS                                                            │
│  • orders.note — no description (critical path column)               │
│  • products.* — 6/15 columns undocumented                           │
│  • Relationship: orders.customer_id → customers.id (missing desc)   │
│                                                                      │
│  [Continue Interview →]  [Jump to gaps →]                           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Doc Record Edit Form

Priamy edit — alternatíva k chat-u. Otvára sa cez `[✎ Edit]` v Doc Record Detail View. Inline v tom istom paneli (nie modal).

```
┌──────────────────────────────────────────────────────────────────────┐
│ ✎ Edit — customers (Table)                       [Cancel] [Save]    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  description                                                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Customer master data imported from CRM system.               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  business_definition                                                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Unique set of all customers who have made at least one       │   │
│  │ purchase.                                                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  owner                          domain                               │
│  ┌──────────────────────────┐   ┌────────────────────────────┐      │
│  │ Finance team             │   │ Sales / CRM                │      │
│  └──────────────────────────┘   └────────────────────────────┘      │
│                                                                      │
│  classification                                                      │
│  (○) Public  (○) Internal  (●) Restricted  (○) PII                  │
│                                                                      │
│  tags  (enter to add)                                                │
│  [customers ×] [core ×] [pii ×]  ┌────────────┐                    │
│                                   │ new tag... │                    │
│                                   └────────────┘                    │
│                                                                      │
│  ℹ️  Uložené záznamy dostanú source attribution: [User authored]     │
└──────────────────────────────────────────────────────────────────────┘
```

Po save → `source=user_authored`, `confidence=high`. Validation: `description` je required pre uloženie (ostatné polia optional).

---

## 5. Business Terms View

Otvára sa kliknutím na "Business Terms" v sidebar navigátore.

**Zoznam termínov:**

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📝 Business Terms                             [+ Add term] [AI ✨]   │
├──────────────────────────────────────────────────────────────────────┤
│  🔍 Search terms...                                                  │
│                                                                      │
│  Term                  Domain         Confidence   Source            │
│  ────────────────────────────────────────────────────────────────    │
│  Customer LTV          Sales/CRM      ● high       [User confirmed] │
│  Net Revenue           Finance        ● high       [User confirmed] │
│  Churn Rate            Sales          ● med        [AI gen] ⚠       │
│  Gross Margin          Finance        ● med        [AI gen] ⚠       │
│  Active Customer       Sales/CRM      ○ low        [AI gen] ⚠       │
│                                                                      │
│  5 terms · 2 need review                                             │
└──────────────────────────────────────────────────────────────────────┘
```

**Term Detail Tab** (klik na term → otvára tab v main workspace):

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📝 Customer LTV                   [✎ Edit]  [Add to AI context ☐]   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  term             [User confirmed] ● high conf                       │
│  "Customer LTV"                                                      │
│                                                                      │
│  definition       [User confirmed] ● high conf                       │
│  "Cumulative net revenue generated by a single customer across all   │
│  time, net of returns and discounts."                                │
│                                                                      │
│  synonyms                                                            │
│  Customer Lifetime Value · CLV · LTV                                 │
│                                                                      │
│  domain           [AI gen] ● med conf                               │
│  Sales / CRM                                                         │
│                                                                      │
│  examples                                                            │
│  "Customer A: €2,847 LTV over 3 years"                              │
│                                                                      │
│  USED IN MODELS                                                      │
│  dim_customer.lifetime_value  ·  fct_sales (derived)                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Empty state (žiadne business terms):**

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📝 Business Terms                                                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│              ○  No business terms yet                                │
│                                                                      │
│              Business terms capture shared definitions your         │
│              team uses — "Customer LTV", "Active User", etc.        │
│                                                                      │
│              [Start Interview →]   [+ Add manually]                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. Relationships View

Otvára sa kliknutím na "Relationships" v sidebar navigátore.

**Zoznam vzťahov:**

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🔗 Relationships                              [+ Add] [AI detect ✨] │
├──────────────────────────────────────────────────────────────────────┤
│  🔍 Search...   Filter: [All types ▾] [All sources ▾]               │
│                                                                      │
│  From                    →  To                  Type    Confidence   │
│  ────────────────────────────────────────────────────────────────    │
│  orders.customer_id      →  customers.id        fk      ● high      │
│  orders.product_id       →  products.id         fk      ● high      │
│  invoices.customer_id    →  customers.id        fk      ● high      │
│  stg_orders.customer_id  →  northwind.customers logical ● med  ⚠   │
│                                                                      │
│  4 relationships · 1 cross-source · 1 needs review                  │
└──────────────────────────────────────────────────────────────────────┘
```

**Relationship Detail Tab** (klik na riadok):

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🔗 orders.customer_id → customers.id              [✎ Edit]          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  type          [DB native] ● high conf                               │
│  FK (foreign key constraint)                                         │
│                                                                      │
│  description   [AI gen] ● med conf               [⚠ Review]        │
│  "Each order belongs to exactly one customer."                       │
│                                                                      │
│  cardinality   [AI gen] ● high conf                                  │
│  N:1  (many orders per customer)                                     │
│                                                                      │
│  source        warehouse.db                                          │
│  Detected:     schema introspection (FK constraint)                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

Cross-source `logical` typ (bez DB FK constraint) má badge `[logical]` namiesto `[DB native]` a `confidence=medium`.

**Empty state:**

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🔗 Relationships                                                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│              ○  No relationships documented yet                      │
│                                                                      │
│              FK relationships from schema introspection will        │
│              appear here automatically after profiling.             │
│                                                                      │
│              [Profile tables first →]   [+ Add manually]           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7. Conventions View

Otvára sa kliknutím na "Conventions" v sidebar navigátore. Conventions sú workspace-level naming/style pravidlá (napr. "stĺpce sú snake_case", "timestamps majú suffix `_at`").

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📐 Conventions                                       [+ Add]        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Naming conventions                      [User authored] ✅  │   │
│  │  "All column names are snake_case. Timestamp columns end     │   │
│  │   with _at (created_at, updated_at). ID columns end with     │   │
│  │   _id."                                                      │   │
│  │  [✎ Edit]  [🗑 Delete]                                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Currency convention                     [User confirmed] ✅ │   │
│  │  "All monetary values are stored in EUR cents (integer),     │   │
│  │   not decimal. Display layer divides by 100."               │   │
│  │  [✎ Edit]  [🗑 Delete]                                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  +  Add convention                                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

Conventions sú free-form text záznamy bez pevnej field štruktúry. Exportujú sa do `docs/conventions.md` v dbt export balíku.

**Empty state:**

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📐 Conventions                                                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│              ○  No conventions documented yet                        │
│                                                                      │
│              Capture naming rules, formatting standards, and        │
│              business logic conventions your team follows.          │
│                                                                      │
│              [+ Add first convention]                               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 8. AI Context v Document module

Doc records sú kľúčový kontext pre AI — pridávajú sa cez `[Add to AI context ☐]` button v detail taboch (sekcia 2, 5), alebo cez `⌘⇧C` Context Selector Modal.

Dostupné context typy z Document:
- `📄 table doc` — governance fields pre danú tabuľku (owner, classification, domain)
- `📄 column doc` — business_definition, logical_type, valid_values
- `📝 business term` — definícia termínu vrátane synonyms a examples
- `🔗 relationship` — vzťah s cardinality a description
