# Shell — GOAL (Phase 0 AInderstanding orchestrator)

*Working doc, slovensky. Verzia 0.1. Súčasť AInderstanding, pozri [parent GOAL](../AINDERSTANDING.md).*

> **`shell/` je riadiaca vrstva AInderstandingu.** Poskytuje navigáciu medzi sub-modulmi, globálny chat panel, SSE stream napojenie, a — čo je najdôležitejšie — **supervisor agent** ktorý interpretuje user intent a dispatchuje na správnych subagentov. Shell neobsahuje žiadnu datamart logiku, len orchestráciu.

---

## 1. Účel

Shell rieši 4 veci ktoré nepatria do žiadneho konkrétneho sub-modulu:

1. **Routing a navigácia** — URL štruktúra (`/workspace/[id]/[module]`), WorkspaceLayout s bočným panelom, aktívny modul highlight.
2. **GlobalChatPanel** — jeden chat input pre celý workspace. Supervisor rozhodne, koho zavolá. User nikdy nevyberá "which AI" ručne.
3. **Supervisor orchestrátor** — centrálny agent ktorý drží workspace kontext, klasifikuje user intent, a dispatchuje na subagentov z príslušného sub-modulu. Riadi approval gate flows, spracuje responses subagentov, emituje SSE eventy.
4. **ModeSelector** — user prepína AI mode (Auto / Documentation / Queries / Manual). Mode ovplyvní ktorých subagentov supervisor zavolá.

---

## 2. Koncepty

- **Active sub-module** — ktorý sub-modul je aktuálne otvorený (URL-driven). Supervisor ho berie do úvahy pri intent classification — keď je aktívny Model a user napíše *"prepíš staging SQL"*, supervisor vie že ide o `model-coordinator`.
- **AI mode** — globálny filter na správanie subagentov. Štyri hodnoty: `auto`, `documentation`, `queries`, `manual`. Viď tabuľku efektov v [ARCHITECTURE.md](../ARCHITECTURE.md).
- **Supervisor (Conductor)** — Tier 1 orchestrátor (model: `"sonnet"`). Dostáva user message + workspace state + active sub-module + AI mode. Klasifikuje intent a dispatchuje na Phase Coordinators (Tier 2) alebo priamo na atomic agents pri jednoduchých úlohách. Nikdy sám nepíše do DB ani do files.
- **Phase Coordinator** — Tier 2 agent (AgentDefinition s `Task` v tools). Každý coordinator vlastní jednu fázu: `explore-coordinator`, `model-coordinator`, `document-coordinator`, `quality-coordinator`. Coordinator drží intra-phase working memory (retry state, session history, coverage tracking) a orchestruje atomic agents vo svojej fáze. Má rovnaký tvar ako atomic agents — je to AgentDefinition registrovaný v tej istej `agents` mape v parent `query()` calle.
- **Atomic agent** — Tier 3 specialist (AgentDefinition bez `Task` v tools). Vykonáva jednu špecifickú funkciu — schema discovery, data profiling, SQL authoring, documentation Q&A, atď. Nevie o existencii coordinatorov — coordinator je pre neho transparentný volajúci.
- **Swarm Host** — rola `document-coordinator`. Orchestruje `interviewer ↔ docs-keeper` iteratívnu slučku: každé kolo interviewer vygeneruje záznamy, docs-keeper ich zapíše, coordinator kontroluje coverage a spustí ďalšie kolo ak `assess_readiness.ready ≠ true`. Max 10 kôl.
- **Intent classification** — supervisor krok pred dispatchom. Output je DispatchPlan s jedným z modov: `manual_only`, `direct_agent`, `coordinator`, `multi_phase`. Iba `multi_phase` vyžaduje LLM fallback.
- **Dispatch plan** — interný struct: `{ mode, target?: agentName | coordinatorName, steps?: [] }`. Pre `coordinator` mode supervisor zavolá `Task(coordinatorName, context)` — coordinator potom riadi intra-phase orchestráciu samostatne.
- **Session** — jedna agentic session = jeden user message → supervisor run → 0-N coordinator/agent calls → stream_end. Každá session má `sessionId` pre audit log koreláciu.

---

## 3. Scope

### In scope (Phase 0)

- `shell/components/WorkspaceLayout.tsx` — wrapper s bočným navigačným panelom + GlobalChatPanel slot
- `shell/components/ModeSelector.tsx` — dropdown/toggle pre AI mode switch
- `shell/components/GlobalChatPanel.tsx` — chat input + SSE stream konzumer, message rendering
- `shell/orchestrator.ts` — supervisor agent factory + dispatch logic
- `shell/lib/intent-classifier.ts` — structured intent classification (s TypeScript types, nie LLM-based)
- `shell/lib/session-manager.ts` — `sessionId` generácia, active session tracking
- `shell/hooks/useWorkspaceContext.ts` — React context pre `{ workspaceId, activeModule, aiMode }`
- `shell/hooks/useSSEStream.ts` — EventSource wrapper, typed SSE event handler
- Next.js routing: `app/workspace/[workspaceId]/[module]/page.tsx` pre každý sub-modul
- `app/api/chat/[workspaceId]/route.ts` — POST endpoint kde frontend odosiela chat messages

### Out of scope

- Per-sub-module UI (každý sub-modul má vlastné komponenty)
- Konkrétne subagent implementácie (žijú v sub-module `agents/`)
- Workspace CRUD UI (patrí do Connect)

---

## 4. Agenti

### Tier 1 — Supervisor (Conductor)

| Field | Value |
|---|---|
| Model | `"sonnet"` (alias) |
| Tools | Read-only MCP tools + `Task` (SDK built-in) + `mcp__aibio__validate_sql`, `mcp__aibio__parse_lineage`, `mcp__aibio__materialize_models`, `mcp__aibio__run_tests`, `mcp__aibio__read_coverage_summary`, `mcp__aibio__guarded_share_results` |
| Scope | Intent classification → DispatchPlan → Phase Coordinator or direct agent dispatch; cross-phase approval gate serialization |

Supervisor **nikdy** nevolá write tools priamo — vždy cez coordinatora alebo atomic agenta. Supervisor tiež nevolá `update_coverage` ani `test_failure_handoff` priamo — tieto sú vlastnené `document-coordinator` a `quality-coordinator` (BR-SHL-001, BR-SHL-002).

### Tier 2 — Phase Coordinators

| Coordinator | Model | Phase | Key pattern |
|---|---|---|---|
| `explore-coordinator` | Haiku | Explore (E1–E2) | sequential schema → parallel profiling |
| `model-coordinator` | Sonnet | Model (M1–M3) | architect → parallel writers → suggester → self-heal |
| `document-coordinator` | Sonnet | Document (D1–D3) | Swarm Host: interviewer ↔ docs-keeper loop |
| `quality-coordinator` | Sonnet | Test (T1–T2) | parallel test-gen → run tests → self-heal |

Každý coordinator je `AgentDefinition` s `Task` v tools. Detailné specifikácie: [AGENT_PROMPTS.md §Phase Coordinators — Tier 2](../AGENT_PROMPTS.md).

Detailná supervisor state machine, AI modes efekt na subagentov, intent classifier, a dispatch flow → [ARCHITECTURE.md](../ARCHITECTURE.md) sekcie 7 a 15.

---

## 5. Success criteria

1. **Routing funguje** — navigácia medzi všetkými 8 sub-modulmi bez page reload, URL sa správne updatuje, SideNav highlight sleduje aktívny modul
2. **Chat → subagent dispatch** — user napíše *"profiluj všetky tabuľky"*, supervisor klasifikuje → dispatchuje `data-profiler`, SSE stream príde do GlobalChatPanel, spinner funguje
3. **AI mode prepnutie** — switch na `Documentation` mode → `sql-writer` nie je volaný keď user žiada SQL, supervisor odpovie že mode to blokuje
4. **Approval gate UI** — `write_model_file` gate: ApprovalDialog sa zobrazí, chat input je disabled, po Approve supervisor pokračuje, po Deny supervisor dostane error a gracefully informuje usera
5. **Parallel dispatch visible** — 3 paralelné `schema-explorer` instances (pre 3 sources): SSE stream ukazuje všetky tri interleaved správy s `agentName` badge, všetky sa dokončia
6. **Session persistence** — page reload zachová chat históriu (messages z DB), nespustí novú supervisor session
7. **Manual mode** — chat input disabled, `sql-writer` nie je volaný, Monaco editor funguje normálne

---

## 6. Phase plán (Phase P0)

Phase P0 je spoločná s `core/` (CORE.md Phase P0a+b), spolu ~2 dni.

### Phase P0c: Routing + WorkspaceLayout — ~3 hodiny

- Next.js App Router štruktúra (`workspace/[workspaceId]/[module]/`)
- `WorkspaceLayout` + `SideNav` (stub linky pre každý sub-modul)
- `ModeSelector` UI komponent
- `WorkspaceContextProvider` + `useWorkspaceContext` hook
- Stub pages pre každý sub-modul (len heading, žiaden content)

**Output:** navigácia medzi sub-modulmi funguje, URL sa mení, SideNav highlight.

### Phase P0d: GlobalChatPanel + SSE + Supervisor skeleton — ~5 hodín

- `GlobalChatPanel` UI (input + message list)
- `useSSEStream` hook (EventSource wrapper)
- `app/api/chat/[workspaceId]/route.ts` — POST endpoint
- `shell/orchestrator.ts` — supervisor skeleton (bez subagentov; len echo response)
- `shell/lib/intent-classifier.ts` — základné pravidlá
- `shell/lib/session-manager.ts`
- Message rendering per SSE event type (agent_message, tool_call, stream_end)
- `ApprovalDialog` komponent + `app/api/approvals/[requestId]/route.ts` napojenie

**Output:** user napíše správu → supervisor skeleton odpovie textom → SSE stream dorazí → zobrazí sa v GlobalChatPanel. Approval dialog funguje (testovateľné s mock tool).

**Total Phase P0 (shell/ časť): ~1 deň (spoločne s core/ = 2 dni celkom)**

---

## 7. Open questions

- **Intent classification LLM vs rule-based** — rule-based je rýchle a lacné ale missne edge cases. LLM-based je pomalšie (+300ms) ale robustnejšie. *Predbežne:* rule-based s LLM fallback. Ak `classifyIntent` vráti `mode === 'multi_phase'` (fallback), supervisor LLM rozhodne o sekvencii coordinator/agent calls. Merať fallback rate v prvých sessions.
- **Chat history v GlobalChatPanel** — zobraziť všetky správy od začiatku workspace alebo len poslednú session? *Predbežne:* posledná session + "Load history" button pre staršie. DB retenciu riešiť s `chat_messages` clean-up policy.
- **Concurrent sessions** — čo ak user otvorí workspace v dvoch taboch? *Predbežne:* second tab zobrazí existujúci SSE stream (subscribe na rovnaký workspace channel), supervisor sessions sú serialized (druhý POST počká). Locking follow-up.
- **Supervisor system prompt dĺžka** — workspace state summary môže byť dlhý (schémy, modely, docs). *Predbežne:* summary je abbreviated (table names + counts, nie full schema). Full schema dostanú subagenti keď ho explicitne potrebujú cez `read_schema_snapshot` tool.
- **Streaming supervisor LLM response** — supervisor sám streamuje text pred tým ako volá subagenta? *Predbežne áno* — supervisor môže streamer-ovať *"OK, spúšťam data profiling na 3 tabuľkách..."* pred dispatch-om. Implementovať cez async iterátor z `query()` — `core/orchestration/streaming.ts` mapuje events na SSE frames.

---

## 8. Riziká

- **Supervisor hallucination pri dispatchingu** — supervisor zavolá nesprávneho subagenta alebo vymyslí tool ktorý neexistuje. *Mitigation:* tool list je pevne definovaný (nie dynamický), system prompt obsahuje explicitný capability map (kedy volať koho), intent classifier pred LLM callom redukuje ambiguitu.
- **Parallel approval gate Deny propagation** — ak dva paralelné subagenti oba trigger-ujú approval gate, supervisor ich serializuje do fronty (nie concurrent). Deny alebo timeout (300 s) na prvom gate → supervisor okamžite zamieta všetky ostatné pending gaty, abortuje všetky in-flight invokácie a emituje `stream_error`. Celý dispatch cyklus sa ukončí — nie iba jeden gate. Implementačné detaily v `ARCHITECTURE.md §7 — Two-Level Approval Gate Serialization`.
- **SSE event ordering pri parallel dispatch** — events z viacerých subagentov prídu interleaved, frontend môže renderovať zmätene. *Mitigation:* každý `agent_message` event má `agentName` field, frontend renderuje per-agent thread view keď sú aktívne viaceré agents súčasne.
- **Session state loss pri server restart** — in-memory session state (supervisor state machine) sa stratí. *Mitigation:* reštart je detekovaný keď frontend dostane `stream_error` na EventSource, user dostane *"Session interrupted. Continue?"* prompt, nová session začne s plným workspace kontextom z DB.
- **Supervisor tool call loop** — supervisor opakuje rovnaký tool call donekonečna. *Mitigation:* max_turns limit na Anthropic API call (nastaviť rozumne, napr. 20 turns), po prekročení `stream_error` s popisom.

---

## 9. Settings (Shell owned)

| Setting | DB stĺpec | Tier | Default | Notes |
|---|---|---|---|---|
| Default AI mode | `workspaces.ai_mode` | `[Core]` | Auto | Per workspace |
| Show tool calls v chat | `workspace_settings.show_tool_calls` | `[Core]` | Yes (collapsible) | Transparency pre user |
| Max supervisor turns | `workspace_settings.max_supervisor_turns` | `[Polish]` | 20 | Hard cap pre loop prevention |
| Session idle timeout | `workspace_settings.session_timeout_min` | `[Polish]` | 60 min | Idle session cleanup |
| Chat history retention | `workspace_settings.chat_history_retention_count` | `[Polish]` | 100 messages | Per workspace |
| Chat panel width | `localStorage` only | `[Polish]` | 360px | Nastavuje sa drag handlerom, nie cez Settings |
| Supervisor model | hardcoded | `[Polish]` | `"sonnet"` alias | Locked v MVP, žiadny DB stĺpec |

---

## 10. Glossary

- **Supervisor** — hlavný orchestrátor agent, model `"sonnet"`, deleguje na subagentov cez `Task` tool, drží workspace kontext
- **Active sub-module** — sub-modul aktuálne zobrazený v UI (URL-driven), ovplyvňuje intent classification
- **AI mode** — `auto` / `documentation` / `queries` / `manual`; globálny filter ktorých subagentov supervisor môže zavolať
- **Intent classification** — sync, rule-based analýza user message → structured dispatch plan
- **Dispatch plan** — interný struct `{ mode, target?, steps? }`: `mode` je jeden z `manual_only | direct_agent | coordinator | multi_phase`; `target` je meno coordinator alebo atomic agenta; `steps` je ordered list pre `multi_phase` mode
- **Session** — jedna agentic run: user message → supervisor → 0-N subagent calls → stream_end
- **ApprovalDialog** — modal zobrazený keď approval gate čaká; blokuje chat input

---

## 11. References

- Parent: [AINDERSTANDING.md](../AINDERSTANDING.md)
- Pravidlá sub-modulu: [RULES.md](./RULES.md)
- Architektúra (supervisor state machine, AI modes, intent classifier, dispatch flow): [ARCHITECTURE.md](../ARCHITECTURE.md) — sekcie 5, 7, 15
- Závisí od:
  - [core/GOAL.md](../00-core/GOAL.md) — MCP server, approval gate, SSE emitter, AgentContext
  - [connect/GOAL.md](../02-connect/GOAL.md) — workspace/source data pre supervisor context
- Konzumujú Shell:
  - Všetky sub-moduly (shell poskytuje WorkspaceLayout a routing)
- Top-level: [AIBIO.md](../AIBIO.md)
