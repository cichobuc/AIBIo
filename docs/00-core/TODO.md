# TODO — Core (Foundation)

> **Phase:** P0a–P0b
> **Status:** complete (P0a + P0b hotové)
> **Owner docs:** [GOAL.md](./GOAL.md)
> **Cross-refs:** ../ARCHITECTURE.md §5.1–5.4, ../DATABASE_SCHEMA.md §1 (singleton), ../MCP_TOOLS.md (tool registry), ../API_CONTRACT.md §SSE + Approvals, ../AGENT_PROMPTS.md (AgentContext inject)

## 1. Účel

Technická foundation — žiadna business logika. Zodpovednosť za 4 oblasti: (1) shared TypeScript typy pre celý projekt, (2) Drizzle/SQLite singleton + migrácie, (3) in-process MCP server s tool registry, (4) approval gate + SSE emitter + AgentContext AsyncLocalStorage injekcia.

## 2. Stav existujúceho kódu

- [x] `core/types/workspace.ts` — `Workspace`, `DataSource`, `ConnectionConfig`, `AIMode`
- [x] `core/types/agent.ts` — `SubagentName`, `ActorName`, `AgentContext`, `TokenCounter`
- [x] `core/types/permissions.ts` — `PermissionTier`, `ApprovalGateType`, `ApprovalGateDetails`, `PiiSubtype`, `ConfidenceLevel`
- [x] `core/types/index.ts` — re-exporter
- [x] `core/agent-sdk/mcp-server.ts` — singleton (`global.__aibio_mcp`), `InMemoryTransport`, `callTool()` wrapper s `withAgentContext`
- [x] `core/agent-sdk/tool-registry.ts` — `registerTool / getTool / getAllTools / getToolsForAgent` (filter cez `allowedCallers`)
- [x] `core/agent-sdk/approval-gate.ts` — `awaitApproval / resolveApproval / cleanupPendingGates`, 300s timeout, `ApprovalDeniedError`; promise vždy resolvuje, nikdy nerejektuje
- [x] `core/agent-sdk/streaming.ts` — `WorkspaceSSEEmitter`, kompletný `SSEEvent` union vrátane `BaseSSEEvent` (sessionId, workspaceId, timestamp) na každom evente okrem `PingEvent`
- [x] `core/agent-sdk/context.ts` — `AsyncLocalStorage` injektor, `withAgentContext`, `getAgentContext`, `recordTokenUsage`, `BudgetExceededError`
- [x] `core/config.ts` — env validácia (`ANTHROPIC_API_KEY`, `AIBIO_ENCRYPTION_KEY`, `AIBIO_DB_PATH`, `AIBIO_WORKSPACES_PATH`)
- [x] `core/db/client.ts` — Drizzle singleton nad `better-sqlite3` s `globalThis.__aibio_db` guard
- [x] `core/db/migrate.ts` — `runMigrations()` cez drizzle migrator
- [x] `core/db/encryption.ts` — AES-256-GCM `encrypt / decrypt` s typed errors
- [x] `core/db/schema.ts` — barrel re-export sub-modulových schém
- [x] `core/db/schema/workspace.ts` — Drizzle schema pre `workspaces` a `workspace_settings`
- [x] `core/ui/index.ts` — shadcn/ui re-exporty (Button, Dialog, Badge, Tooltip, ScrollArea, Separator, Sheet, Input, Select, Textarea, Tabs, Card, DropdownMenu)
- [x] `app/api/stream/[workspaceId]/route.ts` — SSE GET handler s heartbeat 15s, `ping` event, workspace 404 check
- [x] `app/api/approvals/[requestId]/route.ts` — POST handler, volá `resolveApproval`, emituje `approval_resolved`; 404/409/400 error envelopes
- [x] `app/api/health/route.ts` — env check + `SELECT 1` DB check; `{ status, reason, timestamp }` response shape
- [x] `next.config.ts` — `serverExternalPackages: ['better-sqlite3', 'duckdb-async', ...]`
- [x] `instrumentation.ts` — SIGTERM/SIGINT hook → `cleanupPendingGates()`
- [x] `eslint.config.mjs` — `no-restricted-imports` guard pre `core/db/client` a `core/db/migrate`
- [x] `vitest.config.ts` — `node` environment, `forks` pool, `@` alias

## 3. Závislosti

- **Závisí od:** —
- **Blokuje:** všetky ostatné moduly (01–09); najmä `core/db/client.ts` blokuje každú Drizzle schému

## 4. Implementačný checklist

### 4.1 DB — `core/db/`

- [x] `core/db/client.ts` — Drizzle singleton nad `better-sqlite3`:
  ```ts
  import Database from 'better-sqlite3';
  import { drizzle } from 'drizzle-orm/better-sqlite3';
  // globalThis.__aibio_db guard pre Next.js hot reload
  // použiť getConfig().dbPath; WAL mode; foreign_keys ON
  ```
- [x] `core/db/migrate.ts` — `runMigrations()` volaný pri cold start; importuje `migrate` z `drizzle-orm/better-sqlite3/migrator`
- [x] `core/db/encryption.ts` — `encrypt(plaintext: string): EncryptedPayload` a `decrypt(payload: EncryptedPayload): string` cez Node.js `crypto.createCipheriv('aes-256-gcm', ...)` s `AIBIO_ENCRYPTION_KEY`; fail-fast ak key chýba
- [x] `core/db/schema.ts` — barrel export schém; sub-modulové schémy sa dopĺňajú postupne

### 4.2 MCP / streaming dorobky

- [x] Doplniť `sessionId: string` a `workspaceId: string` do každého `SSEEvent` variantu v `streaming.ts` — `BaseSSEEvent` je základom každého eventu okrem `PingEvent`
- [x] Server shutdown hook → `cleanupPendingGates()` (zabrání dangling Promise leaks pri dev hot reload)
- [x] `awaitApproval` API kontrakt — implementácia vracia `{ promise: Promise<ApprovalResult>; requestId: string }`. `requestId` sa emituje cez SSE `approval_required` event. Promise vždy resolvuje (nikdy nerejektuje) — callerove toolhandlery si samy throwujú `ApprovalDeniedError` ak `result.decision === 'denied'`.

### 4.3 Config + Next.js

- [x] `next.config.ts` — `serverExternalPackages: ['better-sqlite3', 'duckdb-async']` pridané
- [x] `app/api/health/route.ts` — `SELECT 1` test na DB singleton

### 4.4 UI primitives

- [x] `core/ui/index.ts` — re-exporty shadcn/ui komponentov ktoré reuse všetky moduly: `Button`, `Dialog`, `Badge`, `Tooltip`, `ScrollArea`, `Separator`, `Sheet`, `Input`, `Select`, `Textarea`, `Tabs`, `Card`, `DropdownMenu`

### 4.5 ESLint guard

- [x] `eslint.config.mjs` — pravidlo `no-restricted-imports` zakazujúce import `@/core/db/client` a `@/core/db/migrate` mimo `core/db/**` a `app/api/**`

### 4.6 Max-budget per session (P0 requirement — AIBIO.md §6 riziko)

- [x] Token counter v `AgentContext` — `tokenCounter: { input: number; output: number }` a `tokenLimit: number` v type; inicializovaný v `withAgentContext`
- [x] Warning threshold: pri prekročení 80 % limitu emituj `SSEEvent { type: 'budget_warning', usedTokens, limitTokens, thresholdPct }` na frontend (cez `recordTokenUsage()`)
- [x] Hard stop: pri prekročení 100 % limitu throwuje `BudgetExceededError` + emituje `stream_error`
- [x] Default limit: `100_000` input+output tokenov per session (konfigurovateľné cez `workspace_settings.max_session_tokens`)
- [x] `workspace_settings.max_session_tokens` — `INTEGER NOT NULL DEFAULT 100000` — v `core/db/schema/workspace.ts`

### 4.7 Integration test

- [x] `core/__tests__/mcp-approval-flow.test.ts` — 6 testov všetky zelené:
  - `registerTool → callTool` round-trip
  - `awaitApproval → resolveApproval` happy path (approved)
  - deny path
  - 3 paralelné `awaitApproval` volania (AsyncLocalStorage isolation)
  - timeout test (fake timers)

## 5. GDPR / Safety pravidlá

- [x] `AIBIO_ENCRYPTION_KEY` nikdy v logoch — `getConfig()` loguje len názov kľúča ak chýba, nie hodnotu
- [x] `decrypt()` fail-fast s typovanou chybou pri nesprávnom IV alebo auth tag (nie silent corrupt)
- [x] Audit entries sú read-only — `core/db` neexportuje delete/update helper pre `audit_entries` tabuľku

## 6. Verifikácia (end-to-end)

- [x] `npm run type-check` — 0 errors
- [x] `npm test` — 6/6 testov zelených (`core/__tests__/mcp-approval-flow.test.ts`)
- [x] `npm run lint` — 0 errors; `no-restricted-imports` guard aktívny
- [ ] `npm run dev` — cold start bez chyby; `GET /api/health` vráti `{ status: 'ok', timestamp }`
- [ ] MCP inspector: `npx @modelcontextprotocol/inspector` — server sa spustí, list tools vráti 0 tools
- [ ] Hot reload: zmena kódu → Next.js reload → `global.__aibio_db` guard zabrání double-open

## 7. Odkazy

- [GOAL.md](./GOAL.md) — funkčný spec (MCP server, approval gate, SSE protokol, shared types, DB)
- [../ARCHITECTURE.md](../ARCHITECTURE.md) — §5.1 Foundation Layer, §5.4 AsyncLocalStorage riziko
- [../DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) — §1 DB singleton konfigurácia
- [../API_CONTRACT.md](../API_CONTRACT.md) — SSE Events spec, `/api/approvals`, `/api/stream`, `/api/health`
- [../TESTING.md](../TESTING.md) — Vitest konfigurácia, integration test patterns
