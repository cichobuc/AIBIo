# TODO — Shell (Supervisor + Workspace UI)

> **Phase:** P0c–P0d
> **Status:** done (P0c + P0d — UI Foundation + Supervisor Orchestration complete)
> **Owner docs:** [GOAL.md](./GOAL.md), [RULES.md](./RULES.md), [UI.md](./UI.md)
> **Cross-refs:** ../ARCHITECTURE.md §5.3 §7 §15, ../DATABASE_SCHEMA.md §4 (workspace_settings), ../MCP_TOOLS.md (supervisor tool whitelist), ../API_CONTRACT.md §POST-chat §GET-messages, ../AGENT_PROMPTS.md §1 (supervisor system prompt)

## 1. Účel

Riadiaca vrstva AInderstandingu. Rieši routing a navigáciu, GlobalChatPanel (jediný chat input pre celý workspace), supervisor agent ktorý klasifikuje user intent a dispatchuje na subagentov, a ModeSelector (Auto / Documentation / Queries / Manual). Shell neobsahuje datamart logiku — len orchestráciu.

## 2. Stav existujúceho kódu

- [x] `app/api/stream/[workspaceId]/route.ts` — existuje (v Core)
- [x] `app/api/approvals/[requestId]/route.ts` — existuje (v Core)
- [ ] `app/api/chat/[workspaceId]/route.ts` — POST handler s persist + supervisor dispatch
- [ ] `app/api/chat/[workspaceId]/messages/route.ts` — GET s cursor pagination
- [x] `app/workspace/[workspaceId]/layout.tsx` — WorkspaceLayout server component wrapper
- [x] `app/workspace/[workspaceId]/page.tsx` — redirect na /connect
- [x] 7 stub pages (connect, explore, govern, model, document, test, export) + dynamic `[module]/page.tsx`
- [x] `modules/ainderstanding/shell/components/` — WorkspaceLayout, ActivityBar, TopBar, ModeSelector, StatusBar, GlobalChatPanel, MessageList, ChatInput, ApprovalDialog, ActiveAgentsBadge, ContextBar, CommandPalette, BottomPanel, PrimarySidebar (stub), ToolCallChip, ApprovalRequiredCard
- [x] `modules/ainderstanding/shell/store/workspace-store.ts` — Zustand store s persist middleware (nahradil useWorkspaceContext)
- [x] `modules/ainderstanding/shell/hooks/useSSEStream.ts` — EventSource wrapper, backoff 1/2/4/8/16s max 5×
- [x] `modules/ainderstanding/shell/hooks/useKeyboardShortcuts.ts` — ⌘B/⌘⇧A/⌘J/⌘1-7
- [ ] `modules/ainderstanding/shell/lib/supervisor-state.ts` — SupervisorState discriminated union, MAX_TURNS
- [ ] `modules/ainderstanding/shell/lib/intent-classifier.ts` — sync classifyIntent
- [ ] `modules/ainderstanding/shell/lib/session-manager.ts` — in-memory Map, createSession/endSession
- [ ] `modules/ainderstanding/shell/lib/dispatcher.ts` — invokeSubagent (P0d stub), invokeParallel
- [ ] `modules/ainderstanding/shell/lib/post-processing.ts` — runPostProcessing (no-op v P0d)
- [ ] `modules/ainderstanding/shell/orchestrator.ts` — createSupervisor factory, Anthropic SDK stream

## 3. Závislosti

- **Závisí od:** 00-core (P0a+P0b kompletné — `mcp-server`, `approval-gate`, `streaming`, `context`, `db/client`)
- **Chat messages stub:** `chat_messages` tabuľka je owned by 06-document — pre P0d postačí stub schéma alebo priamy insert bez FK
- **Blokuje:** 02-connect, 03-explore, 04-govern, 05-model, 06-document, 07-test, 08-translate, 09-export (všetky závisia od supervisor dispatch frameworku)

## 4. Implementačný checklist

### 4.1 DB schema (`modules/ainderstanding/shell/db/schema.ts`)

- [x] Tabuľka `workspace_settings` (20 stĺpcov podľa DATABASE_SCHEMA.md §4) — 1:1 per workspace, vzniká s defaultmi pri create workspace:
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

- [x] `app/api/chat/[workspaceId]/route.ts` — POST:
  - Validácia: max 4000 znakov (BR-SHL-005), Manual mode → 400, aktívna session conflict → 409
  - Persist message do `chat_messages` (stub insert kým 06-document nie je hotový)
  - Vygenerovať `sessionId` UUID, dispatch supervisor
  - Vrátiť `{ sessionId, status: 'dispatched', messageId }`
- [x] `app/api/chat/[workspaceId]/messages/route.ts` — GET:
  - Cursor-based paginácia (`?before=<messageId>&limit=50`)
  - Vrátiť pole `{ id, role, content, agentName?, timestamp }`

### 4.3 Routes (`app/workspace/`)

- [x] `app/workspace/[workspaceId]/layout.tsx` — server component wrapper, `WorkspaceLayout` inject
- [x] `app/workspace/[workspaceId]/[module]/page.tsx` — dynamic segment, stub pre každý modul — len heading + "Coming soon"
- [x] `app/workspace/[workspaceId]/page.tsx` — redirect na `/connect` (default modul)

### 4.4 UI komponenty (`modules/ainderstanding/shell/components/`)

- [x] `WorkspaceLayout.tsx` — flex container: TopBar (48px) / ActivityBar / ResizablePanelGroup (sidebar 19% | main | chat 26%) / StatusBar; react-resizable-panels v4
- [x] `ActivityBar.tsx` — ikony pre Connect, Explore, Govern, Model, Document, Test, Export + Settings, Help; aktívny modul = 2px primary border left
- [x] `ModeSelector.tsx` — `DropdownMenu` s 4 možnosťami: Auto / Documentation / Queries / Manual; farebný indicator dot
- [x] `GlobalChatPanel.tsx` — Header + collapse button + `ActiveAgentsBadge` + `MessageList` + `ContextBar` + `ChatInput`
- [x] `MessageList.tsx` — render všetkých 16 SSEEvent typov (agent_thinking, agent_message, tool_call, tool_result, approval_required, stream_end, stream_error, doc_update, coverage_update, model_run_update, test_run_update, schema_update, approval_resolved, ping, agent_start, agent_end)
- [x] `ApprovalDialog.tsx` — Level 2 (BottomBanner fixed) + Level 3 (AlertDialog) s countdown timerom; POST na `/api/approvals/[requestId]`
- [x] `TopBar.tsx` — breadcrumb (workspaceId/module), ModeSelector, Settings/Help buttons, Avatar
- [x] `StatusBar.tsx` — mode colored dot, active agent + spinner, workspace name, ⌘K hint
- [x] `BottomPanel.tsx` — toggle (⌘J), Tabs: output/sql/results/approvals
- [x] `CommandPalette.tsx` — ⌘K dialog, Navigation/AI/Actions sekcie
- [x] `PrimarySidebar.tsx` — stub (čaká na sub-modul view implementáciu)
- [x] `ActiveAgentsBadge.tsx`, `ContextBar.tsx`, `ChatInput.tsx`, `ToolCallChip.tsx`, `ApprovalRequiredCard.tsx`

### 4.5 Hooks (`modules/ainderstanding/shell/hooks/`)

- [x] `useSSEStream.ts` — `EventSource` wrapper s exponential backoff (1/2/4/8/16s max 5×), stale detection >30s, dispatch do Zustand store
- [x] `useKeyboardShortcuts.ts` — ⌘B (sidebar), ⌘⇧A (chat), ⌘J (bottom), ⌘1-7 (navigate)
- [x] `useWorkspaceContext.ts` — nahradený Zustand store v `shell/store/workspace-store.ts`; pre-TypeScript typing wrapper ak bude potrebný

### 4.6 Lib (`modules/ainderstanding/shell/lib/`)

- [x] `intent-classifier.ts` — sync rule-based (nie LLM):
  - Input: `{ message, activeModule, aiMode, workspaceState }`
  - Output: `DispatchPlan { mode: 'manual_only' | 'direct_agent' | 'coordinator' | 'multi_phase', target?: string, steps?: AgentStep[] }`
  - Pravidlá: BR-SHL-020 (mode filtering), BR-SHL-021 (active module boost), BR-SHL-024 (coordinator bypass podmienky)
  - `coordinator` mode → `target` je meno koordinátora (napr. `'explore-coordinator'`)
  - `multi_phase` mode → LLM fallback, supervisor rozhodne o sekvencii coordinatorov/agentov
  - Manual mode → `{ mode: 'manual_only', steps: [] }`
- [x] `session-manager.ts`:
  - `createSession(workspaceId): Session` — UUID, timestamp, initial state
  - `getActiveSession(workspaceId): Session | null`
  - `endSession(sessionId): void`
  - In-memory Map, cleanup pri `stream_end`
  - BR-SHL-033: max 1 aktívna session per workspace
- [x] `supervisor-state.ts` — state machine:
  - States: `IDLE → CLASSIFYING → DISPATCHING → WAITING_APPROVAL → STREAMING → COMPLETING → IDLE`
  - Max 20 turns hard cap (BR-SHL-003) — after 20 turns force `COMPLETING`
  - Persist state per sessionId in-memory
- [x] `dispatcher.ts`:
  - `invokeCoordinator(name, context): Promise<CoordinatorResult>` — pre `coordinator` mode
  - `invokeAgent(name, tools, context): Promise<AgentResult>` — pre `direct_agent` mode
  - Parallel dispatch: `Promise.all()` pre `parallelGroup` steps (ak v `multi_phase`)
  - Serialized approval: čaká na resolve pred ďalším krokom — BR-SHL-023
- [x] `post-processing.ts` — supervisor-owned cross-phase PostToolUse hooks (BR-SHL-045b):
  - Po `materialize_models` → volá `run_tests` (ak `auto_run_tests = true`)
  - **Nie** `parse_lineage` po `sql-writer` — to je `model-coordinator` PostToolUse hook
  - **Nie** `update_coverage` po `docs-keeper` — to je `document-coordinator` PostToolUse hook

### 4.7 Supervisor agent (`modules/ainderstanding/shell/orchestrator.ts`)

- [x] Factory function `createSupervisor(context: AgentContext)` — vracia `Supervisor` instance
- [x] `@anthropic-ai/claude-agent-sdk` `query()` s async iterátorom; `agents` mapa obsahuje **4 coordinators + 8 atomic agents** (Tier 2 + Tier 3) — viď AGENT_PROMPTS.md §§1a-1e
- [x] Model: `"sonnet"` (alias), temperature: `0`, max_tokens: `4096`
- [x] System prompt — z AGENT_PROMPTS.md §1a (supervisor); inject: `workspaceId`, `activeModule`, `aiMode`, `sourcesSummary`, `modelCount`, `docCoveragePct`
- [x] **Registrácia coordinatorov v `supervisorAgents`** (CR-MCP-004):
  - `'explore-coordinator'`: `exploreCoordinatorDefinition` (tools: `['Agent', 'mcp__aibio__read_schema_snapshot']`, model: `haiku`)
  - `'model-coordinator'`: `modelCoordinatorDefinition` (tools: `['Agent', 'mcp__aibio__validate_sql', 'mcp__aibio__parse_lineage', 'mcp__aibio__read_schema_snapshot', 'mcp__aibio__read_existing_models', 'mcp__aibio__materialize_models']`, model: `sonnet`)
  - `'document-coordinator'`: `documentCoordinatorDefinition` (tools: `['Agent', 'mcp__aibio__assess_readiness', 'mcp__aibio__update_coverage', 'mcp__aibio__read_coverage_summary']`, model: `sonnet`)
  - `'quality-coordinator'`: `qualityCoordinatorDefinition` (tools: `['Agent', 'mcp__aibio__run_tests', 'mcp__aibio__test_failure_handoff', 'mcp__aibio__read_existing_models']`, model: `sonnet`)
- [x] Granted supervisor tools (read-only + cross-phase orchestration) — MCP_TOOLS.md Tool Ownership Matrix:
  - `Agent` (built-in SDK tool — deleguje na coordinatorov/agentov z `agents` mapy)
  - `mcp__aibio__validate_sql`, `mcp__aibio__parse_lineage`, `mcp__aibio__materialize_models`
  - `mcp__aibio__run_tests`, `mcp__aibio__assess_readiness`
  - `mcp__aibio__read_coverage_summary`, `mcp__aibio__guarded_share_results`
- [x] **Vynechané** (write tools): `write_model_file`, `write_test_file`, `write_doc_record`, `update_doc_record` (BR-SHL-001)
- [x] **Vynechané** (coordinator-owned tools): `update_coverage`, `test_failure_handoff` — nie sú v supervisor allowedTools (BR-SHL-002)
- [x] `canUseTool: approvalGateCanUseTool` — z `core/orchestration/approval-gate.ts`; predaný do `query()` options pre consent enforcement na gated tools
- [x] `hooks: supervisorHooks` — z `core/orchestration/hooks.ts`; registruje `PostToolUse` pre deterministický post-processing
- [x] Streaming response → SSE emit každého chunk cez `sseEmitter.emit(workspaceId, event)`

### 4.8 Hooks (`core/orchestration/hooks.ts`)

- [x] Vytvoriť `core/orchestration/hooks.ts` s exportom `supervisorHooks: Partial<Record<HookEvent, HookCallbackMatcher[]>>`
- [x] `PostToolUse` matcher `mcp__aibio__write_model_file` → volá `parse_lineage` (**nie** `update_coverage` — to je `document-coordinator` hook, nie supervisor)
- [x] `PostToolUse` matcher `mcp__aibio__materialize_models` → volá `run_tests` (ak `auto_run_tests = true`)
- [x] Predať `hooks: supervisorHooks` do `query()` v `orchestrator.ts`
- [x] Consent enforcement (pre-tool blocking) riešiť cez `canUseTool` callback — **nie** `PreToolUse` hook
- [x] **Poznámka:** `model-coordinator` a `document-coordinator` majú vlastné `SdkHooks` (coordinator-level PostToolUse) — definované v ich `AgentDefinition` alebo coordinator orchestrator súboroch, nie tu

## 5. GDPR / Safety pravidlá (z RULES.md)

- [x] BR-SHL-001: supervisor nikdy nepoužíva write tools priamo
- [x] BR-SHL-003: max 20 turns per session — hard cap v supervisor state machine
- [x] BR-SHL-005: max 4000 znakov na user message — validácia pred persist
- [x] BR-SHL-010: ChatInput disabled v Manual mode
- [ ] BR-SHL-023: approval gates serializované pri parallel dispatch — nesmú bežať concurrent
- [x] BR-SHL-033: max 1 aktívna session per workspace
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
