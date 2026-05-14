# Govern Sub-module — GOAL

*Working doc, slovensky. Verzia 0.1. Súčasť AInderstanding, pozri [parent GOAL](../AINDERSTANDING.md).*

---

## 1. Účel sub-modulu

**Govern je cross-cutting governance, GDPR control plane, a audit layer celého AInderstanding.**

AIBIo's GDPR-first promise sa fyzicky dodržiava cez Govern. Každý sub-modul ktorý chce poslať dáta do LLM, alebo execute query, alebo write doc — **musí prejsť cez Govern's permission framework**. Bez explicit user permission AI nevidí nič nad rámec schémy.

Govern nemá vlastných subagentov. Je to **policy + audit + UI layer** ktorý monitoring/blocking robí v service vrstve cez ESLint-like pravidlá v code.

---

## 2. Koncepty

- **3-vrstvový data exposure model** *(centrálny GDPR pillar)*:
  - **Vrstva 1 — Schema metadata** *(default ALLOW)* — table/column names, types, FK, native comments
  - **Vrstva 2 — Sample dáta** *(default DENY, per-table opt-in)* — agent vidí samples iba pri tabuľkách flagovaných ako reference
  - **Vrstva 3 — Query results** *(default DENY, per-query approval)* — výsledky AI execution nejdú do agent contextu automaticky; user musí explicitne share
- **Permission tier** — high-level setting per source: `Metadata only` / `+ Reference samples` / `+ Full samples` / `+ Real query results with approval`
- **Per-table override** — strictnejší než source-level tier vie byť (source = full, ale `users` table = metadata-only kvôli PII)
- **Per-column override** — PII columns sa **nikdy nezahŕňajú** do samples, ani pri reference tables
- **Approval gate** — moment kedy AI action musí byť potvrdená user-om predtým než sa vykoná
- **Audit entry** — záznam každej AI access action: čo agent požiadal, čo dostal, kedy
- **PII classification** — per-column flag (None / PII / Sensitive); drives masking + audit

---

## 3. Scope

### In scope (MVP)

- **3-vrstvový data exposure model** enforced cez service layer
- Permission tier UI per source
- Per-table override UI
- Per-column PII classification UI + drives masking logic
- **Approval gates**:
  - Execute AI-written query (Always ask / Never ask / Threshold-based)
  - Display query results to AI (Always ask / Auto for reference tables / Never)
  - Write to docs (Always ask / Confidence-based)
- Approval gate **enforcement** v code (vyžaduje user response pred tool execution)
- **Audit log** — každá AI access action (read schema, read sample, run query, get results)
- **PII inventory dashboard** — overview všetkých PII columns naprieč sources
- **Permissions panel** UI per workspace
- Govern-owned MCP tool wrappers: pred volaním other-module tools (run_select_query, sample_data) preflight check permission

### Out of scope

- Multi-user RLS (AIspaces module v budúcnosti)
- Time-based permission expiry (token-like)
- Permission templates (e.g., "GDPR strict workspace template")
- Audit log export/integration s SIEM systems
- Compliance reporting (GDPR data subject access requests, etc.)

---

## 4. Agenti

**Žiadni subagenti.** Govern je policy/audit/UI layer, žiadny LLM reasoning v ňom. Jeho role je **block / allow / audit** akcie iných subagentov.

Technická implementácia permission wrappers, PII masking logiky, a DB schémy → [ARCHITECTURE.md](../ARCHITECTURE.md) — sekcie 6, 8, 12.

---

## 5. Success criteria

1. **3-vrstvový model enforced** — agent z Explore sub-modulu pýta sample z `customers` table (default tier = metadata_only) → blocked, agent dostane error → audit entry created s outcome=blocked
2. **PII masking funguje** — `customers.email` flagovaný ako PII → keď je `customers` reference table a sample je allowed, email column vráti `[Email_MASKED]`, nie real value
3. **Approval dialog flow** — agent runs query → permission check → approval dialog popne v UI → user clicks Approve → query executes → audit entry s outcome=approval_granted
4. **Results NOT auto-shared with AI** — query result returns to user v UI, agent dostane metadata (row_count, columns) ale not rows. User clicks *"Share top 10 with AI"* → audit entry, agent dostane data.
5. **Audit log comprehensive** — všetky AI operations sú zachytené (read_schema, read_sample, run_query, share_results, write_doc), per-action timestamp + outcome
6. **PII inventory dashboard** — preview všetkých flagged PII columns naprieč 2 demo sources, klikateľné na drill-down do column docs

---

## 6. Phase plán

### Phase G1: Permission framework + enforcement layer — ~2 dni

- Drizzle schemy (source_permissions, table_permissions, column_permissions, approval_settings)
- Permission enforcement service (guarded wrappers nad Connect adapters)
- Default permission tier behavior (metadata_only)
- PII masking logic
- Audit logger service + `audit_entries` schema
- ApprovalDialog UI komponent

**Output:** subagenti v Explore a Model už musia volať cez guarded wrappers, nemôžu obísť. Permission denied errors vrátené ako tool error responses.

### Phase G2: Permissions UI + Audit UI + PII inventory — ~1 deň

- `PermissionsPanel` UI (per source tier + per-table override + per-column PII)
- `AuditLogViewer` UI (chronological + filterable)
- `PIIInventoryDashboard` UI
- Integration s Explore PII candidates (auto-suggest column_permissions z heuristics)

**Output:** user vie cez UI nastaviť všetky permissions, vidí audit log, má prehľad o PII inventory naprieč workspace.

**Total Govern: ~3 dni.**

**Dependencies:** Phase C1 (Connect — source adapters wrappnúť), Phase E2 (Explore — PII candidates feed-uje column_permissions).

**Blocks:** Phase M3 (Model — `sql-writer` runs queries cez guarded tools), Phase T2 (Test — testy bežia cez guarded tools), Phase D2 (Document — docs-keeper write_doc cez guarded with approval).

---

## 7. Open questions

- **Per-row data filtering pre permission** — môže workspace user obmedziť agentom prístup len k some rows (e.g., len Q3 data)? *Predbežne nie v MVP*, future feature.
- **Approval policy granularity** — current per-action policy je: always / never / threshold. *Predbežne dostatočné*, polish je per-tabuľka, per-query-type, etc.
- **Audit log retention** — držať forever, alebo rotate? *Predbežne forever* v MVP, retention policy follow-up.
- **PII subtype enumerácia** — definitive list? Email/Phone/NationalId/Address/IP/Name/DateOfBirth pokrýva 80%. *Predbežne fixed list*, user vie pridať vlastné cez `pii_subtype: 'Other - kid info'`.
- **Approval timeout** — keď user nepoužije approval dialog 5 min, čo sa stane? *Predbežne timeout=deny, agent dostane denial error.*

---

## 8. Riziká

- **Permission bypass** — programmatic error allows subagent to call raw Connect adapter mimo guarded wrapper. *Mitigation:* ESLint rule blokujúci direct imports `modules/ainderstanding/connect/lib/adapters/*` mimo Govern, plus code review checklist. Long-term: TypeScript private access guard pattern.
- **Approval fatigue** — too many approval dialogs irritate user. *Mitigation:* sensible defaults, "Approve and remember for this session" option, threshold-based policies.
- **PII heuristic miss + accidental leak** — Explore missne PII column → AI ho dostane v sample. *Mitigation:* user-facing PII candidates panel "review and confirm" prompt at workspace setup, conservative defaults (when in doubt, flag).
- **Audit log size growth** — long sessions = lots of entries. *Mitigation:* SQLite handles millions of rows fine, audit log viewer paginated, retention policy follow-up.
- **Cached result handle leak** — result cached pre "share later" zostáva v memory. *Mitigation:* TTL na cached results (5 min default), session-scoped, cleanup on workspace close.

---

## 9. Settings (Govern owned)

| Setting | Tier | Default | Notes |
|---|---|---|---|
| Default permission tier (new source) | `[Core]` | `metadata_only` | Most restrictive default |
| Approval policy: execute_query | `[Core]` | `always_ask` | Per workspace |
| Approval policy: share_results_with_ai | `[Core]` | `always_ask` | Per workspace |
| Approval policy: write_to_docs | `[Core]` | `threshold_based` (confidence < high) | Per workspace |
| Approval policy: schema_introspect | `[Polish]` | `never_ask` | Schema is metadata, OK to access |
| Approval timeout (sec) | `[Polish]` | 300 | After this, deny |
| Bulk approval option | `[Polish]` | Yes | "Approve and remember for this session" button |
| PII auto-detect from heuristics | `[Core]` | Yes | Enable Explore PII candidates feed |
| PII masking format | `[Polish]` | `[{TYPE}_MASKED]` | Customize masking string |
| Audit log enabled | `[Core]` | Yes (locked) | Cannot disable |
| Audit log retention | `[Polish]` | Forever | Future: rotate after N days |

---

## 10. Glossary (Govern-specific)

- **Permission tier** — high-level source-level setting určujúce maximum AI access (Metadata only / +Reference samples / +Full samples / +Query results)
- **Per-table override** — strictnejší tier pre konkrétnu tabuľku ako source-level default
- **PII classification** — per-column flag (None / PII / Sensitive) drives masking + audit
- **Approval gate** — preflight check ktorý vyžaduje user response pred AI action
- **Audit entry** — záznam akejkoľvek AI access action
- **Guarded tool** — wrapped MCP tool ktorý preflight-checks permission pred volaním underlying connect adapter
- **Result handle** — opaque reference na cached query result, použiteľný pre "share later" workflow

---

## 11. References

- Parent: [AINDERSTANDING.md](../AINDERSTANDING.md)
- Pravidlá sub-modulu: [RULES.md](./RULES.md)
- Architektúra (DB schema, permission wrappers kód, PII flow, guarded tools): [ARCHITECTURE.md](../ARCHITECTURE.md) — sekcie 6, 8, 11, 12
- Foundation: [core/GOAL.md](../00-core/GOAL.md) — approval gate mechanizmus, SSE emitter (Govern ich volá)
- Govern cross-cuts všetky sub-moduly:
  - [connect/GOAL.md](../02-connect/GOAL.md) — Govern wraps Connect's source adapters
  - [explore/GOAL.md](../03-explore/GOAL.md) — PII candidates feed Govern's column_permissions; profile/sample reads cez guarded tools
  - [model/GOAL.md](../05-model/GOAL.md) — `sql-writer` runs queries cez guarded tools, approval gates
  - [test/GOAL.md](../07-test/GOAL.md) — test queries cez guarded tools
  - [document/GOAL.md](../06-document/GOAL.md) — `docs-keeper` writes cez approval gates pre write_doc
- Top-level: [AIBIO.md](../AIBIO.md)
