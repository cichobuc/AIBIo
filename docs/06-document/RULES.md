# Document Sub-module — Business Rules

*BR-DOC = Document Business Rules. Verzia 0.1. Pozri [GOAL](./GOAL.md) pre kontext.*

---

## Doc record lifecycle

**BR-DOC-001** — AI write vyžaduje approval (s podmienkou)  
Condition: `write_doc_record` alebo `update_doc_record` tool call od `docs-keeper`  
Rule: Approval gate sa spustí podľa confidence — pozri BR-DOC-070. Skrátene: `confidence = high` (db_native alebo user_confirmed) → bez approval. `confidence = medium` alebo `low` (AI-inferred) → approval povinný.

**BR-DOC-002** — Deduplikácia pred zápisom  
Condition: `docs-keeper` zapisuje záznam  
Rule: Pred `write_doc_record` musí prebehnutí check na existujúci záznam pre rovnakú entitu (table/column/term/relationship/convention). Ak existuje → `update_doc_record`. Duplicitné záznamy pre rovnakú entitu sú invalid.

**BR-DOC-003** — Source attribution je povinná  
Condition: Každý `doc_record`  
Rule: `source` musí byť jeden z: `db_native`, `ai_generated`, `user_authored`, `user_confirmed`. Záznam bez source attribution nie je valid.

**BR-DOC-004** — User confirmed override AI generated  
Condition: Existujúci `ai_generated` záznam, user explicitne potvrdzuje  
Rule: Source sa updatuje na `user_confirmed`, confidence na `high`. Hodnota môže byť zachovaná alebo nahradená podľa toho čo user potvrdil.

---

## Confidence rules

**BR-DOC-010** — Confidence je deterministická  
Condition: Každý doc record  
Rule: Mapovanie je striktné:  
- DB native comment → `confidence = high`  
- User explicit confirm → `confidence = high`  
- AI inference z profile data → `confidence = medium`  
- AI inference z naming heuristics → `confidence = low`  
Žiadna iná kombinácia nie je povolená.

**BR-DOC-011** — Low confidence records sú flagované pre review  
Condition: Záznam s `confidence = low`  
Rule: Záznam je zahrnutý v review queue (`auto_flag_low_confidence = true` default). UI zobrazí badge a review prompt. `docs-keeper` musí flag-núť uncertainty ak je záznam guess (*"Predpokladám, že..."*).

---

## Coverage rules

**BR-DOC-020** — Coverage formula je weighted sum  
Condition: `update_coverage` calculation  
Rule: `coverage_score = (tables_pct × 0.40) + (columns_pct × 0.35) + (terms_pct × 0.15) + (relationships_pct × 0.10)`. Pre table a column component je rozhodujúci `description` field. Owner, classification a ďalšie polia nepočítajú do score — sledujú sa zvlášť ako readiness gaps.

**BR-DOC-021** — Readiness threshold = 70  
Condition: `assess_readiness` tool call  
Rule: `coverage_score >= 70` → `{ ready: true }`. `interviewer` navrhuje *"datamart ready for production"*. Pod threshold → `{ ready: false, gaps: [...] }`.

**BR-DOC-022** — Coverage sa updatuje po každom doc write  
Condition: `write_doc_record` alebo `update_doc_record`  
Rule: `update_coverage` je volaný synchronne po každom úspešnom write. Coverage indikátor v UI reflektuje aktuálny stav vždy do 2 s.

---

## Auto-population rules

**BR-DOC-030** — DB native comments sú auto-populated bez approval  
Condition: Source je pridaný do workspace  
Rule: Explore `schema-explorer` načíta native comments z DB metadata. `docs-keeper` ich zapíše priamo ako `source = db_native, confidence = high` bez approval gate.

**BR-DOC-031** — Profile data informuje suggestions, nie priame záznamy  
Condition: `data-profiler` má profile data pre column  
Rule: Profile stats sú dostupné `docs-keeper` cez `read_profiles`. `docs-keeper` ich použije na inferovanie `valid_values`, `logical_type`, atď. s `confidence = medium`. Sú to suggestions — nie automatic writes.

**BR-DOC-032** — PII candidates z Explore sú reflektované s low confidence  
Condition: Explore identifikuje PII candidate column  
Rule: `docs-keeper` reflektuje `pii_classification = 'pii'` pre candidate columns ako `confidence = low, source = ai_generated`. User musí confirm (zmení na `user_confirmed`).

---

## Interviewer agent rules

**BR-DOC-040** — Interviewer prioritizuje kritické polia  
Condition: `interviewer` vybiera ďalšiu otázku  
Rule: Poradie priority: (1) PK/FK/sensitive columns, (2) business-relevant tables (revenue, customer, transactional), (3) edge case fields. Nezačína s menej dôležitými poliami.

**BR-DOC-041** — Max 5 otázok v sérii  
Condition: `interviewer` konverzácia  
Rule: Po 5 otázkach bez user-initiated zmeny témy, `interviewer` pauzuje a pýta sa či chce user pokračovať. Nesmie klásť otázky donekonečna.

**BR-DOC-042** — Skip option musí byť vždy dostupná  
Condition: Každá otázka od `interviewer`  
Rule: UI zobrazí "Skip" button na každej otázke. Skip nezníži coverage score — pole ostáva unsatisfied, nie marked ako skipped.

**BR-DOC-043** — Default verbosity je brief  
Condition: Formulovanie otázky  
Rule: Default je brief (*"Owner tabuľky `invoices`?"*). Verbose mode je opt-in cez setting.

**BR-DOC-044** — `interviewer` formuluje 1-3 otázky per turn  
Condition: Každý `interviewer` turn v konverzácii  
Rule: Per jeden turn sa formulujú **1 až 3 špecifické otázky**, nie viac. Viac otázok naraz by zahlcovalo usera. Každá otázka musí byť konkrétna a kontextuálna (nie generická *"Povedz mi viac..."*).

**BR-DOC-045** — Schema change notifikácia triggeruje doc review  
Condition: Explore detekuje `schema_changes` (pridané/odebrané stĺpce alebo tabuľky)  
Rule: Document sub-modul prijme notifikáciu a surfne review queue: docs pre zmenené tabuľky/stĺpce sú označené ako "possibly stale". `interviewer` pri ďalšej session prioritizuje tieto záznamy.

---

## docs-keeper listening pattern

**BR-DOC-050** — `docs-keeper` je listening agent  
Condition: Každá user message alebo agent response v chat paneli  
Rule: `docs-keeper` monitruje konverzáciu pasívne a extrahuje structured information bez toho aby bol explicitne pýtaný. Zapisuje záznamy na základe všetkého čo odznielo v chate — nie len na direct odpovede na otázky `interviewer`-a.

**BR-DOC-051** — Multi-source: parallelné `docs-keeper` inštancie  
Condition: Workspace s viacerými data sources  
Rule: Pre multi-source onboarding beží samostatná `docs-keeper` inštancia per source (paralelne). Záznamy z rôznych sources nesmú byť pomiešané — každá inštancia má explicitný source identifier v kontexte.

---

## PII mirror rule

**BR-DOC-060** — Document mirroruje PII classification z Govern  
Condition: `column_permissions.pii_classification` je nastavená v Govern  
Rule: `docs-keeper` číta `column_permissions.pii_classification` a kopíruje do `column_descriptions.pii_classification`. Govern je source of truth — Document ho len dokumentuje. Ak sa PII classification zmení v Govern, Document záznam musí byť aktualizovaný.

---

## write_to_docs approval rule

**BR-DOC-070** — Approval len pre confidence < high  
Condition: `write_doc_record` alebo `update_doc_record` od `docs-keeper`  
Rule: Approval gate sa spustí **iba pre `confidence = medium` alebo `confidence = low`**. Pre `confidence = high` (DB native alebo user_confirmed) sa zapíše bez approval. Platí rovnako ako BR-GOV-061 — toto je dokumentový pohľad na to isté pravidlo.
