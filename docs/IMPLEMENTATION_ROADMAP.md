# AIBIo — Implementation Roadmap

Implementačný poriadok a stav všetkých modulov. Číslo = implementačné poradie, nie priorita feature.

## Status tabuľka

| # | Module     | Phase     | Status      | Est.  | TODO                                          |
|---|------------|-----------|-------------|-------|-----------------------------------------------|
| 0 | core       | P0a–P0b   | done        | ~8h   | [docs/00-core/TODO.md](./00-core/TODO.md)     |
| 1 | shell      | P0c–P0d   | done        | ~8h   | [docs/01-shell/TODO.md](./01-shell/TODO.md)   |
| 2 | connect    | C1        | done        | ~3d   | [docs/02-connect/TODO.md](./02-connect/TODO.md) |
| 3 | explore    | E1–E2     | done        | ~4d   | [docs/03-explore/TODO.md](./03-explore/TODO.md) |
| 4 | govern     | G1–G2     | G1 done / G2 not started | ~4d   | [docs/04-govern/TODO.md](./04-govern/TODO.md) |
| 5 | model      | M1–M3     | not started | ~7d   | [docs/05-model/TODO.md](./05-model/TODO.md)   |
| 6 | document   | D1–D3     | not started | ~5d   | [docs/06-document/TODO.md](./06-document/TODO.md) |
| 7 | test       | T1–T2     | not started | ~4d   | [docs/07-test/TODO.md](./07-test/TODO.md)     |
| 8 | translate  | TR1–TR3   | not started | ~7d   | [docs/08-translate/TODO.md](./08-translate/TODO.md) |
| 9 | export     | X1 (MVP)  | not started | ~2d   | [docs/09-export/TODO.md](./09-export/TODO.md) |

**MVP celkovo:** ~36 pracovných dní (vrátane X1 exportu, cross-module integration ~2d, Demo/README ~3d; bez TR1–TR3 a X2–X8)
**Post-MVP (Translate + Export multi-format):** ~22d navyše

---

## Build-order graf

```
00-core (P0a+b)
    ├─► 01-shell (P0c+d)
    └─► 02-connect (C1)
              └─► 04-govern G1 (enforcement)
                        ├─► 03-explore E1 (schema)
                        │         └─► 03-explore E2 (profiling) ──► 04-govern G2 (UI)
                        └─► (všetky ostatné moduly cez guarded wrappers)
                                  ├─► 05-model (M1→M2→M3)
                                  │         ├─► 07-test (T1→T2)
                                  │         └─► 08-translate (TR1→TR2→TR3)
                                  ├─► 06-document (D1→D2→D3)
                                  └─► 09-export (X1 MVP → X2-X8 post-MVP)
```

**Poznámka k Govern G1/G2:** Govern G1 (enforcement layer — guarded wrappers, permission service, audit logger) musí byť hotový **pred** Explore E2. Govern G2 (UI — Permission dashboards, PII Inventory, Audit Log) závisí od Explore E2 (PII candidates). Toto je single cross-dependency loop.

---

## Kľúčové architektonické závislosti (pre plánovanie)

| Ak robíš...       | Potrebuješ hotové...                                    |
|-------------------|---------------------------------------------------------|
| 01-shell dispatch | 00-core MCP server + approval gate + SSE (`core/orchestration/`) |
| 02-connect        | 00-core `core/db/client.ts` + `core/db/encryption.ts`  |
| 03-explore E2     | 04-govern G1 `internal-adapter` + `permission-service` |
| 04-govern UI      | 03-explore E1 `pii_candidates` v DB                    |
| 05-model sql-writer | 04-govern G1 guarded wrappers                         |
| 06-document auto-populate | 02-connect `readNativeComments` adapter        |
| 07-test run       | 05-model `datamart.duckdb` (materializácia)            |
| 08-translate generate | 05-model SQL definície                             |
| 09-export X1      | 02-connect metadata, 05-model SQL, 07-test .yml, 06-document docs |
| 09-export X2+     | 08-translate snippet cache + `code-generator`          |

---

## Migrácie (dokončené)

| Zmena | Stav |
|-------|------|
| `core/agent-sdk/` → `core/orchestration/` (premenované) | done |
| `@anthropic-ai/sdk` → `@anthropic-ai/claude-agent-sdk` (migrované) | done |

---

## Pravidlá pre update tohto súboru

- Po dokončení fázy zmeniť `Status` na `done` v tabuľke
- Po začatí fázy zmeniť na `in progress`
- Po odhade revíziu (`Est.`) aktualizovať s aktuálnymi číslami
- Nikdy mazať riadky — archív zostáva

---

## Cross-cutting docs (root `docs/`)

Tieto súbory sú referenčné pre celý projekt a nie sú vlastníctvom žiadneho modulu:

| Súbor | Účel |
|-------|------|
| [AIBIO.md](./AIBIO.md) | Top-level project overview, roadmap, technologické rozhodnutia |
| [AINDERSTANDING.md](./AINDERSTANDING.md) | AInderstanding product spec, sub-modul index |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Detailná technická architektúra (state machines, agent patterns, data flow) |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Kompletná Drizzle schéma všetkých tabuliek s komentármi |
| [MCP_TOOLS.md](./MCP_TOOLS.md) | Zoznam všetkých 29 MCP tools (26 MVP + 3 Translate post-MVP; tool name, allowedCallers, gate type, popis); obsahuje Tool Ownership Matrix |
| [API_CONTRACT.md](./API_CONTRACT.md) | REST endpointy, SSE event shapes, request/response types |
| [AGENT_PROMPTS.md](./AGENT_PROMPTS.md) | System prompty, sampling params a tool grants — 1 supervisor (Tier 1) + 4 Phase Coordinators (Tier 2) + 8 atomic LLM agents (Tier 3, MVP); Phase 2: +2 `code-generator-*`. `translate-validator` je deterministický service, nie LLM agent. |
| [TESTING.md](./TESTING.md) | Vitest + Playwright konfigurácia, test patterns, no-DB-mock rule |
| [DEPLOY.md](./DEPLOY.md) | Docker, GKE (raw K8s YAML), Traefik konfigurácia — Helm chart a Terraform sú post-MVP |
| [DEV_SETUP.md](./DEV_SETUP.md) | Local development setup (npm, uv, env vars, Chinook demo) |
| [ERROR_HANDLING.md](./ERROR_HANDLING.md) | Typované error kódy, retry stratégie, graceful degradation |
| [UI_UX.md](./UI_UX.md) | Shared UI patterns, design tokens, animácie, empty states |
