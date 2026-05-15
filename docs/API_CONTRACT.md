# AInderstanding — API Contract

> **Scope:** Definícia všetkých Next.js App Router API routes, SSE event union type a štandardného error formátu. Toto je kontrakt medzi frontend (React/Zustand) a backend (Route Handlers / agent orchestration).
>
> **Runtime constraint:** Všetky Route Handlers musia bežať v Node.js runtime (nie Edge). `AsyncLocalStorage` pre `AgentContext` a `better-sqlite3` / `duckdb-async` nie sú kompatibilné s Edge Runtime.

---

## REST Endpoints

### Prehľad

| Method | Path | Účel |
|--------|------|------|
| `GET` | `/api/health` | Kubernetes liveness/readiness probe |
| `POST` | `/api/workspaces` | Vytvorenie workspace |
| `GET` | `/api/workspaces` | Zoznam workspaces |
| `GET` | `/api/workspaces/[workspaceId]` | Detail workspace |
| `GET` | `/api/workspaces/[workspaceId]/settings` | Načítanie workspace_settings |
| `PATCH` | `/api/workspaces/[workspaceId]/settings` | Aktualizácia workspace_settings |
| `POST` | `/api/data-sources/[workspaceId]` | Pridanie data source |
| `GET` | `/api/data-sources/[workspaceId]` | Zoznam data sources pre workspace |
| `DELETE` | `/api/data-sources/[workspaceId]/[sourceId]` | Odstránenie data source |
| `POST` | `/api/data-sources/test` | Test connection (pred uložením) |
| `POST` | `/api/chat/[workspaceId]` | Odoslanie user správy → dispatch supervisorovi |
| `GET` | `/api/chat/[workspaceId]/messages` | Načítanie chat histórie (po SSE reconnecte) |
| `GET` | `/api/stream/[workspaceId]` | Otvorenie SSE streamu pre workspace |
| `POST` | `/api/approvals/[requestId]` | Rozhodnutie approval gate |
| `POST` | `/api/govern/column-permissions` | Klasifikácia PII stĺpca |
| `POST` | `/api/models/[workspaceId]/build` | Spustenie materializácie (single/all) |
| `GET` | `/api/models/[workspaceId]/lineage` | Lineage DAG pre workspace |
| `POST` | `/api/tests/[workspaceId]/run` | Spustenie test runnera |
| `GET` | `/api/documents/[workspaceId]` | Zoznam doc záznamov (tabulky, stĺpce, pojmy) |
| `GET` | `/api/documents/[workspaceId]/[recordId]` | Detail jedného doc záznamu |
| `PATCH` | `/api/documents/[workspaceId]/[recordId]` | Manuálna úprava doc záznamu používateľom |
| `POST` | `/api/export/[workspaceId]/build` | Export do dbt `.zip` |
| `GET` | `/api/export/[workspaceId]/history` | História exportov |
| `GET` | `/api/export/[workspaceId]/download/[exportId]` | Stiahnutie exportu |
| `POST` | `/api/translate/[workspaceId]/generate` | Generácia snippetu pre model v cieľovom jazyku *(Phase 2)* |
| `GET` | `/api/translate/[workspaceId]/snippets` | Zoznam snippetov pre workspace / model *(Phase 2)* |
| `POST` | `/api/translate/[workspaceId]/test` | Spustenie ekvivalenčného testu pre snippet *(Phase 2)* |

---

### `GET /api/health`

Kubernetes liveness a readiness probe. Verejný endpoint bez autentifikácie.

**Response `200 OK`**

```typescript
{ status: 'ok'; timestamp: string }  // timestamp = ISO-8601
```

**Response `503 Service Unavailable`** (pri SQLite unreachable)

```typescript
{ status: 'degraded'; reason: string }
```

Použité v: `DEPLOY.md` (GKE liveness probe `httpGet.path: /api/health`).

---

### `POST /api/chat/[workspaceId]`

Prijme user správu, uloží ju do `chat_messages`, spustí supervisor dispatch a ihneď vráti `sessionId`. Reálny výstup agentov prichádza cez SSE stream.

**Request**

```typescript
type ChatRequest = {
  message: string;              // max 4000 znakov
  sessionId: string;            // UUID; klient generuje pri prvej správe v session
  activeModule: string;         // napr. 'explore', 'model', 'document'
  aiMode: 'auto' | 'documentation' | 'queries' | 'manual';
  dataSourceId?: string;        // ak relevantné pre aktívny modul
};
```

**Response `200 OK`**

```typescript
type ChatResponse = {
  sessionId: string;
  status: 'dispatched' | 'queued';  // 'queued' ak predošlá session ešte beží
  messageId: string;                 // UUID uloženej chat správy
};
```

**Response `400 Bad Request`**

```typescript
type ChatErrorResponse = {
  error: 'MANUAL_MODE_ACTIVE' | 'MESSAGE_TOO_LONG' | 'WORKSPACE_NOT_FOUND';
  message: string;
};
```

**Response `409 Conflict`**

```typescript
type ChatConflictResponse = {
  error: 'SESSION_CONFLICT';
  message: string;
  activeSessionId: string;          // ID bežiacej session
};
```

**Headers (request)**

```
Content-Type: application/json
```

**Validácia**
- `workspaceId` musí existovať v `workspaces` tabuľke → `404 WORKSPACE_NOT_FOUND`
- `message.length > 4000` → `400 MESSAGE_TOO_LONG`
- `aiMode === 'manual'` → `400 MANUAL_MODE_ACTIVE` bez dispatch
- Ak existuje aktívna session pre workspace → `409 SESSION_CONFLICT` (jedna session naraz)

---

### `GET /api/chat/[workspaceId]/messages`

Načíta chat históriu pre workspace. Volaný pri otvorení workspace alebo po SSE reconnecte. Vracia správy zo `chat_messages` tabuľky.

**Query params**

```
?sessionId={uuid}       // voliteľné — filtrovanie na konkrétnu session
?limit={number}         // default: 50, max: 200
?before={messageId}     // cursor-based pagination
```

**Response `200 OK`**

```typescript
type MessagesResponse = {
  messages: Array<{
    messageId: string;
    sessionId: string;
    role: 'user' | 'assistant';
    content: string;
    agentName?: string;             // pre assistant správy
    createdAt: string;              // ISO 8601
  }>;
  hasMore: boolean;
  nextCursor: string | null;
};
```

---

### `GET /api/stream/[workspaceId]`

Otvára SSE stream pre daný workspace. Klient drží jedno permanentné spojenie po celú dobu práce s workspace.

**Response**

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

SSE správy majú formát:

```
data: {"type":"agent_thinking","sessionId":"...","payload":{...}}\n\n
```

Heartbeat každých 15 sekúnd:

```
data: {"type":"ping"}\n\n
```

**Chybové stavy**
- `workspaceId` neexistuje → `404` s telom `{ "error": "WORKSPACE_NOT_FOUND" }`
- Stream sa automaticky znovu-vytvorí pri reconnect (EventSource robí retry automaticky)

---

### `POST /api/approvals/[requestId]`

Prijme user rozhodnutie pre approval gate. Resolves Promise v `awaitApproval()`.

**Request**

```typescript
type ApprovalRequest = {
  decision: 'approved' | 'denied';
};
```

**Response `200 OK`**

```typescript
type ApprovalResponse = {
  resolved: boolean;
  requestId: string;
};
```

**Response `404 Not Found`**

```typescript
type ApprovalErrorResponse = {
  error: 'APPROVAL_REQUEST_NOT_FOUND' | 'APPROVAL_ALREADY_RESOLVED';
  message: string;
};
```

**Notes**
- `requestId` je UUID generovaný v `awaitApproval()` a odoslaný cez SSE `approval_required` event
- Po rozhodnutí: server emituje SSE `approval_resolved` event
- Timeout: 300 s bez rozhodnutia → automatický `denied` a cleanup

---

### `POST /api/govern/column-permissions`

Uloží PII klasifikáciu stĺpca (z PII Candidates panelu v Explore). Toto je jediný govern write endpoint — ostatné zmeny permissions sú cez UI forms s priamym DB prístupom cez server actions.

**Request**

```typescript
type ColumnPermissionRequest = {
  dataSourceId: string;
  tableName: string;
  columnName: string;
  piiClassification: 'none' | 'pii' | 'sensitive';
  piiSubtype?: PiiSubtype;            // povinné ak piiClassification='pii' alebo 'sensitive'
  setBy: 'user';                      // vždy 'user' pre tento endpoint
};
```

**Response `200 OK`**

```typescript
type ColumnPermissionResponse = {
  permissionId: string;               // UUID záznamu v column_permissions
  created: boolean;                   // false = update existujúceho záznamu
};
```

**Response `400 Bad Request`**

```typescript
type ColumnPermissionErrorResponse = {
  error: 'INVALID_PII_SUBTYPE' | 'DATA_SOURCE_NOT_FOUND' | 'COLUMN_NOT_FOUND';
  message: string;
};
```

---

### `POST /api/workspaces`

Vytvorenie nového workspace.

**Request body**

```typescript
type CreateWorkspaceRequest = {
  name: string;                          // max 100 znakov
};
```

**Response `201 Created`**

```typescript
type CreateWorkspaceResponse = {
  workspaceId: string;                   // UUID
  name: string;
  createdAt: string;                     // ISO 8601
};
```

**Errors:** `400 INTERNAL_ERROR` (validácia), `500 INTERNAL_ERROR`

---

### `GET /api/workspaces`

Zoznam všetkých workspaces (zoradené `createdAt DESC`).

**Response `200 OK`** — `WorkspaceSummary[]` (id, name, createdAt, sourceCount)

---

### `GET /api/workspaces/[workspaceId]/settings`

Načítanie `workspace_settings` pre workspace.

**Response `200 OK`** — `WorkspaceSettings` object (všetky stĺpce z `workspace_settings`)

**Errors:** `404 WORKSPACE_NOT_FOUND`

---

### `PATCH /api/workspaces/[workspaceId]/settings`

Partial update `workspace_settings`. Prijíma len zmenené stĺpce.

**Request body** — `Partial<WorkspaceSettings>`

**Response `200 OK`** — aktualizovaný `WorkspaceSettings` objekt

**Errors:** `400 INTERNAL_ERROR` (neznámy stĺpec), `404 WORKSPACE_NOT_FOUND`

---

### `POST /api/data-sources/[workspaceId]`

Pridanie data source do workspace. Uloží credentials (encrypted). Nespúšťa Explore automaticky.

**Request body**

```typescript
type CreateDataSourceRequest = {
  name: string;
  type: 'postgres' | 'mssql' | 'mysql' | 'duckdb';
  connectionConfig: ConnectionConfig;    // z core/types/workspace.ts
};
```

**Response `201 Created`**

```typescript
type CreateDataSourceResponse = {
  dataSourceId: string;
  name: string;
  type: string;
};
```

**Errors:** `400 INTERNAL_ERROR` (validácia), `404 WORKSPACE_NOT_FOUND`, `500 INTERNAL_ERROR`

---

### `GET /api/data-sources/[workspaceId]`

Zoznam data sources pre workspace. Credentials nie sú returnované (len metadata).

**Response `200 OK`** — `DataSourceSummary[]` (id, name, type, createdAt, lastExploreAt)

**Errors:** `404 WORKSPACE_NOT_FOUND`

---

### `DELETE /api/data-sources/[workspaceId]/[sourceId]`

Odstránenie data source a všetkých závislých dát (snapshots, profiles, permissions). Nevratná operácia.

**Response `204 No Content`**

**Errors:** `404 DATA_SOURCE_NOT_FOUND`, `500 INTERNAL_ERROR`

---

### `POST /api/data-sources/test`

Otestovanie connection config pred uložením. Neperzistuje nič.

**Request body**

```typescript
type TestConnectionRequest = {
  type: 'postgres' | 'mssql' | 'mysql' | 'duckdb';
  connectionConfig: ConnectionConfig;
};
```

**Response `200 OK`**

```typescript
type TestConnectionResponse = {
  success: boolean;
  latencyMs: number;
  error?: string;                        // prítomné ak success=false
};
```

---

### `POST /api/models/[workspaceId]/build`

Spustenie materializácie. Výsledky sú streamované cez SSE (`materialization_started`, `materialization_progress`, `materialization_complete` / `stream_error`).

**Request body**

```typescript
type BuildModelsRequest = {
  modelNames?: string[];                 // undefined = build all (dependency order)
};
```

**Response `202 Accepted`** — `{ sessionId: string }` (výsledky prídu cez SSE stream)

**Errors:** `404 WORKSPACE_NOT_FOUND`, `409 SESSION_CONFLICT`

---

### `GET /api/models/[workspaceId]/lineage`

Lineage DAG pre workspace — zoznam hrán z `lineage_edges` pre vizualizáciu v React Flow.

**Response `200 OK`**

```typescript
type LineageResponse = {
  nodes: { id: string; modelName: string; layer: 'stg' | 'int' | 'dim' | 'fct' }[];
  edges: { fromModelId: string; toModelId: string; refType: 'ref' | 'source' }[];
};
```

**Errors:** `404 WORKSPACE_NOT_FOUND`

---

### `POST /api/tests/[workspaceId]/run`

Spustenie test runnera. Výsledky sú streamované cez SSE.

**Request body**

```typescript
type RunTestsRequest = {
  modelNames?: string[];                 // undefined = run all tests
};
```

**Response `202 Accepted`** — `{ sessionId: string }`

**Errors:** `404 WORKSPACE_NOT_FOUND`, `409 SESSION_CONFLICT`

---

### `GET /api/documents/[workspaceId]`

Zoznam doc záznamov pre workspace. Cursor-based pagination, voliteľné filtre podľa druhu záznamu a fulltextového hľadania.

**Query params**

```
?kind=table|column|term    // voliteľné — filter podľa DocRecordType
?q={string}                // voliteľné — fulltext search v name + description
?limit={number}            // default: 50, max: 200
?after={recordId}          // cursor pre ďalšiu stránku
```

**Response `200 OK`**

```typescript
type DocumentsListResponse = {
  records: Array<{
    recordId: string;
    kind: 'table' | 'column' | 'term';
    name: string;                        // napr. 'invoices' alebo 'invoices.total'
    description: string | null;
    isUserEdited: boolean;
    updatedAt: string;                   // ISO 8601
  }>;
  hasMore: boolean;
  nextCursor: string | null;
};
```

**Errors:** `404 WORKSPACE_NOT_FOUND`

---

### `GET /api/documents/[workspaceId]/[recordId]`

Vracia kompletný doc záznam vrátane všetkých polí pre daný typ záznamu.

**Response `200 OK`**

```typescript
type DocumentDetailResponse = {
  recordId: string;
  kind: 'table' | 'column' | 'term';
  name: string;
  description: string | null;
  usageNotes: string | null;             // len pre table
  updateFrequency: string | null;        // len pre table
  businessName: string | null;           // len pre column
  exampleValues: string | null;          // len pre column (JSON string)
  formatNotes: string | null;            // len pre column
  isNullableExpected: boolean | null;    // len pre column
  isUserEdited: boolean;
  createdAt: string;                     // ISO 8601
  updatedAt: string;                     // ISO 8601
};
```

**Errors:** `404 DOCUMENT_NOT_FOUND`

---

### `PATCH /api/documents/[workspaceId]/[recordId]`

Manuálna úprava doc záznamu používateľom. Nastaví `is_user_edited = true` a zaloguje do `audit_entries`.

**Request body**

```typescript
type PatchDocumentRequest = {
  description?: string;
  usageNotes?: string;
  updateFrequency?: string;
  businessName?: string;
  exampleValues?: string;                // JSON string
  formatNotes?: string;
  isNullableExpected?: boolean;
};
```

Prijíma len polia relevantné pre daný `kind` záznamu — neznáme polia sú ignorované.

**Response `200 OK`**

```typescript
type PatchDocumentResponse = {
  recordId: string;
  isUserEdited: true;
  updatedAt: string;                     // ISO 8601
};
```

**Errors:** `400 INVALID_FIELD` (pole nepatrí danému `kind`), `404 DOCUMENT_NOT_FOUND`

---

### `POST /api/export/[workspaceId]/build`

Spustenie dbt `.zip` exportu (Phase X1).

**Request body**

```typescript
type ExportBuildRequest = {
  format: 'dbt';                         // X2-X8 formats sú Phase 2
  includeTests: boolean;
  includeDocs: boolean;
};
```

**Response `202 Accepted`** — `{ exportId: string }` (stiahnutie po dokončení cez `/download/[exportId]`)

**Errors:** `404 WORKSPACE_NOT_FOUND`

---

### `GET /api/export/[workspaceId]/history`

História exportov (zoradené `createdAt DESC`).

**Response `200 OK`** — `ExportSummary[]` (exportId, format, status, createdAt, fileSizeBytes)

**Errors:** `404 WORKSPACE_NOT_FOUND`

---

### `GET /api/export/[workspaceId]/download/[exportId]`

Stiahnutie vygenerovaného `.zip` exportu.

**Response `200 OK`** — `Content-Type: application/zip`, `Content-Disposition: attachment; filename=...`

**Errors:** `404 RESOURCE_NOT_FOUND` (exportId neexistuje alebo nepatrí workspaceId)

---

## SSE Event Union Type

Každý SSE event je JSON objekt s `type` discriminant. Frontend `useSSEStream` hook parsuje eventy a dispatchuje do príslušných Zustand store slices.

```typescript
// core/types/streaming.ts

type BaseSSEEvent = {
  sessionId: string;
  workspaceId: string;
  timestamp: string;                  // ISO 8601
};

// --- Agent lifecycle ---

type AgentThinkingEvent = BaseSSEEvent & {
  type: 'agent_thinking';
  payload: {
    agentName: string;                // napr. 'schema-explorer'
    message: string;                  // napr. 'Introspecting schema...'
  };
};

type AgentMessageEvent = BaseSSEEvent & {
  type: 'agent_message';
  payload: {
    agentName: string;
    content: string;                  // DELTA text (nové znaky) — klient akumuluje do MessageList
    isPartial: boolean;               // true = stream ešte beží (cursor bliká); false = správa kompletná
    messageId: string;                // UUID — klient grupuje delty podľa tohto ID
    role: 'assistant';
  };
};

// --- Tool calls ---

type ToolCallEvent = BaseSSEEvent & {
  type: 'tool_call';
  payload: {
    agentName: string;
    toolName: string;                 // napr. 'guarded_introspect_schema'
    toolCallId: string;               // UUID pre párovanie s tool_result
  };
};

type ToolResultEvent = BaseSSEEvent & {
  type: 'tool_result';
  payload: {
    toolCallId: string;
    toolName: string;
    success: boolean;
    summary: string;                  // napr. '✓ 12 tables found' alebo '✗ Permission denied'
  };
};

// --- Approval gates ---

type ApprovalRequiredEvent = BaseSSEEvent & {
  type: 'approval_required';
  payload: {
    requestId: string;                // UUID pre POST /api/approvals/{id}
    gateType: ApprovalGateType;
    agentName: string;
    description: string;              // human-readable popis čo agent chce urobiť
    details: ApprovalGateDetails;     // type-specific details (viď nižšie)
    timeoutAt: string;                // ISO 8601 timestamp (now + 300s)
  };
};

// Detaily sú discriminated podľa gateType z parent payload — bez redundantného gateType poľa
type ApprovalGateDetails =
  | { sql: string; dataSourceName: string }                                         // execute_query
  | { rowCount: number; columns: string[]; queryPreview: string }                   // share_results_with_ai
  | { modelName: string; layer: string; sqlDiff: string }                           // write_model_file
  | { testType: 'generic' | 'custom'; modelName: string; testPreview: string }      // write_test_file
  | { recordType: DocRecordType; name: string; description: string };               // write_to_docs

type ApprovalResolvedEvent = BaseSSEEvent & {
  type: 'approval_resolved';
  payload: {
    requestId: string;
    decision: 'approved' | 'denied';
    gateType: ApprovalGateType;
  };
};

// --- Domain updates ---

type DocUpdateEvent = BaseSSEEvent & {
  type: 'doc_update';
  payload: {
    recordType: DocRecordType;
    recordId: string;
    name: string;                     // napr. 'invoices.description'
    action: 'created' | 'updated';
  };
};

type CoverageUpdateEvent = BaseSSEEvent & {
  type: 'coverage_update';
  payload: {
    coveragePct: number;
    byType: {
      tables: number;
      columns: number;
      businessTerms: number;
      relationships: number;
    };
  };
};

type ModelRunUpdateEvent = BaseSSEEvent & {
  type: 'model_run_update';
  payload: {
    runId: string;
    modelName: string;
    status: 'running' | 'success' | 'error';
    durationMs?: number;
    error?: string;
    rowsAffected?: number;
  };
};

type TestRunUpdateEvent = BaseSSEEvent & {
  type: 'test_run_update';
  payload: {
    runId: string;
    testId: string;
    testName: string;
    status: 'running' | 'pass' | 'fail' | 'error';
    failureCount?: number;            // počet failing riadkov pre 'fail'
    error?: string;
  };
};

type SchemaUpdateEvent = BaseSSEEvent & {
  type: 'schema_update';
  payload: {
    dataSourceId: string;
    dataSourceName: string;
    snapshotId: string;
    tablesAdded: number;
    tablesRemoved: number;
    columnsChanged: number;
  };
};

// --- Budget ---

type BudgetWarningEvent = BaseSSEEvent & {
  type: 'budget_warning';
  payload: {
    usedTokens: number;
    limitTokens: number;
    thresholdPct: number;               // napr. 80 (pre 80% próg)
  };
};

// --- Stream control ---

type StreamEndEvent = BaseSSEEvent & {
  type: 'stream_end';
  payload: {
    summary: string;                  // supervisor záverečné zhrnutie
    agentsUsed: string[];
    totalDurationMs: number;
  };
};

type StreamErrorEvent = BaseSSEEvent & {
  type: 'stream_error';
  payload: {
    errorCode: string;
    message: string;
    agentName?: string;               // agent ktorý zlyhal, ak relevantné
    recoverable: boolean;             // true = klient môže retry
  };
};

type PingEvent = {
  type: 'ping';                       // žiadne ďalšie polia
};

// --- Discriminated union ---

type SnippetGeneratedEvent = BaseSSEEvent & {
  type: 'snippet_generated';
  payload: {
    snippetId: string;
    modelId: string;
    languageId: string;
    confidence: 'high' | 'medium' | 'low';
    fromCache: boolean;
    limitationsCount: number;
  };
};

type SnippetTestResultEvent = BaseSSEEvent & {
  type: 'snippet_test_result';
  payload: {
    snippetId: string;
    languageId: string;
    status: 'passed' | 'failed' | 'syntax_ok' | 'syntax_error' | 'runtime_error' | 'timeout' | 'generated_only';
    rowCountMatch: boolean | null;
    schemaMatch: boolean | null;
    dataEquivalent: boolean | null;
    durationMs: number;
  };
};

type SSEEvent =
  | AgentThinkingEvent
  | AgentMessageEvent
  | ToolCallEvent
  | ToolResultEvent
  | ApprovalRequiredEvent
  | ApprovalResolvedEvent
  | DocUpdateEvent
  | CoverageUpdateEvent
  | ModelRunUpdateEvent
  | TestRunUpdateEvent
  | SchemaUpdateEvent
  | SnippetGeneratedEvent
  | SnippetTestResultEvent
  | BudgetWarningEvent
  | StreamEndEvent
  | StreamErrorEvent
  | PingEvent;
```

---

## Štandardný error response formát

Všetky REST endpointy vracajú chyby v tomto formáte:

```typescript
type APIError = {
  error: string;          // machine-readable kód (UPPER_SNAKE_CASE)
  message: string;        // human-readable popis
  details?: unknown;      // voliteľné — štruktúrované dáta pre debugging
};
```

**HTTP status kódy:**

| Status | Použitie |
|--------|----------|
| `200` | Úspech |
| `400` | Validačná chyba (zlý input) |
| `404` | Resource nenájdený |
| `409` | Conflict (napr. SESSION_CONFLICT) |
| `500` | Internal server error |
| `503` | Source DB nedostupná |

---

## Session a workspace headers

Všetky requesty od frontendu nesú:

```
X-Workspace-Id: {workspaceId}     // duplikát z URL param, pre middleware logging
X-Session-Id: {sessionId}         // aktívna session ID
```

Tieto headery sú logované do `audit_entries` pre každý API call voči govern endpoints.

---

## `awaitApproval` — server-side kontrakt

```typescript
// core/orchestration/approval-gate.ts

type ApprovalResult = {
  decision: 'approved' | 'denied';
  requestId: string;
};

// Vracia objekt s promise AJ requestId — requestId je potrebné pre resolveApproval()
function awaitApproval(
  gateType: ApprovalGateType,
  details: ApprovalGateDetails,
  options?: { timeoutMs?: number }  // default: 300_000 ms
): { promise: Promise<ApprovalResult>; requestId: string };

function resolveApproval(requestId: string, decision: 'approved' | 'denied'): void;
```

---

## `useSSEStream` hook — kontrakt

```typescript
// shell/hooks/useSSEStream.ts

type SSEStreamOptions = {
  workspaceId: string;
  sessionId?: string;               // ak zadané → hook ignoruje eventy z iných session
  onEvent: (event: SSEEvent) => void;
  onError?: (error: Event) => void;
};

function useSSEStream(options: SSEStreamOptions): {
  connected: boolean;
  reconnecting: boolean;
};
```

- `EventSource` sa automaticky reconnectuje pri výpadku
- Každý event je parsovaný `JSON.parse(event.data)` a typovaný cez `SSEEvent`
- `PingEvent` nemá `sessionId` — hook ho vždy spracuje (heartbeat, nie session-scoped)
- Neznáme `type` hodnoty sú ticho ignorované (forward compatibility)

---

## Next.js config požiadavky

```typescript
// next.config.ts
const nextConfig = {
  serverExternalPackages: [
    'better-sqlite3',   // native addon
    'duckdb-async',     // native addon
  ],
};
```

Všetky Route Handlers musia exportovať:

```typescript
export const runtime = 'nodejs';     // explicitné — zabraňuje Edge Runtime fallback
export const dynamic = 'force-dynamic'; // SSE stream nesmie byť cached
```
