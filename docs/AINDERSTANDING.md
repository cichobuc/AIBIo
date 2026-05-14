# AInderstanding — GOAL (product overview)

*Working doc, slovensky. Verzia 0.9. Súčasť AIBIo, pozri [top-level GOAL](./AIBIO.md).*

> **AInderstanding je AI-asistovaný datamart builder.** Decomposed do **8 sub-modulov**. Tento doc je product overview + index, detaily v sub-module GOAL docs.

---

## 1. Účel produktu

AInderstanding rieši najtvrdší pain v BI workflow: **buildovanie datamartu z raw zdrojov je týždne práce** (SQL skripty, dimensional modeling, cleaning, joins, testing, dokumentácia) a typicky vznikne s gaps v governance.

**Vízia:** AI partner ktorý spolu s BI devom postaví datamart end-to-end, **GDPR-first** (AI nevidí dáta bez explicit povolenia), **strictly read-only voči source DBs**, **no lock-in** (export do dbt-compatible structure).

---

## 2. Mental model

3 ovplyvnujúce paradigmy:

- **Power Query** — vizuálny pipeline (Applied Steps) nad canonical kódom
- **dbt** — SQL-first modeling s layers (staging → intermediate → marts), tests + docs first-class
- **Cursor / Copilot** — AI ako párový programátor s approval gates a bounded permissions

Output AInderstandingu **nie sú "rozumiete schéme docs"**, ale **kompletný datamart**: dimensional schéma + SQL skripty + governance docs + DQ tests + lineage, materializované v AIBIo DuckDB, exportovateľné kedykoľvek.

---

## 3. Sub-moduly

AInderstanding má 8 sub-modulov, každý so single jasným účelom:

| Sub-modul | Účel | Detail |
|---|---|---|
| **Connect** | Source connection management, read-only enforcement | [GOAL](./02-connect/GOAL.md) |
| **Explore** | Schema discovery, data profiling, sample handling | [GOAL](./03-explore/GOAL.md) |
| **Model** | Dimensional modeling, SQL authoring, materialization | [GOAL](./05-model/GOAL.md) |
| **Test** | DQ test framework, validation, failure surfacing | [GOAL](./07-test/GOAL.md) |
| **Document** | Governance docs (structured), conversational doc writing | [GOAL](./06-document/GOAL.md) |
| **Govern** | Permissions, audit log, GDPR controls, PII classification | [GOAL](./04-govern/GOAL.md) |
| **Translate** | Multi-language code generation + equivalence testing (24 jazykov) — **Phase 2 (post-MVP)** | [GOAL](./08-translate/GOAL.md) |
| **Export** | Packaging do deployment-ready .zip archívov, no-lock-in | [GOAL](./09-export/GOAL.md) |

**Connect** je foundation. **Explore** závisí od Connect. **Model** závisí od Explore. **Document**, **Test** a **Translate** sú siblings nad Model — môžu ísť paralelne. **Govern** je cross-cutting (každý sub-modul rešpektuje permissions). **Export** (X1/MVP) je downstream konzument modelov, testov a docs — žiadna závislosť na Translate. Export X2+ (post-MVP) reuse-uje snippety z Translate pre multi-format packaging.

Detailná dependency hierarchy a folder structure → [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 4. Cross-cutting koncepty

Tieto koncepty žijú naprieč viacerými sub-modulmi:

- **Workspace** — top-level container, jedna inštancia AInderstandingu pre jeden projekt. Obsahuje N data sources, generated datamart, docs, settings.
- **3-vrstvový data exposure model** *(centrálny GDPR pillar)*:
  - **Vrstva 1 — Schema metadata** *(default ALLOW)* — table/column names, types, FK, native comments
  - **Vrstva 2 — Sample dáta** *(default DENY, per-table opt-in)* — agent vidí samples iba pri tabuľkách flagovaných ako reference/lookup
  - **Vrstva 3 — Query results** *(default DENY, per-query approval)* — výsledky AI execution nejdú back do agent contextu automaticky; user musí explicitne share-núť
- **AI modes** — Auto / Documentation / Queries / Manual. User prepína v chat paneli, drives ktoré subagenti sú v hre.
- **Permission tiers** — Metadata only / + Reference samples / + Full samples / Real data with approval. Per source + per table override.
- **Approval gates** — kedy AI musí pýtať user-a pred akciou: `execute_query`, `share_results_with_ai`, `write_to_docs`, `write_model_file`, `write_test_file`.
- **Coverage + Confidence metrics** — Coverage = weighted breadth: tables (40%) + columns (35%) + business_terms (15%) + relationships (10%). Confidence = depth/certainty per record. Detail v `ARCHITECTURE.md §6 Document`.

---

## 5. Cross-cutting success criteria

Per-sub-module success criteria sú v ich GOAL docs. Tu **cross-cutting:**

1. **End-to-end happy path** — od pridania source-u po export hotového datamartu za 15 min interactive session (s scripted user actions).
2. **GDPR-first správne enforced** — test scenár: AI sa pýta na `customers.email` → agent dostane response *"PII column, access denied"* a vie sa adaptovať (pýtať si user-a, alebo skip).
3. **No lock-in funguje** — exportovaný `.zip` sa dá successfully spustiť cez `dbt run` mimo AIBIo na Chinook DB.
4. **Self-healing demonštrované** — test scenario s úmyselne zlým SQL → `sql-writer` opraví do 3 retries.
5. **Demo video presvedčivé** — 5-7 min screencast s plynulým flow naprieč sub-modulmi.
6. **Repo zaujme** — README hlavička pútavá, screenshot datamart lineage DAG, setup ≤5 min.
7. **Architektúra demonštrovateľná** — README + sekvenčné diagramy mapujú orchestration patterns čitateľne pre školského hodnotiteľa.

---

## 6. Settings — high-level kategórie

Detail per sub-modul, tu **prehľad kategórií** (~59 settings spolu):

| Kategória | Owner sub-modul | Approx count |
|---|---|---|
| Connection config | Connect | 6 |
| Data exposure to AI | Govern (cross-cutting enforced) | 8 |
| AI modes & behavior | Shell | 6 |
| Approval gates | Govern | 7 |
| Documentation behavior | Document | 8 |
| Model/SQL behavior | Model | 6 |
| Test framework config | Test | 5 |
| Multi-language code gen | Translate | 4 | *(Phase 2, post-MVP)* |
| Privacy, security, cost | Govern | 7 |
| UI / UX preferences | Shell | 8 |

Z toho **~25 `[Core]`** pre MVP, zvyšok `[Polish]` post-MVP.

---

## 7. Phases (cross-modul)

Implementácia per sub-modul + cross-cutting:

**MVP (Phase 1):**

1. **Phase 0: Foundation** (core/, shell/) — ~2 dni
2. **Connect** — ~3 dni
3. **Explore** — ~5 dní
4. **Govern** (foundation pre permissions, before Model) — ~3 dni
5. **Model** — ~7 dní
6. **Document** (paralelne s Model alebo po) — ~5 dní
7. **Test** — ~4 dni
8. **Export X1** (dbt/SQL only) — ~2 dni
9. **Cross-module integration** — ~2 dni
10. **Demo + README** — ~3 dni

**MVP spolu: ~36 dní → 2-3 mesiace pri ~10-15 h/týždeň.**

**Critical path:** Connect → Explore → Govern → Model → Export X1. Document a Test môžu ísť paralelne s Model po dokončení základov.

**Phase 2 (post-MVP):**

- **Translate** (paralelne s Test + Document, po Model) — ~7 dní
- **Export X2–X8** (multi-format packaging) — ~15 dní

---

## 8. Cross-cutting open questions

Otvorené body ktoré nepatria do konkrétneho sub-modulu:

- **Workspace switching mid-session** — keď user prepne workspace, ako sa zachová agent context? *Predbežne fresh context per workspace*, history per-workspace persistent.
- **Multi-user shared workspace** — out of MVP scope, ale netreba zatvoriť architecturally.
- **Sub-module versioning** — predbežne one AInderstanding version, per-submodule independent ak by sa scope rozdelil.
- **Cross-submodule chat scope** — chat je workspace-level (jeden), nie per-submodule. Orchestrator vie ktorý sub-module je active na základe user intent.

---

## 9. Cross-cutting riziká

- **Sub-module coupling drift** — bez disciplíny sa sub-moduly môžu cross-import. *Mitigation:* ESLint rule, code review checklist, public API per sub-modul cez `hooks/`.
- **Supervisor complexity** — orchestrátor musí rozumieť kontextu naprieč 8 sub-modulmi. *Mitigation:* clear state machine, mode-based dispatching, comprehensive logging.
- **Demo coordination** — pre 5-7 min screencast treba zladiť core 7 sub-modulov (Translate je bonus demo). *Mitigation:* scripted demo workflow, pre-recorded úseky kde live demo je riskantné.

Sub-module-specific riziká → sub-module GOAL docs.

---

## 10. References

- Top-level: [AIBIO.md](./AIBIO.md)
- Architektúra (tech stack, agent roster, folder structure, data flows): [ARCHITECTURE.md](./ARCHITECTURE.md)
- Foundation (Phase 0):
  - [core/GOAL.md](./00-core/GOAL.md) — shared types, DB, MCP server, approval gate, SSE
  - [shell/GOAL.md](./01-shell/GOAL.md) — supervisor orchestrator, WorkspaceLayout, AI modes
- Sub-modul GOALs:
  - [connect/GOAL.md](./02-connect/GOAL.md)
  - [explore/GOAL.md](./03-explore/GOAL.md)
  - [model/GOAL.md](./05-model/GOAL.md)
  - [test/GOAL.md](./07-test/GOAL.md)
  - [document/GOAL.md](./06-document/GOAL.md)
  - [govern/GOAL.md](./04-govern/GOAL.md)
  - [translate/GOAL.md](./08-translate/GOAL.md) — multi-language code gen + testing
  - [export/GOAL.md](./09-export/GOAL.md)
