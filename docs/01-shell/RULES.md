# Shell Sub-module — Business Rules

*BR-SHL = Shell Business Rules. Verzia 0.1. Pozri [GOAL](./GOAL.md) pre kontext.*

---

## Supervisor invariants

**BR-SHL-001** — Supervisor nikdy nevolá write tools priamo  
Condition: Supervisor agent tool list  
Rule: `write_model_file`, `write_test_file`, `write_doc_record` nie sú v tool liste supervisora. Priame volanie je technicky vylúčené — write tools sú vynechané z `allowedTools` parametra `query()` volania, nie len konvenčné.

**BR-SHL-002** — Supervisor nikdy nepíše do DB ani do file systému  
Condition: Akákoľvek akcia supervisora  
Rule: Supervisor len číta workspace context a invokuje subagentov. Všetky writes idú cez subagentov cez MCP tools.

**BR-SHL-003** — Supervisor loop má hard cap  
Condition: Supervisor Anthropic API call  
Rule: `max_turns = 20` (konfigurovateľné). Po dosiahnutí limitu → `stream_error` s `reason = 'max_turns_exceeded'`. Žiadna tichá expirácia.

---

## AI mode rules

**BR-SHL-010** — Manual mode deaktivuje všetkých agentov  
Condition: `ai_mode = 'manual'`  
Rule: Chat input je disabled. Supervisor neinvokuje žiadny coordinator ani atomic agent. Monaco editor v Model funguje normálne — manuálne zmeny sú povolené.

**BR-SHL-011** — Documentation mode blokuje query coordinatora a query atomic agentov  
Condition: `ai_mode = 'documentation'`  
Rule: Supervisor smie invokovat: `document-coordinator` (a cez neho `interviewer`, `docs-keeper`), `explore-coordinator` (read-only — `schema-explorer`, `data-profiler`). `model-coordinator` a `quality-coordinator` sú blokované — žiadne SQL authoring, model design, test generation. Supervisor informuje usera ak žiada query-related akciu.

**BR-SHL-012** — Queries mode blokuje doc coordinatora a doc atomic agentov  
Condition: `ai_mode = 'queries'`  
Rule: Supervisor smie invokovat: `model-coordinator` (`model-architect`, `sql-writer`, `transformation-suggester`), `quality-coordinator` (`test-generator`), `explore-coordinator` (read-only — `schema-explorer`, `data-profiler`). `document-coordinator` (a cez neho `interviewer`, `docs-keeper`) je blokovaný.

**BR-SHL-013** — AI mode je workspace-scoped a perzistovaný  
Condition: AI mode setting  
Rule: Mode je uložený per workspace v DB. Page reload alebo session restart zachová posledný nastavený mode. Coordinators preberajú aktívny AI mode z AgentContext pri každom volaní — nedrží vlastnú kópiu.

---

## Dispatch rules

**BR-SHL-020** — Intent classification prebehne pred LLM callom  
Condition: User odošle správu  
Rule: Rule-based `classifyIntent()` prebehne synchronne. Výsledok je jeden z: `manual_only`, `direct_agent`, `coordinator`, `multi_phase`. Iba pri `multi_phase` nastane LLM fallback (supervisor LLM rozhoduje o sekvencii coordinator/agent calls).

**BR-SHL-021** — Active sub-module informuje intent classification  
Condition: User odošle správu keď je aktívny konkrétny sub-modul  
Rule: Active sub-modul (URL-driven) je zahrnutý v classifier kontext. *"Prepíš staging SQL"* pri aktívnom Model = jednoznačne `coordinator: model-coordinator`.

**BR-SHL-022** — Paralelné subagenty dostanú identický workspace context snapshot  
Condition: Parallel dispatch group  
Rule: Všetky subagenty v paralelnej groupe dostanú rovnaký workspace state snapshot z momentu dispatch-u — nie live-updating context. Zabraňuje race conditions v kontexte.

**BR-SHL-023** — Parallel group approval gates sú serializované  
Condition: Viacero paralelných subagentov trigger-uje approval gate súbežne  
Rule: Gates sú serializované — jeden po druhom, nie súbežné dialogy. Deny na jednom gate emituje `stream_error` a abortuje zvyšné subagent calls. Platí na oboch úrovniach: coordinator-level aj supervisor-level.

**BR-SHL-024** — Coordinator bypass je povolený iba pre explicitne definované simple-task prípady  
Condition: Supervisor zvažuje priame volanie atomic agenta  
Rule: Supervisor smie obísť coordinator iba pre: (a) single-source schema refresh (`schema-explorer` priamo), (b) standalone transformation hints na pomenovanom modeli (`transformation-suggester` priamo), (c) code generation request — Phase 2 (`code-generator-*` priamo). Pre VŠETKY ostatné multi-step alebo phase-spanning tasks ide cez coordinator.

**BR-SHL-025** — Coordinator drží intra-phase working memory  
Condition: Coordinator orchestruje viac atomic agentov  
Rule: Coordinator context window (v rámci nested `query()`) drží intra-phase pracovný stav: výstupy predchádzajúcich krokov, retry counters, session_history. Supervisor nemusí sledovať tento stav — coordinator ho zapuzdruje. Po skončení coordinator vráti kompaktný súhrn supervisorovi.

**BR-SHL-026** — `document-coordinator` Swarm Loop má max_rounds limit  
Condition: `document-coordinator` orchestruje interviewer ↔ docs-keeper loop  
Rule: Max 10 rounds per coordinator session. Ak po 10 roundoch `assess_readiness.ready` nie je `true`, coordinator skončí s partial result a informuje supervisora. Loop sa tiež ukončí ak: `session_complete = true` (user skončil), coverage delta < 2% pre 2 po sebe idúce roundy (convergencia), alebo coverage >= target.

---

## Session rules

**BR-SHL-030** — Každá session má unikátny sessionId  
Condition: User message → supervisor run  
Rule: `sessionId` je UUID generovaný pri každej session. Je zahrnutý v každom `audit_entries` zázname pre koreláciu.

**BR-SHL-031** — Chat história prežije page reload  
Condition: `chat_messages` storage  
Rule: Správy sú perzistované v DB. Po page reload sa načítajú z DB — nová supervisor session sa nespustí automaticky.

**BR-SHL-032** — Server restart → graceful recovery prompt  
Condition: Frontend detekuje `stream_error` na EventSource  
Rule: UI zobrazí *"Session interrupted. Continue?"* prompt. User kliknutím spustí novú supervisor session — s plným workspace kontextom načítaným z DB.

**BR-SHL-033** — Concurrent workspace sessions sú serializované  
Condition: Dvaja taby otvorené na rovnakom workspace  
Rule: Druhý POST do `/api/chat/[workspaceId]` čaká kým prvá session dokončí. Supervisor sessions sú serialized per workspace. Locking mechanizmus je follow-up.

---

## Auto mode a context rules

**BR-SHL-040** — Auto mode dovoľuje všetkých coordinatorov a atomic agentov  
Condition: `ai_mode = 'auto'`  
Rule: Supervisor môže invokovať ktorýkoľvek zo 4 coordinatorov (a cez nich všetkých 8 MVP atomic agentov) podľa intent classification. Žiadny coordinator ani atomic agent nie je blokovaný. Toto je default mode pre nový workspace. Viď AI Mode tabuľku v `ARCHITECTURE.md §7`.

**BR-SHL-041** — Supervisor context je abbreviated  
Condition: Workspace state summary v supervisor system prompte  
Rule: Supervisor dostáva abbreviated workspace context (table names + counts, nie full schema). Plnú schému dostanú subagenti keď ju explicitne potrebujú cez `read_schema_snapshot` tool. Toto obmedzuje prompt veľkosť a cost pri každom supervisor call.

**BR-SHL-042** — Idle session timeout  
Condition: Session je idle (žiadna user aktivita) po `session_timeout_min` (default 60 min)  
Rule: Session je ukončená. In-memory session state je vyčistený. Ďalšia user message spustí novú session s plným workspace kontextom z DB.

**BR-SHL-043** — SSE heartbeat každých 15 sekúnd  
Condition: Aktívne SSE spojenie (EventSource)  
Rule: Server emituje `{ type: 'ping' }` event každých 15 s. Zabraňuje browser timeoutu pri idle sessions. Frontend ignoruje ping eventy (nerendreuje ich).

**BR-SHL-044** — Chat history retention: posledných 100 správ  
Condition: `chat_messages` tabuľka per workspace  
Rule: UI zobrazuje posledných 100 správ. Staršie sú dostupné cez "Load history" button. DB neobmedzuje počet — retenčná policy je view-level limit, nie delete.

**BR-SHL-045** — Post-processing je dvojúrovňový: coordinator-owned a supervisor-owned  
Condition: Atomic agent alebo supervisor dokončí svoju akciu  
Rule:  
**(a) Coordinator-owned post-processing** — prebieha vnútri coordinator context window, supervisor ho nevidí:  
- `model-coordinator`: po každom `sql-writer` write → `parse_lineage` (rebuild lineage_edges pre práve zapísaný model)  
- `document-coordinator`: po každom `docs-keeper` write → `update_coverage` (recompute coverage score pre workspace)  
- `quality-coordinator`: po `test-generator` write → `run_tests` (ak `auto_run_tests = true`, inline self-heal loop)  

**(b) Supervisor-owned post-processing** — cross-phase, prebieha po návrate coordinatora:  
- Po `materialize_models` success → `run_tests` (ak `auto_run_tests = true` a quality-coordinator nebol volaný v tej istej session)  

Post-processing (a) ani (b) nevyžaduje ďalší approval gate — prebehne automaticky keď predchádzajúci write step bol approved.

**BR-SHL-047** — Chat input je disabled počas approval gate  
Condition: `approval_required` SSE event prijatý frontendovým `ApprovalDialog`  
Rule: Chat input je deaktivovaný po celý čas kým je ApprovalDialog otvorený. User nemôže odoslať ďalšiu správu kým neschváli alebo nezamietne prebiehajúci gate. Po resolved gate (approve alebo deny) sa chat input reaktivuje.

**BR-SHL-046** — Workspace switching dáva fresh agent context  
Condition: User prepne na iný workspace  
Rule: Supervisor dostane fresh context z nového workspace-u. Chat história z predchádzajúceho workspace-u zostáva v DB ale nie je zahrnutá do nového supervisor kontextu. Každý workspace má izolovanú agent session.
