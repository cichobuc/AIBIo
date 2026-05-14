# TODO — Connect (Source Connection Management)

> **Phase:** C1 (MVP) + C2 (additional adapters)
> **Status:** not started
> **Owner docs:** [GOAL.md](./GOAL.md), [RULES.md](./RULES.md), [UI.md](./UI.md)
> **Cross-refs:** ../ARCHITECTURE.md §6.1, ../DATABASE_SCHEMA.md §2 (workspaces, data_sources), ../MCP_TOOLS.md (žiadne vlastné — Govern wrappuje adaptéry), ../API_CONTRACT.md §workspace-CRUD

## 1. Účel

Foundation layer pre AInderstanding — manažuje pripojenia na zdrojové DB s **absolútnym read-only kontraktom**. Žiadne profiling, žiadne agenty. Poskytuje `SourceAdapter` interface ktorý Govern wrappuje do guarded MCP tools. Connect je prerequisita pre všetky ostatné moduly.

## 2. Stav existujúceho kódu

- [ ] Všetko — greenfield

## 3. Závislosti

- **Závisí od:** 00-core (P0a — `core/db/client.ts`, `core/db/encryption.ts`)
- **Blokuje:** 03-explore (potrebuje source adapters), 04-govern (wrappuje adaptéry), 05-model, 06-document, 07-test, 08-translate, 09-export

## 4. Implementačný checklist

### 4.1 DB schema (`modules/ainderstanding/connect/db/schema.ts`)

- [ ] Tabuľka `workspaces` (z DATABASE_SCHEMA.md §2):
  - `id` UUID PK, `name` varchar(100) NOT NULL
  - `description` text nullable
  - `ai_mode` enum(`auto`, `documentation`, `queries`, `manual`) default `auto`
  - `is_archived` boolean default `false`
  - `created_at`, `updated_at`
- [ ] Tabuľka `data_sources` (z DATABASE_SCHEMA.md §2):
  - `id` UUID PK, `workspace_id` FK `workspaces.id` CASCADE
  - `name` varchar(100) NOT NULL
  - `db_type` enum(`postgres`, `duckdb`, `mssql`, `mysql`) NOT NULL
  - `connection_mode` enum(`form`, `connection_string`) NOT NULL
  - `connection_credentials_encrypted` text NOT NULL — AES-256-GCM šifrovanie, nikdy plaintext
  - `connection_settings_json` text — timeout, SSL mode, pool size
  - `status` enum(`connected`, `error`, `untested`) default `untested`
  - `last_tested_at` timestamp nullable
  - `created_at`, `updated_at`
- [ ] Migrácie cez drizzle-kit

### 4.2 SourceAdapter interface + adaptéry (`modules/ainderstanding/connect/lib/adapters/`)

- [ ] `base.ts` — `SourceAdapter` interface s metódami:
  - `testConnection(): Promise<ConnectionTestResult>`
  - `introspectSchema(): Promise<SchemaSnapshot>`
  - `executeSelect(sql: string): Promise<QueryResult>` — SELECT-only, SQL gate pred odoslaním
  - `readNativeComments(): Promise<NativeComment[]>`
  - Žiadne write metódy na interface

- [ ] `factory.ts` — `createAdapter(source: DataSource, encKey: string): SourceAdapter`
  - In-memory decrypt credentials (nikdy na disk)
  - Switch na db_type → vráti príslušný adapter
  - Credentials sa po vytvorení adaptéra zahodia z heap (zeroing)

- [ ] `postgres.ts` — `pg` driver, pool size 5, connect timeout 10s, SSL optional
- [ ] `duckdb.ts` — `duckdb-async`, file_path z connection_settings_json, read-only mode flag
- [ ] `mssql.ts` — `mssql` driver **(Phase C2, nie MVP)**
- [ ] `mysql.ts` — `mysql2` driver **(Phase C2, nie MVP)**

### 4.3 SQL Parser Gate (`modules/ainderstanding/connect/lib/sql-gate/`)

- [ ] `regex-precheck.ts` — vrstva 1: rýchly regex na DML/DDL keywords pred AST parserom
  - Reject: INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE, EXEC, EXECUTE, sp_executesql, SELECT INTO (nie subquery), CALL
  - Case-insensitive, strip comments pred regexom
- [ ] `ast-parser.ts` — vrstva 2: `node-sql-parser` AST parse
  - Reject: statement type nie je SELECT
  - Reject: SELECT … INTO variable
  - Structured error: `{ code: 'SQL_REJECTED', reason: string, statement_type: string }`
- [ ] `index.ts` — `validateSelectOnly(sql: string): void` — throws `SqlRejectedError` pri akomkoľvek DML/DDL

### 4.4 Encryption / credentials (`modules/ainderstanding/connect/lib/`)

- [ ] `credentials-service.ts`:
  - `encryptCredentials(plain: ConnectionCredentials): string` — volá `core/db/encryption.ts`
  - `decryptCredentials(cipher: string): ConnectionCredentials` — in-memory only, nikdy persist decrypted
  - Fail-fast pri chybnom env key (pri app start cez `getConfig()`)

### 4.5 Services (`modules/ainderstanding/connect/lib/`)

- [ ] `workspace-service.ts`:
  - `createWorkspace(name, description?): Workspace`
  - `listWorkspaces(): Workspace[]`
  - `getWorkspace(id): Workspace`
  - `archiveWorkspace(id): void`
  - `updateWorkspaceMode(id, mode: AIMode): void`
- [ ] `data-source-service.ts`:
  - `addSource(workspaceId, config): DataSource`
  - `updateSource(id, config): DataSource`
  - `removeSource(id): void`
  - `testConnection(id): ConnectionTestResult` — 5-step: resolve → connect → auth → introspect → latency
  - `listSources(workspaceId): DataSource[]`
  - `getSource(id): DataSource`
- [ ] `connection-string-parser.ts` — best-effort parse per db_type; výstup: `{ host, port, database, user }` bez password v parsed objekte

### 4.6 UI komponenty

- [ ] `app/workspaces/page.tsx` — Workspace list: recent workspaces grid, empty state s "Create your first workspace" + Chinook demo link
- [ ] `app/workspaces/new/page.tsx` — Create workspace form: name, description
- [ ] `app/workspace/[workspaceId]/connect/page.tsx` — Sources list per workspace
- [ ] `app/workspace/[workspaceId]/connect/new/page.tsx` — Add source wizard (3 kroky: type → configure → verify)
- [ ] `modules/ainderstanding/connect/components/SourceCard.tsx`:
  - Status dot (zelená connected / červená error / šedá untested)
  - DB type ikona + name, last tested timestamp
  - Action row: Edit, Test, Remove buttons
- [ ] `modules/ainderstanding/connect/components/EditSourceDrawer.tsx` — slide-over 300ms, full config edit, inline test button
- [ ] `modules/ainderstanding/connect/components/TestConnectionPanel.tsx` — 5-step progress s 200ms stagger animáciou per krok; každý krok: loading → success/error
- [ ] `modules/ainderstanding/connect/components/ConnectionStringInput.tsx` — live parsing 300ms debounce, zobrazí parsed fields preview (bez sensitívnych hodnôt)
- [ ] `modules/ainderstanding/connect/components/RemoveSourceDialog.tsx` — type-to-confirm (napíš presný name zdroja)
- [ ] `modules/ainderstanding/connect/components/SourceDetailTab.tsx` — metadata: db_type, host, database, SSL status, last tested, status
- [ ] `modules/ainderstanding/connect/components/SecurityNoticeBanner.tsx` — dismissable banner o šifrovaní credentials

### 4.7 Password display pravidlá (BR-CON-010)

- [ ] Password v UI nikdy plaintext — zobrazuje `[••••••••]` s "Show (3s)" toggle
- [ ] Copy button kopíruje hodnotu bez zobrazenia na screen
- [ ] V error logoch credentials redacted: `{ host, database, user: '[REDACTED]' }`

## 5. GDPR / Safety pravidlá (z RULES.md)

- [ ] BR-CON-001: absolútny read-only kontrakt — SQL gate vynútená PRED odoslaním na DB, nie len v UI
- [ ] BR-CON-002: per-workspace isolation — adapter factory nikdy nezdieľa connection pool naprieč workspaces
- [ ] BR-CON-003: credentials šifrované, nikdy plaintext v SQLite ani v LLM kontexte
- [ ] BR-CON-010: password masking v UI, max 3s unmask
- [ ] No SSH tunnel, no cloud DB connectors v MVP — out of scope bezpečnostný povrch

## 5b. Error handling (z ERROR_HANDLING.md)

- [ ] `SOURCE_UNREACHABLE` — `testConnection()` zachytí `ECONNREFUSED`, `ETIMEDOUT`, auth error; vráti `ConnectionTestResult { success: false, step: string, error: 'SOURCE_UNREACHABLE', detail: string }`; UI zobrazí failed step v `TestConnectionPanel` s konkrétnym krokom (DNS / TCP / Auth / Introspect)
- [ ] `SQL_REJECTED` — `validateSelectOnly()` throws `SqlRejectedError`; adapter layer ho chytí a vráti štruktúrovanú chybu; nikdy raw SQL query v error message (XSS / info leak)
- [ ] Credentials decrypt failure — `DecryptionError` — fail-fast s clear message, nikdy stack trace do UI

## 6. Verifikácia (end-to-end)

- [ ] **Create workspace:** form → submit → redirect na `workspace/[id]/connect` → empty sources state zobrazený
- [ ] **Add PostgreSQL source:** wizard (3 kroky) → Test (5-step progress) → "Connected" → SourceCard zelený dot
- [ ] **Add DuckDB source:** file_path konfig → Test → Connected
- [ ] **SQL gate unit tests:** `npx vitest run modules/ainderstanding/connect/lib/sql-gate/`
  - SELECT: pass
  - INSERT / UPDATE / DELETE: reject s `SQL_REJECTED`
  - `SELECT INTO` variable: reject
  - Multi-statement: reject
  - Obfuscated bypass pokus (newlines v DML keywords): reject
- [ ] **Encryption roundtrip:** encrypt → persist → fetch → decrypt → match original (integration test)
- [ ] **Remove source:** type-to-confirm → source zmizne, FK cascade v DB

## 7. Odkazy

- [GOAL.md](./GOAL.md) — funkčný spec
- [RULES.md](./RULES.md) — business rules (BR-CON-*)
- [UI.md](./UI.md) — UI/UX detaily, wizard steps, animácie, empty states
- [../DATABASE_SCHEMA.md §2](../DATABASE_SCHEMA.md) — `workspaces`, `data_sources` tabuľky
- [../ARCHITECTURE.md §6.1](../ARCHITECTURE.md) — SourceAdapter contract, read-only enforcement
