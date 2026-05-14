# Model Sub-module — Business Rules

*BR-MOD = Model Business Rules. Verzia 0.1. Pozri [GOAL](./GOAL.md) pre kontext.*

---

## Invariants

**BR-MOD-001** — AI write vždy vyžaduje approval  
Condition: `write_model_file` tool call od akéhokoľvek agenta  
Rule: Approval gate musí byť resolved (user klikne Approve) pred zapísaním SQL súboru. Nastavenie `ai_write_requires_approval` je locked — nedá sa vypnúť v MVP.

**BR-MOD-002** — Supervisor nikdy nevolá write tools priamo  
Condition: Supervisor agent (Shell)  
Rule: `write_model_file` nie je v tool liste supervisora. Priame volanie je technicky vylúčené — nie len konvenčné.

**BR-MOD-003** — SQL súbory sú source of truth  
Condition: Model definícia  
Rule: `workspaces/{id}/models/{layer}/{name}.sql` je source of truth. DB záznamy (`models` tabuľka) sú sekundárny index. Pri konflikte file vs DB → file vyhráva.

---

## `ref()` a `source()` pravidlá

**BR-MOD-010** — `ref('name')` syntax, nie Jinja  
Condition: SQL súbor v AIBIo  
Rule: Reference na iný model sa píše ako `ref('model_name')` priamo v SQL. TypeScript parser spracuje tokeny. Export konvertuje na Jinja `{{ ref('name') }}` pre dbt compatibility.

**BR-MOD-011** — `source('src', 'table')` pre externé zdroje  
Condition: Reference na tabuľku v source DB  
Rule: Syntax je `source('source_name', 'table_name')`. Pri materializácii prebehne source pull phase: tabuľka sa stiahne do DuckDB `_src__{source}__{table}` pred spustením modelov.

**BR-MOD-012** — Kruhová závislosť je blokovacia chyba  
Condition: `ref()` vzťahy tvoria cyklus v DAG  
Rule: Topological sort zlyhá fast s `{ code: 'CIRCULAR_DEPENDENCY', cycle: string[] }`. Materializácia sa nespustí.

**BR-MOD-013** — Chýbajúca ref je blokovacia chyba  
Condition: `ref('name')` kde `name` neexistuje ako model  
Rule: Validácia prebehne pred build-om (nie za runtime). Materializácia sa nespustí, user dostane konkrétny error s chýbajúcim názvom.

---

## Materialization rules

**BR-MOD-020** — Poradie materialization je dependency-driven  
Condition: Build all  
Rule: Staging modely bežia prv, potom intermediate, potom marts. Modely v rovnakej vrstve bez vzájomných závislostí bežia paralelne (`parallel_build_concurrency`, default 4).

**BR-MOD-021** — Full refresh vždy (v MVP)  
Condition: Akákoľvek materializácia  
Rule: DROP + CREATE pre každý model. Incremental refresh nie je implementovaný v MVP.

**BR-MOD-022** — Source pull prebehne pred model execution  
Condition: Model obsahuje `source()` reference  
Rule: Source pull phase (stiahnutie source tabuliek do `_src__*` v DuckDB) musí prebehnutí pred exekúciou modelov. Source pull error → build sa zastaví.

**BR-MOD-023** — Large source warning je neblokujúci  
Condition: Source tabuľka > 500 000 riadkov  
Rule: UI zobrazí warning pred build-om. Nie je blocking — user môže pokračovať po prečítaní.

---

## Self-heal loop rules

**BR-MOD-030** — Max 3 retries  
Condition: SQL execution error v `sql-writer`  
Rule: Self-heal loop sa zastaví po 3 pokusoch. Výsledok: `{ status: 'self_heal_exhausted', attempts: 3 }` s odporúčaním manuálneho fix-u.

**BR-MOD-031** — `ApprovalDeniedError` zastaví self-heal okamžite  
Condition: User klikne Deny na approval gate počas self-heal  
Rule: Toto je user-intentional cancel, nie SQL chyba. Self-heal **nesmie** pokračovať. Build status = `approval_denied`. Retry counter sa neincrementuje.

**BR-MOD-032** — Self-heal je scoped na zlyhávajúci model  
Condition: Self-heal pokus  
Rule: `sql-writer` smie opraviť len model ktorý failol. Nesmie modifikovať iné model súbory ani meniť schému.

---

## Layer convention rules

**BR-MOD-040** — Naming conventions sú enforcované agentom  
Condition: Model súbor vytvorený `sql-writer`  
Rule: Staging = `stg_{source}__{table}.sql`, Intermediate = `int_{description}.sql`, Marts = `dim_{name}.sql` alebo `fct_{name}.sql`. `sql-writer` system prompt obsahuje tieto konvencie explicitne.

**BR-MOD-041** — Manual edit je rešpektovaný pri ďalšom AI call  
Condition: User manuálne edituje SQL súbor v Monaco editore  
Rule: `dirty_state` flag sa nastaví. Agent pri ďalšom volaní číta aktuálny obsah súboru (nie cached verziu) a nesmie prepísať bez explicit user potvrdenia cez approval gate.

**BR-MOD-042** — Lineage je rebuild-nutý automaticky po každom save  
Condition: Akýkoľvek save model súboru (AI alebo manual)  
Rule: `ref()` parser beží synchronne po save, `lineage_edges` tabuľka je aktualizovaná. Lineage DAG v UI sa refresh-ne bez manuálneho triggeru.

---

## model-architect workflow rules

**BR-MOD-050** — `model-architect` výstup je proposal vyžadujúci approval  
Condition: `model-architect` dokončí dimensional model návrh  
Rule: Výsledok (`propose_dimensional_model` tool output) je zobrazený userovi pre review **pred tým** ako `sql-writer` začne písať SQL. `sql-writer` sa nespustí automaticky — user musí explicitne potvrdiť, odmietnuť alebo upraviť proposal.

**BR-MOD-051** — `model-architect` graceful pri prázdnych docs  
Condition: `read_docs` vráti prázdny výsledok (Document fáza ešte nebehla)  
Rule: `model-architect` pokračuje so schémou + profilmi a explicitne označí výstup: *"No business context available. Proposal based on schema only."* Nesmie halucinovať business kontext ktorý nemá.

**BR-MOD-052** — `sql-writer` beží paralelne pre nezávislé modely v rovnakej vrstve  
Condition: Build all — viacero staging modelov bez vzájomných závislostí  
Rule: `sql-writer` je invokaný súbežne pre N nezávislých modelov cez `Promise.all()`. Toto je key demo pattern paralelnej orchestrácie — nie optimalizácia, nie optional.

---

## DuckDB storage rules

**BR-MOD-060** — DuckDB súbor je per workspace  
Condition: Datamart storage  
Rule: Každý workspace má vlastný DuckDB súbor na ceste `workspaces/{workspaceId}/datamart.duckdb`. Workspaces nezdieľajú DuckDB instance.

**BR-MOD-061** — DuckDB naming convention pre materialized tables  
Condition: Akákoľvek tabuľka v `datamart.duckdb`  
Rule: Naming konvencie (all in `main` schema):  
- Source pull staging: `_src__{source}__{table}`  
- Staging models: `stg_{source}__{table}`  
- Intermediate models: `int_{name}`  
- Dimension marts: `dim_{name}`  
- Fact marts: `fct_{name}`  
Tieto konvencie sú enforcované v system prompte `sql-writer` a validované pri materializácii.

**BR-MOD-062** — Per-model build materializuje aj závislosti  
Condition: User spustí "Build single model" (nie "Build all")  
Rule: Materializácia jedného modelu automaticky zahrnie všetky jeho závislosti v správnom poradí (topological sort z `lineage_edges`). User nemusí manuálne spúšťať závislosti.

**BR-MOD-063** — `transformation-suggester` výstup sú suggestions, nie auto-apply  
Condition: `transformation-suggester` vráti transformation steps  
Rule: Výstup je structured list návrhov zobrazených userovi. **Nie sú automaticky aplikované.** User môže: (a) aplikovať manuálne cez Monaco, ALEBO (b) potvrdiť a nechať `sql-writer` zapísať — oba prípady vyžadujú explicit user akciu.
