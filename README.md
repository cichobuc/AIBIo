# AIBIo — AInderstanding

> AI-assisted datamart builder with GDPR-first design and no vendor lock-in.

AInderstanding is the active module of AIBIo. It acts as an AI partner for the full datamart lifecycle — connecting to source databases, profiling data, designing dimensional models, writing SQL, generating data quality tests, and producing governance documentation — all in one tool, with you in control at every step.

---

## Why AInderstanding

The hardest problem in AI-assisted BI is not generating SQL. Every LLM can do that. The hard problem is that **AI doesn't know your data** — what `BIR_AMT_NET` means, that `customer_id = 0` is a test record, or that "turnover" is calculated differently across different parts of the business.

On top of that, building a datamart from raw sources is weeks of manual work: profiling, dimensional modeling, cleaning, joins, DQ testing, documentation — repetitive, error-prone, and typically without governance.

AInderstanding solves both:

| Property | How |
|---|---|
| **GDPR-first** | 3-layer data exposure model. AI sees only what you explicitly permit. Per-column PII classification, non-bypassable masking, full audit log. |
| **No lock-in** | One-click export to a dbt-compatible `.zip`. `dbt run` it outside AIBIo and it just works. |
| **Strictly read-only** | SQL parser gate rejects any non-`SELECT` statement before it reaches source databases. No DDL, no DML, no COMMENT writebacks. |
| **Full lifecycle** | Connect → Explore → Govern → Model → Document → Test → Export in one tool, with a persistent AI partner that remembers your schema context across sessions. |
| **You stay in control** | AI proposes — you approve. Every write (SQL file, doc, test) goes through an explicit approval gate before it lands on disk. |

---

## Modules

```
Connect → Explore → Model ──┬── Document
              │              ├── Test
              ↓              └── Translate → Export
           Govern (cross-cutting — all data access routes through Govern guards)
```

| Module | What it does |
|---|---|
| **Connect** | Add source databases (PostgreSQL, MySQL, SQL Server, DuckDB). Read-only introspection. Schema snapshots with change detection. |
| **Explore** | DBeaver-style schema tree with per-source/table/column AI access tiers. Data profiling (null rates, distributions, top values, PII candidates). Monaco SQL editor with multi-tab sessions and PII masking. |
| **Govern** | 3-layer GDPR permission model. Per-column PII classification. Workspace-wide approval policies. Full audit log. |
| **Model** | Dimensional model builder (Kimball-flavored). Staging → intermediate → mart layers. `ref()` references. Lineage DAG. AI-written SQL with diff-based approval. |
| **Document** | AI-generated governance documentation per table and column. Confidence scores. Auto-sync with schema changes. |
| **Test** | AI-proposed data quality tests (uniqueness, FK integrity, not-null, custom assertions). YAML + SQL output compatible with dbt test conventions. |
| **Export** | One-click export to dbt-compatible `.zip`. Standard project structure runnable with `dbt run` outside AIBIo. |

---

## GDPR Data Exposure Model

Every data access decision goes through three layers, in order of strictness:

```
Layer 1 — Schema only (default for new sources)
  AI can see: table names, column names, data types, relationships
  AI cannot see: any actual data values

Layer 2 — Reference samples (opt-in per table)
  AI can see: up to N sample rows from tables you flag as reference data
  Blocked by: column-level PII classification (non-bypassable)

Layer 3 — Query results (opt-in per query, with approval gate)
  AI can see: results of a specific SELECT you approved
  TTL: 5 minutes in-memory only — never persisted to disk
  Blocked by: PII columns are masked in results regardless of tier
```

Per-column PII classification (`none` / `sensitive` / `pii`) is set by you in the schema tree or PII Inventory, stored in `column_metadata`, and enforced at the masking layer — AI never receives a raw value from a PII-classified column, even if you approve query sharing.

---

## Agent Architecture

AInderstanding uses a two-tier orchestration model built on the Claude Agent SDK:

```
User message
    │
    ▼
Supervisor  (Sonnet — intent classification, session state, approval queue)
    │
    ├── ExploreCoordinator  (Haiku — schema introspection, profiling, PII detection)
    │       ├── schema-explorer
    │       ├── data-profiler
    │       └── pii-detector
    │
    ├── ModelCoordinator  (Sonnet — dimensional design, SQL writing, lineage)
    │       ├── model-designer
    │       └── sql-writer
    │
    ├── QualityCoordinator  (Sonnet — test generation, DQ analysis)
    │       ├── test-generator
    │       └── dq-analyzer
    │
    └── DocumentCoordinator  (Haiku — doc writing, schema sync)
            └── docs-keeper
```

The Supervisor dispatches intent to the appropriate Phase Coordinator. Coordinators spawn atomic agents via the `agents` parameter of `query()`. Every write action (SQL, doc, test, model file) triggers an approval gate — the AI waits for your explicit approval before the file lands on disk. Approval timeout is configurable (default 5 min); expired requests are auto-denied and logged.

Tool calls stream to the browser in real time via SSE. You see what the AI is doing at every step.

---

## Tech Stack

**Frontend**
- Next.js 15 (App Router), TypeScript, Tailwind CSS
- shadcn/ui + Radix UI primitives
- Monaco Editor (SQL), `@xyflow/react` (lineage DAG), Zustand

**Backend**
- Next.js Route Handlers (Node.js)
- SQLite + `better-sqlite3` + Drizzle ORM (metadata)
- DuckDB via `duckdb-async` (materialized datamart)
- Source connectors: `pg`, `mssql`, `mysql2`, `duckdb-async`
- `node-sql-parser` (AST-based SELECT-only enforcement)

**AI**
- `@anthropic-ai/claude-agent-sdk` — `query()`, `agents`, `canUseTool` approval callback
- `@modelcontextprotocol/sdk` — in-process MCP server (`createSdkMcpServer()`)
- Authentication: Claude Code OAuth (`claude login`) — no API key, no per-token billing

---

## Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20 LTS |
| npm | 10+ |
| Claude CLI | latest (`npm install -g @anthropic-ai/claude-code`) |
| Claude Pro or Max subscription | required for Claude Code OAuth |

Docker and Python are **not** required for the core dev setup. DuckDB runs embedded via `duckdb-async`.

### Install

```bash
git clone https://github.com/cichobuc/AIBIo.git
cd AIBIo
npm install
```

`better-sqlite3` and `duckdb-async` are native addons compiled during `npm install`. On macOS you need Xcode Command Line Tools:

```bash
xcode-select --install
```

### Authentication

AInderstanding uses Claude Code OAuth — no API key needed.

```bash
claude login          # one-time setup, stores OAuth token locally
```

The Claude Agent SDK picks up the token automatically.

### Environment

```bash
cp .env.example .env.local
```

Required variables:

```bash
# 32-byte base64 key for connection credential encryption (AES-256)
AIBIO_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
```

### Run

```bash
npm run dev           # http://localhost:3000
npm run type-check    # TypeScript check
npm run lint          # ESLint
```

### Database migrations

Migrations run automatically on server start via the Drizzle runtime migrator. No manual migration step needed for local dev.

---

## Project Structure

```
app/
├── api/                          # Next.js Route Handlers
│   ├── chat/[workspaceId]/       # POST — supervisor entry point
│   ├── stream/[workspaceId]/     # GET  — SSE stream
│   ├── approvals/[requestId]/    # POST — approval gate resolution
│   ├── govern/                   # GDPR control plane endpoints
│   └── …
└── workspace/[workspaceId]/
    ├── explore/
    ├── govern/
    ├── model/
    └── …

core/
├── db/                           # Drizzle client + migrations
├── orchestration/                # Supervisor, approval gate, SSE emitter
├── types/                        # Shared TypeScript types
└── ui/                           # shadcn/ui component re-exports

modules/ainderstanding/
├── connect/                      # Source adapters + AddSourceWizard
├── explore/                      # Schema tree, profiler, SQL editor, MCP tools
├── govern/                       # Permission service, PII masking, audit log
├── model/                        # Dimensional model, SQL writer, lineage
├── document/                     # Doc templates, docs-keeper agent
├── test/                         # DQ test generator, test runner
└── shell/                        # Supervisor, ActivityBar, Settings, ChatPanel

docs/                             # Architecture, API contract, rules, roadmap
```

---

## Roadmap

**MVP (in progress)**
- [x] Core foundation — DB, orchestration, SSE, approval gate
- [x] Shell — supervisor state machine, chat panel, settings
- [x] Connect — source adapters, schema introspection
- [x] Explore — schema tree, data profiling, SQL editor
- [x] Govern — PII classification, approval policies, audit log, GDPR exposure model
- [x] Model (M1–M3) — dimensional model builder, SQL writer, lineage DAG
- [ ] Document — AI-generated governance docs
- [ ] Test — DQ test generator and runner
- [ ] Export X1 — dbt-compatible `.zip`

**Phase 2 (post-MVP)**
- Translate — multi-language code generation (Python, Power Query M, DAX/TMDL, KQL, 24 targets)
- Export X2–X8 — multi-format packaging

---

## Key Design Decisions

**Why SQLite and not Postgres for metadata?**
Zero-ops local-first setup. All metadata (schema snapshots, profiles, models, docs, audit log) fits comfortably in SQLite. The datamart itself lives in DuckDB.

**Why Claude Code OAuth instead of an API key?**
No per-token billing surprises during development. Claude Pro/Max subscription covers usage. The Agent SDK handles token refresh automatically.

**Why not mock the database in tests?**
Integration tests hit a real SQLite database seeded with fixtures. Mocked DB tests have burned us with migration regressions — the real DB catches constraint violations and migration failures that mocks silently pass.

**Why dbt-compatible export?**
Lock-in is a dealbreaker for BI teams evaluating new tools. If AInderstanding disappears tomorrow, your SQL models, tests, and docs continue working with `dbt run`.

---

## License

MIT
