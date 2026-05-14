# Connect — UI/UX špecifikácia

*Súčasť [UI_UX.md](../UI_UX.md) · Funkčný spec: [GOAL.md](./GOAL.md)*

---

## 1. Filozofia a inšpirácia

Connect je **prvý dojem** — user sem príde hneď po otvorení aplikácie. Musí pôsobiť moderne, jasne, a dôveryhodne (pracujeme s DB credentials).

**Inšpirácia:** Railway / Supabase (live status cards), Airbyte (step-by-step wizard), DataGrip (DB type picker), Linear (empty states), Retool (resource grid).

**Čo robiť:** veľké vizuálne DB type ikony, live pulsujúci status dot, bohatý test connection výsledok (nie len "OK"), connection string live parsing, masked credentials.

**Čo nerobiť:** generic "form in a modal", stack trace chybové hlášky, "Loading..." bez progress kontextu.

---

## 2. Workspace List — landing page

URL: `/` alebo `/workspaces`

**Normálny stav (má workspaces):**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ◈  AInderstanding                                          [+ New workspace] │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Recent                                                                      │
│  ─────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  ┌────────────────────────────────────┐  ┌──────────────────────────────┐   │
│  │ ◈  my_project                      │  │ ◈  test_workspace             │   │
│  │                                    │  │                              │   │
│  │  2 sources · 6 models · 20 tests   │  │  1 source · draft            │   │
│  │                                    │  │                              │   │
│  │  ●̈ warehouse.db   Postgres         │  │  ●̈ northwind.db  MySQL       │   │
│  │  ●̈ staging.duckdb DuckDB           │  │                              │   │
│  │                                    │  │  Coverage: 0%                │   │
│  │  Coverage ████████░░ 72%           │  │  Not started                 │   │
│  │                                    │  │                              │   │
│  │  Opened 2 hours ago                │  │  Opened 3 days ago           │   │
│  │                                    │  │                              │   │
│  │  [Open →]          [⋮ more]        │  │  [Open →]        [⋮ more]   │   │
│  └────────────────────────────────────┘  └──────────────────────────────┘   │
│                                                                              │
│  ┌────────────────────────────────────┐                                      │
│  │  +  New workspace                  │                                      │
│  └────────────────────────────────────┘                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

Workspace karta: ~340px × 160px, horný accent bar (zelená = active, žltá = warnings, sivá = draft), live status doty pri sources, coverage bar z Document modulu, `[⋮ more]` menu: Rename / Duplicate / Archive / Delete.

**Empty state (nový user):**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ◈  AInderstanding                                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                         ┌─────────────────────────┐                         │
│                         │   ◈◈◈                   │                         │
│                         │                         │                         │
│                         │  Build your first       │                         │
│                         │  datamart               │                         │
│                         │                         │                         │
│                         │  Connect your database, │                         │
│                         │  let AI understand it,  │                         │
│                         │  export to dbt.         │                         │
│                         │                         │                         │
│                         │  [Create workspace →]   │                         │
│                         │  ── or try a demo ──    │                         │
│                         │  [Load Chinook demo]    │                         │
│                         └─────────────────────────┘                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

Demo workspace predvyplní Chinook DB (SQLite bundled) — pre onboarding a testovanie.

---

## 3. Workspace Create flow

URL: `/workspaces/new` — len name + description, zdroje sa pridávajú neskôr.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ◈  New workspace                                                [×]         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                    ┌─────────────────────────────────────┐                  │
│                    │  Workspace name                     │                  │
│                    │  ┌─────────────────────────────┐   │                  │
│                    │  │ e.g. "sales_datamart"       │   │                  │
│                    │  └─────────────────────────────┘   │                  │
│                    │                                     │                  │
│                    │  Description  (optional)            │                  │
│                    │  ┌─────────────────────────────┐   │                  │
│                    │  │ What is this datamart for?  │   │                  │
│                    │  └─────────────────────────────┘   │                  │
│                    │                                     │                  │
│                    │  [Cancel]    [Create workspace →]   │                  │
│                    └─────────────────────────────────────┘                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

Po vytvorení → automatický redirect na `/workspace/[id]/connect` s "Add your first data source" promptom.

---

## 4. Connect Module — hlavný pohľad

URL: `/workspace/[id]/connect`

**Stav: má sources:**

```
┌────┬───────────────────────────────────────────────────────────┬───────────┐
│    │  SOURCES IN "my_project"                      [+ Add]     │  AI CHAT  │
│    ├───────────────────────────────────────────────────────────┤           │
│ A  │                                                           │  (sidebar)│
│ C  │  ┌────────────────────────────────────────────────────┐  │           │
│ T  │  │  🐘 warehouse.db                        ●̈ Live    │  │           │
│ I  │  │  PostgreSQL · localhost:5432 · public              │  │           │
│ V  │  │                                                    │  │           │
│ I  │  │  12 tables · 3 views · Last checked 2 min ago      │  │           │
│ T  │  │  GDPR tier: [Metadata only ▾]                      │  │           │
│ Y  │  │                                                    │  │           │
│    │  │  [⟳ Test]   [✎ Edit]   [👁 Browse]   [⋮]         │  │           │
│    │  └────────────────────────────────────────────────────┘  │           │
│    │                                                           │           │
│    │  ┌────────────────────────────────────────────────────┐  │           │
│    │  │  🦆 staging.duckdb                      ●̈ Live    │  │           │
│    │  │  DuckDB · ./data/staging.db                        │  │           │
│    │  │                                                    │  │           │
│    │  │  6 tables · Last checked 5 min ago                 │  │           │
│    │  │  GDPR tier: [+ Reference samples ▾]               │  │           │
│    │  │                                                    │  │           │
│    │  │  [⟳ Test]   [✎ Edit]   [👁 Browse]   [⋮]         │  │           │
│    │  └────────────────────────────────────────────────────┘  │           │
│    │                                                           │           │
│    │  ┌────────────────────────────────────────────────────┐  │           │
│    │  │  +  Add data source                                │  │           │
│    │  └────────────────────────────────────────────────────┘  │           │
└────┴───────────────────────────────────────────────────────────┴───────────┘
```

**Stav: prázdny (po vytvorení workspace):**

```
┌────────────────────────────────────────────────────────────────────────────┐
│  SOURCES IN "my_project"                                        [+ Add]    │
├────────────────────────────────────────────────────────────────────────────┤
│                 ┌─────────────────────────────────────┐                   │
│                 │  🔌                                 │                   │
│                 │  No data sources yet                │                   │
│                 │                                     │                   │
│                 │  Connect your database to start     │                   │
│                 │  exploring and building your        │                   │
│                 │  datamart.                          │                   │
│                 │                                     │                   │
│                 │  Supported: PostgreSQL, MySQL,      │                   │
│                 │  SQL Server, DuckDB                 │                   │
│                 │                                     │                   │
│                 │  [+ Add first data source →]        │                   │
│                 └─────────────────────────────────────┘                   │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Source Cards — stavy a anatomy

**Anatomy karty:**

```
┌────────────────────────────────────────────────────────────┐
│ [db-icon]  [name]                         [status dot]     │  ← header row
│            [db-type · host · db-name]     [status text]    │  ← subtitle
├────────────────────────────────────────────────────────────┤
│  [N tables]  ·  [N views]  ·  [last checked X ago]         │  ← metadata row
│  GDPR tier:  [Metadata only ▾]                              │  ← quick tier selector
├────────────────────────────────────────────────────────────┤
│  [⟳ Test]    [✎ Edit]    [👁 Browse]    [⋮ More]           │  ← actions row
└────────────────────────────────────────────────────────────┘
```

**DB type ikony** — každý typ má vlastnú ikonu a accent farbu (v produkcii SVG logo, nie emoji):

| DB typ | Ikona | Accent farba |
|--------|-------|-------------|
| PostgreSQL | 🐘 slon | `#336791` modrá |
| MySQL | 🐬 delfín | `#F29111` oranžová |
| SQL Server | Ⓜ | `#0078D4` modrá |
| DuckDB | 🦆 kačica | `#FFF000` žltá |

**Status stavy:**

```
●̈ Live      — zelený pulse dot (CSS animation: pulse 2s infinite)
⟳ Testing   — spinner, počas test connection
⚠ Slow      — žltý, latencia > 2 000ms
✗ Error     — červený + posledná chyba + [⟳ Retry]
○ Untested  — sivý, nikdy netestovaný
✗ Offline   — červený, spojenie spadlo počas session
```

**Overflow menu `[⋮ More]`:**

```
┌─────────────────────────┐
│  ⟳  Test connection     │
│  ✎  Edit configuration  │
│  👁  Browse schema       │
│  ─────────────────────  │
│  ⎘  Duplicate source    │
│  ─────────────────────  │
│  ⚠  Change GDPR tier    │
│  ─────────────────────  │
│  🗑  Remove source       │  ← červené, vyžaduje confirm
└─────────────────────────┘
```

---

## 6. Add Source Wizard

Otvorí sa ako **full-page overlay** (nie drawer, nie modal) — connection setup si zaslúži priestor.

URL: `/workspace/[id]/connect/new`

**Krok 1 — Vyber typ databázy:**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ◈  Add Data Source                                              [×] Cancel  │
│                                                                              │
│     Step 1 of 3           Step 2          Step 3                            │
│     ──────●───────────────○───────────────○                                 │
│     Choose type       Configure         Verify                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Choose your database type                                                   │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                │
│  │                          │  │                          │                │
│  │   🐘                     │  │   🐬                     │                │
│  │                          │  │                          │                │
│  │   PostgreSQL             │  │   MySQL                  │                │
│  │   Most common, great     │  │   Popular for web apps   │                │
│  │   performance            │  │                          │                │
│  └──────────────────────────┘  └──────────────────────────┘                │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                │
│  │                          │  │                          │                │
│  │   Ⓜ                     │  │   🦆                     │                │
│  │                          │  │                          │                │
│  │   SQL Server             │  │   DuckDB                 │                │
│  │   Microsoft ecosystem    │  │   Local analytical DB,   │                │
│  │                          │  │   perfect for files      │                │
│  └──────────────────────────┘  └──────────────────────────┘                │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Coming soon: Snowflake · BigQuery · Redshift · Databricks                   │
│                                                                              │
│                                                    [Next: Configure →]       │
└──────────────────────────────────────────────────────────────────────────────┘
```

Hover na kartu = zvýraznený border (accent farba podľa DB typu). Klik = selected state (filled border + check icon v rohu).

**Krok 2 — Konfigurácia (PostgreSQL):**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ◈  Add Data Source — PostgreSQL                                 [×] Cancel  │
│                                                                              │
│     Step 1          Step 2 of 3          Step 3                             │
│     ────●───────────────●────────────────○                                  │
│     Choose type     Configure          Verify                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Connection mode                                                             │
│  (●) Form-based        (○) Connection string                                 │
│                                                                              │
│  Source name  (identifier v AIBIo)                                           │
│  ┌──────────────────────────────────────┐                                   │
│  │ e.g. "warehouse", "production_db"    │                                   │
│  └──────────────────────────────────────┘                                   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  CONNECTION DETAILS                                                  │   │
│  │                                                                      │   │
│  │  Host                              Port                              │   │
│  │  ┌────────────────────────────┐   ┌──────────┐                      │   │
│  │  │ localhost                  │   │ 5432     │                      │   │
│  │  └────────────────────────────┘   └──────────┘                      │   │
│  │                                                                      │   │
│  │  Database name                                                       │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │ warehouse                                                    │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  Username                          Password                          │   │
│  │  ┌────────────────────────────┐   ┌────────────────────────┐        │   │
│  │  │ admin                      │   │ ●●●●●●●●           👁  │        │   │
│  │  └────────────────────────────┘   └────────────────────────┘        │   │
│  │                                                                      │   │
│  │  SSL / TLS  [Prefer ▾]  (Disabled/Allow/Prefer/Require/Verify-full) │   │
│  │                                                                      │   │
│  │  Schema  (optional, leave blank for all)                             │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │ public                                                       │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ⚠️  Credentials are stored in plain text in the local SQLite database.      │
│     Do not use production credentials in the current version.                │
│                                                                              │
│  [← Back]                          [Test Connection first →]                │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Krok 2 — DuckDB variant** (lokálny súbor — iné polia):

```
│  File path                                                              │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │ ./data/warehouse.duckdb                                       │     │
│  └───────────────────────────────────────────────────────────────┘     │
│  [Browse files...]                                                      │
│  ℹ️  Relative path je relatívna k AIBIo data directory.                 │
```

**Krok 3 — Verify:**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ◈  Add Data Source — PostgreSQL                                 [×] Cancel  │
│                                                                              │
│     Step 1          Step 2          Step 3 of 3                             │
│     ────●───────────────●───────────────●                                   │
│     Choose type     Configure          Verify                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  ✅  Connection established                              48 ms        │  │
│  │  ✅  Authentication successful                           52 ms        │  │
│  │  ✅  Database "warehouse" accessible                     61 ms        │  │
│  │  ✅  SELECT-only enforcement verified                    65 ms        │  │
│  │  ✅  Schema introspection preview                        98 ms        │  │
│  │                                                                       │  │
│  │  TOTAL                                                  98 ms        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  CONNECTION DETAILS                                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL 15.3 · localhost:5432 · database: warehouse               │  │
│  │  Tables detected: 12  ·  Views: 3  ·  Schemas: public                │  │
│  │  Read-only mode: ✅ confirmed                                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  [← Back to configure]                    [Save & Start Exploring →]        │
└──────────────────────────────────────────────────────────────────────────────┘
```

Každý riadok testu sa objavuje s 200ms stagger — user vidí reálny progress, nie instant "OK".

Po "Save & Start Exploring" → progress overlay → automatický redirect na Explore po dokončení introspection.

---

## 7. Edit Source — slide-over drawer

Na rozdiel od Add (full-page), Edit je **slide-over drawer** z pravej strany (slide-in 300ms ease-out). Workflow je kratší.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [main content — dimmed overlay]          │  Edit Source                 [×] │
│                                           ├─────────────────────────────────┤ │
│                                           │  🐘 warehouse.db               │ │
│                                           │  PostgreSQL                     │ │
│                                           │                                 │ │
│                                           │  Source name                    │ │
│                                           │  ┌───────────────────────────┐  │ │
│                                           │  │ warehouse.db              │  │ │
│                                           │  └───────────────────────────┘  │ │
│                                           │                                 │ │
│                                           │  ── Connection details ──────── │ │
│                                           │  Host         Port              │ │
│                                           │  [localhost ] [5432 ]           │ │
│                                           │  Database                       │ │
│                                           │  [warehouse                   ] │ │
│                                           │  Username      Password         │ │
│                                           │  [admin      ] [●●●●●●●● 👁]   │ │
│                                           │  SSL: [Prefer ▾]               │ │
│                                           │                                 │ │
│                                           │  [⟳ Test connection]            │ │
│                                           │  ●̈ Live · 48ms (checked now)    │ │
│                                           │                                 │ │
│                                           │  [Cancel]       [Save changes]  │ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Test Connection — rich feedback

Nie len ping — **5-krokový verification sequence** v reálnom čase.

**Priebeh (kroky sa objavujú postupne):**

```
┌───────────────────────────────────────────────────────────────────────┐
│  Testing connection...                                                │
│  ✅ Host resolved                                           2 ms      │
│  ✅ TCP connection OK                                      28 ms      │
│  ✅ PostgreSQL handshake                                   35 ms      │
│  ⟳ Authenticating...                                                 │
└───────────────────────────────────────────────────────────────────────┘
```

**Úspešný výsledok:**

```
┌───────────────────────────────────────────────────────────────────────┐
│  ✅  Connection successful                                             │
│  ✅  Host resolved       2 ms  ·  TCP  28 ms  ·  Auth  35 ms          │
│  ✅  Database accessible 42 ms  ·  SELECT-only  48 ms                 │
│                                                                       │
│  PostgreSQL 15.3 · localhost:5432 · warehouse                         │
│  Tables: 12  · Views: 3 · Schemas: public                             │
│  ⏱  Total: 48 ms  ← zelené (< 500ms = "Good")                        │
└───────────────────────────────────────────────────────────────────────┘
```

**Latency farebné kódovanie:** `< 500ms` zelená "Good" · `500ms–2s` žltá "Acceptable" · `> 2s` červená "Slow".

**Chybový výsledok (ECONNREFUSED):**

```
┌───────────────────────────────────────────────────────────────────────┐
│  ✗  Connection failed                                                 │
│  ✅  Host resolved  2 ms                                              │
│  ✗   TCP connection failed                                            │
│                                                                       │
│  Error: ECONNREFUSED — Connection refused at localhost:5432           │
│                                                                       │
│  Possible causes:                                                     │
│  • PostgreSQL is not running on this host                             │
│  • Wrong port (default: 5432)                                         │
│  • Firewall blocking the connection                                   │
│                                                                       │
│  [⟳ Retry]   [✎ Change host/port]                                    │
└───────────────────────────────────────────────────────────────────────┘
```

**Autentifikačná chyba:**

```
│  ✅  TCP connection  28 ms                                            │
│  ✗   Authentication failed                                            │
│  Error: password authentication failed for user "admin"               │
│  • Wrong password  • User does not exist  • Missing privileges        │
│  [✎ Change credentials]                                               │
```

Každý error kód má mapovanú user-friendly správu s "Possible causes" — žiadne raw Node.js stack traces.

---

## 9. Source Detail Panel

Klik na `[👁 Browse]` alebo na source name → otvára **Source Detail Tab** v main workspace.

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🐘 warehouse.db                              [⟳ Test] [✎ Edit] [⋮] │
├──────────────────────────────────────────────────────────────────────┤
│  STATUS                                                              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ ●̈ Live · 48ms · PostgreSQL 15.3                              │   │
│  │ Last verified: 2 minutes ago                                 │   │
│  │ Connection history (last 24h):                               │   │
│  │ ████████████████████████████████████████░  96% uptime       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  CONFIGURATION                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Type: PostgreSQL 15.3  ·  Host: localhost:5432               │   │
│  │ Database: warehouse  ·  User: admin                          │   │
│  │ Password: ●●●●●●●●  [👁 Show]  ·  SSL: Prefer               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  SCHEMA OVERVIEW                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 12 tables · 3 views · Last introspected: 2h ago              │   │
│  │  📋 orders          [L1]   48 col   ✅ profiled             │   │
│  │  📋 customers       [L2]   12 col   ✅ profiled             │   │
│  │  📋 media_types [ref] [L1]  3 col   ✅ profiled             │   │
│  │  ...                          [Go to Explore →]              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  GDPR TIER                                                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Current tier: Metadata only                                  │   │
│  │ AI can see: Schema, column names, FK, native comments        │   │
│  │ AI cannot see: Sample data, query results                    │   │
│  │ [Change tier →]                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 10. Connection String mode

Pre advanced users alebo pri paste z iného nástroja.

**Toggle a live parsing:**

```
┌────────────────────────────────────────────────────────────────────┐
│  Connection mode                                                   │
│  (○) Form-based        (●) Connection string                       │
├────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ postgresql://admin:secret@localhost:5432/warehouse?ssl=prefer│ │
│  │                                                       [👁] [⎘]│ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ✅  Parsed successfully                                           │
│  Host: localhost · Port: 5432 · DB: warehouse · User: admin       │
│  Password: ●●●●●● (detected)  · SSL: prefer                      │
│  [View as Form ↗]                                                  │
└────────────────────────────────────────────────────────────────────┘
```

Connection string sa parsuje **on-type** s 300ms debounce. Pri parse error: inline červená správa s expected format.

**Paste detection** — keď user paste-uje niečo čo vyzerá ako connection string do ľubovoľného formulárového poľa:

```
┌───────────────────────────────────────────────────────┐
│  ✨ Looks like a connection string                     │
│  Switch to Connection string mode to parse it?        │
│  [Yes, parse it]    [No, keep form mode]              │
└───────────────────────────────────────────────────────┘
```

---

## 11. Error states a recovery

**Source went offline počas session:**

Status bar: `● Auto  │  warehouse.db ✗  │  ...` ← červený

Toast (Sonner): `⚠ warehouse.db lost connection — AI agents paused. [⟳ Reconnect]`

Source karta sa zmení na Offline state s `[⟳ Reconnect]` a `[✎ Edit config]`.

**Remove source — type-to-confirm dialog:**

```
┌──────────────────────────────────────────────────────────────────────┐
│  Remove "warehouse.db"?                                              │
├──────────────────────────────────────────────────────────────────────┤
│  This will:                                                          │
│  • Remove the connection configuration                               │
│  • Delete all schema snapshots and profiles for this source          │
│  • Remove 8 table doc records associated with this source            │
│                                                                      │
│  This will NOT:                                                      │
│  • Affect your source database (read-only, no changes were made)     │
│  • Delete model SQL files (they stay, but SQL may need updating)     │
│                                                                      │
│  Type "warehouse.db" to confirm:                                     │
│  ┌──────────────────────────────────┐                                │
│  │                                  │                                │
│  └──────────────────────────────────┘                                │
│                                                                      │
│  [Cancel]                              [Remove source]               │
└──────────────────────────────────────────────────────────────────────┘
```

Remove button je disabled kým user nenapíše presný názov. Červený destructive variant (shadcn).

---

## 12. Security notices

**Persistent dismissable banner** v Connect module pod headerom:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🔒 Security notice: Credentials are stored unencrypted in local SQLite.      │
│    Use test/dev credentials only. Encryption coming in a future release.  [×]│
└──────────────────────────────────────────────────────────────────────────────┘
```

Dismissable per-session. Vráti sa po reštarte.

**Password field behavior:**
- Default: masked (`●●●●●●●●`)
- Klik `👁`: unmask na 3 sekundy, potom auto-re-mask
- Copy button `⎘`: kopíruje bez zobrazenia

**Log redaction:** password sa nikdy neobjaví v Audit Logu, Output paneli ani error správach. Format: `postgresql://admin:***@localhost/warehouse`.

---

## 13. Mikrointerakcie a animácie

| Akcia | Animácia |
|-------|----------|
| Otvoriť Add Source wizard | Fade + slight scale-up (200ms) |
| Otvoriť Edit drawer | Slide-in z pravej (300ms ease-out) |
| Test connection kroky | Stagger 200ms per krok |
| Status dot Live | CSS pulse 2s infinite |
| Status dot OK→Error | Fade zelená→červená (500ms) |
| Source karta hover | Border highlight + shadow (150ms) |
| Klik na DB type card | Border fill + check icon (100ms) |
| Remove confirm enable | Button fade gray→red keď text matched |

Formulárové polia validujú **on-blur** (nie on-type). Connection string parsuje **on-type** s 300ms debounce.
