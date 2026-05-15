# AInderstanding — Error & Resilience Model

> **Scope:** Taxonómia chýb, recovery stratégie, partial state handling a user-visible error states pre celý AInderstanding stack. Cieľom je, aby každý failure mode mal explicitný a predvídateľný výsledok — žiadne tiché zlyhania.

---

## Princípy

1. **Fail fast, fail visibly** — každá chyba musí byť surfovaná používateľovi alebo zalogovaná s kontextom
2. **Partial persistence je OK** — ak workflow zlyhá v kroku 3 z 5, zachovaj kroky 1–2; nerollbackuj bez dôvodu
3. **Retries sú explicitné** — iba `sql-writer` self-heal loop má retry (max 3×); ostatné operácie sa neopakujú automaticky
4. **SSE stream_error pred stream_end** — pri chybe vždy emituj `stream_error` a potom `stream_end`; nikdy neopúšťaj stream bez closure eventu

---

## Error taxonómia

### Tier 1 — Infrastructure errors (service layer)

| Kód | Miesto vzniku | Príčina |
|-----|--------------|---------|
| `SOURCE_UNREACHABLE` | Connect adapters | DB nedostupná (sieť, credentials, firewall) |
| `SQLITE_LOCKED` | core/db | Paralelný write do SQLite (WAL mode by mal eliminovať, ale nie vždy) |
| `AGENT_SDK_ERROR` | agent-sdk | Claude Agent SDK error: rate limit, overload, alebo interná chyba |
| `SSE_CLIENT_DISCONNECTED` | streaming.ts | Browser zatvoril EventSource spojenie |
| `INTERNAL_ERROR` | Kdekoľvek | Nečakané runtime exception |

### Tier 2 — Permission & governance errors

| Kód | Miesto vzniku | Príčina |
|-----|--------------|---------|
| `PERMISSION_DENIED` | Govern guarded tools | Agent chce dáta nad rámec permission tier |
| `APPROVAL_DENIED` | approval-gate.ts | Používateľ klikol "Deny" |
| `APPROVAL_TIMEOUT` | approval-gate.ts | 300 s bez rozhodnutia |
| `INVALID_SQL` | validate_sql / parser gate | Non-SELECT SQL zachytený parserom |

### Tier 3 — Domain errors (business logic)

| Kód | Miesto vzniku | Príčina |
|-----|--------------|---------|
| `QUERY_EXECUTION_ERROR` | guarded_run_select_query | SELECT zlyhal na source DB |
| `MATERIALIZATION_ERROR` | materialize_models | Model SQL zlyhal v DuckDB |
| `LINEAGE_CYCLE` | parse_lineage | Cirkulárna ref() závislosť |
| `TEST_COMPILATION_ERROR` | write_test_file | Custom test SQL odmietnutý parserom |
| `MAX_RETRIES_EXCEEDED` | test_failure_handoff | Self-heal loop vyčerpal 3 pokusy |
| `FILE_EXISTS_NO_OVERWRITE` | write_model_file | Súbor existuje a overwrite=false |
| `RESOURCE_NOT_FOUND` | Všetky tools | workspace_id / data_source_id / model_name neexistuje |
| `EXECUTION_TIMEOUT` | translate-validator | Python/SQL execution prekročil časový limit (default 30 s) |
| `SANDBOX_UNAVAILABLE` | translate-validator | Docker sandbox pre PySpark/Spark tier nedostupný |
| `INVALID_TIER` | generate_snippet | Neznáme `executionTier` v Language Registry |

### Canonical Error Code Table

> **Single source of truth.** `API_CONTRACT.md` per-endpoint error types a `stream_error` SSE events MUSIA referencovať len kódy z tejto tabuľky. **Channel:** `HTTP body` = synchronná REST odpoveď; `SSE stream_error` = asynchrónny event počas agentic session.

| Kód | Tier | HTTP Status | Channel | Retry |
|---|---|---|---|---|
| `SOURCE_UNREACHABLE` | 1 | 503 | SSE stream_error | Nie |
| `SQLITE_LOCKED` | 1 | 500 | SSE stream_error | Áno (exponential, max 3×) |
| `AGENT_SDK_ERROR` | 1 | 429 / 502 / 529 | SSE stream_error | Áno pre rate limit / overload (SDK retry); Nie pre 5xx |
| `SSE_CLIENT_DISCONNECTED` | 1 | — | interné | — |
| `INTERNAL_ERROR` | 1 | 500 | HTTP body + SSE stream_error | Nie |
| `MANUAL_MODE_ACTIVE` | 2 | 400 | HTTP body | Nie |
| `MESSAGE_TOO_LONG` | 2 | 400 | HTTP body | Nie |
| `SESSION_CONFLICT` | 2 | 409 | HTTP body | Nie |
| `PERMISSION_DENIED` | 2 | 403 | SSE stream_error | Nie |
| `APPROVAL_DENIED` | 2 | — | SSE stream_error (`recoverable: true`) | Nie (user action) |
| `APPROVAL_TIMEOUT` | 2 | — | SSE stream_error (`recoverable: true`) | Nie |
| `APPROVAL_REQUEST_NOT_FOUND` | 2 | 404 | HTTP body | Nie |
| `APPROVAL_ALREADY_RESOLVED` | 2 | 409 | HTTP body | Nie |
| `INVALID_SQL` | 2 | 400 | SSE stream_error | Nie |
| `INVALID_PII_SUBTYPE` | 3 | 400 | HTTP body | Nie |
| `WORKSPACE_NOT_FOUND` | 3 | 404 | HTTP body | Nie |
| `DATA_SOURCE_NOT_FOUND` | 3 | 404 | HTTP body | Nie |
| `COLUMN_NOT_FOUND` | 3 | 404 | HTTP body | Nie |
| `RESOURCE_NOT_FOUND` | 3 | 404 | HTTP body | Nie |
| `QUERY_EXECUTION_ERROR` | 3 | — | SSE stream_error | Nie |
| `MATERIALIZATION_ERROR` | 3 | — | SSE stream_error | Áno (self-heal, max 3×) |
| `LINEAGE_CYCLE` | 3 | — | SSE stream_error | Nie |
| `TEST_COMPILATION_ERROR` | 3 | — | SSE stream_error | Nie |
| `MAX_RETRIES_EXCEEDED` | 3 | — | SSE stream_error | Nie |
| `FILE_EXISTS_NO_OVERWRITE` | 3 | 409 | SSE stream_error | Nie |
| `EXECUTION_TIMEOUT` | 3 | 408 | SSE stream_error | Nie |
| `SANDBOX_UNAVAILABLE` | 3 | 503 | SSE stream_error | Nie |
| `INVALID_TIER` | 3 | 400 | SSE stream_error | Nie |

---

## Recovery stratégie per error type

### `SOURCE_UNREACHABLE`

**Kontext:** Nastáva pri `guarded_introspect_schema`, `guarded_run_select_query`, `run_profile_query`, source pull pri materializácii.

**Recovery:**
- Okamžite zastaviť dotknutú operáciu; neskúšať retry
- Emitovať `stream_error` s `recoverable: true` a správou s radou (skontrolovať credentials, sieť)
- Zachovať všetky predošlé snapshoty a profily — nič nemazať
- Workflow sa zastaví na tomto kroku; ostatné paralelné operácie (ak bežia) môžu dokončiť

**Partial state:** `schema_snapshots` a `column_profiles` z predošlého úspešného run zostávajú platné.

**Paralelné operácie:** `data-profiler` beží ako `Promise.allSettled()` — nie `Promise.all()`. Failure jednej instance nezastaví ostatné. Supervisor zbiera výsledky a reportuje čiastočné zlyhania po dokončení všetkých.

**User-visible state:** Error banner "Cannot connect to {sourceName}. Check your connection settings." s tlačidlom "Test Connection".

---

### `SQLITE_LOCKED`

**Kontext:** Paralelný write (data-profiler N instances) do SQLite.

**Recovery:**
- Implementovať exponential backoff: 3 pokusy s 100ms, 200ms, 400ms delay
- Ak po 3 pokusoch stále locked → `INTERNAL_ERROR` s kontextom
- Preferovať WAL mode (`PRAGMA journal_mode=WAL`) — eliminuje väčšinu lock contention

**Config:**
```typescript
// core/db/client.ts
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000'); // 5s timeout namiesto immediate fail
```

---

### `AGENT_SDK_ERROR`

**Kontext:** Kdekoľvek kde sa volá `query()` z `@anthropic-ai/claude-agent-sdk`.

**Sub-typy:**

| Príčina | Recovery |
|---------|----------|
| Rate limit | Claude Agent SDK má built-in retry; ak vyčerpá pokusy → emitovať `stream_error` |
| Overload (529 ekvivalent) | SDK retry po backoff; po vyčerpaní → `stream_error` |
| Interná chyba SDK / siete | Emitovať `stream_error`, surfovať používateľovi |
| OAuth token neplatný / expirovaný | Okamžite failnúť; informovať používateľa: `claude login` je potrebný |

**User-visible state:** "AI service temporarily unavailable. Please try again." + retry tlačidlo pre dočasné chyby.

---

### `SSE_CLIENT_DISCONNECTED`

**Kontext:** Browser zatvoril tab / stratil sieť počas dlhého agentic run.

**Recovery:**
- Server-side: pokračovať v agentic workflow (nečakať na klienta)
- Výsledky sú uložené v SQLite — klient ich načíta pri reconnecte
- Approval gates: ak klient odpojí počas čakania na approval → approval sa zastaví s `APPROVAL_TIMEOUT` po 300s; agent dostane `denied`
- EventSource na klientovi sa automaticky reconnectuje; po reconnecte emituj `stream_end` ak workflow medzitým skončilo

**State po reconnecte:** `useSSEStream` hook pri otvorení streamu dostane iba nové eventy (od momentu reconnectu). História je v `chat_messages` tabuľke — UI ju načíta cez samostatný fetch.

---

### `APPROVAL_DENIED` / `APPROVAL_TIMEOUT`

**Kontext:** Approval gate pre `execute_query`, `write_model_file`, `write_test_file`, `write_to_docs`.

**Recovery:**
- Tool handler dostane `rejected` z Promise → vráti error tool result agentovi
- Agent (sql-writer, docs-keeper, test-generator) dostane tool error → reportuje supervisorovi
- Supervisor emituje `stream_error` s `recoverable: true` a popisom čo bolo zamietnuté
- Supervisor ukončí workflow a informuje používateľa: "Model file write was denied. You can retry the operation."

**Partial state:**
- `write_model_file` denied: súbor neexistuje / nie je zmenený. Model v DB má `status='pending'`.
- `execute_query` denied: `query_result_id` je zahodený. `sql-writer` zapíše model bez execution-time verifikácie — používateľ zvolil tento trade-off kliknutím "Deny". Materializácia odhalí prípadné SQL chyby.
- `write_to_docs` denied: záznam nie je vytvorený. Coverage sa nemení.

---

### `INVALID_SQL`

**Kontext:** `validate_sql`, `write_model_file`, `write_test_file`.

**Recovery:**
- `validate_sql` vráti `{ valid: false, errors: [...] }` — agent dostane chyby a môže opraviť
- `write_model_file` s invalid SQL → okamžitý fail pred approval gate (approval sa nespúšťa)
- Custom test SQL odmietnutý → `TEST_COMPILATION_ERROR`, surfovaný používateľovi

**User-visible state:** Inline error v Monaco editore s riadkom a popisom. Pre AI-generated SQL: chat správa "SQL contains non-SELECT statements and cannot be written."

---

### `MATERIALIZATION_ERROR`

**Kontext:** `materialize_models` → DuckDB execution failure.

**Recovery:**
- Emitovať `model_run_update` s `status: 'error'` a error správou
- Automaticky spustiť `test_failure_handoff` pre `sql-writer` self-heal
- Self-heal loop: max 3 pokusy; každý pokus vyžaduje nový `write_model_file` approval
- Po `MAX_RETRIES_EXCEEDED`: emitovať `stream_error` + zobraziť model error panel

**Partial state pri multi-model build:**
- Modely v topologickom poradí pred failujúcim modelom sú úspešne materializované
- Modely po failujúcom modeli (downstream) nie sú spustené
- DuckDB stav: úspešné modely existujú ako tabuľky; failujúci model nie je vytvorený / zostáva stará verzia (ak existovala)

**User-visible state:** Progress bar zmení farbu na červenú pri failujúcom modeli. "Build failed at {modelName}: {error}. Self-heal initiated." + approval gate pre opravu.

---

### `LINEAGE_CYCLE`

**Kontext:** `parse_lineage`.

**Recovery:**
- Okamžitý fail bez retry
- `parse_lineage` vráti `{ cycles_detected: true, topological_order: [] }`
- Materializácia sa nespustí
- Supervisor emituje `stream_error`: "Circular dependency detected in model references."

**User-visible state:** Lineage DAG (React Flow) zobrazí cyklické hrany zvýraznené červenou. UI zablokuje "Build" tlačidlo kým nie je cyklus opravený.

---

### `RESOURCE_NOT_FOUND`

**Kontext:** Volaný tool odkazuje na `workspace_id`, `data_source_id`, `model_name`, `record_id` alebo `test_id` ktoré neexistujú v SQLite.

**Recovery:**
- Okamžite failnúť — nie je čo robiť bez existujúceho resource
- Supervisor emituje `stream_error` s popisom chýbajúceho resource
- Typicky indikuje bug (nesprávne ID v kontexte) — logovať s plným tool input pre debugging

**Partial state:** Žiadna zmena — tool nevykonal žiadnu akciu.

**User-visible state:** "Internal error: resource not found. Please refresh and try again." — väčšinou nie je to chyba používateľa.

---

### `TEST_COMPILATION_ERROR`

**Kontext:** `write_test_file` s `test_type: 'custom'` — SQL odmietnutý parserom (non-SELECT príkaz alebo syntax error).

**Recovery:**
- Approval gate sa nespustí (fail prebehne pred approval)
- `test-generator` dostane error → môže opraviť SQL a zavolať `write_test_file` znovu (raz)
- Ak druhý pokus tiež zlyhá → reportovať supervisorovi

**User-visible state:** Chat správa "Custom test SQL failed validation: {error}. The test was not written." Test file nie je vytvorený.

---

### `MAX_RETRIES_EXCEEDED`

**Kontext:** `test_failure_handoff` po 3. neúspešnom self-heal pokuse.

**Recovery:**
- Ukončiť self-heal loop
- Emitovať `stream_error` s popisom všetkých 3 pokusov
- Zobraziť model error panel s SQL históriou pokusov

**User-visible state:** "Auto-fix failed after 3 attempts. Manual intervention required." + tlačidlo "Open in Editor" pre priame editovanie.

---

### `EXECUTION_TIMEOUT`

**Kontext:** `translate-validator` pri spúšťaní Python snippetu (`uv run --isolated`) alebo SQL snippet-u v DuckDB.

**Recovery:**
- Snippet test sa označí ako `status: 'timeout'` (nie `'failed'`) — timeout ≠ nesprávny kód
- `run_snippet_test` vráti `{ status: 'timeout' }`, UI zobrazí status badge `⏱` s popisom "Execution timed out (30s)"
- Snippet zostáva v cache s `test_status='timeout'`; user môže retry manuálne

**User-visible state:** Status badge "Timeout" vedľa jazyka. Chat správa nie je emitovaná (nie je to AI chyba).

---

### `SANDBOX_UNAVAILABLE`

**Kontext:** `translate-validator` pri pokuse o PySpark sandbox tier, Docker nie je dostupný.

**Recovery:**
- `run_snippet_test` vráti `{ status: 'syntax_ok' }` ak syntax check prešiel, inak `{ status: 'generated_only' }`
- UI degraduje gracefully: Run button zobrazí tooltip "Sandbox unavailable. Syntax checked only."
- Nie je to chyba — sandbox je voliteľná infraštruktúra

**User-visible state:** Status badge `ℹ️` s "Sandbox unavailable". Snippet je stále použiteľný.

---

### `INVALID_TIER`

**Kontext:** `generate_snippet` dostane `languageId` ktorého `executionTier` nie je v enum (`full-exec | sandbox | syntax-only | gen-only`).

**Recovery:**
- Okamžitý fail pred volabím `code-generator` agenta
- Supervisor emituje `stream_error`: "Unknown execution tier for language {languageId}."
- Indikuje chybu v Language Registry konfigurácia (nie user error)

---

## Partial state handling — matica

| Scenár | Čo je zachované | Čo NIE je zachované |
|--------|----------------|---------------------|
| Schema introspect fails na tabuľke X | Všetky predošlé snapshoty | Nový snapshot s tabuľkou X |
| Profiling fails na tabuľke X (paralelný run) | Profily ostatných N-1 tabuliek | Profil tabuľky X |
| Model write denied (approval) | Ostatné modely v tom istom batch | Zamietnutý model SQL súbor |
| Materialization fails na modeli X | Modely pred X v topologickom poradí | Modely X a downstream |
| Doc write denied | Predošlé doc záznamy | Zamietnutý záznam; coverage ostáva nižší |
| SSE disconnect počas workflow | Všetky SQLite záznamy z dokončených krokov | SSE eventy ktoré neboli doručené klientovi |

---

## Audit logging pre errors

Každá chyba v Govern-guarded paths je zaznamenaná do `audit_entries`:

```typescript
type AuditEntry = {
  workspace_id: string;
  session_id: string;
  agent_name: string;
  tool_name: string;
  action: string;
  outcome: 'success' | 'denied' | 'error';
  error_code?: string;
  timestamp: string;
};
```

Tier 1 infrastructure errors (napr. `AGENT_SDK_ERROR`) sú logované do Node.js console (nie do `audit_entries` — audit log je pre data access, nie pre service errors).

---

## Error boundary v UI

GlobalChatPanel má error boundary ktorý chytí React runtime errors (nie SSE errors):

```typescript
// shell/components/GlobalChatPanel.tsx
// Ak MessageList crashes → zobraziť fallback s "Reload chat" tlačidlom
// Workspace a moduly ostávajú funkčné
```

SSE `stream_error` eventy sú spracované v `useSSEStream` hook a dispatchované do Zustand store — nie cez React error boundary.
