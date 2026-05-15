# TODO — Document (Conversational Governance Documentation)

> **Phase:** D1 (DB + auto-populate) + D2 (agents) + D3 (UI)
> **Status:** not started
> **Owner docs:** [GOAL.md](./GOAL.md), [RULES.md](./RULES.md), [UI.md](./UI.md)
> **Cross-refs:** ../ARCHITECTURE.md §6.5, ../DATABASE_SCHEMA.md §7 (doc tables + chat_messages), ../MCP_TOOLS.md §Document, ../API_CONTRACT.md §chat §stream, ../AGENT_PROMPTS.md §4–5 (interviewer, docs-keeper)

## 1. Účel

Konverzačná governance dokumentácia. `docs-keeper` (Haiku) počúva chat session a zapisuje 22 governance fields v 5 record typoch (`table`, `column`, `business_term`, `relationship`, `convention`). `interviewer` (Sonnet) vedie štruktúrovaný rozhovor. Coverage formula vážená (0.40 tables / 0.35 columns / 0.15 terms / 0.10 relationships), threshold 70 % = "ready for production". Document **vlastní** `chat_messages` tabuľku (shell len persist do nej).

## 2. Stav existujúceho kódu

- [ ] Všetko — greenfield

## 3. Závislosti

- **Závisí od:** 00-core, 02-connect (C1 — DB native comments), 03-explore (E1 schema snapshot, E2 profiles + PII candidates), 04-govern (G1 — write_to_docs conditional approval, `column_permissions` PII mirror)
- **Blokuje:** 05-model (model-architect číta `read_docs`), 07-test (`valid_values` z `column_descriptions`)

## 4. Implementačný checklist

### 4.1 DB schema (`modules/ainderstanding/document/db/schema.ts`)

- [ ] Tabuľka `chat_messages` (DATABASE_SCHEMA.md §9) — **vlastní Document, shell len inserts**:
  - `id` UUID PK, `workspace_id` FK CASCADE, `session_id` varchar
  - `role` varchar NOT NULL (`user`, `assistant`, `system`), `content` text NOT NULL
  - `agent_name` varchar nullable, `active_module` varchar nullable (v schéme, nie `partial`)
  - `created_at` timestamp NOT NULL

- [ ] Tabuľka `table_descriptions` (DATABASE_SCHEMA.md §9):
  - `id` UUID PK, `data_source_id` FK CASCADE, `table_name` varchar NOT NULL
  - `description` text nullable
  - `business_definition` text nullable (v schéme `business_definition`, nie `business_context`)
  - `owner` varchar nullable (v schéme `owner`, nie `data_owner`)
  - `classification` varchar nullable, `domain` varchar nullable, `tags_json` text nullable
  - `confidence` varchar default `low`, `source_attribution` varchar (v schéme string, nie enum)
  - `created_at`, `updated_at`
  - UNIQUE(`data_source_id`, `table_name`)
  - **Poznámka:** `usage_notes`, `update_frequency` nie sú v DATABASE_SCHEMA.md

- [ ] Tabuľka `column_descriptions` (DATABASE_SCHEMA.md §9):
  - `id` UUID PK, `data_source_id` FK, `table_name`, `column_name` NOT NULL
  - `description` text nullable
  - `business_definition` text nullable (v schéme, nie `business_name`)
  - `logical_type` varchar nullable, `unit_of_measure` varchar nullable
  - `pii_classification` varchar nullable — **mirror z `govern.column_permissions`** (BR-DOC-060)
  - `valid_values_json` text nullable — pre `accepted_values` testy v 07-test (v schéme `valid_values_json`)
  - `calculation` text nullable
  - `confidence` varchar, `source_attribution` varchar
  - `created_at`, `updated_at`
  - UNIQUE(`data_source_id`, `table_name`, `column_name`)
  - **Poznámka:** `business_name`, `example_values`, `format_notes`, `is_nullable_expected` nie sú v DATABASE_SCHEMA.md

- [ ] Tabuľka `business_terms` (DATABASE_SCHEMA.md §9):
  - `id` UUID PK, `workspace_id` FK CASCADE
  - `term` varchar NOT NULL, `definition` text NOT NULL, `domain` varchar nullable
  - `synonyms_json` text nullable, `examples_json` text nullable (v schéme, nie `related_tables_json`)
  - `confidence` varchar, `source_attribution` varchar
  - `created_at`, `updated_at`

- [ ] Tabuľka `relationships` (DATABASE_SCHEMA.md §9):
  - `id` UUID PK, `workspace_id` FK CASCADE
  - `from_data_source_id` FK, `from_table_name`, `from_column_name` NOT NULL
  - `to_data_source_id` FK, `to_table_name`, `to_column_name` NOT NULL
  - `rel_type` varchar NOT NULL (v schéme `rel_type`, nie `relationship_type`)
  - `description` text nullable, `cardinality` varchar nullable
  - `confidence` varchar, `source_attribution` varchar
  - `created_at`, `updated_at`
  - **Poznámka:** `business_name` nie je v DATABASE_SCHEMA.md

- [ ] Tabuľka `conventions` (DATABASE_SCHEMA.md §9):
  - `id` UUID PK, `workspace_id` FK CASCADE
  - `title` varchar NOT NULL, `description` text NOT NULL
  - `category` varchar (v schéme `category`, nie `convention_type` enum)
  - `confidence` varchar, `source_attribution` varchar
  - `created_at`, `updated_at`
  - **Poznámka:** `examples_json` nie je v DATABASE_SCHEMA.md

### 4.2 MCP tools (`modules/ainderstanding/document/lib/mcp-tools.ts`)

- [ ] `read_docs` — čítanie existujúcich doc records; `allowedCallers: ['interviewer', 'docs-keeper', 'model-architect', 'sql-writer', 'test-generator']`; Layer 1 — žiadny permission check
- [ ] `write_doc_record` — uloží nový doc record:
  - Conditional approval gate: `awaitApproval('write_to_docs', ...)` IBA ak `confidence < 'high'` (BR-DOC-070, BR-GOV-061)
  - Deduplication: ak record pre daný (source, table, column) už existuje → update, nie duplicate
  - Throttling: max 5 writes per sekunda z jedného docs-keeper (BR-DOC-031)
  - `allowedCallers: ['docs-keeper']` (write je výhradne docs-keeper — nie interviewer priamo)
- [ ] `update_doc_record` — update existujúceho záznamu; rovnaké approval podmienky; `allowedCallers: ['docs-keeper']`
- [ ] `update_coverage` — prepočíta coverage; SSE emit `coverage_update`; `allowedCallers: ['docs-keeper']` (nie supervisor — patrí coordinator flow, BR-SHL-045a)
- [ ] `assess_readiness` — `{ coveragePct, isReady: boolean, gaps: string[] }`; `allowedCallers: ['document-coordinator', 'interviewer', 'supervisor']`
- [ ] `read_coverage_summary` — read-only coverage bez prepočtu; `allowedCallers: ['document-coordinator', 'supervisor']`

### 4.3 Phase Coordinator (`modules/ainderstanding/document/agents/document-coordinator.ts`)

- [ ] `document-coordinator.ts` — Tier 2 coordinator, Swarm Host (BR-SHL-026):
  - Model: `"sonnet"`, temperature: `0`
  - System prompt: AGENT_PROMPTS.md §1d (`document-coordinator`)
  - Tools: `['Task', 'mcp__aibio__assess_readiness', 'mcp__aibio__read_coverage_summary']`
  - Swarm Loop (max 10 rounds):
    1. `Task('interviewer', { session_history, workspace_context })` → `{ docs_to_write, session_complete }`
    2. `Task('docs-keeper', { docs_to_write })` → `{ coverage_after }`
    3. `assess_readiness` → ak `ready=true` alebo `session_complete=true` → terminate
    4. Convergence check: ak coverage delta < 2% pre 2 po sebe idúce roundy → terminate
  - PostToolUse hook (na coordinator úrovni): po každom `write_doc_record` / `update_doc_record` → `update_coverage`
  - Session history: akumuluje `{ q, a }` páry a odovzdáva `interviewer`-u v každom kole
  - Po ukončení vráti supervisorovi kompaktný súhrn `{ roundsCompleted, finalCoverage, recordsWritten }`

### 4.4 Atomic Agents (`modules/ainderstanding/document/agents/`)

- [ ] `interviewer.ts` — volaný `document-coordinator`-om (nie supervisorom priamo):
  - Model: `"sonnet"`, temperature: `0.3`
  - System prompt: AGENT_PROMPTS.md §7
  - Granted tools: `read_docs`, `read_profiles`, `assess_readiness` (read-only — nepíše nič)
  - Flow: prijme `session_history` → identifikuj priority gaps → vygeneruj 1–3 otázky → vráti `{ docs_to_write, session_complete }` coordinator-u
  - Prioritizácia: PK/FK stĺpce → sensitive columns → business tables

- [ ] `docs-keeper.ts` — volaný `document-coordinator`-om po každom `interviewer` kole:
  - Model: `"haiku"`
  - System prompt: AGENT_PROMPTS.md §8
  - Granted tools: `read_docs`, `write_doc_record`, `update_doc_record`, `update_coverage`
  - Prijme `docs_to_write` z interviewer → zapíše do DB → vráti `{ coverage_after }` coordinator-u
  - Explicit source identifier v každom call (anti-context-bleed — BR-DOC-030)
  - Deduplication pred write (porovnaj s existujúcim `read_docs`)

### 4.4 Lib (`modules/ainderstanding/document/lib/`)

- [ ] `coverage-calculator.ts`:
  - `calculateCoverage(workspaceId): CoverageBreakdown`
  - Váhy: tables 0.40, columns 0.35, terms 0.15, relationships 0.10
  - Table coverage: description NOT NULL = 1, business_definition NOT NULL = bonus
  - Column coverage: description NOT NULL = 1 (PK/FK váha × 2)
  - Term coverage: min(term_count / estimated_business_terms, 1.0) — estimated = table_count × 2
  - Relationship coverage: min(relationship_count / FK_count, 1.0)
  - Vráti `{ total, tables, columns, terms, relationships }` percentages

- [ ] `auto-populate.ts` — spustí sa po Connect pri prvom pripojení source:
  - `autoPopulateFromNativeComments(dataSourceId): void`
  - Načíta `readNativeComments()` cez `guarded_read_native_comments`
  - Pre každý koment → vytvorí `table_descriptions` alebo `column_descriptions` záznam s `source='db_native'`, `confidence='high'`
  - **Bez approval gate** (confidence=high — BR-DOC-070)

- [ ] `pii-mirror.ts` — sync `column_descriptions.pii_classification` z `govern.column_permissions`:
  - Volaný pri každej zmene v `column_permissions` (event alebo periodic sync)
  - **Nikdy** naopak — Document nenastavuje `column_permissions` (BR-DOC-060)
  - Mirror iba zobrazuje, nerozhoduje

### 4.5 API endpointy

- [ ] `app/api/chat/[workspaceId]/route.ts` — POST (implementovaný v 01-shell, Document ho **vlastní** z hľadiska message persist)
- [ ] `app/api/chat/[workspaceId]/messages/route.ts` — GET (implementovaný v 01-shell)
- [ ] SSE events emitted: `doc_update`, `coverage_update` — z `update_coverage` a `write_doc_record`

### 4.6 UI komponenty

Layout note: Document má **inverzný layout** — ChatPanel je **primary** (pravý, 600px), DocsPanel je sekundárny (ľavý sidebar, 320px).

- [ ] `app/workspace/[workspaceId]/document/page.tsx`
- [ ] `modules/ainderstanding/document/components/ChatPanel.tsx` — primárny UI element:
  - SSE-driven MessageList (rovnaká ako shell GlobalChatPanel, ale Document-specific rendering)
  - Interviewer správy s otázkami highlighted
  - Quick-reply chips pre common responses
- [ ] `modules/ainderstanding/document/components/DocsPanel.tsx` — sekundárny left panel:
  - Tree view: zdroje → tabuľky → stĺpce
  - Per-item: coverage bar + confidence badge + source attribution icon
- [ ] `modules/ainderstanding/document/components/DocRecordView.tsx` — detail existujúceho záznamu (read)
- [ ] `modules/ainderstanding/document/components/DocRecordEditForm.tsx` — inline edit form pre user-authored changes
- [ ] `modules/ainderstanding/document/components/BusinessTermsView.tsx` — zoznam terms, search, alphabetical grouping
- [ ] `modules/ainderstanding/document/components/RelationshipsView.tsx` — zoznam s from/to display, relationship type badge
- [ ] `modules/ainderstanding/document/components/ConventionsView.tsx` — zoznam conventions po type
- [ ] `modules/ainderstanding/document/components/CoverageDashboard.tsx` — progress bars per dimension + total; threshold indicator (70%)
- [ ] `modules/ainderstanding/document/components/CoverageBadge.tsx` — malý badge pre SideNav / header: "42%" s farebným kódovaním (red < 30%, yellow 30–70%, green > 70%)
- [ ] `modules/ainderstanding/document/components/ConfidenceMarker.tsx` — chip: `high` (modrá) / `medium` (žltá) / `low` (šedá)
- [ ] `modules/ainderstanding/document/components/SourceAttributionBadge.tsx` — ikona + tooltip: DB Native / AI Generated / User Confirmed / User Authored
- [ ] Empty state: "Start documenting — ask me about your data model" s interviewer CTA

## 5. GDPR / Safety pravidlá (z RULES.md)

- [ ] BR-DOC-021: interviewer max 2 vety per otázka, max 5 otázok v sérii
- [ ] BR-DOC-030: docs-keeper parallel — jeden per source, explicit source identifier, bez cross-source context bleed
- [ ] BR-DOC-031: max 5 writes per sekunda z jedného docs-keeper
- [ ] BR-DOC-060: `column_descriptions.pii_classification` je mirror z Govern, nie unilateral nastavenie
- [ ] BR-DOC-070: approval gate pre `write_doc_record` iba ak `confidence < 'high'`; DB native comments a user direct answers sú `confidence='high'`
- [ ] Source attribution povinná na každom recorde — nikdy anonymný AI záznam
- [ ] Agent musí flagovať `confidence='low'` ak neistý (BR-DOC-040) — nikdy guess ako high

## 6. Verifikácia (end-to-end)

- [ ] **Auto-populate:** pridaj source s native DB comments → `chat_messages` DB prístup → `table_descriptions` / `column_descriptions` sa naplnia s `source='db_native', confidence='high'` → žiadny approval dialog
- [ ] **Interviewer session:** chat "document my data" → interviewer dispatch → otázky s max 3 per turn → odpovede → docs-keeper zapisuje → coverage sa zvyšuje → CoverageBadge sa aktualizuje
- [ ] **Coverage formula:** manuálne overenie výpočtu s testovacím workspacom (5 tables, 20 columns, 3 terms, 2 relationships)
- [ ] **PII mirror:** v Govern klasifikuj stĺpec ako PII → `column_descriptions.pii_classification` sa automaticky updatuje
- [ ] **write_to_docs approval:** docs-keeper writes low-confidence record → approval dialog → Approve → record uložený; Deny → record sa neuloží, audit entry
- [ ] **Schema change alert:** zmeň DB schému → schema diff detected → "Review queue" notifikácia v DocsPanel pre affected records
- [ ] Integration tests: `npx vitest run modules/ainderstanding/document/__tests__/`

## 7. Odkazy

- [GOAL.md](./GOAL.md) — funkčný spec (22 fields, 5 record types, coverage formula)
- [RULES.md](./RULES.md) — business rules (BR-DOC-*)
- [UI.md](./UI.md) — inverzný layout, source attribution ikony, coverage vizualizácia
- [../AGENT_PROMPTS.md §7–8](../AGENT_PROMPTS.md) — interviewer a docs-keeper system prompts
- [../DATABASE_SCHEMA.md §7](../DATABASE_SCHEMA.md) — všetky doc tabuľky + `chat_messages`
- [../MCP_TOOLS.md](../MCP_TOOLS.md) — Document tools sekcia
