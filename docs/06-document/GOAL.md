# Document Sub-module — GOAL

*Working doc, slovensky. Verzia 0.1. Súčasť AInderstanding, pozri [parent GOAL](../AINDERSTANDING.md).*

---

## 1. Účel sub-modulu

**Document robí governance dokumentáciu cez konverzáciu.**

Tradičné dokumentačné systémy (Confluence, dbt docs, data catalog tools) vyžadujú **manuálne písanie** — ktoré typicky neprebehne, takže docs sú stale alebo neexistujú. Document mení paradigmu: agent **vedie konverzáciu s user-om** a **počas nej zapisuje structured governance docs**.

Outputs:
- Per-table dokumentácia
- Per-column dokumentácia
- Business glossary
- Relationships (vrátane cross-source)
- Conventions

Štruktúrované podľa **logického governance modelu** (~22 polí, nie full DCAT/Dublin Core overkill).

---

## 2. Koncepty

- **Doc record** — jedna structured entity (table_description / column_description / business_term / relationship / convention)
- **Governance fields** — logické polia per record type (description, owner, classification, ...)
- **Coverage** — breadth metrika: % zdokumentovaných tabuliek/stĺpcov
- **Confidence** — depth/certainty per record (`high` / `medium` / `low`)
- **Source attribution** — kde vznikol doc record (`db_native` z DB comments / `ai_generated` z agent reasoning / `user_authored` cez manual edit / `user_confirmed` po user verify v chate)
- **Coverage threshold** — predbežne 70 %, agent navrhne *"datamart ready for production"* keď je dosiahnutý

---

## 3. Scope

### In scope (MVP)

- **22 governance fields** organizovaných v 5 record types:

**Per table (6 fields):**

| Field | Popis |
|---|---|
| `description` | Čo je v tabuľke |
| `business_definition` | Biznis perspektíva |
| `owner` | Person/team ktorý vlastní |
| `classification` | Public / Internal / Restricted / PII |
| `domain` | Sales / Finance / HR / Operations / ... |
| `tags` | Free-form labels |

**Per column (7 fields):**

| Field | Popis |
|---|---|
| `description` | Čo stĺpec znamená |
| `business_definition` | Biz perspektíva (ak iná od description) |
| `logical_type` | Identifier / Date / Currency / Text / Enum / Count / ... |
| `unit_of_measure` | EUR / % / count / kg |
| `pii_classification` | `none` / `pii` / `sensitive` |
| `valid_values` | Enumerácia ak applicable |
| `calculation` | SQL/formula ak derived |

**Per business term (5 fields):**

| Field | Popis |
|---|---|
| `term` | Term name |
| `definition` | Canonical definition |
| `synonyms` | Alternative names |
| `domain` | Subject area |
| `examples` | Positive examples |

**Per relationship (4 fields):**

| Field | Popis |
|---|---|
| `from / to` | Source table+column, target table+column |
| `type` | `fk` / `logical` / `cross_source_logical` |
| `description` | Vzťah popisom |
| `cardinality` | 1:1 / 1:N / N:M |

- `interviewer` subagent — formuluje questions kde chýbajú field values
- `docs-keeper` subagent — píše/updatuje structured records
- **Chat panel** s SSE streamingom (workspace-level scope)
- **Docs panel** — live view čo agent zapísal
- Coverage indikátor per source + per table + per record type
- Per-record confidence markers
- Source attribution badges (DB native / AI / User)
- Direct doc edit forms (edge case, main path je chat)
- Auto-population z multiple sources:
  - Native DB comments → table/column descriptions (confidence=high)
  - Profile data → typical_values, NULL behavior, valid_values
  - User chat → business definitions, owner, classification

### Out of scope

- Full DCAT / Dublin Core / DAMA-DMBOK conformance (logical subset stačí)
- Doc versioning / history (každý update overwrites; export do git je versioning path)
- Approval workflow pre doc changes
- Multi-language docs
- Schema-to-DB sync writeback (vyhodené per requirement)
- Rich markdown formatting v doc fields (plain text v MVP)

---

## 4. Agenti

### `interviewer`

| Field | Value |
|---|---|
| Owner | Document |
| Model | Sonnet |
| Tools | `read_docs`, `read_schema_snapshot`, `read_profiles` |

**Účel:** ide cez **structured checklist** odvodený z 22 governance fields a formuluje konkrétne otázky kde chýbajú values. Prioritizes podľa value:

1. Critical (PK / FK / sensitive fields) prv
2. Business-relevant (revenue, customer, transactional) ďalej
3. Edge case fields naposledy

Pýta sa cielene: *"Vidím že tabuľka `invoices` nemá ownerа. Kto je za ňu zodpovedný — Finance team, alebo IT?"* — nie všeobecne *"Povedz mi viac o tabuľke invoices."*

**Workflow:**
1. Read current docs state + coverage
2. Identify highest-value gaps (using priority logic)
3. Formulate 1-3 specific questions
4. User responds
5. Pass response context to `docs-keeper` for capture
6. Re-assess coverage, repeat

### `docs-keeper`

| Field | Value |
|---|---|
| Owner | Document |
| Model | Haiku |
| Tools | `write_doc_record`, `update_doc_record`, `read_docs` (s approval gate pre create/update) |

**Účel:** **listening agent** — analyzuje chat messages (user response, agent observations) a zapisuje/updatuje structured doc records. Deduplikuje (ak existing record, update; ak nový, create). Nastavuje confidence based on source:

- DB native comment → `confidence=high`, `source=db_native`
- User explicit confirm → `confidence=high`, `source=user_confirmed`
- AI inference z profile → `confidence=medium`, `source=ai_generated`
- AI inference z naming heuristics → `confidence=low`, `source=ai_generated`

**Auto-population sources:**
1. DB native comments → table/column descriptions
2. Profile stats → typical_values, valid_values
3. PII candidates (from Explore) → pii_classification
4. User chat → business definitions, owner, classification, domain, calculation

### Coverage formula

Coverage score sa počíta ako **weighted sum** štyroch komponentov:

- **Tabuľky: 40 %** — najvyššia hodnota, bez table description je datamart nepochopiteľný
- **Stĺpce: 35 %** — column-level docs sú jadrom governance
- **Business terms: 15 %** — dôležité pre cross-team porozumenie, nie každý datamart ich potrebuje
- **Relationships: 10 %** — bonus pre pokročilé datasety; jednoduché single-source datamarly ich nemajú

`"description"` field je rozhodujúci pre table aj column component — vyplnenie iných polí (owner, classification) nepočíta do coverage (tie sa sledujú zvlášť v readiness gaps).

**Threshold:** `coverage_score ≥ 70` → `assess_readiness` vráti `ready: true` a `interviewer` navrhne *"datamart ready for production"*.

### Patterny demonštrované v Document

- **Loop** — konverzačný cyklus: `interviewer` pýta → user odpovedá → `docs-keeper` zapisuje → `update_coverage` updatuje → `interviewer` pýta ďalej
- **Parallel** — pri multi-source onboarding, per-source `docs-keeper` instances bežia paralelne
- **Conditional** — `interviewer` priorizuje otázky podľa coverage stage (low coverage = critical fields prv, high coverage = polish fields)

---

## 5. Success criteria

1. **End-to-end understanding session** — fresh Chinook DB, prázdne docs. Po 15 min konverzácie (≤30 user správ):
   - 100 % tabuliek s `description`
   - ≥80 % stĺpcov s `description`
   - ≥3 `business_terms` records
   - Coverage indikátor ≥70 %
2. **Multi-source paralel session** — 2 paralelné sources, agent zvládne onboarding without context bleed, aspoň 1 cross-source relationship identifikovaný/discussed
3. **Confidence accuracy** — po user explicit confirm → `confidence=high`, AI-inferred bez confirm → `confidence=medium`
4. **Source attribution viditeľná** — UI badge na každom doc record (DB native / AI / User authored / User confirmed)
5. **Live docs update** — po každej user message sa DocsPanel updatuje pod 2 s
6. **Chat persistence** — chat history prežije reštart app-y

---

## 6. Phase plán

### Phase D1: Storage + DocsPanel + DB native auto-population — ~2 dni

- Drizzle schemy (table_descriptions, column_descriptions, business_terms, relationships, conventions)
- DocsPanel UI komponent (kategórie + records list)
- DocRecordView UI (drill-down + editable fields)
- DB native comment auto-population (pri Connect-e source pre-fillne table/column descriptions s `source=db_native, confidence=high`)
- CoverageBadge UI
- ConfidenceMarker + SourceAttributionBadge UI

**Output:** user pridá source, automaticky vidí pre-populated docs s DB-native comments + structured edit forms pre manual additions. **Bez chat-u zatiaľ.**

### Phase D2: Chat panel + interviewer + docs-keeper — ~2 dni

- Drizzle schema `chat_messages`
- ChatPanel UI komponent
- Document chat používa canonical SSE endpoint `/api/stream/[workspaceId]` (per `API_CONTRACT.md`) so session-scoped messages
- `interviewer` subagent (s structured checklist driven by governance fields)
- `docs-keeper` subagent (listening + structured write)
- MCP tools: `write_doc_record`, `update_doc_record`, `read_docs`
- Per-source parallel agent invocations pre multi-source

**Output:** user píše v chat, agent vedie konverzáciu, docs sa plnia live.

### Phase D3: Coverage + readiness + polish — ~1 deň

- `update_coverage` + `assess_readiness` tool calls
- Coverage threshold check (~70%) + chat hláška *"ready for production"*
- Coverage breakdown per record type (tables / columns / terms / relationships)
- DocEditForm pre direct edits
- Confidence markers polish

**Total Document: ~5 dní.**

**Dependencies:** Phase C1 (Connect — source data), Phase E1+E2 (Explore — schema + profile context), Phase G1 (Govern — permission framework + PII classifications informujú).

**Blocks:** Phase M3 (Model — `model-architect` číta docs cez `useDocs()`), Phase T2 (Test — `test-generator` číta `valid_values` z docs).

---

## 7. Open questions

- **Coverage formula** — ~~rozhodnuté:~~ weighted heuristic, definovaná v sekcii "Coverage formula" vyššie. Nie LLM-judged (príliš drahé a non-deterministické pre číslo zobrazované live).
- **Interviewer otázky verbosity** — verbose alebo brief? *Predbežne brief* — *"Owner tabuľky `invoices`?"* nie *"Mohol by som sa Vás láskavo opýtať..."*. User v Settings môže prepnúť na verbose.
- **AI pre-fill rate limiting** — pri velkej DB môže `docs-keeper` zapisovať desiatky records za sekundu. *Mitigation:* throttle update_doc_record calls, batch writes po 1-2s window.
- **Cross-source business term scope** — `business_terms` sú workspace-level, ale relationships sú tiež workspace-level. *Predbežne ok*, monitor pre confusion.
- **Doc field auto-suggestion z naming heuristics** — `customer_email` column → suggest `logical_type=Identifier, pii_classification='pii', description="Customer email address"`. Where draws the line? *Predbežne:* low-confidence suggestion always allowed, user vie reject/accept.

---

## 8. Riziká

- **Hallucinated docs** — agent môže napísať wrong popis, user nezachytí (najmä pri velkej DB). *Mitigation:* confidence markers viditeľné, "review queue" pre `confidence=low` records, agent musí flag-núť ak je niečo guess (*"Predpokladám, že..."*).
- **Frustračná konverzácia** — ak `interviewer` kladie nudné otázky alebo opakuje, user vzdá. *Mitigation:* prioritization by value, skip option per otázka, max 5 questions in a row bez user-initiated topic change.
- **LLM cost v conversational loop** — long sessions = drahé. *Mitigation:* Haiku pre `docs-keeper` (high frequency), Sonnet len pre `interviewer`. Session budget warning.
- **Multi-source context bleed** — keď agent jongluje 2 sources, môže pomiešať detaily. *Mitigation:* explicit source identifier v každej agent message, separate context tracking per source.
- **Stale docs po schema change** — keď sa DB schema zmení, docs zostávajú. *Mitigation:* Explore detect-uje schema diff, surfaces v UI s "review docs" prompt.

---

## 9. Settings (Document owned)

| Setting | Tier | Default | Notes |
|---|---|---|---|
| Auto-write docs | `[Core]` | Yes | `docs-keeper` zapisuje counterfactually |
| Doc verbosity | `[Core]` | Standard | Minimal / Standard / Detailed |
| Interviewer otázky verbosity | `[Polish]` | Brief | Brief / Verbose |
| Include sample data v docs | `[Core]` | No (default) | Yes / No / Mock only |
| Auto-flag low-confidence | `[Core]` | Yes | Visible review queue |
| Confidence threshold pre review | `[Polish]` | Medium | Records below need attention |
| Doc language | `[Polish]` | Auto (match user) | SK / EN / Auto |
| Skip option per question | `[Core]` | Yes | "Skip" button na každej otázke |

---

## 10. Glossary (Document-specific)

- **Doc record / Doc entry** — jeden záznam v jednej z 5 doc tables (table / column / business_term / relationship / convention)
- **Governance field** — jedno pole v doc record-e (description, owner, classification, ...)
- **Coverage** — breadth metrika, % records s vyplnenými core fields
- **Confidence** — depth/certainty per record (high/medium/low)
- **Source attribution** — kto/čo vytvoril doc record (db_native / ai_generated / user_authored / user_confirmed)
- **Readiness score** — output `assess_readiness`, kombinácia coverage + confidence weighted

---

## 11. References

- Parent: [AINDERSTANDING.md](../AINDERSTANDING.md)
- Pravidlá sub-modulu: [RULES.md](./RULES.md)
- Architektúra (DB schema, coverage formula kód, UI hooks): [ARCHITECTURE.md](../ARCHITECTURE.md) — sekcia 6, 12
- Foundation: [core/GOAL.md](../00-core/GOAL.md) — MCP server, approval gate, SSE
- Závisí od:
  - [connect/GOAL.md](../02-connect/GOAL.md) — workspace + source context
  - [explore/GOAL.md](../03-explore/GOAL.md) — schema + profile + PII candidates informujú docs
  - [govern/GOAL.md](../04-govern/GOAL.md) — permission framework
- Konzumujú Document:
  - [model/GOAL.md](../05-model/GOAL.md) — `model-architect` číta docs pri navrhovaní dimensional model
  - [test/GOAL.md](../07-test/GOAL.md) — `test-generator` číta `valid_values` pre accepted_values testy
  - [export/GOAL.md](../09-export/GOAL.md) — exportuje docs do dbt-compat structure
- Top-level: [AIBIO.md](../AIBIO.md)
