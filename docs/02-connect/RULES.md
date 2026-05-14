# Connect Sub-module — Business Rules

*BR-CON = Connect Business Rules. Verzia 0.1. Pozri [GOAL](./GOAL.md) pre kontext.*

---

## Invariants

**BR-CON-001** — Read-only contract (hard)  
Condition: Akýkoľvek SQL smerovaný na source DB  
Rule: Musí byť `SELECT`. `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`, `MERGE`, `TRUNCATE`, `COMMENT`, `GRANT`, `REVOKE` sú rejected **pred odoslaním do DB**. Rejected query sa nikdy nedotkne source DB — nie je to DB-level error, je to preflight block.

**BR-CON-002** — Connection isolation per workspace  
Condition: Každý workspace  
Rule: Source adapters nie sú zdieľané naprieč workspaces. Workspace A nemôže pristupovať k source-om workspace B.

**BR-CON-003** — `SourceAdapter` interface nemá write metódy  
Condition: Definícia `SourceAdapter` interface  
Rule: Interface deklaruje iba `introspectSchema`, `executeSelect`, `testConnection`. Write metódy nie sú povolené — ani ako optional.

---

## SQL Parser Gate

**BR-CON-010** — Dual-layer enforcement  
Condition: Každý SQL prichádzajúci od agenta alebo usera  
Rule: Preflight check prebehne v dvoch vrstvách: (1) regex pre-check na known DML/DDL keywords, (2) AST parse cez `node-sql-parser`. Obe vrstvy musia pass.

**BR-CON-011** — Parser gate sa aplikuje identicky na všetky DB typy  
Condition: Akýkoľvek DB typ (Postgres, SQL Server, MySQL, DuckDB)  
Rule: Neexistuje "trusted adapter" výnimka. Parser gate je rovnaký bez ohľadu na DB.

**BR-CON-012** — `SELECT ... INTO` je rejected  
Condition: SQL s `INTO` clause  
Rule: Aj keď ide o SELECT, `INTO` clause umožňuje writes. Parser gate rejectuje tento pattern.

**BR-CON-013** — Dynamic SQL je rejected  
Condition: SQL obsahujúci `EXEC`, `sp_executesql`, `EXECUTE`, alebo stored procedure calls  
Rule: Rejected. Dynamický SQL nemožno staticky analyzovať pre intent.

**BR-CON-014** — Structured error pri rejection  
Condition: Parser gate rejectuje SQL  
Rule: Vracia `{ code: 'SQL_REJECTED', reason: string, statement_type: string }`. Agent dostane toto ako tool error response — nie generic exception.

---

## Connection lifecycle

**BR-CON-020** — Test connection odporúčaný pred uložením  
Condition: Pridanie alebo editácia data source  
Rule: UI vyzve na test connection (`SELECT 1` alebo equivalent). Neúspešné pripojenie možno uložiť s explicit user confirmation — user môže byť offline pri konfigurácii.

**BR-CON-021** — Max concurrent connections per source  
Condition: Paralelné operácie na rovnakom source  
Rule: Default max 5 súbežných pripojení per source (`max_concurrent_connections` setting). Nadlimitné requesty sú queued, nie rejected.

**BR-CON-022** — Connection config je workspace-scoped  
Condition: Každý `data_source` záznam  
Rule: Musí mať `workspace_id` FK. Connection bez workspace je schema-level invalid.

**BR-CON-023** — Credentials sú AES-256-GCM encrypted (P0a required)  
Condition: Connection storage (SQLite)  
Rule: Password fields v `data_sources` tabuľke sú zašifrované cez AES-256-GCM s kľúčom z `AIBIO_ENCRYPTION_KEY` env var. Aplikácia odmietne štart ak env var chýba alebo je kratšia ako 32 bytes (assertion v `core/db/encryption.ts`). Password v UI display je masked, v logs redacted. Dešifrovanie sa robí iba v `SourceAdapter.testConnection()` a `SourceAdapter.executeSelect()` — nikdy sa neserializuje do MCP tool responses ani SSE events.

---

## Error handling

**BR-CON-030** — Connection error → actionable message  
Condition: Zlý password, neexistujúci host, timeout  
Rule: User dostane konkrétnu správu (napr. *"Connection refused — skontroluj host a port"*), nie raw stack trace.

**BR-CON-031** — Query timeout → structured error  
Condition: Query prekročí `default_query_timeout` (default 30 s)  
Rule: Adapter zruší query, vracia `{ code: 'QUERY_TIMEOUT', timeout_ms: number }`. Agent dostane toto ako tool error response.

**BR-CON-032** — Adapter rozdiely sú skryté za interface-om  
Condition: Rôzne DB typy s rôznou system catalog syntaxou  
Rule: `SourceAdapter` interface normalizuje rozdiely. Konzumenti (Explore, Model) nikdy nevidia DB-špecifické chybové formáty.

---

## User SQL (Monaco)

**BR-CON-040** — SELECT-only platí aj pre user SQL z Monaco editora  
Condition: SQL zadaný manuálne user-om cez Monaco editor v Model sub-module  
Rule: Rovnaký SQL parser gate (regex + AST) sa aplikuje aj na manuálne SQL pred odoslaním do source DB. Nie je výnimka pre "manual mode" — read-only contract je absolútny.

**BR-CON-041** — Connection string je fallback za form-based config  
Condition: Konfigurácia data source  
Rule: Primárny input je form-based (host/port/user/password/database). Connection string je fallback ("advanced mode"). Connection string sa parsuje best-effort per DB type — ak parsing zlyhá, vráti graceful error (nie crash).
