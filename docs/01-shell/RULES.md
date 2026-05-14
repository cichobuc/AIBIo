# Shell Sub-module — Business Rules

*BR-SHL = Shell Business Rules. Verzia 0.1. Pozri [GOAL](./GOAL.md) pre kontext.*

---

## Supervisor invariants

**BR-SHL-001** — Supervisor nikdy nevolá write tools priamo  
Condition: Supervisor agent tool list  
Rule: `write_model_file`, `write_test_file`, `write_doc_record` nie sú v tool liste supervisora. Priame volanie je technicky vylúčené — write tools sú vynechané z `tools` parametra Anthropic API call-u, nie len konvenčné.

**BR-SHL-002** — Supervisor nikdy nepíše do DB ani do file systému  
Condition: Akákoľvek akcia supervisora  
Rule: Supervisor len číta workspace context a invokuje subagentov. Všetky writes idú cez subagentov cez MCP tools.

**BR-SHL-003** — Supervisor loop má hard cap  
Condition: Supervisor Anthropic API call  
Rule: `max_turns = 20` (konfigurovateľné). Po dosiahnutí limitu → `stream_error` s `reason = 'max_turns_exceeded'`. Žiadna tichá expirácia.

---

## AI mode rules

**BR-SHL-010** — Manual mode deaktivuje všetkých subagentov  
Condition: `ai_mode = 'manual'`  
Rule: Chat input je disabled. Žiadny subagent nie je invokaný. Monaco editor v Model funguje normálne — manuálne zmeny sú povolené.

**BR-SHL-011** — Documentation mode blokuje query subagentov  
Condition: `ai_mode = 'documentation'`  
Rule: Supervisor smie invokovať: `interviewer`, `docs-keeper`, `schema-explorer`, `data-profiler` (posledné dva read-only). `sql-writer`, `model-architect`, `transformation-suggester`, `test-generator` sú blokované. Supervisor informuje usera ak žiada query-related akciu.

**BR-SHL-012** — Queries mode blokuje doc subagentov  
Condition: `ai_mode = 'queries'`  
Rule: Supervisor smie invokovať: `sql-writer`, `model-architect`, `transformation-suggester`, `test-generator`, `schema-explorer` (read-only), `data-profiler` (read-only). `interviewer`, `docs-keeper` sú blokované.

**BR-SHL-013** — AI mode je workspace-scoped a perzistovaný  
Condition: AI mode setting  
Rule: Mode je uložený per workspace v DB. Page reload alebo session restart zachová posledný nastavený mode.

---

## Dispatch rules

**BR-SHL-020** — Intent classification prebehne pred LLM callom  
Condition: User odošle správu  
Rule: Rule-based `classifyIntent()` prebehne synchronne. Ak výsledok je jednoznačný, supervisor dispatchuje priamo. LLM fallback nastane len ak `mode === 'multi_agent'` alebo klasifikácia nie je istá.

**BR-SHL-021** — Active sub-module informuje intent classification  
Condition: User odošle správu keď je aktívny konkrétny sub-modul  
Rule: Active sub-modul (URL-driven) je zahrnutý v classifier kontext. *"Prepíš staging SQL"* pri aktívnom Model = jednoznačne `sql-writer`.

**BR-SHL-022** — Paralelné subagenty dostanú identický workspace context snapshot  
Condition: Parallel dispatch group  
Rule: Všetky subagenty v paralelnej groupe dostanú rovnaký workspace state snapshot z momentu dispatch-u — nie live-updating context. Zabraňuje race conditions v kontexte.

**BR-SHL-023** — Parallel group approval gates sú serializované  
Condition: Viacero paralelných subagentov trigger-uje approval gate súbežne  
Rule: Gates sú serializované — jeden po druhom, nie súbežné dialogy. Deny na jednom gate emituje `stream_error` a abortuje zvyšné subagent calls.

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

**BR-SHL-040** — Auto mode dovoľuje všetkých subagentov  
Condition: `ai_mode = 'auto'`  
Rule: Supervisor môže invokovať akéhokoľvek z 9 subagentov podľa intent classification. Žiadny subagent nie je blokovaný. Toto je default mode pre nový workspace.

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

**BR-SHL-045** — Supervisor robí post-processing po dokončení subagentov  
Condition: Subagent dokončí prácu  
Rule: Supervisor volá post-processing tools podľa toho čo bežalo:  
- Po `sql-writer` write → `parse_lineage` (rebuild lineage_edges)  
- Po `docs-keeper` write → `update_coverage` (recompute coverage score)  
- Po `materialize_models` success → `run_tests` (ak `auto_run_tests = true`)  
Post-processing prebehne aj keď subagent dostal approval — nie len pri plnom úspechu.

**BR-SHL-047** — Chat input je disabled počas approval gate  
Condition: `approval_required` SSE event prijatý frontendovým `ApprovalDialog`  
Rule: Chat input je deaktivovaný po celý čas kým je ApprovalDialog otvorený. User nemôže odoslať ďalšiu správu kým neschváli alebo nezamietne prebiehajúci gate. Po resolved gate (approve alebo deny) sa chat input reaktivuje.

**BR-SHL-046** — Workspace switching dáva fresh agent context  
Condition: User prepne na iný workspace  
Rule: Supervisor dostane fresh context z nového workspace-u. Chat história z predchádzajúceho workspace-u zostáva v DB ale nie je zahrnutá do nového supervisor kontextu. Každý workspace má izolovanú agent session.
