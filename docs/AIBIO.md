# AIBIo — GOAL document (top-level)

*Working doc, slovensky. Verzia 0.9.*

> **AIBIo je modulárna AI-natívna BI platforma. V aktívnom scope:** [AInderstanding](./AINDERSTANDING.md) — AI-asistovaný datamart builder s GDPR-first dizajnom a no-lock-in exportom.

---

## 1. Vízia v jednej vete

**AIBIo je modulárna AI-natívna BI platforma, ktorá začína AI-asistovaným datamart builderom a v budúcnosti rozšíri o dashboard authoring a end-user distribution.**

---

## 2. Problém ktorý AIBIo rieši

Najťažší problém v AI BI tooloch nie je generovanie SQL — to už dnes vie každý LLM. Najťažší problém je, že **AI nepozná tvoje dáta**. Nevie čo znamená stĺpec `BIR_AMT_NET`, nevie že `customer_id = 0` je test record, nevie že "turnover" sa počíta inak v rôznych typoch nájmu.

A druhý problém: aj keď BI dev dátam rozumie, **buildovanie datamartu z raw zdrojov je týždne práce**. SQL skripty, dimensional modeling, cleaning, joins, testing, dokumentácia — všetko manuálne, repetitive, error-prone, a typicky bez governance fragments.

**AIBIo to rieši cez modulárnu architektúru:**

- **AInderstanding** *(aktívny modul)* — AI partner ktorý spolu s tebou postaví datamart: pripojí sa na sources, profilne dáta, navrhne dimensional model, napíše SQL, vygeneruje DQ testy, napíše governance dokumentáciu. **Strictly read-only voči source DBs**, **GDPR-first** (AI vidí len čo explicitne povolíš), **no lock-in** (export do dbt-compatible structure kedykoľvek).
- **AIBoard** *(future)* — dashboard authoring nad AInderstanding datamartmi
- **AIspaces** *(future)* — end-user distribution layer s RLS, viewer permissions, scheduled refresh

---

## 3. Existujúce alternatívy a ako sa AIBIo odlišuje

| Tool | Čo robí | Čo nerobí (oproti AInderstanding) |
|---|---|---|
| **Power Query** | Manual data prep s M-script editorom | Žiadny AI assist, vendor lock-in (Power BI ecosystem) |
| **dbt** | SQL-based modeling framework | Žiadny AI assist, žiadne UI, vyžaduje setup expertise |
| **Vanna AI** | Text-to-SQL nad existing DB | Nepostaví datamart, nepíše docs, nepracuje s governance |
| **Cube / Metabase / Lightdash** | BI semantic layer s code-first definition | Žiadny AI assist pri buildovaní, žiadny GDPR-first design |
| **Atlan / DataHub / OpenMetadata** | Data catalog s manual docs | Nepostaví datamart, len katalógyzuje existing |
| **Power BI Copilot** | Generuje DAX miery, jeden vizuál naraz | Nepostaví dimensional model, nepamätá si schému medzi sessions |

**AIBIo robí inak:**
- **AI partner pre celý datamart lifecycle** (nie len SQL alebo len docs alebo len model — všetko)
- **GDPR-first by default** (AI nevidí dáta bez explicit opt-in)
- **No lock-in** (export do dbt-compatible structure, môžeš pokračovať mimo AIBIo)
- **Strictly read-only voči source DBs** (žiadne DDL/DML/COMMENT writeback, len SELECT)
- **Modulárny** (postupný rast, jasné scope hranice)

---

## 4. Cieľová persona

**Marek, 32, BI Developer** v reálnej firme so 4-ročnou históriou. Pozná SQL, dimensional modeling (Kimball, dbt), pracuje s 3 produkčnými databázami (Postgres CRM, SQL Server ERP, BigQuery analytics).

**Marekov typický deň pri novej požiadavke:**

- 9:00 — stakeholder chce nový report
- 9:00 – 12:00 — Marek hľadá v databázach, otvára 5 SQL skriptov z minulosti, profil-uje dáta v SSMS
- 12:00 – 15:00 — píše staging SQL, debug-uje JOINs, rieši edge cases, kreslí dimensional model na papier
- 15:00 – 17:00 — píše dokumentáciu (alebo nie, lebo nestihne)
- *druhý deň* — testuje, naráža na data quality issues, fixuje
- *tretí deň* — robí report ktorý stakeholder pôvodne pýtal

Marek hodnotí: keyboard-driven workflow, transparentnosť, kontrolu, a najmä — **aby AI partner rozumel jeho dátam aj governance konvenciám** a vedel postaviť datamart s ním paralelne, nie pýtaním sa naňho na každý detail.

*Sekundárne persony neskôr:* dashboard author (po AIBoard), business user (po AIspaces). V aktuálnom scope mimo.

---

## 5. Modulárna architektúra

AIBIo je **single Next.js app organizovaná do modulov**, kde každý modul je **konceptuálne oddelený, ale always-installed**. Code je organizovaný per modul; user ich vidí ako prepojené časti jedného nástroja.

### Aktívny modul: AInderstanding

**AInderstanding** *(flagship, full focus)* — AI-asistovaný datamart builder. **Sám je vnútorne rozdelený na 8 sub-modulov** (Connect, Explore, Model, Test, Document, Govern, Translate, Export) — viď [AInderstanding GOAL](./AINDERSTANDING.md).

### Future complementary modules

Tieto sú **mimo aktívneho scope** ale udržiavame priestor pre ne v architektúre:

**AIBoard** — dashboard authoring layer.

> Konzumuje datamarty z AInderstanding (žiadny vlastný data prep, čistá separácia: AInderstanding = jediný source pravdy o dátach). Power BI ekvivalent: DAX + report canvas. Mentálny model: BI dev klikne *New dashboard* nad existing datamartom, dá brief (*"top 10 customers, monthly trend"*), agent navrhne layout, ty schvaľuješ. Output: interaktívne dashboardy konzumovateľné cez AIspaces.

**AIspaces** — end-user distribution layer.

> Workspaces, RLS, viewer permissions, scheduled refresh. Power BI Service ekvivalent. Pre **biznis usera je AIspaces "the product"** — otvorí workspace, klikne na dashboard, vidí ho podľa svojich práv. Nevie že AInderstanding alebo AIBoard existujú. Dev team má všetky 3 moduly, koncoví usermi len AIspaces.

Technická hierarchia modulov a dependency graph → [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 6. Mental model

AInderstanding kombinuje 3 ovplyvnujúce paradigmy:

- **Power Query** — vizuálny pipeline (Applied Steps) nad canonical kódom, krok-za-krokom transformations
- **dbt** — SQL-first modeling s `ref()`, model layering (staging → intermediate → marts), tests + docs ako first-class artifacts
- **Cursor / Copilot** — AI ako párový programátor, ale s explicitnými approval gates a strictly bounded permissions

Power Query analógia s AInderstanding flavorom:

| Power Query | AInderstanding |
|---|---|
| M-script ako canonical | SQL ako canonical |
| Applied Steps panel (vizuálny pipeline) | Lineage DAG + step-by-step transformation views |
| Vendor lock-in (Power BI ecosystem) | No lock-in (dbt-compatible export) |
| Klikací editor primárny | SQL editor + AI chat primárny, vizuál ako komplement |
| Žiadny AI | AI partner s 9 LLM subagentmi (8 v MVP, `code-generator` v Phase 2) |
| Žiadne native data governance | Built-in governance dokumentácia + GDPR-first |

---

## 7. Demo script (5-7 min screencast)

**Setup (off-camera):** AIBIo bez workspace, Chinook v DuckDB + Northwind v Postgres pripravené.

**Akt 1 (0:00 – 0:30): Hook**

> Voice-over: *"Building a datamart from raw databases takes weeks. AIBIo does it in 10 minutes — GDPR-friendly, with full transparency, and zero vendor lock-in."*

Show: AIBIo dashboard prázdny, "Create workspace" button.

**Akt 2 (0:30 – 1:00): Connect**

- User vytvorí workspace, pridá Chinook + Northwind connections
- Schema introspection prebehne v background, vidíme listy tabuliek

**Akt 3 (1:00 – 2:00): Explore**

- Paralelný data profiling všetkých tabuliek (live progress)
- Coverage indikátor stúpa
- User flagne pár tabuliek ako "reference data" (číselníky) → AI dostane permission čítať samples

**Akt 4 (2:00 – 4:00): Model + Document v paralel**

- User: *"Postav mi unified Customer datamart z týchto dvoch sources"*
- Agent navrhne dimensional model (DAG sa kreslí live)
- User pripomienkuje, agent updatuje
- User: *"OK, napíš SQL"*
- Vidíme SQL diff approval flow, user schvaľuje
- Documentation panel sa paralelne plní governance fields

**Akt 5 (4:00 – 5:30): Test + materialize**

- `test-generator` navrhne DQ testy (uniqueness na surrogate keys, FK integrity, not_null na critical fields)
- Test results dashboard sa kreslí: passed/failed badges
- 1 test fail-uje, agent navrhne fix v staging SQL, user schváli, retest passes
- Full refresh datamartu → DuckDB materializuje all marts

**Akt 6 (5:30 – 6:00): Govern**

- User prejde do Govern view, vidí audit log (čo AI videl, kedy)
- Klikne na `customers.email` → flagne ako PII → AI to nikdy znova nedostane do contextu

**Akt 7 (6:00 – 6:30): Export**

- One-click export → `.zip` s dbt-compatible structure
- Voice-over: *"No lock-in. Continue with dbt-core, or import into Atlan / DataHub. Your data, your rules."*

**Akt 8 (6:30 – 7:00): Outro**

> Voice-over: *"AIBIo AInderstanding. AI-assisted datamart building, GDPR-first, MIT licensed."*

Screen: GitHub URL.

---

## 8. Cross-cutting open questions a riziká

### Otvorené

- **AIBoard / AIspaces dependency model** — keď začneme stavať tieto moduly, dependencies definujeme v ich vlastných GOAL docs. Teraz len rezervujeme priestor.
- **Module versioning** — predbežne one product version, per-module independent versioning ak by sa scope rozdelil.
- **Multi-workspace v MVP** — UI to umožní, demo bude mať len 1 workspace pre clarity.

### Hlavné cross-cutting riziká

- **Scope creep** — **MVP je explicitne ohraničené:** Connect + Explore + Govern + Model + Document + Test + Export X1 (dbt/SQL) = ~36 dní = 2-3 mesiace. **Translate a Export X2-X8 sú Phase 2 (post-MVP)** — demo a portfolio cieľ na nich nezávisí. Pridávanie ich do MVP je najrýchlejší spôsob nedodania nič.
- **LLM cost** — supervisor + 9 LLM subagentov (8 v MVP) + multi-source paralel = drahý setup. Mitigation: Haiku pre high-frequency low-reasoning (`schema-explorer`, `data-profiler`, `docs-keeper`), Sonnet pre reasoning-heavy, prompt caching. **`max-budget per session` musí byť implementované v Phase 0** — token counter + warning keď session presiahne threshold, inak demo môže stáť $20-30 za run.
- **Credentials security** — connection credentials musia byť šifrované v SQLite **aj v MVP**; plain-text v GDPR-first produkte je reputačný a reálny bezpečnostný risk. Mitigation: AES-256 via `node:crypto` implementované v Phase P0a, `AIBIO_ENCRYPTION_KEY` env var (required at startup, app sa nespustí bez neho).
- **Privacy / PII** — GDPR-first dizajn je *the* differentiator. Mitigation: 3-vrstvový data exposure model (Schema / Samples / Query results) defaultne denies samples a query results, audit log čo AI videl, per-column PII classification.
- **Dependency na Claude API** — outage = app nepoužiteľný. Mitigation: graceful degradation (manual SQL editor + docs view stále funguje bez AI), jasné error states.
- **`@anthropic-ai/sdk` TS edge cases** — Mitigation: changelog tracking, fallback na priamy SDK call pre high-risk subagentov.
- **Module coupling drift** — bez disciplíny sa sub-moduly môžu cross-import nad rámec interfaces. Mitigation: ESLint rule (`no-restricted-imports` pre cross-module direct imports mimo `hooks/` exports), code review checklist.

---

## 9. High-level roadmap

Pri ~10-15 h/týždeň, hrubé time estimates:

### MVP (Phase 1) — cieľ: demonštrovateľný datamart builder

1. **Foundation Phase 0** (core/ + shell/) — ~2 dni → [core/GOAL.md](./00-core/GOAL.md) + [shell/GOAL.md](./01-shell/GOAL.md)
2. **AInderstanding sub-moduly:**
   - Connect — ~3 dni → [connect/GOAL.md](./02-connect/GOAL.md)
   - Explore — ~5 dní → [explore/GOAL.md](./03-explore/GOAL.md)
   - Govern (foundation) — ~3 dni → [govern/GOAL.md](./04-govern/GOAL.md)
   - Model — ~7 dní → [model/GOAL.md](./05-model/GOAL.md)
   - Document — ~5 dní → [document/GOAL.md](./06-document/GOAL.md)
   - Test — ~4 dni → [test/GOAL.md](./07-test/GOAL.md)
   - Export X1 (dbt/SQL only) — ~2 dni → [export/GOAL.md](./09-export/GOAL.md)
3. **Cross-module integration** — ~2 dni
4. **Demo + README** — ~3 dni

**MVP celkom: ~36 pracovných dní** (vrátane cross-module integration ~2d + Demo/README ~3d) → 2-3 mesiace pri ~10-15 h/týždeň. Detailný build-order a aktuálny status: [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md).

### Phase 2 (post-MVP) — po dokončení MVP

- Translate (multi-language code gen + equivalence testing) — ~7 dní → [translate/GOAL.md](./08-translate/GOAL.md)
- Export X2–X8 (multi-format: Python, Power Query M, DAX/TMDL, KQL) — ~15 dní → [export/GOAL.md](./09-export/GOAL.md)

**Phase 2 celkom: ~22 dní.** Tieto sub-moduly sú **nezávislé od demo a portfolio cieľa** — neukazujú nové architektonické patterny (Translate je code-gen agent, Export X2-X8 je packaging), ale zásadne rozširujú no-lock-in story.

**AIBoard a AIspaces sú mimo tohto rozsahu** — budú riešené až po dokončení AInderstanding ako samostatné product iterácie.

---

## 10. Glossary (cross-product)

- **Datamart** — clean, well-modeled set tabuliek (dimensional alebo flat) pripravený na konzumáciu downstream consumers (dashboards, reports, analysis). AInderstanding output.
- **Sub-modul** — vnútorné delenie AInderstanding modulu (Connect, Explore, Model, Test, Document, Govern, Export). Každý má vlastný folder, agentmi, DB schémy, UI komponenty.
- **GDPR-first design** — princíp že AI nikdy nedostáva dáta bez explicit user opt-in. 3-vrstvový exposure model (Schema / Samples / Query results).
- **No lock-in** — princíp že kompletný datamart spec je exportovateľný v industry-standard formáte (dbt-compatible), funkčný mimo AIBIo.
- **Subagent** — špecializovaný agent invokovaný supervisor agentom cez Agent tool, s vlastným system promptom a tool-set-om.
- **MCP server** — Model Context Protocol server, in-process tool registry pre agentov.
- **SSE** — Server-Sent Events, one-way streaming z servera do prehliadača.

Detailný glossary per sub-modul → sub-module GOAL docs.

---

## 11. Changelog

- **v0.9** *(this version)* — **MVP scope fix + bezpečnostné opravy.** Translate a Export X2-X8 presunuté do Phase 2 (post-MVP) — MVP je 36 dní namiesto 58. Credentials encryption presunúté z "planned" do Phase P0a (required). `max-budget per session` pridané ako P0 requirement. Scope creep risk prepísaný s explicitnou MVP definíciou. Canonical agent count: supervisor + 9 LLM subagentov; 8 v MVP (`code-generator` je Phase 2); `translate-validator` je deterministický service (nie LLM agent). AIBIO.md v0.9, AINDERSTANDING.md v0.9.
- **v0.8** — **Translate sub-modul (8. sub-modul) + multi-format Export rozšírenie.** Nový `translate/` sub-modul: interaktívna multi-language code generácia + equivalence testing, 24 jazykov v Language Registry (SQL dialekty, Python rodina, DAX/TMDL, Power Query M, KQL, R, Scala, Julia, TypeScript/Prisma, GraphQL, MDX), 4 execution tiers (full-exec/sandbox/syntax-only/gen-only). Nový `code-generator` agent (Haiku/Sonnet). Export prepoziciovaný ako packaging layer — reuse-uje Translate snippety namiesto vlastnej code generation logiky. Celkový roadmap: ~58 dní (pôvodných ~36 + Translate ~7 + Export multi-format ~15). Docs: `translate/GOAL.md`, `translate/LANGUAGES.md`, `translate/RULES.md`, `export/MULTIFORMAT.md` (prepísané).
- **v0.7** — **Dokumentačná kompletizácia a architektonická konzistencia.** Pridané [CORE.md](./00-core/GOAL.md) (Phase 0 foundation: shared types, Drizzle klient, in-process MCP server, kompletný tool registry 25 tools, approval gate mechanizmus, SSE streaming protokol) a [shell/GOAL.md](./01-shell/GOAL.md) (supervisor state machine, AI modes efekt na každý subagent, intent classifier, SSE message rendering, serialized approval queue pre parallel dispatch). Opravené: supervisor lokácia (`shell/orchestrator.ts`, nie `core/`), `@anthropic-ai/sdk` package name, React Flow (`@xyflow/react`) rozhodnutý, `is_reference_table` source of truth (Explore only), PII classification flow zdokumentovaný (3-tabulkový flow), SQL injection opravená v test kompilácii, `source()` expansion 2-fázová materialization zdokumentovaná, `ref()` syntax rozhodnutá (priama, nie Jinja), coverage formula definovaná (40/35/15/10), `chat_messages` ownership opravená, DuckDB dialect: MVP cieľ je dbt-duckdb, broken cross-reference paths opravené. Verzia: AIBIO.md v0.7, AINDERSTANDING.md v0.7.
- **v0.6** — Major scope refocus: AInderstanding ako jediný aktívny modul, **decomposed do 7 sub-modulov** (Connect, Explore, Model, Test, Document, Govern, Export). AIBoard a AIspaces vyhodené z aktívneho scope, ostali len ako "future complementary modules" v stručnej mention. Mental model rozšírený o Power Query + dbt + Cursor paralely. GDPR-first ako product-wide pillar. No lock-in ako product-wide pillar. Strict read-only voči source DBs (žiadne DDL/DML/COMMENT writeback). Data exposure 3-vrstvový model (Schema / Samples / Query results). 8 subagentov (rozšírené z 6), distribuovaných medzi sub-moduly.
- **v0.5** — Split na 4 docs (top-level + Workspaces + Understanding + Dashboards). Modulárna architektúra (Workspaces foundation, Understanding + Dashboards sibling).
- **v0.4** — Reframe na modulárnu architektúru, dependency graph, module interfaces, roadmap modulov.
- **v0.3** — Vízia preformulovaná. 6 subagentov. Alternatívy, persona Marek, demo script, glossary, changelog. Coverage/confidence rozdelené.
- **v0.2** — Dvojfázový flow, docs ako first-class output, 10 subagentov, multi-source paralelný onboarding.
- **v0.1** — Initial draft, primárne dashboard-builder fokus.

---

*Doc owner: Lukáš (Inchartio). Verzia 0.9. Reaguj komentármi / úpravami a iteruj.*
