# TODO — Govern (GDPR Control Plane)

> **Phase:** G1 (enforcement layer) → G2 (UI)
> **Status:** not started
> **Owner docs:** [GOAL.md](./GOAL.md), [RULES.md](./RULES.md), [UI.md](./UI.md)
> **Cross-refs:** ../ARCHITECTURE.md §6.3 §8, ../DATABASE_SCHEMA.md §5 (permissions, audit), ../MCP_TOOLS.md §Govern, ../API_CONTRACT.md §approvals §govern, ../AGENT_PROMPTS.md (žiadni vlastní agenti)

## 1. Účel

Cross-cutting governance, GDPR control plane a audit layer. Vynucuje **3-vrstvový data exposure model** (Layer 1: schema metadata — ALLOW; Layer 2: sample data — DENY s opt-in; Layer 3: query results — DENY s per-query approval). Manažuje permission tiers, PII klasifikáciu a audit log. **Žiadne LLM reasoning** — len policy + audit + guarded adaptery. G1 (enforcement) musí byť hotový pred Explore E2.

## 2. Stav existujúceho kódu

- [x] `app/api/approvals/[requestId]/route.ts` — exists (v Core), volá `resolveApproval`
- [ ] Všetko ostatné — greenfield

## 3. Závislosti

- **Závisí od:** 00-core (`awaitApproval`, `sseEmitter`, `AgentContext`), 02-connect (SourceAdapter — Govern wrappuje)
- **G2 závisí od:** 03-explore E1 (PII candidates feed do `column_permissions` UI)
- **Blokuje:** 03-explore E2 (data-profiler cez internal-adapter), 05-model (sql-writer cez guarded tools), 06-document (write_doc s approval), 07-test (testy cez guarded tools), všetky write operácie subagentov

## 4. Implementačný checklist

### 4.1 DB schema (`modules/ainderstanding/govern/db/schema.ts`)

- [ ] Tabuľka `source_permissions` (DATABASE_SCHEMA.md §5):
  - `id` UUID PK, `data_source_id` FK `data_sources.id` CASCADE UNIQUE
  - `permission_tier` enum(`metadata_only`, `with_reference_samples`, `with_full_samples`, `with_query_results`) default `metadata_only`
  - `updated_at`
- [ ] Tabuľka `table_permissions` (DATABASE_SCHEMA.md §5):
  - `id`, `data_source_id` FK, `table_name` varchar NOT NULL
  - `permission_override` enum (rovnaká ako `permission_tier`) nullable — null = follow source
  - UNIQUE(`data_source_id`, `table_name`)
- [ ] Tabuľka `column_permissions` (DATABASE_SCHEMA.md §5):
  - `id`, `data_source_id` FK, `table_name`, `column_name` NOT NULL
  - `pii_classification` enum(`none`, `pii`, `sensitive`) nullable
  - `pii_subtype` enum(`name`, `email`, `phone`, `address`, `id_number`, `financial`, `health`, `biometric`, `other`) nullable
  - `set_by` enum(`user`, `ai_suggestion`) NOT NULL
  - `classified_at`, `classified_by_session` nullable
  - UNIQUE(`data_source_id`, `table_name`, `column_name`)
- [ ] Tabuľka `approval_settings` (DATABASE_SCHEMA.md §5):
  - `id`, `workspace_id` FK UNIQUE
  - `policy_execute_query` enum(`always_ask`, `session_remember`, `auto_approve`) default `always_ask`
  - `policy_share_results` enum rovnaký, default `always_ask`
  - `policy_write_to_docs` enum, default `threshold_based` (BR-GOV-060: approval iba ak confidence < high)
  - `policy_schema_introspect` enum, default `auto_approve`
  - `approval_timeout_sec` default `300`
- [ ] Tabuľka `audit_entries` (DATABASE_SCHEMA.md §5) — **read-only po insert**:
  - `id` UUID PK, `workspace_id`, `data_source_id` nullable, `session_id`
  - `agent_name` varchar, `action_type` enum(`read_schema`, `read_native_comments`, `read_samples`, `execute_query`, `share_results`, `write_doc`, `write_model`, `write_test`, `pii_classify`)
  - `table_name` nullable, `column_names_json` nullable, `sql_hash` nullable (SHA-256 SQL, nie SQL samotný)
  - `outcome` enum(`allowed`, `denied`, `timeout`, `blocked`)
  - `detail_json` text, `created_at` timestamp NOT NULL
  - **NIKDY update ani delete** — audit log je append-only

### 4.2 MCP guarded wrappers (`modules/ainderstanding/govern/lib/mcp-tools.ts`)

Všetky guarded wrappers: preflight permission check → (approval gate ak treba) → call Connect adapter → audit → vrátiť výsledok.

- [ ] `guarded_introspect_schema`:
  - Permission check: Layer 1 — vždy allowed ak source existuje
  - Audit: `action_type='read_schema'`
  - `allowedCallers: ['schema-explorer', 'supervisor']`

- [ ] `guarded_read_native_comments`:
  - Permission check: Layer 1 — vždy allowed
  - Audit: `action_type='read_native_comments'`
  - `allowedCallers: ['schema-explorer', 'docs-keeper']`

- [ ] `guarded_sample_data`:
  - Permission check: Layer 2 — vyžaduje `permission_tier >= with_reference_samples` A `table_permissions.is_reference_table=true` (z `table_profiles`)
  - PII masking: stĺpce kde `pii_classification IS NOT NULL` → `[{TYPE}_MASKED]` (non-bypassable)
  - Audit: `action_type='read_samples'`, `outcome` podľa výsledku
  - `allowedCallers: ['data-profiler', 'model-architect']`

- [ ] `guarded_run_select_query`:
  - SQL parser gate (z Connect lib) pred odoslaním
  - Approval gate: `awaitApproval('execute_query', payload: { sql, estimatedRows })` — podľa `approval_settings.policy_execute_query`
  - Cache výsledok: `result-cache.ts` (TTL 300s, session-scoped, in-memory)
  - Agent dostane iba metadata: `{ rowCount, columns, resultHandle }` — nikdy raw rows
  - Audit: `action_type='execute_query'`, `sql_hash=SHA256(sql)`
  - `allowedCallers: ['sql-writer']`

- [ ] `guarded_share_results`:
  - Approval gate: `awaitApproval('share_results_with_ai', payload: { resultHandle, rowCount })`
  - Načíta z `result-cache` cez `resultHandle` — ak expired alebo neexistuje → error
  - Aplikuje PII masking na rows (column_permissions lookup)
  - Vráti faktické rows agentovi iba po approve
  - Audit: `action_type='share_results'`
  - `allowedCallers: ['supervisor']`

### 4.3 Internal adapter (pre Explore profiling)

- [ ] `modules/ainderstanding/govern/lib/internal-adapter.ts`:
  - `profileTable(dataSourceId, tableName, stats: ProfileStats): Promise<void>` — priamy prístup cez Connect adapter, BEZ approval gate (profiling je systémová operácia)
  - Audit: `action_type='read_samples'` s `detail_json: { mode: 'profiling', sampling: true/false }`
  - PII pre-filter pred uložením top_values do `column_profiles`
  - Volané iba z Explore `run_profile_query` MCP tool handler

### 4.4 Lib (`modules/ainderstanding/govern/lib/`)

- [ ] `permission-service.ts`:
  - `getEffectivePermission(dataSourceId, tableName?, columnName?): PermissionTier`
  - Precedencia: column_permissions > table_permissions > source_permissions (najstrictnejšie vyhráva — BR-GOV-012)
  - Cached per request (iba in-memory, nie DB cache)
- [ ] `pii-masking.ts`:
  - `maskRow(row: Record<string, unknown>, columnPermissions: ColumnPermission[]): Record<string, unknown>`
  - Formát: `[{PII_SUBTYPE}_MASKED]` napr. `[EMAIL_MASKED]`
  - **Non-bypassable** — žiadny escape hatch pre agentov
  - Aplikuje sa aj na reference table samples
- [ ] `result-cache.ts`:
  - In-memory `Map<resultHandle, { rows, columns, sessionId, expiresAt }>`
  - TTL 300s od insertu
  - Session-scoped cleanup: pri `stream_end` SSE event vymaž všetky entries pre daný sessionId
  - `storeResult(sessionId, rows, columns): ResultHandle`
  - `getResult(resultHandle, sessionId): QueryResult | null` — null ak expired alebo wrong session
- [ ] `audit-logger.ts`:
  - `log(entry: AuditEntry): void` — append-only insert do `audit_entries`
  - **Non-bypassable** — volaný priamo z každého guarded wrapper, nie cez MCP tool call chain
  - `audit_entries` je append-only — žiadny UPDATE/DELETE, žiadny setter pre vypnutie
  - Aj blocked operácie (outcome=denied/timeout) musia byť zaauditované (BR-GOV-042)
- [ ] ESLint custom rule (`.eslintrc.json` plugin alebo `eslint.config.mjs`):
  - Zakáže direct import `@/modules/ainderstanding/connect/lib/adapters/*` mimo `govern/` a `connect/`
  - Error message: "Import SourceAdapter directly — use Govern guarded wrappers instead"

### 4.5 API endpointy

- [ ] `app/api/govern/column-permissions/route.ts` — POST:
  - Body: `{ dataSourceId, tableName, columnName, piiClassification, piiSubtype, setBy: 'user' }`
  - Uloží do `column_permissions`, audit log
  - Volaný z PIICandidatesPanel (Explore) a ClassifyColumnTab (Govern)
- [ ] `app/api/approvals/[requestId]/route.ts` — **existuje z Core**, iba overiť integráciu s `approval_settings.policy_*`

### 4.6 UI komponenty (`app/workspace/[workspaceId]/govern/`)

- [ ] `page.tsx` — 3 taby: Permissions / PII Inventory / Audit Log
- [ ] `modules/ainderstanding/govern/components/PermissionsPanel.tsx`:
  - Per-source permission tier dropdown
  - Per-table overrides (collapsible)
  - Approval policy settings (4 policy dropdowns)
- [ ] `modules/ainderstanding/govern/components/PIIInventoryDashboard.tsx`:
  - Filter: table / column / pii_type / status (candidate/classified) / layer (1/2/3)
  - Per-row: Classify button (opens `ClassifyColumnTab`) / Mark as not-PII
  - Export list button
- [ ] `modules/ainderstanding/govern/components/ClassifyColumnTab.tsx` — inline classification:
  - PII classification selector (`none` / `pii` / `sensitive`)
  - PII subtype radio group
  - Potvrdiť → POST `/api/govern/column-permissions`
- [ ] `modules/ainderstanding/govern/components/BulkClassifyTab.tsx` — multi-column výber + hromadné nastavenie
- [ ] `modules/ainderstanding/govern/components/AuditLogViewer.tsx`:
  - Chronologický zoznam (newest first)
  - Filter: agent_name, action_type, outcome, date range
  - Per-entry detail: session_id, table, columns, outcome badge
  - **Žiadne tlačidlo delete/clear** — read-only UI
- [ ] `ApprovalDialog.tsx` — global modal (viď 01-shell TODO) — Govern len poskytuje `gateType`-specific payload rendering:
  - `execute_query`: SQL snippet (syntax highlighted, read-only), estimated row count
  - `write_model_file`: model name + SQL preview
  - `write_to_docs`: doc record type + confidence
  - `write_test_file`: test SQL preview
  - `share_results_with_ai`: row count + column names (nikdy raw values v dialógu!)

## 5. GDPR / Safety pravidlá (z RULES.md)

- [ ] BR-GOV-001/002/003: 3-vrstvový model — Layer 1 ALLOW, Layer 2 DENY s opt-in, Layer 3 DENY s per-query approval
- [ ] BR-GOV-012: permission precedencia — najstrictnejšia úroveň vyhráva (column > table > source)
- [ ] BR-GOV-022: ApprovalDeniedError nie je trigger pre retry v sql-writer
- [ ] BR-GOV-023: approval je per-request jednorazový (pokiaľ nie je "Approve for session" zvolené)
- [ ] BR-GOV-030: PII masking non-bypassable — aj reference tables, aj po share_results_with_ai approve
- [ ] BR-GOV-032: `column_permissions` je source of truth pre PII — Explore `column_profiles.pii_candidate` je iba suggestion
- [ ] BR-GOV-041: audit log je append-only — žiadny UPDATE/DELETE na `audit_entries`, žiadna UI možnosť vypnúť
- [ ] BR-GOV-042: blocked operácie (outcome=denied/timeout) musia byť zaauditované
- [ ] BR-GOV-050: result handle TTL 5 min (300s), in-memory iba
- [ ] BR-GOV-051: result handle session-scoped — iný user/session nemôže načítať cudzí result
- [ ] BR-GOV-061: write_to_docs approval skip ak `confidence='high'`

## 6. Verifikácia (end-to-end)

- [ ] **Permission check:** source na `metadata_only` → `guarded_sample_data` vráti DENIED → audit entry s `outcome=denied`
- [ ] **Layer 3 approval flow:** sql-writer zavolá `guarded_run_select_query` → SSE `approval_required` → ApprovalDialog → Approve → tool pokračuje, vráti `{ rowCount, resultHandle }` → `guarded_share_results` potrebuje druhý approval → po approve agent dostane rows
- [ ] **PII masking:** stĺpec `email` klasifikovaný ako PII → reference table sample zobrazuje `[EMAIL_MASKED]` namiesto hodnôt
- [ ] **Result cache expiry:** po 300s `getResult(resultHandle)` vráti null, agent dostane `RESULT_EXPIRED` error
- [ ] **Audit log:** každá operácia (aj DENIED) sa objaví v AuditLogViewer; žiadna UI možnosť zmazať
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
