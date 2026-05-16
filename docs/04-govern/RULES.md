# Govern Sub-module — Business Rules

*BR-GOV = Govern Business Rules. Verzia 0.1. Pozri [GOAL](./GOAL.md) pre kontext.*

---

## 3-vrstvový data exposure model (GDPR)

**BR-GOV-001** — Vrstva 1: Schema metadata default ALLOW  
Condition: Akýkoľvek agent request na schema metadata (table names, column names, types, FK, native comments)  
Rule: Povolené bez approval a bez ohľadu na permission tier. Schema metadata nie sú osobné údaje.

**BR-GOV-002** — Vrstva 2: Sample dáta default DENY  
Condition: Akýkoľvek agent request na sample rows  
Rule: DENY pokiaľ tabuľka nemá `is_reference_table = true` (user-set flag v Explore) a source tier to dovoľuje. Iné tabuľky sú blocked.

**BR-GOV-003** — Vrstva 3: Query results default DENY  
Condition: AI-executed query vráti výsledky  
Rule: Výsledky sa uložia do result cache (opaque handle). **Nie** sú automaticky odovzdané agentovi. Agent dostane iba metadata (`row_count`, `columns`). User musí explicitne kliknúť *"Share with AI"*.

**BR-GOV-004** — Permission tier je per-source ceiling  
Condition: Source má nastavený permission tier  
Rule: Tier určuje maximum AI access pre daný source. Per-table a per-column overrides môžu byť len **strictnejšie**, nie permissívnejšie ako source tier.

**BR-GOV-005** — PII column nikdy nie je v samples  
Condition: Column s `pii_classification = 'pii'` alebo `'sensitive'`  
Rule: PII column **nikdy** nie je zahrnutý v sample dátach — ani keď je tabuľka reference table. PII masking sa aplikuje pred odovzdaním akýchkoľvek hodnôt agentovi.

---

## Permission enforcement

**BR-GOV-010** — Všetky sub-moduly musia ísť cez guarded tools  
Condition: Akýkoľvek subagent volajúci Connect adapter (schema introspect, sample data, run query)  
Rule: Priamy import `modules/ainderstanding/connect/lib/adapters/*` mimo Govern je zakázaný. ESLint rule to vynucuje v build time. Výnimka: Connect sub-module samotný (setup/test connection).

**BR-GOV-011** — Permission denied → structured error  
Condition: Guarded tool call blocked permission checkom  
Rule: Vracia `{ code: 'PERMISSION_DENIED', tier: string, reason: string }`. Agent dostane toto ako tool error response — môže sa adaptovať (informovať usera), nie crashnúť.

**BR-GOV-012** — Permission precedencia  
Condition: Konflikt medzi source tier, per-table override, per-column override  
Rule: Per-column override > per-table override > source tier. Najstrictnejšia úroveň vždy vyhráva.

---

## Approval gate rules

**BR-GOV-020** — Approval gate je pre-execution  
Condition: Agent chce spustiť akciu vyžadujúcu approval (execute_query, share_results, write_doc)  
Rule: `awaitApproval()` musí byť resolved (user klikne Approve) **pred** exekúciou. Akcia nikdy nespustí optimisticky.

**BR-GOV-021** — Approval timeout = deny  
Condition: User nereaguje počas `approval_timeout_sec` (default 300 s)  
Rule: `awaitApproval()` resolve-uje s `{ decision: 'denied', reason: 'timeout' }`. Agent dostane `ApprovalDeniedError`.

**BR-GOV-022** — Deny nie je trigger pre retry  
Condition: User klikne Deny  
Rule: Agent **nesmie** opakovať rovnakú operáciu bez inej user akcie. Deny je intentional — nie transient failure. Platí aj pre sql-writer self-heal loop.

**BR-GOV-023** — Approval je per-request jednorazový  
Condition: Každý approval gate request  
Rule: Každý `requestId` je jednorazový. Schválenie jednej query neschvaľuje ďalšiu. Výnimka: "Approve for this session" option ukladá session-scoped policy — nie permanent.

**BR-GOV-024** — Approval timeout je workspace-scoped  
Condition: `approval_timeout_sec` setting  
Rule: Je per-workspace. Celý workspace má rovnaký timeout naprieč všetkými agentmi.

---

## PII rules

**BR-GOV-030** — PII masking je non-bypassable  
Condition: Stĺpec s `pii_classification != 'none'`  
Rule: Masking sa aplikuje pred odovzdaním hodnôt agentovi. Neexistuje agent-requestable bypass. User môže classification zmeniť (PII reklasifikácia), nie masking preskočiť.

**BR-GOV-031** — Masking format je konfigurovateľný  
Condition: Masked hodnota  
Rule: Default `[{TYPE}_MASKED]` (napr. `[Email_MASKED]`). Konfigurovateľné cez `pii_masking_format` setting.

**BR-GOV-032** — `column_metadata` je source of truth pre PII classification  
Condition: PII classification pre column  
Rule: Source of truth je `column_metadata.pii_classification`. `column_metadata.pii_candidate` je heuristický signál z Explore profilera — profiler nikdy neprepisuje `pii_classification` / `pii_subtype` ani `set_by` na riadkoch kde `set_by='user'`. User klasifikácia v Govern nastavuje `set_by='user'` cez `upsertHeuristicPiiSignal` nie je volaná po existujúcom user riadku.

---

## Audit rules

**BR-GOV-040** — Každá AI access akcia musí byť auditovaná  
Condition: Akýkoľvek guarded tool call (read_schema, read_sample, run_query, share_results, write_doc)  
Rule: `audit_entries` row musí byť zapísaná s: `{ action, agent, timestamp, outcome, workspace_id, source_id? }`. Audit log neprechádza approval gate — je automatic a non-bypassable.

**BR-GOV-041** — Audit log sa nedá vypnúť  
Condition: `audit_log_enabled` setting  
Rule: Locked na `true`. UI nedovoľuje deaktiváciu. Ani workspace admin nemôže vypnúť audit log.

**BR-GOV-042** — Blocked operácia sa audituje s `outcome=blocked`  
Condition: Permission denied  
Rule: Aj blocked (nepovolené) pokusy musia mať `audit_entries` záznam s `outcome = 'blocked'`.

**BR-GOV-043** — Audit entries sú read-only  
Condition: `audit_entries` tabuľka  
Rule: Záznamy sa nikdy neupravujú ani nemažú cez aplikáciu. Retention policy je follow-up feature — v MVP žiadne mazanie neexistuje.

---

## Result cache rules

**BR-GOV-050** — Result handle má TTL 5 minút  
Condition: Query result uložený do cache  
Rule: TTL = 300 s (default). Po vypršaní je handle neplatný. Agent dostane `{ code: 'RESULT_EXPIRED' }` ak skúsi použiť expirovaný handle.

**BR-GOV-051** — Result handle je session-scoped  
Condition: Workspace close alebo session end  
Rule: Všetky cached result handles pre daný workspace sú vymazané pri zatvorení workspace.

---

## Default approval policies

**BR-GOV-060** — Defaultné approval policies per gate type  
Condition: Nový workspace (default settings)  
Rule: Defaultné nastavenia sú:  
- `execute_query` → `always_ask`  
- `share_results_with_ai` → `always_ask`  
- `write_to_docs` → `threshold_based` (confidence < high)  
- `schema_introspect` → `never_ask` (schema je metadata, vždy OK)

**BR-GOV-061** — `write_to_docs` approval je podmienená confidence-om  
Condition: `docs-keeper` volá `write_doc_record` alebo `update_doc_record`  
Rule: Approval gate sa spustí **iba ak** `confidence < high` (t.j. pre `medium` a `low`). Záznamy s `confidence = high` (`db_native` alebo `user_confirmed`) sa zapíšu **bez approval**. Toto je výnimka z všeobecného pravidla BR-GOV-020.

---

## PII review & sample-tier interaction

**BR-GOV-065** — Dismissed PII candidate zostáva ako reviewed  
Condition: User zamietne PII candidate v `PIICandidatesPanel`  
Rule: `column_profiles.pii_candidate` ostáva `true` ale je označený ako `reviewed`. Govern enforcement sa **nenastaví** — žiadne masking, žiadna access restriction. Ak sa neskôr user rozmyslí, môže column manuálne reklasifikovať v Govern permissions.

**BR-GOV-066** — Sample data v rámci povoleného tieru nevyžaduje per-request approval  
Condition: Agent žiada sample data z reference table, source tier je `with_reference_samples` alebo vyšší  
Rule: Approval gate sa pre sample data **nespúšťa** — tier + reference flag sú postačujúce. Approval gate existuje iba pre `execute_query` a `share_results_with_ai`. Každý sample read je auditovaný bez ohľadu na approval.

---

## Permission tier hierarchy

**BR-GOV-070** — Permission tiers sú hierarchické a additive  
Condition: Nastavenie permission tier per source  
Rule: Štyri tiere (od najstrictnejšieho po najpermissívnejší):  
1. `metadata_only` — iba schema metadata (Layer 1)  
2. `with_reference_samples` — + samples pre reference tables (Layer 2, is_reference_table)  
3. `with_full_samples` — + samples pre akúkoľvek tabuľku (Layer 2, non-PII)  
4. `with_query_results` — + query results forwarding s approval (Layer 3)  
Každý tier zahŕňa všetko z predchádzajúceho. Default pre nový source = `metadata_only`.
