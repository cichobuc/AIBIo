# AIBIo — System Architecture

> **Scope:** This document covers the complete architecture of AIBIo with a focus on the active module — **AInderstanding** (AI-assisted datamart builder). It is intended as a single reference for system design, agent orchestration, data flow, and key architectural decisions.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [Module Hierarchy](#3-module-hierarchy)
4. [Application Structure](#4-application-structure)
5. [Foundation Layer — core/ and shell/](#5-foundation-layer--core-and-shell)
6. [AInderstanding Sub-modules](#6-ainderstanding-sub-modules)
7. [Multi-Agent Architecture](#7-multi-agent-architecture)
8. [GDPR Data Exposure Model](#8-gdpr-data-exposure-model)
9. [Approval Gate Mechanism](#9-approval-gate-mechanism)
10. [SSE Streaming Architecture](#10-sse-streaming-architecture)
11. [MCP Tool Registry](#11-mcp-tool-registry)
12. [Database Schema Overview](#12-database-schema-overview)
13. [File System Layout](#13-file-system-layout)
14. [Key Data Flows](#14-key-data-flows)
15. [Orchestration Patterns](#15-orchestration-patterns)
16. [Security Model](#16-security-model)
17. [Deployment](#17-deployment)

---

## 1. System Overview

AIBIo is a **modular AI-native BI platform**. The active scope is **AInderstanding** — an AI-assisted datamart builder with GDPR-first design and no-vendor-lock-in export.

### Core Value Propositions

| Property | Mechanism |
|---|---|
| **GDPR-first** | 3-layer data exposure model; AI sees only what user explicitly permits |
| **No lock-in** | One-click export to dbt-compatible `.zip`; runnable with `dbt run` outside AIBIo |
| **Strictly read-only** | SQL parser gate rejects any non-`SELECT` statement before it reaches source DBs |
| **AI as partner** | Supervisor + 9 LLM subagentov (8 v MVP, `code-generator` v Phase 2); user always reviews and approves AI writes |
| **Full lifecycle** | Connect → Explore → Govern → Model → Document → Test → Translate → Export in one tool |

### Mental Model

AInderstanding draws from three paradigms:

| Paradigm | Borrowed concept |
|---|---|
| **Power Query** | Visual pipeline (Applied Steps), canonical SQL, step-by-step transformations |
| **dbt** | SQL-first modeling layers (staging → intermediate → marts), `ref()`, tests + docs as first-class artifacts |
| **Cursor / Copilot** | AI as pair programmer, but with explicit approval gates and bounded permissions |

---

## 2. Tech Stack

### Frontend & Shell

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR routing, API route handlers, layout nesting |
| Language | TypeScript (strict) | End-to-end type safety |
| Styling | Tailwind CSS | Utility-first CSS |
| UI components | shadcn/ui, Radix UI primitives | Accessible headless components |
| SQL editor | Monaco Editor | VS Code-grade SQL editing |
| Lineage DAG | `@xyflow/react` (React Flow) | Interactive directed acyclic graph visualization |
| State (client) | Zustand | Lightweight global state |
| State (server) | Tanstack Query | Server state + caching |
| State (URL) | Next.js URL search params | Routing-level state |
| Streaming | Server-Sent Events (SSE) | Unidirectional server → browser push |

### Backend & Storage

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js (via Next.js) | Server-side execution |
| Metadata DB | SQLite + `better-sqlite3` | Local persistent storage for all metadata |
| ORM | Drizzle ORM | Type-safe SQL query builder |
| Datamart DB | DuckDB (`duckdb-async`) | Materialized datamart storage |
| Source connectors | `pg`, `mssql`, `mysql2`, `duckdb-async` | Read-only access to source databases |
| SQL parser | `node-sql-parser` | AST-based SELECT-only enforcement |
| File storage | Node.js `fs` | SQL model files, test YAML/SQL, workspace folder |

### AI / Agent Layer

| Layer | Technology | Purpose |
|---|---|---|
| Anthropic SDK | `@anthropic-ai/sdk` | Claude API calls (`messages.create()` + streaming) |
| MCP protocol | `@modelcontextprotocol/sdk` | In-process MCP server for tool registration |
| Supervisor model | `claude-sonnet-4-6` | Orchestration, intent classification |
| Haiku agents | `claude-haiku-4-5` | High-frequency low-cost tasks (schema, profiling, docs-keeper) |
| Sonnet agents | `claude-sonnet-4-6` | Reasoning-heavy tasks (model design, SQL writing, test generation) |

### Testing & Build

| Tool | Purpose |
|---|---|
| Vitest | Unit + integration tests |
| Playwright | E2E browser tests |
| ESLint | Linting + cross-module import enforcement |

---

## 3. Module Hierarchy

### AIBIo Product Modules

```
┌──────────────────────────────────────────────────────────┐
│                       AIBIo                              │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │              core/  (foundation)                 │    │
│  │  shared types, DB singleton, MCP server,         │    │
│  │  approval gate, SSE emitter, UI primitives       │    │
│  └──────────────────────┬──────────────────────────┘    │
│                         │                                │
│             ┌───────────▼──────────┐                    │
│             │    AInderstanding    │  ◄── ACTIVE SCOPE   │
│             │  (datamart builder)  │                    │
│             └───────────┬──────────┘                    │
│                         │ produces datamarts             │
│              ┌──────────┴──────────┐                    │
│              ▼                     ▼                    │
│         ┌─────────┐         ┌──────────┐               │
│         │ AIBoard │         │ AIspaces │  ◄── future    │
│         │(future) │────────►│ (future) │               │
│         └─────────┘ publish └──────────┘               │
└──────────────────────────────────────────────────────────┘
```

### AInderstanding Sub-module Dependencies

```
              ┌─────────────────┐
              │     Govern      │  ◄── cross-cutting: all modules route
              │  (permissions,  │       data access through Govern guards
              │   audit, GDPR)  │
              └─────────────────┘
                      ▲
                      │ wraps
   ┌─────────┐     ┌──┴──────┐     ┌─────────┐
   │ Connect │────►│ Explore │────►│  Model  │
   └─────────┘     └─────────┘     └────┬────┘
      sources       schema +            │
      adapter       profiling   ┌───────┼───────┐
                                │       │       │
                                ▼       ▼       ▼
                           ┌──────┐ ┌──────┐ ┌───────────┐
                           │ Doc  │ │ Test │ │ Translate │
                           └──┬───┘ └──┬───┘ └─────┬─────┘
                              │        │           │ snippets
                              └────────┴─────┬─────┘
                                             ▼
                                        ┌─────────┐
                                        │ Export  │
                                        └─────────┘
```

**Dependency rules:**
- **Connect** — foundation, no upstream dependencies
- **Explore** — depends on Connect (source adapters), respects Govern permissions
- **Govern** — cross-cutting; every module that touches source data must go through Govern's guarded tools
- **Model** — depends on Connect (adapters), Explore (profile data), Govern (permission framework)
- **Document** — depends on Connect, Explore (schema + profile context), Govern
- **Test** — depends on Model (materialized tables to test against)
- **Translate** — depends on Model (SQL definitions, lineage, grain), Explore (column types); provides snippet cache consumed by Export
- **Export** — downstream consumer of all sub-modules; reuses Translate snippets when available; no writes

---

## 4. Application Structure

### Next.js App Router Layout

```
app/
├── page.tsx                              # Workspace list (Connect landing)
├── workspace/
│   └── [workspaceId]/
│       ├── layout.tsx                    # WorkspaceLayout (SideNav + GlobalChatPanel)
│       ├── connect/page.tsx
│       ├── explore/page.tsx
│       ├── model/page.tsx
│       ├── test/page.tsx
│       ├── document/page.tsx
│       ├── govern/page.tsx
│       ├── translate/page.tsx
│       └── export/page.tsx
└── api/
    ├── chat/[workspaceId]/route.ts       # POST — user message → supervisor
    ├── stream/[workspaceId]/route.ts     # GET  — SSE stream
    ├── approvals/[requestId]/route.ts    # POST — approval gate resolution
    ├── translate/
    │   ├── [workspaceId]/generate/route.ts  # POST — generate snippet
    │   ├── [workspaceId]/snippets/route.ts  # GET  — list snippets
    │   └── [workspaceId]/test/route.ts      # POST — run equivalence test
    └── govern/
        └── column-permissions/route.ts  # POST — PII classification write
```

### URL Structure

```
/                                    → Workspace list
/workspace/{id}/connect              → Source connection management
/workspace/{id}/explore              → Schema discovery & data profiling
/workspace/{id}/model                → Dimensional modeling & SQL authoring
/workspace/{id}/test                 → Data quality test framework
/workspace/{id}/document             → Governance documentation
/workspace/{id}/govern               → GDPR permissions & audit log
/workspace/{id}/translate            → Multi-language code generation & testing
/workspace/{id}/export               → Deployment-ready export packages
```

### Repository Folder Structure

```
aibio/
├── app/                                  # Next.js App Router (routes + API)
├── core/                                 # Foundation (no business logic)
│   ├── types/                            # Shared TypeScript types
│   ├── db/                               # Drizzle singleton + migrations
│   ├── agent-sdk/                        # MCP server, approval gate, SSE emitter
│   └── ui/                              # Re-exported shadcn/ui primitives
├── modules/
│   └── ainderstanding/
│       ├── shell/                        # Supervisor, WorkspaceLayout, GlobalChatPanel
│       ├── connect/                      # Source adapters, workspace CRUD
│       ├── explore/                      # Schema introspection, data profiling
│       ├── model/                        # SQL authoring, materialization, lineage
│       ├── test/                         # DQ test framework
│       ├── document/                     # Governance documentation
│       ├── govern/                       # Permission enforcement, audit log
│       ├── translate/                    # Multi-language code generation + testing
│       └── export/                       # Deployment-ready export packages
├── lib/                                  # App-wide utilities
└── workspaces/                           # Runtime: workspace-scoped file storage
    └── {workspaceId}/
        ├── models/{layer}/*.sql
        ├── tests/{generic,custom}/*.yml/*.sql
        ├── sources.yml
        └── lineage.json
```

---

## 5. Foundation Layer — `core/` and `shell/`

### 5.1 `core/` — Technical Infrastructure

`core/` contains **zero business logic**. It provides four shared infrastructure concerns:

```
core/
├── types/
│   ├── workspace.ts      # Workspace, DataSource, ConnectionConfig
│   ├── agent.ts          # SubagentName, AIMode, AgentContext
│   ├── permissions.ts    # PermissionTier, ApprovalGateType, ApprovalGatePolicy
│   └── index.ts          # Re-export all
├── db/
│   ├── client.ts         # Drizzle singleton (better-sqlite3)
│   └── migrate.ts        # Migration runner (called at app start)
└── agent-sdk/
    ├── mcp-server.ts     # McpServer singleton (InMemoryTransport)
    ├── tool-registry.ts  # registerTool() helper
    ├── approval-gate.ts  # awaitApproval() + resolveApproval()
    ├── streaming.ts      # WorkspaceSSEEmitter + SSEEvent union type
    └── context.ts        # AsyncLocalStorage for AgentContext injection
```

**Key invariant:** Sub-modules import from `core/types` and `core/ui`. They do **not** import from `core/db` directly — they use their own Drizzle schema re-exported through `core/db/client.ts`. This prevents circular imports.

### 5.2 `shell/` — Supervisor Orchestrator

`shell/` provides the workspace UI frame and the **supervisor agent** — the only component that sees the full workspace context and dispatches to specialized subagents.

```
shell/
├── components/
│   ├── WorkspaceLayout.tsx     # Outer layout: SideNav + main content + GlobalChatPanel
│   ├── SideNav.tsx             # Module navigation + ModeSelector
│   ├── GlobalChatPanel.tsx     # Single chat interface for entire workspace
│   ├── MessageList.tsx         # SSE event renderer
│   ├── ApprovalDialog.tsx      # Blocking modal for approval gates
│   └── ChatInput.tsx
├── lib/
│   ├── intent-classifier.ts    # Sync rule-based intent classification
│   └── session-manager.ts      # sessionId generation + active session tracking
├── hooks/
│   ├── useWorkspaceContext.ts  # { workspaceId, activeModule, aiMode }
│   └── useSSEStream.ts         # EventSource wrapper + typed event handler
└── orchestrator.ts             # Supervisor agent (claude-sonnet-4-6)
```

**Owns:** `workspace_settings` — user preferences, AI mode overrides, per-workspace config

### 5.3 Supervisor State Machine

```
         IDLE
           │ user message received
           ▼
      CLASSIFYING  (sync intent classification, <50ms)
           │ plan ready
           ▼
      DISPATCHING  (supervisor LLM call, subagent tool use)
           │
           ├──► WAITING_APPROVAL  (awaitApproval() blocks tool handler)
           │         │ user approved → resume DISPATCHING
           │         │ user denied / timeout → COMPLETING (partial)
           │
           │ subagent invoked
           ▼
       STREAMING  (SSE events flowing from subagent execution)
           │ stream finished
           ▼
      COMPLETING  (post-processing: lineage rebuild, coverage update)
           │
           ▼
         IDLE

     Any state ──► ERROR (unhandled exception)
          ERROR ──► IDLE (after user acknowledge)
```

---

## 6. AInderstanding Sub-modules

| Sub-module | Purpose | Agents | Phase |
|---|---|---|---|
| **Connect** | Source connection management, read-only enforcement | None | P0 + C1 |
| **Explore** | Schema introspection, data profiling, PII detection | `schema-explorer`, `data-profiler` | E1 + E2 |
| **Govern** | GDPR control plane, permission enforcement, audit log | None | G1 + G2 |
| **Model** | Dimensional modeling, SQL authoring, materialization, lineage | `model-architect`, `sql-writer`, `transformation-suggester` | M1–M3 |
| **Document** | Governance documentation via conversation | `interviewer`, `docs-keeper` | D1–D3 |
| **Test** | DQ test framework, AI-generated tests, self-heal handoff | `test-generator` | T1 + T2 |
| **Translate** | Multi-language code gen (24 langs) + equivalence testing | `code-generator` | TR1–TR3 *(Phase 2, post-MVP)* |
| **Export** | Deployment-ready `.zip` packaging; reuses Translate snippets | None (reuses `code-generator`) | X1–X8 |

### Connect
- Defines the hard contract: **SELECT-only** access to source databases
- SQL parser gate: dual-layer enforcement (regex pre-check + AST parse via `node-sql-parser`)
- 4 adapters: Postgres (`pg`), SQL Server (`mssql`), MySQL (`mysql2`), DuckDB (`duckdb-async`)
- Owns: `workspaces`, `data_sources` tables

### Explore
- Auto-triggers after source add; parallel profiling of N tables simultaneously
- PII detection via column name regex heuristics (no content inspection by default)
- `is_reference_table` flag per table = only source of truth (used by Govern for sample permissions)
- Owns: `schema_snapshots`, `table_profiles`, `column_profiles`, `schema_changes`
- **`run_profile_query` source access:** Handler pristupuje k source DB cez `govern/lib/internal-adapter.ts` — interný Govern wrapper bez approval gate (profiling je implicitne povolený na tier `metadata_only`). Volania sú auditované ako `read_schema`. PII pre-filter: `sample_values` sú vyprázdnené pre stĺpce ktorých mená zodpovedajú PII heuristikám, pred spustením query.

### Govern
- **No agents** — pure policy/enforcement/audit layer
- Exports **guarded wrappers**: every sub-module that accesses source data calls `guardedSampleData()` / `guardedRunQuery()` — never raw adapters directly
- Query results are **never automatically forwarded to agents** — agent gets metadata only (row count + columns), user must explicitly share
- Owns: `source_permissions`, `table_permissions`, `column_permissions`, `approval_settings`, `audit_entries`

### Model
- File system is the canonical source of truth for model SQL (`workspaces/{id}/models/`)
- `ref('model_name')` and `source('src', 'table')` syntax — TypeScript-parsed (not Jinja `{{ }}`)
- Materialization: 2-phase — source pull into DuckDB (`_src__*` tables) then model execution in dependency order
- Self-heal loop: SQL execution error → `sql-writer` gets error context → proposes fix → re-approval → retry (max 3×)
- Owns: `models`, `model_runs`, `lineage_edges`

#### Cross-source SQL execution

When `relationships.rel_type = 'cross_source_logical'` links tables from two different data sources, materialization proceeds in two sub-phases:
1. **Parallel source pull** — each source DB is queried independently; results cached as `_src__{source}__{table}` staging tables inside DuckDB. Source names are slug-encoded before use in the table name: any non-alphanumeric character is replaced with a single `_` (e.g. `erp-live` → `erp_live`, `erp__prod` → `erp__prod`). Because double-underscore is the separator, source slugs must not contain `__` — Connect adapter rejects source names whose slug would contain consecutive underscores.
2. **Cross-source join** — the model SQL runs entirely within DuckDB joining between two `_src__*` staging tables

No direct DB-to-DB query occurs. Cross-source models are always DuckDB-local during execution.

### Document
- 22 governance fields across 5 record types: table, column, business_term, relationship, convention
- Coverage score = weighted sum: tables (40%) + columns (35%) + business terms (15%) + relationships (10%)
- Source attribution per record: `db_native` / `ai_generated` / `user_authored` / `user_confirmed`
- Owns: `table_descriptions`, `column_descriptions`, `business_terms`, `relationships`, `conventions`, `chat_messages`

### Test
- dbt-style generic tests: `unique`, `not_null`, `foreign_key`, `accepted_values`
- Custom tests: user-written SQL (0 rows returned = pass)
- Test failure → automatic handoff to `sql-writer` in Model for self-heal
- SQL parser gate applied to custom tests too (no DDL/DML in test SQL)
- Owns: `tests`, `test_runs`, `test_results`

### Translate
- Language Registry: 24 languages, 4 tiers — `full-exec` (DuckDB, pandas, polars, ibis), `sandbox` (PySpark/Docker), `syntax-only` (DAX, KQL, Power Query M, dbt SQL, Snowflake), `gen-only` (R, Scala, Julia, TypeScript, GraphQL, MDX)
- `code-generator` agent (Haiku for syntax translation, Sonnet for semantic: DAX measures, KQL materialized views)
- `translate-validator` service (deterministic): Python subprocess via `uv run --isolated`, DuckDB dialect execution, syntax parsers
- Snippet cache: `translate_snippets` table; invalidated on model SQL change
- Equivalence test: generated output vs DuckDB ground truth (schema + row count + 100-row sample)
- GDPR: agent receives schema + docs only — no sample values

### Export
- Packaging layer: reuses Translate snippets when available; falls back to calling `code-generator` if missing
- dbt/SQL (Phase X1): pure deterministic; `ref('name')` → `{{ ref('name') }}` Jinja conversion
- Multi-format (Phase X2–X8): Python package, Power Query M, DAX/TMDL, KQL — see `export/MULTIFORMAT.md`
- Each format: `.zip` with deployment scripts + manifest.json + README
- MVP success criterion: dbt export passes `dbt run && dbt test` with `dbt-duckdb`

---

## 7. Multi-Agent Architecture

### Agent Roster

| Agent | Owner | Model tier | Primary tools | Workflow pattern |
|---|---|---|---|---|
| **supervisor** | shell/ | Sonnet 4.6 | All read tools + `invoke_subagent` + post-processing | Orchestrates all |
| `schema-explorer` | Explore | Haiku | `guarded_introspect_schema`, `guarded_read_native_comments`, `detect_schema_changes` | Sequential |
| `data-profiler` | Explore | Haiku | `run_profile_query`, `detect_pii_candidates`, `suggest_reference_table_flags` | **Parallel** (N tables) |
| `interviewer` | Document | Sonnet | `read_docs`, `read_schema_snapshot`, `read_profiles` | Loop |
| `docs-keeper` | Document | Haiku | `write_doc_record`, `update_doc_record`, `read_docs` | **Parallel** (N sources) |
| `model-architect` | Model | Sonnet | `read_docs`, `read_profiles`, `propose_dimensional_model` | Conditional |
| `sql-writer` | Model | Sonnet | `read_docs`, `read_profiles`, `read_schema_snapshot`, `read_existing_models`, `write_model_file` (gated), `guarded_run_select_query` | **Parallel** (N models) + Loop |
| `transformation-suggester` | Model | Sonnet | `read_profiles`, `read_existing_models` | Conditional |
| `test-generator` | Test | Sonnet | `read_schema_snapshot`, `read_profiles`, `read_docs`, `write_test_file` (gated) | Conditional |
| `code-generator` | Translate | Haiku / Sonnet | `read_schema_snapshot`, `read_docs`, `read_existing_models`, `generate_snippet`, `read_snippets` | On-demand |

**Model tier rationale:** Haiku for high-frequency, low-reasoning tasks (schema reading, doc writing, simple syntax translation); Sonnet for reasoning-heavy tasks (model design, SQL authoring, test generation, semantic translation: DAX/KQL/complex Python). `code-generator` uses Haiku for SQL dialects and basic pandas/polars; Sonnet for DAX measures, KQL materialized views, ibis semantic translation.

**`translate-validator`** is a **deterministic service** (not an LLM agent): Python `uv run --isolated` subprocess executor + DuckDB dialect runner + syntax parsers (DAX/KQL/M). It is not in the agent roster.

### Intent Classification → Dispatch Flow

```
User message
      │
      ▼
classifyIntent()  ──── sync rule-based, <50ms ────►  DispatchPlan
      │                                               {mode, steps[]}
      │
      ├── mode: manual_only  ──► "Manual mode active. Use Monaco editor."
      │
      ├── mode: single_agent  ──► Direct subagent invocation
      │
      ├── mode: parallel  ──► Promise.all([...subagent invocations])
      │
      └── mode: multi_agent (fallback)
              │
              ▼
         Supervisor LLM call (claude-sonnet-4-6)
              │ tool_use: invoke_subagent
              ▼
         Subagent execution
              │
              ▼
         Post-processing (parse_lineage, update_coverage, run_tests)
              │
              ▼
         stream_end SSE event
```

### AI Mode Effect on Dispatch

| Subagent | Auto | Documentation | Queries | Manual |
|---|---|---|---|---|
| `schema-explorer` | ✓ active | ✓ active | ✓ read-only | ✗ disabled |
| `data-profiler` | ✓ active | ✓ active | ✓ read-only | ✗ disabled |
| `interviewer` | ✓ active | **✓ primary** | ✗ disabled | ✗ disabled |
| `docs-keeper` | ✓ active | **✓ primary** | ✗ disabled | ✗ disabled |
| `model-architect` | ✓ active | ✗ disabled | **✓ primary** | ✗ disabled |
| `sql-writer` | ✓ active | ✗ disabled | **✓ primary** | ✗ disabled |
| `transformation-suggester` | ✓ active | ✗ disabled | **✓ primary** | ✗ disabled |
| `test-generator` | ✓ active | ✗ disabled | **✓ primary** | ✗ disabled |
| `code-generator` | ✓ active | ✗ disabled | ✗ disabled | ✗ disabled |

**Manual mode:** no agent runs; chat input disabled; Monaco editor fully functional.

### Parallel Approval Gate Handling

When multiple parallel subagents both trigger an approval gate, the gates are **serialized** (not concurrent). Two simultaneous modal dialogs would be confusing. The supervisor queues pending gates in an internal `pendingGateQueue: ApprovalRequest[]` and presents one at a time.

**Deny propagation:** If the user denies any gate in the queue (or a gate times out after 300 s without user action), the supervisor immediately:
1. Rejects the waiting subagent with `ApprovalDeniedError`
2. Discards all remaining entries in the pending gate queue (subsequent gates are never shown)
3. Emits `stream_error` to abort all in-flight subagent invocations
4. Transitions supervisor state back to `IDLE`

This means a single Deny (or timeout) on a parallel batch ends the entire dispatch cycle, not just the one gate.

---

## 8. GDPR Data Exposure Model

The GDPR-first design is the central product differentiator. It is enforced at the service layer (not just the UI).

### 3-Layer Data Exposure Model

```
Layer 1 — Schema metadata
  ┌────────────────────────────────────────────────────┐
  │ Table names, column names, types, FKs,             │
  │ native DB comments                                 │
  │                              DEFAULT: ALLOW        │
  └────────────────────────────────────────────────────┘

Layer 2 — Sample data
  ┌────────────────────────────────────────────────────┐
  │ Row samples from source tables                     │
  │ Only for tables flagged as reference/lookup        │
  │ PII columns are always masked                      │
  │                              DEFAULT: DENY         │
  │                              Opt-in: per-table     │
  └────────────────────────────────────────────────────┘

Layer 3 — Query results
  ┌────────────────────────────────────────────────────┐
  │ Results of AI-executed SELECT queries              │
  │ Agent receives metadata only (row count, columns)  │
  │ User must explicitly click "Share with AI"         │
  │                              DEFAULT: DENY         │
  │                              Per-query: user click │
  └────────────────────────────────────────────────────┘
```

### Permission Tier Hierarchy

```
metadata_only
    │ +reference table samples (is_reference_table = true)
    ▼
with_reference_samples
    │ +any table samples (non-PII columns)
    ▼
with_full_samples
    │ +query results forwarded to agent (per approval)
    ▼
with_query_results
```

Tiers are set **per source** with **per-table overrides**. PII-classified columns are masked at all tiers.

### Tier × Layer Access Matrix

| Permission Tier | Layer 1 — Schema metadata | Layer 2 — Sample data | Layer 3 — Query results |
|---|---|---|---|
| `metadata_only` | ✓ always | ✗ | ✗ |
| `with_reference_samples` | ✓ | ✓ reference tables only (`is_reference_table = true`) | ✗ |
| `with_full_samples` | ✓ | ✓ all non-PII columns | ✗ |
| `with_query_results` | ✓ | ✓ all non-PII columns | ✓ per-query approval gate |

PII-classified columns are masked in Layer 2 at all tiers. Layer 3 access always requires an explicit `share_results_with_ai` approval gate regardless of tier.

### PII Classification Flow

```
Explore detects
column_profiles.pii_candidate = true
  (naming heuristic: email, phone, ssn, address, ...)
           │
           ▼
PIICandidatesPanel (Explore UI)
User reviews each candidate
           │
    ┌──────┴──────┐
    │ Confirm PII │         │ Dismiss
    ▼             ▼         ▼
column_permissions      pii_candidate stays
.pii_classification     but flagged as reviewed
= 'pii' (set_by=user)
           │
           ▼
Govern enforcement
guardedSampleData() → getPiiColumns()
→ maskPiiColumns()   → [EMAIL_MASKED]
           │
           ▼
Document mirror
docs-keeper reads column_permissions.pii_classification
→ copies to column_descriptions.pii_classification
```

**Three tables, three roles — no duplication:**

| Table | Owner | Role |
|---|---|---|
| `column_profiles.pii_candidate` | Explore | Detection: heuristic flag |
| `column_permissions.pii_classification` | **Govern** | **Enforcement: source of truth** |
| `column_descriptions.pii_classification` | Document | Documentation: mirror for governance record |

---

## 9. Approval Gate Mechanism

The approval gate is a **Promise-based flow** with no polling. It bridges the asynchronous LLM tool call with the synchronous UI response.

```
Tool handler (server)              UI (browser)
       │                                │
       │ awaitApproval(type, payload)   │
       │                                │
       │──── SSE: approval_required ───►│
       │     { requestId, gateType,     │
       │       agentName, payload }     │
       │                                │
       │                         ApprovalDialog shown
       │                         (chat input disabled)
       │                                │
       │              User clicks Approve or Deny
       │                                │
       │◄─── POST /api/approvals/{id} ──│
       │     { decision: 'approved' }   │
       │                                │
   resolveApproval(requestId)           │
   Promise resolves                     │
       │                                │
   Tool execution continues             │
       │                                │
       │──── SSE: approval_resolved ───►│
                                  ApprovalDialog dismissed
```

**Timeout:** 300 seconds of inactivity → automatic deny. The gate is cleaned up on server shutdown (acceptable data loss for MVP — pending gate will deny on next attempt).

**Gate types:**
- `execute_query` — AI wants to run a SELECT on a source DB
- `share_results_with_ai` — AI results should be forwarded to agent context
- `write_model_file` — AI wants to write/overwrite a model SQL file
- `write_test_file` — AI wants to write/overwrite a test definition file
- `write_to_docs` — AI wants to write/update a documentation record (conditional: only when `confidence < high`)

### Gate Type → UI Variant Mapping

| `gateType` | UI Variant | Rationale |
|---|---|---|
| `execute_query` | **Level 2 — Bottom Banner** | Medium-friction; frequent but sensitive; agent shows SQL in banner before running |
| `write_to_docs` | **Level 2 — Bottom Banner** | Medium-friction; conditional gate (only when `confidence < high`); reversible |
| `share_results_with_ai` | **Level 3 — Full Modal** | High-friction; Layer 3 data exposure; user must actively decide to share query results |
| `write_model_file` | **Level 3 — Full Modal** | High-friction; permanent filesystem write; user must read proposed SQL before approving |
| `write_test_file` | **Level 3 — Full Modal** | High-friction; test definition write |

**Level 1 — Inline Card** is used for `guarded_sample_data` first-time reference-table access (permission-tier soft-confirm, not a formal gate). See `docs/UI_UX.md §17` for component specs and ASCII wireframes.

---

## 10. SSE Streaming Architecture

All real-time communication from server to browser uses **Server-Sent Events** (SSE). The event system is workspace-scoped.

### Architecture

```
Subagent / Tool handler
        │
        │ sseEmitter.emit(workspaceId, event)
        ▼
WorkspaceSSEEmitter (Node.js EventEmitter)
  one event channel per workspace
        │
        │ GET /api/stream/{workspaceId}
        ▼
SSE Route Handler (Next.js)
  ReadableStream, Content-Type: text/event-stream
        │
        │ data: {JSON}\n\n
        ▼
useSSEStream hook (browser)
  EventSource listener
        │
        ▼
GlobalChatPanel → MessageList rendering
```

### SSE Event Types

| Event | Rendered as |
|---|---|
| `agent_thinking` | Spinner "Thinking..." |
| `agent_message` | Chat bubble (streaming text, blinking cursor on partial) |
| `tool_call` | Collapsible chip: `schema-explorer → introspect_schema` |
| `tool_result` | Small badge: `✓ 12 tables found` or `✗ Permission denied` |
| `approval_required` | ApprovalDialog modal (blocks chat input) |
| `approval_resolved` | Dialog dismissed |
| `doc_update` | Toast: `Docs updated: invoices.description` |
| `coverage_update` | Coverage badge refresh in DocsPanel |
| `model_run_update` | Progress bar in MaterializationPanel |
| `test_run_update` | Badge update in TestResultsDashboard |
| `schema_update` | Schema diff indicator in Explore |
| `stream_end` | Spinner disappears |
| `stream_error` | Error banner + retry button |

**Heartbeat:** `{ type: 'ping' }` every 15 seconds to prevent browser timeout on idle connections.

---

## 11. MCP Tool Registry

All 28 MCP tools registered in AInderstanding. Sub-modules call `registerTool()` at startup. The supervisor receives only tools appropriate for its role (read-only + post-processing); subagents receive only tools registered for their owner sub-module.

> **Single source of truth for tool names, callers, TypeScript signatures, and error codes: [MCP_TOOLS.md](./MCP_TOOLS.md).** Do not duplicate the full tool table here — update MCP_TOOLS.md and it automatically reflects in the registry at runtime.

### Tool Distribution by Owner

| Owner | Count | Gate types |
|---|---|---|
| Govern | 5 | `execute_query`, `share_results_with_ai` |
| Explore | 6 | — |
| Model | 6 | `write_model_file` |
| Test | 3 | `write_test_file` |
| Document | 5 | `write_to_docs` (conditional) |
| Translate | 3 *(Phase 2)* | — |

### Registration Pattern

```typescript
// shell/db-schema/index.ts (example from explore module)
registerTool({
  name: 'read_schema_snapshot',
  owner: 'explore',
  allowedCallers: ['schema-explorer', 'data-profiler', 'model-architect',
                   'sql-writer', 'test-generator', 'interviewer'],  // code-generator Phase 2
  handler: async (input, ctx) => { ... },
});
```

Callers list in `registerTool()` is enforced at runtime: the MCP server rejects any `tool_use` where `agentName` is not in `allowedCallers`.

---

## 12. Database Schema Overview

All metadata is stored in a single SQLite database (`aibio.db`). Each sub-module owns its tables; `core/db/client.ts` imports and merges all schemas into one Drizzle instance.

**Full schema with all columns, types, and Mermaid ERDs:** [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)

### Schema Ownership

```
core/db/client.ts
  imports:
    shell/db/schema     →  workspace_settings
    connect/db/schema   →  workspaces, data_sources
    explore/db/schema   →  schema_snapshots, table_profiles,
                            column_profiles, schema_changes
    govern/db/schema    →  source_permissions, table_permissions,
                            column_permissions, approval_settings,
                            audit_entries
    model/db/schema     →  models, model_runs, lineage_edges
    test/db/schema      →  tests, test_runs, test_results
    document/db/schema  →  table_descriptions, column_descriptions,
                            business_terms, relationships,
                            conventions, chat_messages
    translate/db/schema →  translate_snippets, translate_test_results
```

### Key Cross-Module FK Relationships

```
workspaces.id
  ├─► data_sources.workspace_id
  ├─► source_permissions.data_source_id
  ├─► models.workspace_id
  ├─► tests.workspace_id
  ├─► business_terms.workspace_id
  ├─► chat_messages.workspace_id
  └─► audit_entries.workspace_id

data_sources.id
  ├─► schema_snapshots.data_source_id
  ├─► table_profiles.data_source_id
  ├─► column_profiles.data_source_id
  ├─► column_permissions.data_source_id
  ├─► table_descriptions.data_source_id
  └─► column_descriptions.data_source_id

models.id
  ├─► lineage_edges.from_model_id
  ├─► lineage_edges.to_model_id
  ├─► model_runs.workspace_id (via models_affected JSON)
  └─► translate_snippets.model_id

translate_snippets.id
  └─► translate_test_results.snippet_id
```

### Datamart DB (DuckDB)

Separate from the metadata DB. Per workspace: `workspaces/{id}/datamart.duckdb`.

```
datamart.duckdb (main schema)
  ├── _src__{source}__{table}    # source pull staging (pre-materialization)
  ├── stg_{source}__{table}      # staging models
  ├── int_{name}                 # intermediate models
  ├── dim_{name}                 # dimension marts
  └── fct_{name}                 # fact marts
```

---

## 13. File System Layout

Workspace-scoped files are the **canonical source of truth** for models and tests. The SQLite DB stores metadata + run history. This separation allows git-versioning of the datamart definition independently of the AIBIo metadata store.

```
workspaces/
└── {workspaceId}/
    ├── models/
    │   ├── staging/
    │   │   ├── stg_{source}__{table}.sql
    │   │   └── ...
    │   ├── intermediate/
    │   │   └── int_{name}.sql
    │   └── marts/
    │       ├── dim_{name}.sql
    │       └── fct_{name}.sql
    ├── tests/
    │   ├── generic/
    │   │   └── {model}__{column}__{test_type}.yml
    │   └── custom/
    │       └── {assertion_name}.sql
    ├── sources.yml                # auto-generated: data source definitions
    ├── lineage.json               # auto-generated: lineage DAG snapshot
    └── datamart.duckdb            # materialized datamart
```

---

## 14. Key Data Flows

### 14.1 Source Onboarding Flow

```
User adds DataSource
      │
      ├──► Connect: test connection (SELECT 1)
      │          │ success
      ├──► Explore: schema-explorer
      │          │ introspect_schema → SchemaSnapshot
      │          │ read_native_comments
      │          │ save to schema_snapshots
      │
      ├──► Explore: data-profiler (parallel over N tables)
      │          │ run_profile_query per column
      │          │ detect_pii_candidates
      │          │ suggest_reference_table_flags
      │          │ save to table_profiles + column_profiles
      │
      └──► Document: docs-keeper
                 │ auto-populate table/column descriptions
                 │ from DB native comments (confidence=high)
                 │ save to table_descriptions + column_descriptions
```

### 14.2 Materialization Flow

```
User triggers "Build all"
      │
      ├── Phase 1: Source Pull
      │      │ Read all staging models, extract source() refs
      │      │ For each unique source ref:
      │      │   audit_log(source_pull)
      │      │   SELECT * FROM source_table
      │      │   INSERT INTO DuckDB _src__{source}__{table}
      │
      └── Phase 2: Model Execution (topological order)
             │ For each model in dependency order:
             │   renderModelSql()  (expand ref() and source())
             │   CREATE OR REPLACE TABLE "{model_name}" AS {sql}
             │   sseEmitter: model_run_update
             │   on error (sql-writer session open):
             │     triggerSelfHeal() → max 3 retries
             │
             └── Auto-trigger test run after success
```

### 14.3 Test Failure Self-Heal Loop

```
Model materialization
      │ SQL execution error
      ▼
test_failure_handoff(model, error_context)
      │
      ▼
sql-writer subagent
  receives: error message + model SQL + schema
      │
      ▼
sql-writer proposes fix SQL
      │
      ▼
write_model_file (approval gate)
User reviews SQL diff → Approve
      │
      ▼
Re-materialize model
      │
      ├── pass → continue build
      └── fail → retry (max 3) → error report to user
```

---

## 15. Orchestration Patterns

All four classic agentic patterns are demonstrated in AInderstanding:

### Sequential
**Example:** Sub-module lifecycle
```
Connect → Explore → Govern → Model → Test → Document → Export
```
Each phase produces artifacts that the next phase depends on.

### Parallel
**Example:** Data profiling 10 tables simultaneously
```typescript
await Promise.all(
  tables.map(table => invokeSubagent('data-profiler', { table }, ctx))
)
```
**Example:** Writing staging SQL for N independent models
```typescript
await Promise.all(
  stagingModels.map(m => invokeSubagent('sql-writer', { model: m }, ctx))
)
```

### Loop
**Example:** Documentation conversation loop
```
interviewer asks question
  → user responds
    → docs-keeper records
      → update_coverage
        → assess_readiness
          → if not ready: interviewer asks next question
            → ...
```
**Example:** SQL self-heal loop (max 3 retries)

### Conditional
**Example:** `model-architect` topology selection
- Single source, low cardinality → flat model
- Multi-source, identified facts → star schema
- Complex hierarchies → snowflake schema

**Example:** `test-generator` test type selection
- 100% distinct + `*_id` column → `unique` test
- Low cardinality categorical → `accepted_values` test
- Identified FK in lineage → `foreign_key` test

---

## 16. Security Model

### Source DB Security
- **SELECT-only** enforced at two layers: regex pre-check + AST parse (`node-sql-parser`)
- Applies to: source adapters, test SQL, AI-generated queries, user SQL run via Monaco
- Connection credentials **encrypted in SQLite** (AES-256-GCM via `node:crypto`; `AIBIO_ENCRYPTION_KEY` env var required at startup — app refuses to start without it). Implemented in Phase P0a, not deferred.

### AI Data Exposure Security
- Govern's guarded tools are the **only valid path** to source data for agents
- ESLint rule blocks direct imports of `modules/ainderstanding/connect/lib/adapters/*` from any module except Govern
- Query results are never auto-forwarded to agent context (agent gets metadata, not rows)
- PII columns masked in all sample responses with `[{PII_SUBTYPE}_MASKED]` placeholder

### Agent Scope Limitation
- Supervisor **cannot** call `write_model_file`, `write_test_file`, `write_doc_record` directly — these are excluded from its tool list
- All writes go through specialized subagents with approval gates
- Subagents receive only tools registered by their owner sub-module

### Audit Log Retention
- `audit_entries` retention: 1 year from `created_at`; monthly rotation via background job (Phase G1)
- GDPR delete flow: workspace delete → soft delete (`deleted_at`) on all related audit entries → physical purge after 30-day archive window
- Raw query results (`guarded_run_select_query`) are in-memory only (not persisted to SQLite); cleared on server restart

### No DDL/DML Ever
The platform makes no writes to source databases — no `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `MERGE`, `GRANT`, `REVOKE`, `COMMENT`. **SELECT only.**

---

## 17. Deployment

### v1 — Local Development

```bash
npm run dev    # Next.js dev server on localhost:3000
```

- SQLite `aibio.db` in project root (configurable via `AIBIO_DB_PATH`)
- `ANTHROPIC_API_KEY` environment variable required
- DuckDB datamart per workspace at `workspaces/{id}/datamart.duckdb`
- Single-user, single-workspace typical usage

### v2 — Desktop App (Planned)

- **Tauri** wrapper for native macOS/Windows installer
- App data at OS-standard path (`app.path.appData + '/aibio.db'`)
- Bundles Node.js runtime + Next.js build

### Key Configuration

| Env var | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | (required) | Claude API access |
| `AIBIO_ENCRYPTION_KEY` | (required) | 32-byte base64 key pre AES-256-GCM šifrovanie credentials; app odmietne naštartovať bez nej |
| `AIBIO_DB_PATH` | `./aibio.db` | SQLite database location |
| `AIBIO_WORKSPACES_PATH` | `./workspaces` | Root directory for workspace-scoped files (SQL models, test YAML, DuckDB). Override in containers: `/data/workspaces` |
| `NODE_ENV` | `development` | Controls DB singleton behavior |

### Next.js Config Notes

- `better-sqlite3` requires `serverExternalPackages: ['better-sqlite3']` in `next.config.ts` (native addon, not bundleable)
- DuckDB requires same treatment: `serverExternalPackages: ['duckdb-async']`
- All agentic operations run in Next.js Route Handlers (not Edge Runtime; `AsyncLocalStorage` required)

---

## References

- [AIBIO.md](./AIBIO.md) — Top-level product vision and roadmap
- [AINDERSTANDING.md](./AINDERSTANDING.md) — AInderstanding product overview and sub-module index
- [core/GOAL.md](./00-core/GOAL.md) — Phase 0 foundation: types, DB, MCP server, approval gate, SSE
- [shell/GOAL.md](./01-shell/GOAL.md) — Supervisor orchestrator, WorkspaceLayout, AI modes
- [connect/GOAL.md](./02-connect/GOAL.md) — Source connection management
- [explore/GOAL.md](./03-explore/GOAL.md) — Schema discovery and data profiling
- [govern/GOAL.md](./04-govern/GOAL.md) — GDPR control plane, permission enforcement, audit
- [model/GOAL.md](./05-model/GOAL.md) — Dimensional modeling, SQL authoring, materialization
- [document/GOAL.md](./06-document/GOAL.md) — Governance documentation via conversation
- [test/GOAL.md](./07-test/GOAL.md) — Data quality test framework
- [export/GOAL.md](./09-export/GOAL.md) — dbt-compatible export

---

*Architecture document — AIBIo AInderstanding. Auto-generated from full documentation review.*
