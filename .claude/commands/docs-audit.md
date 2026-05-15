Run a documentation sync audit — verify the implementation matches the docs/ specifications.

Arguments (optional): $ARGUMENTS
(doc filename or module to focus on, e.g. "CORE.md", "connect", or leave empty for a full audit)

Delegate this task to the `docs-sync-auditor` subagent which has specialized instructions for this kind of audit.

## What to audit

If `$ARGUMENTS` is provided, focus on that doc or module. Otherwise audit all docs in this order (most critical first):

1. `CORE.md` — foundation types, MCP server, approval gate, SSE protocol
2. `SHELL.md` — supervisor state machine, AI modes, intent classifier
3. Active module docs (whichever has the most recent code changes)
4. `ARCHITECTURE.md` — check that file/folder structure matches §13

## Report format expected

The audit should produce:

```
## Docs Sync Audit: <doc>
Date: <today>

### ✅ Verified  — claims found in code
### ❌ Missing   — doc says must exist, not found
### ⚠️ Diverged  — exists but shape differs from spec
### 📋 Planned   — explicitly future/phase-N, not yet expected

Summary:
Coverage: N/M (X%)
Critical gaps: <anything that blocks other features>
```

## Key things to check for each doc

**CORE.md:**
- `AgentContext` type shape matches `core/types/agent.ts`
- `awaitApproval()` signature matches `core/orchestration/approval-gate.ts`
- SSE event union in `core/orchestration/streaming.ts` covers all events listed in doc
- MCP singleton pattern in `core/orchestration/mcp-server.ts`

**ARCHITECTURE.md:**
- File system layout (§13) matches actual `src/` structure
- API routes exist: `/api/stream/[workspaceId]`, `/api/approvals/[requestId]`
- 28 MCP tools from §11 — check which are registered vs planned

**Module docs (CONNECT.md, EXPLORE.md, etc.):**
- DB table definitions match `DATABASE_SCHEMA.md`
- MCP tool names match what's in `MCP_TOOLS.md`
- API route handlers exist under `app/api/`
