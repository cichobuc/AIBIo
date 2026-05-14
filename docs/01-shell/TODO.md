# TODO — Shell (Supervisor + Workspace UI)

> **Phase:** P0c–P0d
> **Status:** not started
> **Owner docs:** [GOAL.md](./GOAL.md), [RULES.md](./RULES.md), [UI.md](./UI.md)
> **Cross-refs:** ../ARCHITECTURE.md §5.3 §7 §15, ../DATABASE_SCHEMA.md §4 (workspace_settings), ../MCP_TOOLS.md (supervisor tool whitelist), ../API_CONTRACT.md §POST-chat §GET-messages, ../AGENT_PROMPTS.md §1 (supervisor system prompt)

## 1. Účel

Riadiaca vrstva AInderstandingu. Rieši routing a navigáciu, GlobalChatPanel (jediný chat input pre celý workspace), supervisor agent ktorý klasifikuje user intent a dispatchuje na subagentov, a ModeSelector (Auto / Documentation / Queries / Manual). Shell neobsahuje datamart logiku — len orchestráciu.

## 2. Stav existujúceho kódu

- [x] `app/api/stream/[workspaceId]/route.ts` — existuje (v Core)
- [x] `app/api/approvals/[requestId]/route.ts` — existuje (v Core)
- [ ] Všetky shell komponenty, hooks, lib — greenfield

## 3. Závislosti

- **Závisí od:** 00-core (P0a+P0b kompletné — `mcp-server`, `approval-gate`, `streaming`, `context`, `db/client`)
- **Chat messages stub:** `chat_messages` tabuľka je owned by 06-document — pre P0d postačí stub schéma alebo priamy insert bez FK
- **Blokuje:** 02-connect, 03-explore, 04-govern, 05-model, 06-document, 07-test, 08-translate, 09-export (všetky závisia od supervisor dispatch frameworku)

## 4. Implementačný checklist

### 4.1 DB schema (`modules/ainderstanding/shell/db/schema.ts`)

- [ ] Tabuľka `workspace_settings` (20 stĺpcov podľa DATABASE_SCHEMA.md §4) — 1:1 per workspace, vzniká s defaultmi pri create workspace:
  - `id` UUID PK, `workspace_id` FK `workspaces.id` CASCADE UNIQUE
  - `query_timeout_sec` default `30`
  - `auto_profile_on_source_add` boolean default `true`
  - `profile_sample_threshold_rows` default `1000000`
  - `top_values_per_column` default `10`
  - `schema_change_auto_detect` boolean default `true`
  - `pii_heuristics_enabled` boolean default `true`
  - `self_heal_max_retries` default `3`
  - `parallel_build_concurrency` default `4`
  - `auto_run_tests_after_materialize` boolean default `true`
  - `ai_test_generation_enabled` boolean default `true`
  - `test_execution_timeout_sec` default `30`
  - `failing_pk_samples_count` default `5`
  - `auto_write_docs` boolean default `true`
  - `doc_verbosity` enum(`minimal`, `standard`, `detailed`) default `standard`
  - `doc_confidence_threshold` enum(`high`, `medium`, `low`) default `high`
  - `show_tool_calls` boolean default `true`
  - `max_supervisor_turns` default `20`
  - `updated_at`
  - **Poznámka:** `approval_timeout_sec` a `audit_log_enabled` patria do `approval_settings` (Govern, nie tu); `ai_mode` patrí do `workspaces` (Connect)

### 4.2 API endpointy

- [ ] `app/api/chat/[workspaceId]/route.ts` — POST:
  - Validácia: max 4000 znakov (BR-SHL-005), Manual mode → 400, aktívna session conflict → 409
  - Persist message do `chat_messages` (stub insert kým 06-document nie je hotový)
  - Vygenerovať `sessionId` UUID, dispatch supervisor
  - Vrátiť `{ sessionId, status: 'dispatched', messageId }`
- [ ] `app/api/chat/[workspaceId]/messages/route.ts` — GET:
  - Cursor-based paginácia (`?before=<messageId>&limit=50`)
  - Vrátiť pole `{ id, role, content, agentName?, timestamp }`

### 4.3 Routes (`app/workspace/`)

- [ ] `app/workspace/[workspaceId]/layout.tsx` — server component wrapper, `WorkspaceLayout` inject
- [ ] `app/workspace/[workspaceId]/[module]/page.tsx` — dynamic segment, stub pre každý z 8 modulov (connect, explore, govern, model, document, test, translate, export) — len heading + "Coming soon"
- [ ] `app/workspace/[workspaceId]/page.tsx` — redirect na `/connect` (default modul)

### 4.4 UI komponenty (`modules/ainderstanding/shell/components/`)

- [ ] `WorkspaceLayout.tsx` — flex container s:
  - Top bar (48px): workspace name, ModeSelector, user avatar
  - Activity bar (48px wide): module icons s tooltip labels
  - Primary sidebar (260px): contextual per-module panel slot
  - Main content: `{children}` (každý sub-modul page)
  - AI chat panel (360px right): `GlobalChatPanel`
  - Bottom panel: output tabs (Run Results, Test Results, Logs)
  - Status bar (24px): aktívny agent, session state
- [ ] `SideNav.tsx` / `ActivityBar.tsx` — ikony pre Connect, Explore, Govern, Model, Document, Test, Translate, Export + Settings, Help; aktívny modul = 2px accent border left
- [ ] `ModeSelector.tsx` — `DropdownMenu` s 4 možnosťami: Auto / Documentation / Queries / Manual; uloží do `workspace_settings.ai_mode` + do `WorkspaceContext`
- [ ] `GlobalChatPanel.tsx`:
  - Header s "AI Assistant" titulom + collapse button
  - `ActiveAgentsBadge` — zobrazí mená aktívnych agentov (z SSE `agent_thinking` events)
  - `MessageList` — scroll container, SSE-driven updates
  - `ContextBar` — aktívny modul + posledný source (mini info strip)
  - `ChatInput` — textarea, ⌘↵ submit, disabled v Manual mode a počas approval gate (BR-SHL-010, BR-SHL-047)
- [ ] `MessageList.tsx` — render per `SSEEvent.type`:
  - `agent_thinking` → spinner s agentName
  - `agent_message` → chat bubble s agentName badge, partial streaming support
  - `tool_call` → collapsible tool call chip (toolName)
  - `tool_result` → success/error indicator + summary
  - `approval_required` → trigger pre `ApprovalDialog` (nerendruje priamo, emituje event)
  - `stream_end` → "Done" indicator
  - `stream_error` → error banner
  - `doc_update`, `coverage_update`, `model_run_update`, `test_run_update`, `schema_update` → subtle system message
- [ ] `ApprovalDialog.tsx` — globálny modal (nad všetkým):
  - Počúva SSE `approval_required` event
  - Renderuje type-specific detail podľa `gateType`: SQL snippet pre `execute_query`, model name pre `write_model_file`, doc preview pre `write_to_docs`, test SQL pre `write_test_file`, row count pre `share_results_with_ai`
  - Tlačidlá: Approve / Deny / "Approve for session" (session-scoped policy)
  - POST `{ decision: 'approved' | 'denied' }` na `/api/approvals/[requestId]`
  - Počas čakania: `ChatInput` disabled

### 4.5 Hooks (`modules/ainderstanding/shell/hooks/`)

- [ ] `useWorkspaceContext.ts` + `WorkspaceContextProvider`:
  - State: `{ workspaceId, activeModule, aiMode, isSessionActive, sessionId }`
  - Poskytnutý cez `app/workspace/[workspaceId]/layout.tsx`
- [ ] `useSSEStream.ts` — `EventSource` wrapper:
  - Auto-connect na `GET /api/stream/[workspaceId]`
  - Heartbeat: server posiela `ping` event každých 15s (API_CONTRACT.md) — klient ignoruje `ping`, ale deteguje absenciu (> 30s bez eventu → reconnect)
  - Auto-reconnect pri disconnect (exponential backoff: 1s, 2s, 4s, 8s, max 5× — BR-SHL-061)
  - Filter events podľa `sessionId` (ignorovať eventy z iných sessions)
  - Ignorovať `ping` events
  - Typed dispatch do `onEvent(event: SSEEvent)` callback
  - `ANTHROPIC_API_ERROR` na strane servera → server emituje `stream_error` SSE event → UI zobrazí error banner s retry CTA

### 4.6 Lib (`modules/ainderstanding/shell/lib/`)

- [ ] `intent-classifier.ts` — sync rule-based (nie LLM):
  - Input: `{ message, activeModule, aiMode, workspaceState }`
  - Output: `DispatchPlan { mode: 'manual_only' | 'single_agent' | 'parallel' | 'multi_step', steps: AgentStep[] }`
  - Pravidlá: BR-SHL-020 (mode filtering), BR-SHL-021 (active module boost)
  - Manual mode → `{ mode: 'manual_only', steps: [] }`
- [ ] `session-manager.ts`:
  - `createSession(workspaceId): Session` — UUID, timestamp, initial state
  - `getActiveSession(workspaceId): Session | null`
  - `endSession(sessionId): void`
  - In-memory Map, cleanup pri `stream_end`
  - BR-SHL-033: max 1 aktívna session per workspace
- [ ] `supervisor-state.ts` — state machine:
  - States: `IDLE → CLASSIFYING → DISPATCHING → WAITING_APPROVAL → STREAMING → COMPLETING → IDLE`
  - Max 20 turns hard cap (BR-SHL-003) — after 20 turns force `COMPLETING`
  - Persist state per sessionId in-memory
- [ ] `dispatcher.ts`:
  - `invokeSubagent(name, tools, context): Promise<SubagentResult>`
  - Parallel dispatch: `Promise.all()` pre `parallelGroup` steps
  - Serialized approval: čaká na resolve pred ďalším krokompre BR-SHL-023
- [ ] `post-processing.ts` — automatické post-processing hooks (BR-SHL-045):
  - Po `sql-writer` → volá `parse_lineage` MCP tool
  - Po `docs-keeper` → volá `update_coverage`
  - Po `materialize_models` → volá `run_tests`

### 4.7 Supervisor agent (`modules/ainderstanding/shell/orchestrator.ts`)

- [ ] Factory function `createSupervisor(context: AgentContext)` — vracia `Supervisor` instance
- [ ] `@anthropic-ai/sdk` `client.messages.create()` so `stream: true`
- [ ] Model: `claude-sonnet-4-6`, temperature: `0`, max_tokens: `4096`
- [ ] System prompt — z AGENT_PROMPTS.md §1; inject: `workspaceId`, `activeModule`, `aiMode`, `sourcesSummary`, `modelCount`, `docCoveragePct`
- [ ] Granted tools (read-only + orchestration) — z MCP_TOOLS.md supervisor whitelist:
  - `validate_sql`, `parse_lineage`, `materialize_models`, `run_tests`, `test_failure_handoff`
  - `update_coverage`, `assess_readiness`, `guarded_share_results`
  - `invoke_subagent` (interný, nie MCP — volá `dispatcher.ts`)
- [ ] **Vynechané** (write tools): `write_model_file`, `write_test_file`, `write_doc_record`, `write_doc_record_update` (BR-SHL-001)
- [ ] Streaming response → SSE emit každého chunk cez `sseEmitter.emit(workspaceId, event)`
- [ ] Tool use response handling → dispatch na subagenta cez `dispatcher.ts`

## 5. GDPR / Safety pravidlá (z RULES.md)

- [ ] BR-SHL-001: supervisor nikdy nepoužíva write tools priamo
- [ ] BR-SHL-003: max 20 turns per session — hard cap v supervisor state machine
- [ ] BR-SHL-005: max 4000 znakov na user message — validácia pred persist
- [ ] BR-SHL-010: ChatInput disabled v Manual mode
- [ ] BR-SHL-023: approval gates serializované pri parallel dispatch — nesmú bežať concurrent
- [ ] BR-SHL-033: max 1 aktívna session per workspace
- [ ] BR-SHL-047: ChatInput disabled počas aktívneho approval gate

## 6. Verifikácia (end-to-end)

- [ ] **Routing:** navigácia medzi Connect, Explore, Model — URL sa mení, SideNav highlight, žiadny full page reload
- [ ] **Chat dispatch:** send message → supervisor sa zavolá → SSE stream príde → MessageList sa updatuje v realtime
- [ ] **Mode switch:** prepni na Manual → ChatInput zobrazí tooltip "AI disabled", POST na chat vracia 400
- [ ] **Approval dialog:** manuálne trigger `approval_required` SSE event (cez debug tool) → dialog sa zobrazí, ChatInput disabled, po Approve sa dialog zatvorí a stream pokračuje
- [ ] **Parallel agents:** debug message spustí 2 agentov paralelne → v MessageList vidíme interleaved správy s rozličnými `agentName` badges
- [ ] **Reconnect:** ukončiť server na 5s → obnoviť → `useSSEStream` sa automaticky reconnectne (max 5 pokusov)
- [ ] Integration test: `npx vitest run modules/ainderstanding/shell/__tests__/`

## 7. Odkazy

- [GOAL.md](./GOAL.md) — funkčný spec
- [RULES.md](./RULES.md) — business rules (BR-SHL-*)
- [UI.md](./UI.md) — UI/UX detaily, rozmery panelov, animácie, stavy
- [../AGENT_PROMPTS.md §1](../AGENT_PROMPTS.md) — supervisor system prompt + sampling
- [../DATABASE_SCHEMA.md §4](../DATABASE_SCHEMA.md) — `workspace_settings` tabuľka
- [../API_CONTRACT.md](../API_CONTRACT.md) — POST /api/chat, GET .../messages, SSE events spec
- [../ARCHITECTURE.md §5.3 §7 §15](../ARCHITECTURE.md) — supervisor state machine, dispatch patterns
