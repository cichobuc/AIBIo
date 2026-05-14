# Core — GOAL (Phase 0 foundation)

*Working doc, slovensky. Verzia 0.1. Súčasť AIBIo, pozri [top-level GOAL](./AIBIO.md).*

> **`core/` je technická foundation celého AIBIo.** Žiadne business logic tu nežije — iba zdieľané typy, DB klient, MCP server s tool registry, approval gate mechanizmus, a UI primitives. Každý modul závisí od `core/`. Nič v `core/` nezávisí od modulov.

---

## 1. Účel

`core/` rieši tri infraštruktúrne problémy ktoré by inak vznikli ako cross-module duplikácia:

1. **Shared TypeScript types** — každý sub-modul potrebuje `Workspace`, `DataSource`, `AgentContext`, `PermissionTier`. Bez `core/` by si každý definoval vlastné, nekompatibilné verzie.
2. **Drizzle + SQLite klient** — jeden singleton DB connection, centrálna migrácia, re-export všetkých module schemát.
3. **MCP server + tool registry** — in-process MCP server kde každý sub-modul registruje svoje tools. Supervisor (v `shell/`) a subagenti dostávajú len tools pre ktoré majú permission. Bez centrálneho registry by tool binding bol chaos pri rozširovaní.
4. **Approval gate mechanizmus** — cross-cutting flow (agent trigger → user UI → resolved promise). Žiaden sub-modul by ho nemal implementovať samostatne.

---

## 2. Koncepty

- **MCP tool** — TypeScript funkcia s JSON Schema definíciou inputov/outputov, registrovaná do in-process MCP servera. Subagenti ju volajú cez `client.callTool(name, args)`.
- **Tool registry** — centrálny zoznam všetkých MCP tools naprieč sub-modulmi. Každý tool má: meno, owner modul, input/output schema, či vyžaduje approval gate.
- **In-process MCP server** — nie sieťový server, ale SDK MCP transport v rámci jedného Node.js procesu. Nulová latencia, žiadne serialization overhead pre lokálny app.
- **AgentContext** — per-request metadata ktoré každý tool handler dostane: kto volal, v akom workspace, aký AI mode je aktívny. Drives permission checks a audit logging.
- **Approval gate** — Promise ktorý sa resolve-uje keď user klikne Approve/Deny v UI. Tool handler zavolá `awaitApproval(type, payload)` a čaká. UI dostane event cez SSE, zobrazí dialog, po kliknutí odošle odpoveď cez HTTP endpoint ktorý resolve-uje Promise.
- **DB singleton** — jediná `better-sqlite3` inštancia v procese, cez Drizzle ORM. Všetky sub-module schémy sú importované a migrované z jedného miesta.

---

## 3. Scope

### In scope (Phase 0)

- `core/types/` — zdieľané TypeScript typy (Workspace, DataSource, AgentContext, PermissionTier, AIMode, ...)
- `core/db/` — Drizzle klient, migrácie, re-export schemát zo všetkých sub-modulov
- `core/agent-sdk/mcp-server.ts` — in-process MCP server setup (`@modelcontextprotocol/sdk`)
- `core/agent-sdk/tool-registry.ts` — centrálny tool registry + helper pre registráciu nových tools
- `core/agent-sdk/approval-gate.ts` — approval gate mechanizmus (Promise + SSE event)
- `core/agent-sdk/streaming.ts` — SSE emitter utilities (per-workspace event channel)
- `core/ui/` — re-export shadcn/ui komponentov ktoré používajú viaceré moduly (`Button`, `Dialog`, `Badge`, `Tooltip`, `ScrollArea`, `Separator`, `Sheet`)

### Out of scope

- Business logic akéhokoľvek druhu
- Per-sub-module DB schémy (každý sub-modul vlastní svoju, `core/db/` len importuje)
- Supervisor orchestrátor (žije v `modules/ainderstanding/shell/`)
- Konkrétne tool implementácie (žijú v sub-module `lib/`)

---

## 4. Agenti

**Žiadni.** `core/` je čistá infraštruktúra. Supervisor žije v `shell/`.

---

## 5. Success criteria

1. **DB migrácia beží čisto** — `runMigrations()` pri cold start prebehne bez erroru, všetky sub-module schémy sú vytvorené
2. **MCP server dostupný** — supervisor (v shell/) vie zaregistrovať tool, zavolať ho, dostať typovaný výsledok
3. **Approval gate round-trip** — tool zavolá `awaitApproval()`, SSE event príde na `/api/stream/[id]`, POST na `/api/approvals/[requestId]` resolve-uje Promise, tool pokračuje
4. **SSE stream stabilný** — 10-minútová session bez reconnect, `stream_end` event správne ukončí stream
5. **Singleton guard funguje** — pri Next.js hot reload nevznikne druhá DB inštancia (overené cez `globalThis.__aibio_db`)

---

## 6. Phase plán (Phase P0)

Phase P0 je spoločná s `shell/` (shell/GOAL.md), spolu ~2 dni.

### Phase P0a: Types + DB — ~4 hodiny

- `core/types/` — všetky shared types
- `core/db/client.ts` — Drizzle singleton
- `core/db/migrate.ts` — migration runner
- Drizzle schema re-exports (stub imports — schémy vzniknú v sub-moduloch)
- `npm run dev` bez chýb

### Phase P0b: MCP + Approval gate + SSE — ~4 hodiny

- `core/agent-sdk/mcp-server.ts` — McpServer singleton
- `core/agent-sdk/tool-registry.ts` — registerTool() helper
- `core/agent-sdk/approval-gate.ts` — awaitApproval() + resolveApproval()
- `core/agent-sdk/streaming.ts` — WorkspaceSSEEmitter
- `core/agent-sdk/context.ts` — AsyncLocalStorage injector
- `app/api/stream/[workspaceId]/route.ts` — SSE endpoint
- `app/api/approvals/[requestId]/route.ts` — approval resolution endpoint
- Integration test: registerTool → awaitApproval → SSE event → resolveApproval → tool continues

**Total Phase P0 (core/ časť): ~1 deň (spoločne so shell/ = 2 dni celkom)**

---

## 7. Open questions

- **`@anthropic-ai/sdk` vs hypotetický `claude-agent-sdk`** — používame `@anthropic-ai/sdk` (štandardný Anthropic SDK). Neexistuje separátny `claude-agent-sdk` package. Subagenti sú implementovaní ako `messages.create()` calls s `tool_use` — "Agent tool" je len `messages.create()` kde tools obsahujú invoke_subagent. MCP je z `@modelcontextprotocol/sdk`.
- **AsyncLocalStorage pre AgentContext** — je spoľahlivý v Next.js App Router? *Predbežne áno* pre Route Handlers (nie Edge Runtime). Alternatíva: explicitne predávať `ctx` každému tool handleru ako parameter — verbóznejšie ale bezpečnejšie. *Rozhodnúť pri P0b.*
- **MCP server singleton vs per-request** — jeden globálny McpServer alebo nový per agentic session? *Predbežne singleton* pre simplicity, tool registration je statická. Ak vzniknú state problémy pri concurrent sessions, prejsť na per-session.
- **`better-sqlite3` + Next.js bundling** — `better-sqlite3` je native addon, vyžaduje `serverExternalPackages: ['better-sqlite3']` v `next.config.ts`. *Explicitne nastaviť v P0a.*
- **DB súbor lokácia v dev vs prod** — `AIBIO_DB_PATH` env var. Dev default: `./aibio.db` v project root. Tauri (v2): `app.path.appData + '/aibio.db'`. *MVP: env var postačí.*

---

## 8. Riziká

- **`AsyncLocalStorage` spoľahlivosť v Next.js App Router** — **KRITICKÉ, musí byť overené ako prvé v P0b.** Next.js má historicky problémy s `AsyncLocalStorage` pri hot reload, streaming responses a concurrent Route Handler requests. Ak nefunguje spoľahlivo, celá AgentContext injekcia potrebuje redesign na explicitné `ctx` parametre vo všetkých tool handleroch. *Overenie P0b deň 1:* napíš integration test s 3 súčasnými requests, over že každý dostane správny `workspaceId`. Ak failne → prejdi na explicitné `ctx` parametre (verbóznejšie, ale deterministické).
- **Credentials encryption** — connection credentials musia byť šifrované v SQLite **v Phase P0a**, nie neskôr. Implementácia: AES-256-GCM via `node:crypto`, `AIBIO_ENCRYPTION_KEY` env var. App sa nespustí bez tejto premennej. Encrypt pri `INSERT`, decrypt pri `SELECT` v Connect adapter factory.
- **`better-sqlite3` native module kompilačné problémy** — ak node verzia alebo arch nezodpovedá, `npm install` failne. *Mitigation:* pevná node verzia v `.nvmrc`, `postinstall` script s `node-pre-gyp rebuild` fallback.
- **Approval gate memory leak** — ak user nikdy neodpovie (tab closed, server restart), Promise ostáva v `pendingGates` Map natrvalo. *Mitigation:* timeout (300 s default) + cleanup pri server shutdown. Pre restart: pending gates sa stratia — agent dostane denial pri ďalšom pokuse (acceptable pre MVP).
- **SSE reconnect pri dlhých sessions** — browser preruší SSE spojenie po idle. *Mitigation:* heartbeat event každých 15 s (`{ type: 'ping' }`), frontend auto-reconnect s `EventSource` retry.
- **Circular import risk** — `core/db/client.ts` importuje sub-module schémy. Sub-moduly importujú `core/types`. Ak sub-modul začne importovať z `core/db`, vznikne circular. *Mitigation:* ESLint rule `no-restricted-imports` — sub-moduly môžu importovať z `core/types` a `core/ui`, nie z `core/db` priamo (používajú Drizzle cez vlastné `db/` file).

---

## 9. Glossary

- **MCP tool** — pomenovaná funkcia registrovaná do MCP servera, volateľná subagentmi cez `callTool(name, args)`
- **Tool registry** — centrálna tabuľka všetkých MCP tools: meno, owner, schema, approval gate flag
- **In-process MCP server** — MCP server a klient v rovnakom Node.js procese, komunikácia cez `InMemoryTransport`
- **Approval gate** — Promise-based flow: tool zavolá `awaitApproval()` → SSE event do UI → user klikne → HTTP POST resolve-uje Promise
- **AgentContext** — per-request objekt s `workspaceId`, `agentName`, `sessionId`, `activeMode`; injektovaný cez `AsyncLocalStorage`
- **SSE event** — jeden typed event emitovaný cez `WorkspaceSSEEmitter`, konzumovaný frontendovým `EventSource` listenerom

---

## 10. References

- Top-level: [AIBIO.md](./AIBIO.md)
- Core invariants: [RULES.md](./RULES.md) — MCP registry, approval gate, SSE protocol, DB client pravidlá
- Architektúra (implementačné detaily core/): [ARCHITECTURE.md](./ARCHITECTURE.md) — sekcie 5, 9, 10, 11
- Shell (supervisor): [shell/GOAL.md](./01-shell/GOAL.md)
- Konzumujú core/:
  - [connect/GOAL.md](./02-connect/GOAL.md)
  - [explore/GOAL.md](./03-explore/GOAL.md)
  - [model/GOAL.md](./05-model/GOAL.md)
  - [test/GOAL.md](./07-test/GOAL.md)
  - [document/GOAL.md](./06-document/GOAL.md)
  - [govern/GOAL.md](./04-govern/GOAL.md)
  - [export/GOAL.md](./09-export/GOAL.md)
  - [translate/GOAL.md](./08-translate/GOAL.md)
