# AInderstanding — UI/UX Design Index

*Working doc, slovensky. Verzia 2.0. Súčasť AInderstanding.*

> UI/UX dokumentácia je rozdelená per-modul. Tento súbor je index + cross-cutting komponenty a design systém.

---

## Moduly

| Modul | Funkčný spec | UI/UX spec |
|-------|-------------|------------|
| Shell | [shell/GOAL.md](./01-shell/GOAL.md) | [shell/UI.md](./01-shell/UI.md) |
| Connect | [connect/GOAL.md](./02-connect/GOAL.md) | [connect/UI.md](./02-connect/UI.md) |
| Explore | [explore/GOAL.md](./03-explore/GOAL.md) | [explore/UI.md](./03-explore/UI.md) |
| Govern | [govern/GOAL.md](./04-govern/GOAL.md) | [govern/UI.md](./04-govern/UI.md) |
| Model | [model/GOAL.md](./05-model/GOAL.md) | [model/UI.md](./05-model/UI.md) |
| Document | [document/GOAL.md](./06-document/GOAL.md) | [document/UI.md](./06-document/UI.md) |
| Test | [test/GOAL.md](./07-test/GOAL.md) | [test/UI.md](./07-test/UI.md) |
| Translate | [translate/GOAL.md](./08-translate/GOAL.md) | [translate/UI.md](./08-translate/UI.md) |
| Export | [export/GOAL.md](./09-export/GOAL.md) | [export/UI.md](./09-export/UI.md) |

---

## 1. Filozofia a štandardy

### Vzory na ktoré sa opierame

**VS Code + DBeaver hybrid shell** — Activity Bar (ikony vľavo) + resizable panely + tabbed workspace + AI chat ako pevný pravý panel. Toto je etablovaný štandard 2025/26 pre AI-first developer tooling (Cursor, Zed, GitHub Copilot Chat, DataGrip).

### Tri produktové princípy ktoré sa musia odrážať v UI

1. **GDPR-first je viditeľné** — klasifikácia dát nie je skrytá v nastaveniach. Je prítomná všade kde sa dáta zobrazujú. User musí na prvý pohľad vedieť, čo AI vidí a čo nie.
2. **AI je partner, nie čierna skrinka** — každá akcia agenta je viditeľná (agent name badge, tool call log, progress). User kedykoľvek vie zastaviť alebo odmietnuť.
3. **Schválenie pred zápisom** — žiadna AI akcia (write model, write doc, run query) sa nedeje bez explicitného user kliknutia. Approval nie je skrytý modal, ale prvotriednny UI element.

### Referenčné zdroje

- Shadcn/ui + Radix UI pre komponenty
- Tailwind CSS pre styling
- React Flow pre lineage DAG
- Monaco Editor pre SQL editor
- Lightweight Charts (ak budú distribučné grafy — zvážiť Recharts pre jednoduchosť)

---

## Cross-cutting UI komponenty

## 16. Cross-cutting: AI Context Selector

Toto je feature ktorá dáva userovi **explicitnú kontrolu nad tým, čo AI vidí**. Je dostupná v každom module.

### 16.1 Tri spôsoby ako pridať do AI kontextu

**A) Schema Navigator — checkbox na column/table hover:**
```
▼ 📋 orders             [L1]
  ├ ☐ id        INT PK       ← hover → zobrazí checkbox
  ├ ☑ amount    DEC   [L2]   ← vybraný → checkbox viditeľný stále
  ├ ☐ status    VAR   [L1]
  └ ☐ created   TS    [L1]
```

**B) Context menu (pravý klik) → "Add to AI context":**
Pre tabuľky, stĺpce, modely, profily.

**C) Inline button v detail taboch:**
Každý detail tab (table, column, model) má `[Add to AI context ☐]` button v headeri.

### 16.2 Context Bar (nad input v Chat Paneli)

Zobrazí všetky vybraté entity ako removable chips:

```
┌──────────────────────────────────────────────────────────────────────┐
│  CONTEXT FOR AI                                              [Clear] │
│                                                                      │
│  📋 orders (schema)  ×    ◍ orders.amount (profile)  ×             │
│  📋 customers (schema) ×   ◻ stg_orders (model SQL) ×              │
│                                                                      │
│  [+ Add more...]                                                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 16.3 Context types a čo AI vidí

| Context chip | Čo AI dostane | Layer |
|-------------|--------------|-------|
| `📋 table (schema)` | Column names, types, FK, native comments | L1 |
| `◍ column (profile)` | NULL rate, distinct count, distribution summary (bez sample values) | L1 |
| `📋 table (sample)` | Top 10 rows, PII stĺpce maskované | L2 (len ak allowed) |
| `📄 doc record` | Governance fields pre daný record | L1 |
| `◻ model (SQL)` | Kompletný SQL obsah modelu | L1 |
| `✓ test results` | Pass/fail summary, failing PK IDs | L1 |

**GDPR enforcement:** pri pridaní L2/L3 kontextu systém skontroluje permission tier. Ak nie je povolený, zobrazí:
```
⚠ orders (sample data) requires Layer 2 permission.
[Grant permission →]  [Add schema only instead]
```

### 16.4 Context Selector Modal (⌘⇧C)

Pre pokročilý výber:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Add AI Context                          [×]                          │
├──────────────────────────────────────────────────────────────────────┤
│ 🔍 Search tables, columns, models...                                 │
├─────────────────┬────────────────────────────────────────────────────┤
│ SOURCES         │  AVAILABLE CONTEXT                                 │
│  📂 warehouse.db│                                                    │
│    📋 orders    │  ☑ orders (table schema)          Layer 1  ✅     │
│    📋 customers │  ☑ orders.amount (profile)        Layer 1  ✅     │
│    ...          │  ☐ orders (sample data — 10 rows) Layer 2  ⚠     │
│                 │                                                    │
│ MODELS          │  ☐ stg_orders (model SQL)         Layer 1  ✅     │
│  📂 staging     │  ☐ dim_customer (model SQL)       Layer 1  ✅     │
│  📂 marts       │                                                    │
│                 │  ☐ customers table docs            Layer 1  ✅     │
│ DOCS            │  ☐ Business term: Customer LTV    Layer 1  ✅     │
└─────────────────┴────────────────────────────────────────────────────┘
│ Selected: 2 items                               [Add to context]    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 17. Cross-cutting: Approval Gates

Tri úrovne approval UX — podľa závažnosti akcie. Kanonické mapovanie `gateType → UI variant` je v `ARCHITECTURE.md §9 "Gate Type → UI Variant Mapping"`. Tu sú component specs a wireframes.

### Level 1 — Inline Chat Card (permission-tier soft-confirm, nie formálna gate)

Používa sa pre `guarded_sample_data` prvý prístup k reference tabuľke (Layer 2). Approval je embedded v chat správe — nie je rušivé, user vidí kontext. Na rozdiel od L2/L3 sa toto nepočíta ako "formal approval gate" v audit logu.

```
┌─ APPROVAL REQUIRED ────────────────────────────────────────────┐
│ ⚠ data-profiler žiada:                                         │
│ Sample dát z tabuľky `media_types` (reference, Layer 2)        │
│                                                                 │
│ [✓ Allow once]   [☑ Allow for session]   [✗ Deny]              │
└─────────────────────────────────────────────────────────────────┘
```

### Level 2 — Bottom Banner (SQL execution, doc write)

Žltý banner nad bottom panelom pri SQL execution alebo write_doc_record:

```
┌──────────────────────────────────────────────────────────────────┐
│ ⚠ sql-writer chce spustiť query na warehouse.db.                │
│ [View SQL ∨]   [✓ Execute]   [✗ Deny]          Timeout: 4:58   │
└──────────────────────────────────────────────────────────────────┘
```

### Level 3 — Full Modal (Layer 3 PII data, model file write)

Blokovanie celého UI. Pre najcitlivejšie akcie.

```
┌──────────────────────────────────────────────────────────────────┐
│  🔒 LAYER 3 — Explicit Approval Required                         │
├──────────────────────────────────────────────────────────────────┤
│  Agent `sql-writer` chce zobraziť výsledky query obsahujúce     │
│  PII stĺpce (customers.email — Layer 3).                         │
│                                                                  │
│  SQL:                                                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ SELECT email, amount FROM customers LIMIT 100              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  PII riziko: customers.email (Level 3)                           │
│                                                                  │
│  Dôvod prístupu (povinný):                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Verifikácia transformácie pre dokumentáciu...              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [✓ Schváliť — jednorazovo]              [✗ Zamietnuť]          │
└──────────────────────────────────────────────────────────────────┘
```

**Chat input blokovaný** (disabled) počas akéhokoľvek čakajúceho approval.

### Approval Timeout

Vizuálny countdown vo všetkých approval komponentoch. Timeout = 300s → automatic DENY.
```
Timeout: 4:47  ████████████████████░░░░░░░░  (zostatok)
```

---

## 18. Cross-cutting: Streaming a Agent Progress

### Active Agents Bar (v AI Chat Panel headeri)

Zobrazí sa počas paralelného dispatchu keď bežia 2+ agents:

```
┌────────────────────────────────────────────┐
│ ACTIVE AGENTS                              │
│ ⟳ schema-explorer · warehouse.db  (step 2/3)│
│ ⟳ schema-explorer · staging.duckdb (step 1/3)│
│ ──────────────────────────────────────────  │
│ [Stop All]                                  │
└────────────────────────────────────────────┘
```

### Streaming message anatomy

```
┌─ ◈ model-architect (Sonnet) ─────────────────────────────┐
│ Running · 1.2s                              [■ Stop]      │
│                                                           │
│ Analysing schema and profiles for dimensional model...    │
│ ▓▓▓▓▓▓▓▓░░░░                                             │
│                                                           │
│ ▶ 2 tool calls (click to expand)                         │
└───────────────────────────────────────────────────────────┘
```

Po dokončení streamingu:
```
┌─ ◈ model-architect (Sonnet) ─────────────────────────────┐
│ Completed · 4.3s                                          │
│                                                           │
│ Based on schema and profiles, I recommend:                │
│ ...                                                       │
│                                                           │
│ ▶ 3 tool calls  [copy] [feedback 👍 👎]                  │
└───────────────────────────────────────────────────────────┘
```

### Self-heal Loop Visibility

```
┌─ ◈ sql-writer (Sonnet) ──────────────────────────────────┐
│ Build failed — Self-heal attempt 1/3                      │
│                                                           │
│ Error: column "discount" does not exist                   │
│ Analysing...                                              │
│                                                           │
│ Proposed fix: Add COALESCE(o.discount_pct, 0)            │
│                                                           │
│ [✓ Approve fix]  [✗ Stop self-heal]                      │
└───────────────────────────────────────────────────────────┘
```

---

## 19. Cross-cutting: GDPR Visual System

### Layer badges (konzistentné naprieč celou app)

```
[L1]  ← zelený text, zelený border  — Schema metadata, ALLOW
[L2]  ← žltý text, žltý border     — Sample data, default DENY
[L3]  ← červený text, červený border — Query results + PII, DENY
[?]   ← sivý text, sivý border     — Unclassified, potrebuje review
```

### PII column vizualizácia

V každej tabuľkovej grille kde sa zobrazujú dáta:
- PII stĺpce sú **vždy maskované** ak sú L3 a nie je explicitný L3 approval
- Format maskovania: `[EMAIL_MASKED]`, `[PHONE_MASKED]`, `[NAME_MASKED]`, atď.
- Maskovanie je v UI **explicitné** — user vidí že pole existuje ale je skryté

### GDPR Banner (pri L3 výsledkoch)

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🔒 Query results contain L3 data. AI nevidí tieto výsledky.         │
│ [Share top 10 rows with AI →]  [Share row count only →]  [Don't share]│
└──────────────────────────────────────────────────────────────────────┘
```

---

## 20. Command Palette

Trigger: `⌘K`. Vždy dostupné, naprieč všetkými modulmi.

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⌘K  🔍 Type a command or search...                                  │
├──────────────────────────────────────────────────────────────────────┤
│  RECENT                                                              │
│  → Explore: orders                                                   │
│  → Classify: orders.amount                                           │
│  → Build All Models                                                  │
│                                                                      │
│  NAVIGATION                                                          │
│  → Go to Connect                               ⌘1                   │
│  → Go to Explore                               ⌘2                   │
│  → Go to Govern                                ⌘3                   │
│  → Go to Model                                 ⌘4                   │
│  → Go to Document                              ⌘5                   │
│  → Go to Test                                  ⌘6                   │
│  → Go to Export                                ⌘7                   │
│                                                                      │
│  AI                                                                  │
│  → Switch AI mode...                                                 │
│  → Add to AI context...                        ⌘⇧C                  │
│  → Clear AI context                                                  │
│  → Stop current agent                          ⌘.                   │
│                                                                      │
│  ACTIONS                                                             │
│  → Add data source                                                   │
│  → Profile all tables                                                │
│  → Build all models                            ⌘⇧B                  │
│  → Run all tests                               ⌘⇧T                  │
│  → Export workspace                                                  │
│  → Open settings                               ⌘,                   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 21. Design systém

### Farebné tokeny

```css
/* Backgrounds — layered tmavé */
--bg-base:      #0D1117   /* app background */
--bg-elevated:  #161B22   /* sidebars, panels */
--bg-surface:   #1C2333   /* cards, inputs, hover */
--bg-overlay:   #21262D   /* modals, dropdowns */

/* Text */
--text-primary:   #E6EDF3
--text-secondary: #8B949E
--text-muted:     #6E7681
--text-accent:    #58A6FF  /* links, focus */

/* Borders */
--border-default: #30363D
--border-subtle:  #21262D
--border-focus:   #58A6FF

/* Accent — AI / brand */
--accent-ai:    #7C6AF7   /* purple — AI actions, agent badges */
--accent-blue:  #58A6FF   /* links, CTAs */

/* GDPR Layer system */
--layer-1:      #3FB950   /* green — L1 safe */
--layer-2:      #D29922   /* amber — L2 restricted */
--layer-3:      #F85149   /* red — L3 PII */
--layer-unknown:#8B949E   /* gray — unclassified */

/* States */
--success: #3FB950
--warning: #D29922
--error:   #F85149
--info:    #58A6FF

/* Model build states */
--built:      #3FB950  /* green */
--stale:      #D29922  /* amber */
--not-built:  #6E7681  /* gray */
--running:    #58A6FF  /* blue + pulse */
--failed:     #F85149  /* red */
```

### Typografia

```
Font stack:  Inter (UI), JetBrains Mono (code, SQL, JSON)

Sizes:
  12px  caption, badges, status bar
  13px  body, list items, sidebar items
  14px  default text, inputs
  16px  section headers
  20px  module titles
  24px  workspace name
```

### Spacing system

4px base grid (Tailwind default). Konzistentné spacery:
- Kompaktné (sidebar items): 4px padding v/h, 8px medzi items
- Štandard (cards, panels): 16px padding
- Spacious (dialógy, onboarding): 24px padding

### Komponenty (shadcn/ui mapovanie)

| UI element | Komponent |
|-----------|-----------|
| Sidebar | `ResizablePanelGroup + ResizablePanel` |
| Tabbed workspace | `Tabs` s custom tab bar |
| Data grid | `Table` (pre menšie datasety) alebo virtualizovaná custom grid |
| Dropdowns | `DropdownMenu` |
| Modals | `Dialog` |
| Approval cards | custom Card s Radix AlertDialog základ |
| Badges | `Badge` s custom GDPR variants |
| Toast notifs | `Sonner` (odporúčaný shadcn partner) |
| Command palette | `Command` (cmdk) |
| SQL Editor | `@monaco-editor/react` |
| Lineage DAG | `@xyflow/react` |
| Chat input | `Textarea` s auto-resize |
| Progress bars | custom `div` s CSS transition |
| Tooltips | `Tooltip` (Radix) |

---

## 22. Responzivita a panel management

### Breakpoints

| Viewport | Layout zmena |
|---------|-------------|
| < 1280px | AI Chat Panel defaultne zatvorený |
| < 1024px | Primary Sidebar defaultne zatvorený |
| < 768px | Tablet mode: Activity Bar + Main only, Chat = full-screen overlay |

Aplikácia je primárne **desktop-first** (data tool workflow vyžaduje priestor). Mobile nie je v scope MVP.

### Panel state persistence

Stav panelov (open/closed, šírky) je uložený v `localStorage` per workspace. User nemusí každý raz nastavovať rozloženie.

### Split workspace

V main workspace oblasti je možné otvoriť **split view** (horizontal alebo vertical):
- Napríklad: Lineage DAG (vľavo) + SQL Editor (vpravo)
- Alebo: Table schema (vľavo) + Column profile (vpravo)
- Trigger: `⊟ Split` button v tab bare, alebo drag tab na okraj

---

## 23. Keyboard skratky

| Skratka | Akcia |
|---------|-------|
| `⌘K` | Command Palette |
| `⌘B` | Toggle Primary Sidebar |
| `⌘⇧A` | Toggle AI Chat Panel |
| `⌘J` | Toggle Bottom Panel |
| `⌘1` – `⌘7` | Navigácia medzi modulmi (Connect → Export) |
| `⌘⇧C` | Otvoriť Context Selector |
| `⌘⇧B` | Build All Models |
| `⌘⇧T` | Run All Tests |
| `⌘.` | Stop current agent |
| `⌘↵` | Odoslať chat správu |
| `⌘,` | Otvoriť Settings |
| `⌘W` | Zavrieť aktívny tab |
| `⌘⇧W` | Zavrieť všetky taby |
| `Esc` | Zavrieť modal / zavrieť command palette |
| `F5` | Re-run last action (profile / build / test) |

---

## 24. Open UX questions

Tieto body potrebujú rozhodnutie pred implementáciou:

- **Document module layout** — Je lepšie mať docs panel naľavo a chat napravo (ako navrhnuté), alebo rozdeliť Document na dve pod-stránky (Interview view vs. Browse docs view)?
- **Column context checkboxes v navigátore** — Sú checkboxes (hover-to-reveal) UX správne, alebo je lepší explicit "AI Context mode" toggle ktorý aktivuje výber naprieč celým navigátorom?
- **Approval fatigue prevention** — Koľko approvals za session je acceptovateľných? Odporúčam implementovať "Approve and remember for this session" pre L2 čo najskôr.
- **First-run onboarding** — Chýba nám onboarding flow: welcome screen, guided setup (Add source → Profile → Start interview). Pridať ako post-MVP?
- **Dark mode only, alebo light mode support?** — Pre BI/data tools je dark mode dominantný štandard. Light mode ako follow-up.

---

## References

- Parent: [AINDERSTANDING.md](./AINDERSTANDING.md)
- Shell: [shell/GOAL.md](./01-shell/GOAL.md) — routing, GlobalChatPanel, supervisor
- Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md) — komponenty, DB schema
- Sub-module GOALs: [connect/GOAL.md](./02-connect/GOAL.md) | [explore/GOAL.md](./03-explore/GOAL.md) | [govern/GOAL.md](./04-govern/GOAL.md) | [model/GOAL.md](./05-model/GOAL.md) | [document/GOAL.md](./06-document/GOAL.md) | [test/GOAL.md](./07-test/GOAL.md) | [export/GOAL.md](./09-export/GOAL.md)
