# TODO — Govern (GDPR Control Plane)

> **Phase:** G1 (enforcement layer) → G2 (UI)
> **Status:** done (G1 + G2)
> **Owner docs:** [GOAL.md](./GOAL.md), [RULES.md](./RULES.md), [UI.md](./UI.md)
> **Cross-refs:** ../ARCHITECTURE.md §6.3 §8, ../DATABASE_SCHEMA.md §5 (permissions, audit), ../MCP_TOOLS.md §Govern, ../API_CONTRACT.md §approvals §govern, ../AGENT_PROMPTS.md (žiadni vlastní agenti)

## 1. Účel

Cross-cutting governance, GDPR control plane a audit layer. Vynucuje **3-vrstvový data exposure model** (Layer 1: schema metadata — ALLOW; Layer 2: sample data — DENY s opt-in; Layer 3: query results — DENY s per-query approval). Manažuje permission tiers, PII klasifikáciu a audit log. **Žiadne LLM reasoning** — len policy + audit + guarded adaptery. G1 (enforcement) musí byť hotový pred Explore E2.

## 2. Stav existujúceho kódu

- [x] `app/api/approvals/[requestId]/route.ts` — exists (v Core), volá `resolveApproval`
- [x] Všetko G1 — implementované

## 3. Závislosti

- **Závisí od:** 00-core (`awaitApproval`, `sseEmitter`, `AgentContext`), 02-connect (SourceAdapter — Govern wrappuje)
- **G2 závisí od:** 03-explore E1 (PII candidates feed do `column_permissions` UI)
- **Blokuje:** 03-explore E2 (data-profiler cez internal-adapter), 05-model (sql-writer cez guarded tools), 06-document (write_doc s approval), 07-test (testy cez guarded tools), všetky write operácie subagentov

## 4. Implementačný checklist

### 4.1 DB schema (`modules/ainderstanding/govern/db/schema.ts`)

- [x] Tabuľka `source_permissions` (DATABASE_SCHEMA.md §5):
  - `id` UUID PK, `data_source_id` FK `data_sources.id` CASCADE UNIQUE
  - `permission_tier` enum(`metadata_only`, `with_reference_samples`, `with_full_samples`, `with_query_results`) default `metadata_only`
  - `updated_at`
- [x] Tabuľka `table_permissions` (DATABASE_SCHEMA.md §5):
  - `id`, `data_source_id` FK, `table_name` varchar NOT NULL
  - `permission_override` enum (rovnaká ako `permission_tier`) nullable — null = follow source
  - UNIQUE(`data_source_id`, `table_name`)
- [x] Tabuľka `column_permissions` (DATABASE_SCHEMA.md §5):
  - `id`, `data_source_id` FK, `table_name`, `column_name` NOT NULL
  - `pii_classification` enum(`none`, `pii`, `sensitive`) nullable
  - `pii_subtype` enum(`email`, `phone`, `national_id`, `address`, `ip`, `name`, `date_of_birth`, `iban`, `other`) nullable (per DATABASE_SCHEMA.md)
  - `set_by` enum(`user`, `heuristic`) NOT NULL (per DATABASE_SCHEMA.md)
  - UNIQUE(`data_source_id`, `table_name`, `column_name`)
- [x] Tabuľka `approval_settings` (DATABASE_SCHEMA.md §5):
  - `id`, `workspace_id` FK UNIQUE
  - `policy_execute_query` enum(`always_ask`, `never_ask`, `threshold_based`) default `always_ask`
  - `policy_share_results` enum(`always_ask`, `never_ask`, `auto_reference`) default `always_ask`
  - `policy_write_to_docs` enum(`always_ask`, `threshold_based`, `never_ask`) default `threshold_based`
  - `policy_schema_introspect` enum(`never_ask`, `always_ask`) default `never_ask`
  - `approval_timeout_sec` default `300`
- [x] Tabuľka `audit_entries` (DATABASE_SCHEMA.md §5) — **read-only po insert**:
  - `id` UUID PK, `workspace_id`, `data_source_id` nullable, `session_id`
  - `agent_name` varchar, `action_type` enum(`read_schema`, `read_sample`, `run_query`, `share_results`, `write_doc`, `write_model`, `write_test`)
  - `table_name` nullable, `column_names_json` nullable, `sql_hash` nullable (SHA-256 SQL, nie SQL samotný)
  - `outcome` enum(`allowed`, `blocked`, `approval_granted`, `approval_denied`, `timeout`)
  - `detail_json` text, `created_at` timestamp NOT NULL
  - **NIKDY update ani delete** — audit log je append-only

### 4.2 MCP guarded wrappers (`modules/ainderstanding/govern/lib/mcp-tools.ts`)

Všetky guarded wrappers: preflight permission check → (approval gate ak treba) → call Connect adapter → audit → vrátiť výsledok.

- [x] `guarded_introspect_schema`:
  - Permission check: Layer 1 — vždy allowed ak source existuje
  - Audit: `action_type='read_schema'`
  - `allowedCallers: ['schema-explorer', 'supervisor']`

- [x] `guarded_read_native_comments`:
  - Permission check: Layer 1 — vždy allowed
  - Audit: `action_type='read_schema'` s `detail.sub='native_comments'`
  - `allowedCallers: ['schema-explorer', 'docs-keeper']`

- [x] `guarded_sample_data`:
  - Permission check: Layer 2 — vyžaduje `permission_tier >= with_reference_samples` A `isReferenceTable=true`
  - PII masking: stĺpce kde `pii_classification IS NOT NULL` → `[{TYPE}_MASKED]` (non-bypassable)
  - Audit: `action_type='read_sample'`, `outcome` podľa výsledku
  - `allowedCallers: ['data-profiler', 'model-architect']`

- [x] `guarded_run_select_query`:
  - Approval gate: `awaitApproval('execute_query', payload: { sql, dataSourceName })`
  - Cache výsledok: `result-cache.ts` (TTL 300s, session-scoped, in-memory)
  - Agent dostane iba metadata: `{ rowCount, columns, resultHandle }` — nikdy raw rows
  - Audit: `action_type='run_query'`, `sql_hash=SHA256(sql)`
  - `allowedCallers: ['sql-writer']`

- [x] `guarded_share_results`:
  - Approval gate: `awaitApproval('share_results_with_ai', payload: { rowCount, columns, queryPreview })`
  - Načíta z `result-cache` cez `resultHandle` — ak expired alebo neexistuje → error
  - Aplikuje PII masking na rows (column_permissions lookup)
  - Vráti faktické rows agentovi iba po approve
  - Audit: `action_type='share_results'`
  - `allowedCallers: ['supervisor']`

### 4.3 Internal adapter (pre Explore profiling)

- [x] `modules/ainderstanding/govern/lib/internal-adapter.ts`:
  - `profileTable(dataSourceId, tableName, stats: ProfileStats): Promise<void>` — priamy prístup cez Connect adapter, BEZ approval gate (profiling je systémová operácia)
  - Audit: `action_type='read_sample'` s `detail_json: { mode: 'profiling', rowCount }`
  - PII masking aplikovaný na vrátené rows
  - Volané iba z Explore `run_profile_query` MCP tool handler

### 4.4 Lib (`modules/ainderstanding/govern/lib/`)

- [x] `permission-service.ts`:
  - `getEffectivePermission(dataSourceId, tableName?, columnName?): PermissionTier`
  - Precedencia: column_permissions > table_permissions > source_permissions (najstrictnejšie vyhráva — BR-GOV-012)
  - Cached per request (iba in-memory, nie DB cache)
- [x] `pii-masking.ts`:
  - `maskRow(row: Record<string, unknown>, columnPermissions: ColumnPermission[]): Record<string, unknown>`
  - Formát: `[{PII_SUBTYPE}_MASKED]` napr. `[EMAIL_MASKED]`
  - **Non-bypassable** — žiadny escape hatch pre agentov
  - Aplikuje sa aj na reference table samples
- [x] `result-cache.ts`:
  - In-memory `Map<resultHandle, { rows, columns, sessionId, expiresAt }>`
  - TTL 300s od insertu
  - Session-scoped cleanup: `evictSession(sessionId)` — volať pri `stream_end`
  - `storeResult(sessionId, rows, columns): ResultHandle`
  - `getResult(resultHandle, sessionId): QueryResult | null` — null ak expired alebo wrong session
- [x] `audit-logger.ts`:
  - `log(entry: AuditEntry): void` — append-only insert do `audit_entries`
  - **Non-bypassable** — volaný priamo z každého guarded wrapper, nie cez MCP tool call chain
  - `audit_entries` je append-only — žiadny UPDATE/DELETE, žiadny setter pre vypnutie
  - Aj blocked operácie (outcome=denied/timeout) musia byť zaauditované (BR-GOV-042)
- [ ] ESLint custom rule (`.eslintrc.json` plugin alebo `eslint.config.mjs`):
  - Zakáže direct import `@/modules/ainderstanding/connect/lib/adapters/*` mimo `govern/` a `connect/`
  - Error message: "Import SourceAdapter directly — use Govern guarded wrappers instead"

### 4.5 API endpointy

- [x] `app/api/govern/column-metadata/route.ts` — POST:
  - Body: `{ dataSourceId, workspaceId, tableName, columnName, piiClassification, piiSubtype, setBy }`
  - Uloží do `column_metadata` (upsert classification fields, `setBy='user'`), audit log
  - Volaný z ClassifyColumnSheet (Govern) a context menu (Explore schema tree)
- [ ] `app/api/approvals/[requestId]/route.ts` — **existuje z Core**, iba overiť integráciu s `approval_settings.policy_*`

### 4.6 UI komponenty (`app/workspace/[workspaceId]/govern/`)

- [x] `page.tsx` — 2 taby: PII Inventory / Audit Log; deep-link `?tab=pii&source=&table=&column=` highlight; `?tab=permissions` redirect na `?tab=pii`
- [x] ~~`modules/ainderstanding/govern/components/PermissionsPanel.tsx`~~ — **odstránený** (presunutý do Settings → Approval Gates + Schema tree inline controls)
- [x] `modules/ainderstanding/govern/components/PIIInventoryDashboard.tsx`:
  - Filter: source / pii_type / status — client-side
  - Per-row: Edit button opens ClassifyColumnSheet; CSV export
- [x] `modules/ainderstanding/govern/components/ClassifyColumnSheet.tsx` — side drawer classification:
  - GDPR Layer radio group (L1/L2/L3) + PII subtype radios
  - AI suggestion badge; useEffect syncs state on re-open
  - Save → POST `/api/govern/column-metadata` with `setBy: 'user'`
- [x] `modules/ainderstanding/govern/components/BulkClassifySheet.tsx` — per-row select dropdowns + Save all (sequential POST)
- [x] `modules/ainderstanding/govern/components/PiiTypeRadios.tsx` — shared 9-subtype radio group
- [x] `modules/ainderstanding/govern/components/PiiLayerChip.tsx` — L1/L2/L3 chip with layer CSS tokens
- [x] `modules/ainderstanding/govern/components/AuditLogViewer.tsx`:
  - Chronologický zoznam (newest first); filters push URL search params (server-side)
  - Filter: agent, action_type, outcome, table search
  - Per-entry klik → `AuditEntryDetailSheet` (detail_json pretty-print, sql_hash)
  - **Žiadne tlačidlo delete/clear** — read-only UI
- [x] `modules/ainderstanding/govern/components/AuditEntryDetailSheet.tsx` — read-only entry detail
- [x] `ApprovalDialog.tsx` — refactored with gate-type dispatch:
  - `execute_query` → `ExecuteQueryGate` (L2 bottom banner, collapsible SQL)
  - `write_to_docs` → `WriteDocsGate` (L2 banner, confidence chip)
  - `share_results_with_ai` → `ShareResultsGate` (L3 modal, mandatory reason, progress bar)
  - `write_model_file` / `write_test_file` → `WriteFileGate` (L3 modal, file preview, mandatory reason)
- [x] `core/ui/progress.tsx` — countdown progress bar (manual impl, no Radix dep)

## 5. GDPR / Safety pravidlá (z RULES.md)

- [x] BR-GOV-001/002/003: 3-vrstvový model — Layer 1 ALLOW, Layer 2 DENY s opt-in, Layer 3 DENY s per-query approval
- [x] BR-GOV-012: permission precedencia — najstrictnejšia úroveň vyhráva (column > table > source)
- [ ] BR-GOV-022: ApprovalDeniedError nie je trigger pre retry v sql-writer
- [ ] BR-GOV-023: approval je per-request jednorazový (pokiaľ nie je "Approve for session" zvolené)
- [x] BR-GOV-030: PII masking non-bypassable — aj reference tables, aj po share_results_with_ai approve
- [x] BR-GOV-032: `column_metadata` je source of truth pre PII — ClassifyColumnSheet + Schema tree context menu ukladajú s `setBy: 'user'`; profiler nikdy neprepíše `set_by='user'` riadky
- [x] BR-GOV-041: audit log je append-only — žiadny UPDATE/DELETE na `audit_entries`, žiadna UI možnosť vypnúť
- [x] BR-GOV-042: blocked operácie (outcome=denied/timeout) musia byť zaauditované
- [x] BR-GOV-050: result handle TTL 5 min (300s), in-memory iba
- [x] BR-GOV-051: result handle session-scoped — iný user/session nemôže načítať cudzí result
- [ ] BR-GOV-061: write_to_docs approval skip ak `confidence='high'`

## 6. Verifikácia (end-to-end)

- [ ] **Permission check:** source na `metadata_only` → `guarded_sample_data` vráti DENIED → audit entry s `outcome=denied`
- [ ] **Layer 3 approval flow:** sql-writer zavolá `guarded_run_select_query` → SSE `approval_required` → ApprovalDialog → Approve → tool pokračuje, vráti `{ rowCount, resultHandle }` → `guarded_share_results` potrebuje druhý approval → po approve agent dostane rows
- [ ] **PII masking:** stĺpec `email` klasifikovaný ako PII → reference table sample zobrazuje `[EMAIL_MASKED]` namiesto hodnôt
- [ ] **Result cache expiry:** po 300s `getResult(resultHandle)` vráti null, agent dostane `RESULT_EXPIRED` error
- [x] **Audit log:** každá operácia (aj DENIED) sa objaví v AuditLogViewer; žiadna UI možnosť zmazať
- [ ] **ESLint rule:** pokus o priamy import Connect adaptéra z explore/ → ESLint error pri `npm run lint`
- [ ] Integration tests: `npx vitest run modules/ainderstanding/govern/__tests__/`

## 7. Odkazy

- [GOAL.md](./GOAL.md) — funkčný spec
- [RULES.md](./RULES.md) — business rules (BR-GOV-*)
- [UI.md](./UI.md) — UI/UX detaily, approval dialog variants, audit log filters
- [../DATABASE_SCHEMA.md §5](../DATABASE_SCHEMA.md) — permission + audit tabuľky
- [../MCP_TOOLS.md](../MCP_TOOLS.md) — Govern guarded wrappers sekcia
- [../API_CONTRACT.md](../API_CONTRACT.md) — `/api/approvals`, `/api/govern/column-permissions`
- [../ARCHITECTURE.md §8](../ARCHITECTURE.md) — 3-vrstvový model, approval gate mechanizmus
