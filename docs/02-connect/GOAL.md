# Connect Sub-module — GOAL

*Working doc, slovensky. Verzia 0.1. Súčasť AInderstanding, pozri [parent GOAL](../AINDERSTANDING.md).*

---

## 1. Účel sub-modulu

**Connect je foundation AInderstandingu.** Manage source DB connections + enforce strict read-only access. Nič iné — žiadne profiling, žiadne modelovanie, len pure connection layer.

Tento sub-modul **definuje hard contract: AIBIo nikdy nezmení source DB**. Žiadne `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`, `MERGE`, `TRUNCATE`, `COMMENT`, `GRANT`. **SELECT-only**, parser-enforced.

---

## 2. Koncepty

- **Data source** — konekcia na konkrétny external DB (Postgres / SQL Server / MySQL / DuckDB). Per workspace môže byť 1-N sources.
- **Source adapter** — implementácia `SourceAdapter` interface per DB type. Tenká abstrakcia, žiadne write methods.
- **Connection config** — JSON s host/port/user/password/database (form-based) alebo connection string (advanced mode).
- **SQL parser gate** — preflight check pre každý SQL ktorý ide do source DB. Reject čokoľvek čo nie je `SELECT`.

---

## 3. Scope

### In scope (MVP)

- Workspace CRUD (jednoduché — name, description, archive)
- Source CRUD (add, edit, remove, test connection)
- Form-based connection editor + connection string fallback
- 4 source adapters: Postgres, SQL Server, MySQL, DuckDB
- SQL parser gate (SELECT-only enforcement, dual-layer: regex pre-check + AST parse)
- Connection health check (test connection button)
- Connection storage (SQLite v AIBIo, AES-256-GCM encrypted via `AIBIO_ENCRYPTION_KEY` — required, app nespustí bez neho)

### Out of scope

- Connection pooling beyond defaults (single connection per source)
- SSH tunneling (advanced — follow-up)
- Cloud DB types (Snowflake, BigQuery, Redshift, Databricks) — Postgres/MSSQL/MySQL/DuckDB stačia pre MVP
- Source-to-source replication
- Connection sharing across workspaces

---

## 4. Agenti

**Žiadni subagenti.** Connect je pure infrastructure layer. Source adapters sú volané subagentmi v iných sub-moduloch (`schema-explorer` v Explore, `sql-writer` v Model, atď.) cez MCP tools registered v `core/agent-sdk/`.

---

## 5. Success criteria

1. **Workspace lifecycle** — vytvorenie workspace + 2 data sources + 4 úspešných test-connection calls do 30 s
2. **SELECT-only enforcement** — test: agent napíše `DROP TABLE x` → SQL parser gate odmietne pred odoslaním do DB, vráti structured error, agent dostane to ako tool error a vie sa adaptovať
3. **Read fungovanie naprieč adapters** — test connection + jednoduchý `SELECT 1` funguje na Postgres, MySQL, MSSQL, DuckDB
4. **Connection error UX** — invalid config (zlý password, neexistujúci host) vráti graceful error v UI s actionable message, nie stack trace alebo crash

---

## 6. Phase plán

### Phase C1: Workspace + Data source CRUD + 2 adapters — ~3 dni

- Drizzle schema (workspaces, data_sources)
- Workspaces CRUD (UI + backend)
- DataSource CRUD (UI + backend)
- SourceAdapter interface
- Postgres adapter (use `pg`)
- DuckDB adapter (use `duckdb-async`)
- SQL parser gate (use `node-sql-parser`)
- Test connection feature

**Outputs:** user vie create workspace, pridá Postgres + DuckDB source, vidí test connection success.

### Phase C2 *(môže byť odložené ak MVP scope tight)* — ~1 deň

- MSSQL adapter (use `mssql`)
- MySQL adapter (use `mysql2`)

**Total Connect: ~3-4 dni**

---

## 7. Open questions

- **Connection string format inconsistency naprieč DB types** — JDBC vs ODBC vs `postgres://` URL syntax sú rôzne. *Predbežne:* form-based primary, connection string accepts any reasonable format pre daný typ, fail gracefully ak parsing failne.
- **Encrypted connection storage** — credentials sú AES-256-GCM šifrované v SQLite (Phase P0a requirement); `AIBIO_ENCRYPTION_KEY` env var required. Decrypt-uje sa in-memory v adapter factory, nikdy sa neukladá plain text. Zároveň mask password v UI display a redact v logoch.
- **Concurrent connections** — pri paralelnom profiling N tabuliek, koľko súčasných pripojení? *Predbežne max 5 per source.* User-configurable cez setting.

---

## 8. Riziká

- **SQL parser bypass** — sofisticovaný SQL môže obíť naive regex check. *Mitigation:* použiť real SQL parser (`node-sql-parser`), unit tests so známymi bypass attempts (`SELECT ... INTO`, dynamic SQL, etc.).
- **Connection string PII leak** — connection string môže obsahovať password. *Mitigation:* credentials šifrované v SQLite (AES-256-GCM, P0a); mask password v UI display; redact v logoch pred akýmkoľvek loggingom.
- **Adapter inconsistencies** — rôzne DB types majú rôzne syntax pre system catalogs, comments, etc. *Mitigation:* per-adapter test suite, abstraction maps differences za uniform interface.

---

## 9. Settings (Connect owned)

| Setting | Tier | Default | Notes |
|---|---|---|---|
| Connection name | `[Core]` | required | Per source |
| DB type | `[Core]` | required | Postgres / SQL Server / MySQL / DuckDB |
| Connection mode | `[Core]` | Form-based | Form / Connection string |
| Default query timeout | `[Core]` | 30 s | Per workspace |
| Max concurrent connections per source | `[Polish]` | 5 | Per source |
| SSL / TLS preference | `[Polish]` | Prefer | Per source |

---

## 10. Glossary (Connect-specific)

- **Source adapter** — implementácia `SourceAdapter` interface per DB type
- **Connection config** — JSON s host/port/user/password (form) alebo connection string
- **SQL parser gate** — preflight enforcement layer ktorý odmietne non-SELECT statements pred ich odoslaním do source DB
- **Test connection** — sync health check, vyšle `SELECT 1` (alebo equivalent) a meria latency

---

## 11. References

- Parent: [AINDERSTANDING.md](../AINDERSTANDING.md)
- Pravidlá sub-modulu: [RULES.md](./RULES.md)
- Architektúra (SourceAdapter interface, SQL parser gate implementácia, DB schema): [ARCHITECTURE.md](../ARCHITECTURE.md) — sekcia 6
- Foundation: [core/GOAL.md](../00-core/GOAL.md) — DB klient, MCP server
- Konzumujú Connect:
  - [explore/GOAL.md](../03-explore/GOAL.md) — schema introspection + sample data
  - [model/GOAL.md](../05-model/GOAL.md) — runs SELECT queries pri SQL development
  - [govern/GOAL.md](../04-govern/GOAL.md) — wraps Connect adapters do guarded tools
- Top-level: [AIBIO.md](../AIBIO.md)
