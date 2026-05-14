# Govern — UI/UX špecifikácia

*Súčasť [UI_UX.md](../UI_UX.md) · Funkčný spec: [GOAL.md](./GOAL.md)*

---

URL: `/workspace/[id]/govern`

## 1. Permissions Panel (hlavný tab)

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🛡 Govern — Permissions                                              │
├──────────────────────────────────────────────────────────────────────┤
│  SOURCE-LEVEL PERMISSION TIERS                                        │
│                                                                      │
│  warehouse.db                                                        │
│  [Metadata only ▾]                                                   │
│    ● Metadata only      — AI sees schema (L1), nothing else          │
│    ○ + Reference samples — AI sees samples of [ref] tables (L2 opt-in)│
│    ○ + Full samples     — AI sees samples of all tables (L2 all)     │
│    ○ + Query results    — AI can run queries with approval (L3)      │
│                                                                      │
│  staging.duckdb                                                      │
│  [+ Reference samples ▾]                                            │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  PER-TABLE OVERRIDES                                                 │
│                                                                      │
│  🔒 customers     Force: Metadata only  (overrides source tier)      │
│     [Edit override ▾]  [Remove override]                             │
│                                                                      │
│  [+ Add table override]                                              │
├──────────────────────────────────────────────────────────────────────┤
│  APPROVAL POLICIES                                                   │
│                                                                      │
│  Execute query (sql-writer)     [Always ask ▾]                       │
│  Share results with AI          [Always ask ▾]                       │
│  Write to docs (docs-keeper)    [Threshold-based ▾]                  │
│  Write model file (sql-writer)  [Always ask ▾] (locked)             │
│  Approval timeout               [300s ▾]                             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## 2. PII Inventory Dashboard (tab)

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🔍 PII Inventory                              [Export CSV] [⟳]      │
├──────────────────────────────────────────────────────────────────────┤
│  Filter: [All sources ▾] [All types ▾] [All statuses ▾]             │
│                                                                      │
│  Table              Column         PII Type    Status    Layer       │
│  ─────────────────────────────────────────────────────────────────   │
│  customers          email          Email       Confirmed   [L3]      │
│  customers          phone          Phone       Confirmed   [L3]      │
│  customers          first_name     Name        Confirmed   [L2]      │
│  customers          last_name      Name        Confirmed   [L2]      │
│  orders             billing_addr   Address     Review ⚠   [?]  [→]  │  ← klik = classify
│                                                                      │
│  5 PII columns · 1 needs review                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## 3. Audit Log Viewer (tab)

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📋 Audit Log                   [Filter ▾] [Export] [Search...]      │
├──────────────────────────────────────────────────────────────────────┤
│  Time        Agent           Action            Target         Result  │
│  ────────────────────────────────────────────────────────────────── │
│  14:35:22    schema-explorer  read_schema       warehouse.db   ✅     │
│  14:35:24    data-profiler    run_profile_qry   orders         ✅     │
│  14:35:26    data-profiler    sample_data       orders.amount  ✗DENY  │
│  14:35:30    sql-writer       run_select_query  orders→2847r   👤APPR │
│  14:35:45    sql-writer       write_model_file  stg_orders     👤APPR │
│  14:35:47    docs-keeper      write_doc_record  orders.desc    ✅     │
│                                                                      │
│  Legend: ✅ Auto-allowed  ✗ Blocked  👤 User approved  ⚠ Warn       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Main Workspace — Govern tabs

Klik na ikonu Govern v Activity Bare otvára Main Workspace s troma tabmi. Sidebar (Classification Navigator) zostáva vľavo.

```
┌────┬──────────────────────────────────────────────────────────────────┐
│    │  [🛡 Permissions] [🔍 PII Inventory] [📋 Audit Log]    [+]      │
│ A  ├──────────────────────────────────────────────────────────────────┤
│ C  │                                                                  │
│ T  │  < obsah aktívneho tabu — sekcie 1, 2, 3 vyššie >               │
│ I  │                                                                  │
│ V  │                                                                  │
│ I  │                                                                  │
│ T  │                                                                  │
│ Y  │                                                                  │
└────┴──────────────────────────────────────────────────────────────────┘
```

Defaultne sa otvára **Permissions** tab. Každý tab je nezávislý — zmeny v Permissions sa uložia okamžite (bez explicitného Save button), PII Inventory a Audit Log sú read-only.

**Empty states pre každý tab:**

*Permissions — prázdny workspace (nové):*
```
┌──────────────────────────────────────────────────────────────────────┐
│ 🛡 Govern — Permissions                                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  SOURCE-LEVEL PERMISSION TIERS                                        │
│                                                                      │
│  ○  No sources configured yet.                                       │
│     Add a data source in Connect to manage its permissions.          │
│     [Go to Connect →]                                                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

*PII Inventory — pred profilovaním:*
```
┌──────────────────────────────────────────────────────────────────────┐
│ 🔍 PII Inventory                                                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ○  No PII data yet.                                                 │
│     Profile your tables in Explore — the profiler will flag         │
│     PII candidates based on column naming heuristics.               │
│     [Go to Explore →]                                                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

*Audit Log — čistá session:*
```
┌──────────────────────────────────────────────────────────────────────┐
│ 📋 Audit Log                                                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ○  No AI activity recorded yet.                                     │
│     All AI agent actions will appear here once you start             │
│     working with your data.                                          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Inline Column Classification Flow

Keď user klikne na `⚠️ phone — Unset` v Classification Navigator (sidebar sekcia 3.3 v shell/UI.md), v Main Workspace sa otvorí **Classify Column Tab**:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚙ Classify: customers.phone                        [×]              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Column:   customers.phone                                           │
│  Type:     VARCHAR                                                   │
│  Profile:  not null 82% · distinct 94% · sample: "+421 9..." ⚠      │
│                                                                      │
│  GDPR LAYER                                                          │
│  (○) [L1] Schema metadata only — safe to share with AI              │
│  (○) [L2] Sample data — reference tables, no PII                    │
│  (●) [L3] PII / Sensitive — never auto-share with AI    ← suggested │
│                                                                      │
│  PII TYPE                                                            │
│  (●) Phone  (○) Email  (○) Name  (○) Address  (○) National ID       │
│  (○) Date of birth  (○) IP address  (○) Other: [           ]        │
│                                                                      │
│  ℹ️  AI suggested: Layer 3 · Phone                                   │
│     Based on column name "phone" + profile data (high distinct rate) │
│                                                                      │
│  [Cancel]                [Save classification]                       │
└──────────────────────────────────────────────────────────────────────┘
```

Po save → Classification Navigator sa okamžite updatuje (`⚠️ phone — Unset` → `🔒 phone — L3 PII`), tab sa zatvorí, záznam sa zapíše do `column_permissions` tabuľky.

**Bulk classify flow** — klik na `[Classify All Unset →]` v navigátore otvára multi-column variant:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚙ Classify Unset Columns (3)                                        │
├──────────────────────────────────────────────────────────────────────┤
│  AI suggestions pre-filled. Review and confirm each.                │
│                                                                      │
│  customers.phone    → [L3 Phone ▾]   ● AI suggested                │
│  orders.note        → [L1 ▾]         ● AI suggested                │
│  products.sku       → [L1 ▾]         ● AI suggested                │
│                                                                      │
│  [Cancel]                      [Save all classifications]            │
└──────────────────────────────────────────────────────────────────────┘
```
