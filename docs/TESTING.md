# AInderstanding — Testing Strategy

> **Scope:** Stratégia testovania samotného kódu AInderstanding (nie Test sub-modul, ktorý testuje dátovú kvalitu). Pokrýva unit, integration a E2E testy.
>
> **Stack:** Vitest (unit + integration) · Playwright (E2E)

---

## Princípy

1. **Real SQLite, nie mock** — testy bežia voči skutočnej SQLite DB (in-memory alebo temp súbor); mockovaná DB maskuje SQL chyby
2. **Mock Anthropic API** — AI volania sú vždy mockované v testoch; reálne volania sú drahé a nedeterministické
3. **Governi guarded tools testuj izolovane** — každý guarded tool má vlastný integration test s fake adapter
4. **E2E len pre golden paths** — Playwright pokrýva kritické user flows, nie každý edge case

---

## Konfigurácia

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/unit/**/*.test.ts', '**/__tests__/integration/**/*.test.ts'],
    exclude: ['**/__tests__/e2e/**'],
  },
});
```

---

## Štruktúra test súborov

```
{module}/
├── __tests__/
│   ├── unit/           # Izolované funkcie bez externých závislostí
│   └── integration/    # Testy s real DB alebo fake adapters
app/
└── __tests__/
    └── e2e/            # Playwright testy
```

Konvencia: `*.test.ts` pre Vitest, `*.spec.ts` pre Playwright.

---

## Unit testy (Vitest)

### Čo unit testovať

| Čo | Príklad | Prečo |
|----|---------|-------|
| SQL parser gate | `validate_sql('DROP TABLE x')` → `has_non_select_statements: true` | Bezpečnostný invariant |
| Intent classifier | `classifyIntent('show me the schema')` → `{ mode: 'single_agent', agent: 'schema-explorer' }` | Deterministická logika |
| PII regex patterns | `detectPiiByName('email_address')` → `{ pii_subtype: 'email' }` | Veľa edge cases |
| Coverage formula | `computeCoverage({ tables: 0.8, columns: 0.6, ... })` → `68` | Matematický výpočet |
| ref() / source() parser | `parseModelRefs("SELECT * FROM ref('orders')")` → `['orders']` | Lineage závisí na tomto |
| Approval gate timeout | `awaitApproval()` timeout po 300s → `denied` | Kritický bezpečnostný flow |
| Schema context compressor | `compressSchema(largeSchema)` → token limit dodržaný | Závislosť pre context injection |

### Čo NIE unit testovať

- Next.js Route Handlers (tie patria do integration)
- Drizzle queries (tie patria do integration s real DB)
- React komponenty (UI zmeny sú príliš časté; Playwright pokrýva golden paths)

### Príklad

```typescript
// core/agent-sdk/__tests__/unit/validate-sql.test.ts
import { describe, it, expect } from 'vitest';
import { validateSql } from '../../validate-sql';

describe('validateSql', () => {
  it('rejects DROP statement', () => {
    const result = validateSql('DROP TABLE orders');
    expect(result.has_non_select_statements).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('accepts SELECT with CTE', () => {
    const result = validateSql('WITH x AS (SELECT 1) SELECT * FROM x');
    expect(result.valid).toBe(true);
    expect(result.has_non_select_statements).toBe(false);
  });

  it('reports line number for syntax error', () => {
    const result = validateSql('SELECT * FORM orders');  // typo
    expect(result.errors[0].line).toBeDefined();
  });
});
```

---

## Integration testy (Vitest)

### Real SQLite — setup

```typescript
// core/db/__tests__/test-db.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

// better-sqlite3 je plne synchronný — žiadne async/await
export function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: './core/db/migrations' });
  return db;
}
```

Handlers prijímajú DB inštanciu cez dependency injection — nie cez globálny singleton (ten je len pre produkciu):

```typescript
// vitest.setup.ts
import { createTestDb } from './core/db/__tests__/test-db';
import { setTestDb } from './core/db/client';

beforeEach(() => {
  const db = createTestDb();
  setTestDb(db);          // inject do singletonu pre trvanie testu
});
```

### Čo integration testovať

| Čo | Prístup |
|----|---------|
| Drizzle schema + CRUD | Real in-memory SQLite |
| Govern guarded tools | Fake adapter (vráti statické dáta) + real SQLite pre audit |
| Approval gate Promise flow | Real awaitApproval() + manuálne resolveApproval() v teste |
| MCP tool registration + routing | Real McpServer singleton, fake tool handlers |
| parse_lineage + cycle detection | Real SQLite + skutočné model súbory v temp dir |
| Coverage formula end-to-end | Real SQLite s doc records |

### Mock Anthropic API

```typescript
// vitest.setup.ts
import { vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  Anthropic: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mocked response' }],
        stop_reason: 'end_turn',
      }),
    },
  })),
}));
```

Pre testy konkrétnych agentov používaj factory pre rôzne response scenarios:

```typescript
function mockAgentResponse(toolCalls: ToolUse[]) {
  // vráti sekvenciu: tool_use → tool_result → end_turn
}
```

### Fake source adapter

```typescript
// connect/__tests__/helpers/fake-adapter.ts
export const fakePostgresAdapter = {
  testConnection: vi.fn().mockResolvedValue({ success: true }),
  introspectSchema: vi.fn().mockResolvedValue(MOCK_SCHEMA),
  runSelect: vi.fn().mockResolvedValue({ rows: MOCK_ROWS, columns: ['id', 'name'] }),
};
```

### Príklad — approval gate test

```typescript
// core/agent-sdk/__tests__/integration/approval-gate.test.ts
import { awaitApproval, resolveApproval } from '../../approval-gate';

it('resolves when approved within timeout', async () => {
  // awaitApproval vracia { promise, requestId } — requestId treba pre resolveApproval
  const { promise, requestId } = awaitApproval('execute_query', { sql: 'SELECT 1' });

  // simuluj user click approve po 100ms
  setTimeout(() => resolveApproval(requestId, 'approved'), 100);

  const result = await promise;
  expect(result.decision).toBe('approved');
});

it('auto-denies after timeout', async () => {
  vi.useFakeTimers();
  const { promise } = awaitApproval('execute_query', { sql: 'SELECT 1' }, { timeoutMs: 1000 });
  vi.advanceTimersByTime(1001);
  const result = await promise;
  expect(result.decision).toBe('denied');
  vi.useRealTimers();
});
```

---

## E2E testy (Playwright)

### Čo E2E testovať

E2E testy sú drahé (pomalé, krehké). Pokrývaj iba **golden paths** a **blokujúce regression scenáre**.

| Flow | Prečo E2E |
|------|-----------|
| Vytvorenie workspace + pridanie DuckDB source | Základný onboarding — musí fungovať |
| Schema introspect → zobrazenie tabuliek | Viditeľný výstup prvého AI volania |
| PII candidate review + klasifikácia | GDPR kritický flow |
| Approval gate — approve + deny | Bezpečnostný flow, blokujúci pre všetky writes |
| SSE stream — zobrazenie agent správ | Koreň UX; ak toto nefunguje, nič nefunguje |
| Export → download .zip | No-lock-in záväzok |

### Playwright konfigurácia

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './app/__tests__/e2e',
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### AI mocking v E2E

E2E testy tiež mockujú Anthropic API — nie cez vi.mock, ale cez MSW (Mock Service Worker) alebo Next.js route handler mock:

```typescript
// app/__tests__/e2e/helpers/mock-anthropic.ts
// Intercept fetch voči api.anthropic.com a vráti deterministické SSE eventy
```

### Príklad — SSE stream test

```typescript
// app/__tests__/e2e/shell.spec.ts
test('agent_message events render in chat', async ({ page }) => {
  await page.goto('/workspace/test-workspace/explore');
  await page.fill('[data-testid="chat-input"]', 'Show me the schema');
  await page.keyboard.press('Enter');

  // čakaj na agent_thinking event
  await expect(page.locator('[data-testid="agent-thinking"]')).toBeVisible({ timeout: 5000 });

  // čakaj na agent_message
  await expect(page.locator('[data-testid="agent-message"]').first()).toBeVisible({ timeout: 15000 });
});
```

---

## CI pipeline (referencia)

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    steps:
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm run test          # Vitest
      - run: npm run build         # Next.js build (chytí runtime type errors)
      - run: npm run test:e2e      # Playwright (len na main branch)
```

Playwright E2E beží len na `main` a PR do `main` — nie na feature branches (príliš pomalé).

---

## Translate — testovacia stratégia

### Čo testovať (unit)

| Čo | Prístup |
|----|---------|
| `translate-validator` Python execution | Mock `child_process.spawn` — testuj timeout handling, stdout/stderr parsing |
| `translate-validator` SQL dialect | Real DuckDB in-memory (deterministic), testuj `row_count_match` a `schema_match` |
| `translate-validator` syntax-only tier | Real parsery (napr. `node-sql-parser` pre SQL dialekty) — testuj valid vs invalid snippets |
| Snippet cache stale invalidation | Real in-memory SQLite — model SQL change → `translate_snippets.is_stale=true` |
| `generate_snippet` INVALID_TIER guard | Unit test — vráti error pred agent callom |

### Mock `code-generator` agent

Rovnaká mock stratégia ako ostatné agenti (viď sekciu vyššie). Pre Translate-specific scenarios:

```typescript
// translate/__tests__/helpers/mock-code-generator.ts
function mockCodeGeneratorResponse(languageId: string, snippet: string) {
  vi.mocked(anthropic.messages.create).mockResolvedValueOnce({
    content: [{ type: 'text', text: JSON.stringify({
      languageId,
      snippet,
      confidence: 'high',
      limitations: [],
    }) }],
    stop_reason: 'end_turn',
  });
}
```

### Príklad — snippet equivalence test

```typescript
// translate/__tests__/integration/equivalence.test.ts
import { runSnippetTest } from '../../lib/translate-validator';

it('detects row count mismatch between DuckDB SQL and pandas', async () => {
  // Seed in-memory DuckDB s 10 rows
  const { rowCount, schemaMatch } = await runSnippetTest({
    referenceSQL: 'SELECT id, name FROM customers WHERE active = true',
    snippet: 'df = pd.read_sql("SELECT id, name FROM customers", conn)',  // missing WHERE
    languageId: 'python-pandas',
    workspaceId: 'test-ws',
  });

  expect(rowCount.match).toBe(false);  // snippet vrátil viac rows
  expect(schemaMatch).toBe(true);      // schema columns sú rovnaké
});

it('marks result as timeout, not failed', async () => {
  vi.spyOn(childProcess, 'spawn').mockImplementation(() => {
    // simuluj proces ktorý nikdy neskonší
    return createNeverEndingProcess();
  });

  const result = await runSnippetTest({ ..., timeoutMs: 100 });
  expect(result.status).toBe('timeout');
});
```

### Čo E2E testovať (Translate)

| Flow | Prečo E2E |
|------|-----------|
| Model detail → Code tab → vygeneruj Python snippet | Základný Translate UX flow |
| Status badge update po generovaní | SSE `snippet_generated` event → UI update |
| Run & Compare → výsledok sa zobrazí | `snippet_test_result` SSE event → result pane |

---

## Coverage ciele (Vitest)

| Oblasť | Target |
|--------|--------|
| `core/agent-sdk/` | 90% |
| `govern/` guarded tools | 85% |
| `core/types/` | 70% |
| `connect/` adapters | 70% |
| `translate/` validator | 80% |
| UI komponenty | 0% (pokryté E2E) |

Coverage report:

```bash
npm run test -- --coverage
```
