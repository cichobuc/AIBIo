# Core — Invariants & Rules

> **Scope:** Technické invarianty pre `core/` infraštruktúru. Pravidlá pre `shell/` orchestrátor sú v `01-shell/RULES.md`. Detailná špecifikácia mechanizmov je v `ARCHITECTURE.md §9–§11`.

---

## MCP Tool Registry

**CR-MCP-001** — Každý sub-modul registruje tools pri startup cez `registerTool()` z `core/agent-sdk/tool-registry.ts`.

**CR-MCP-002** — `allowedCallers` v `registerTool()` je enforced at runtime. MCP server odmietne `tool_use` kde `agentName ∉ allowedCallers`. Zdroj pravdy pre allowedCallers: `MCP_TOOLS.md`.

**CR-MCP-003** — Supervisor dostane iba tools kde `allowedCallers.includes('supervisor')`. Sub-agenti dostanú iba tools svojho owner sub-modulu. Žiadny agent nemôže volať tool iného modulu priamo — iba cez supervisor dispatch.

---

## Approval Gate

**CR-AG-001** — Presne 5 `ApprovalGateType` hodnôt: `execute_query`, `share_results_with_ai`, `write_model_file`, `write_test_file`, `write_to_docs`. Žiadne ďalšie. Menenie enum = breaking change.

**CR-AG-002** — Timeout 300 sekúnd je konštanta pre všetky gates. Nie je konfigurovateľný per-gate.

**CR-AG-003** — Paralelné approval gates sú serializované. Supervisor nespustí druhý gate kým prvý nie je resolved. Viď `ARCHITECTURE.md §9`.

**CR-AG-004** — Gate musí byť resolved pred pokračovaním tool handlera. `awaitApproval()` je `Promise<'approved' | 'denied'>` — nikdy nie-blocking.

---

## SSE Streaming Protocol

**CR-SSE-001** — Každý agentic run musí skončiť s `stream_end` event — aj pri chybe. Sekvenecia: `stream_error` → `stream_end`. Nikdy neopúšťaj stream bez closure eventu.

**CR-SSE-002** — Heartbeat `{ type: 'ping' }` každých 15 sekúnd na idle connections (zabraňuje browser timeout).

**CR-SSE-003** — SSE stream je workspace-scoped (`WorkspaceSSEEmitter`). Jeden workspace = jeden aktívny stream.

**CR-SSE-004** — `sessionId` je korelačný string (UUID) generovaný pri každom user message. Nie je FK — sessions sú in-memory. Používa sa pre audit log koreláciu a `chat_messages` grouping.

---

## Database Client

**CR-DB-001** — SQLite WAL mode je povinný: `db.pragma('journal_mode = WAL')`. Bez neho paralelný data-profiler write spôsobí `SQLITE_LOCKED`.

**CR-DB-002** — `busy_timeout = 5000` (5 sekúnd). Eliminuje immediate lock fail pri race conditions.

**CR-DB-003** — Sub-moduly importujú len `core/types` a `core/ui`. **Nesmú importovať `core/db` priamo** — používajú vlastné Drizzle schémy re-exportované cez `core/db/client.ts`. Zabraňuje circular imports.

**CR-DB-004** — Credentials sú vždy AES-256-GCM encrypted pred zápisom do SQLite. `AIBIO_ENCRYPTION_KEY` env var je required pri startup. App nesmie štartovať bez neho.

---

## References

- Mechanizmy (code patterns, state machines): [../ARCHITECTURE.md §5, §9, §10, §11](../ARCHITECTURE.md)
- Tool catalog (names, callers, TypeScript types): [../MCP_TOOLS.md](../MCP_TOOLS.md)
- Implementačný checklist: [TODO.md](./TODO.md)
