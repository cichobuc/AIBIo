Start implementing the specified development phase for AIBIo.

Arguments: $ARGUMENTS
(e.g. P0a, P0b, P0c, P0d, C1, or a module name like "connect", "explore")

## Phase map

| ID   | Scope                             | Est. |
|------|-----------------------------------|------|
| P0a  | core/types/ + core/db/            | ~4h  |
| P0b  | MCP server + approval gate + SSE  | ~4h  |
| P0c  | routing + WorkspaceLayout         | ~3h  |
| P0d  | GlobalChatPanel + supervisor      | ~5h  |
| C1   | Connect sub-module                | ~3d  |

## Steps to follow

1. **Read the relevant doc** — identify the phase from `$ARGUMENTS`, then read the corresponding doc(s) from `docs/`. Phase 0 → read `docs/CORE.md` + `docs/SHELL.md`. Module phases → read `docs/<MODULE>/GOAL.md` + `docs/<MODULE>/RULES.md`.

2. **Audit existing code** — check `src/` (or `core/`, `app/`) for what already exists for this phase. Use `find` and `grep` to avoid duplicating work.

3. **Identify concrete deliverables** — list exactly what files/types/functions need to be created or modified based on the doc spec. Create tasks for each deliverable.

4. **Implement in doc order** — follow the spec exactly. Do not add features not in the doc. Do not skip required pieces.

5. **Validate after each file** — run `npx tsc --noEmit` after each TypeScript file to catch type errors immediately. Fix before moving on.

6. **Cross-check the doc** — after implementing, re-read the relevant doc section and verify nothing was missed.

## Key invariants (never break these)

- All tool handlers wrapped in try/catch, emit `stream_error` SSE on failure
- All data access to source DBs goes through `core/agent-sdk/` — never raw query in modules
- GDPR: query results require `awaitApproval()` before returning to LLM
- No `any` types, no `var`, no `console.log` in production code
- Package manager: `npm` only
