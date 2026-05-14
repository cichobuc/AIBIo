# Translate Sub-module — Business Rules

*BR-TRN = Translate Business Rules. Verzia 0.1. Pozri [GOAL](./GOAL.md) pre kontext.*

---

## Bezpečnosť a GDPR

**BR-TRN-001** — `code-generator` agent dostáva iba tier-1 dáta  
Condition: Každý LLM call v Translate module  
Rule: Agent dostáva: column names, types, SQL model definition, grain declarations, documentation descriptions, relationship definitions. **Nikdy:** sample_values z profilovania, query results, PII column values. `PiiColumnFilter` je povinná vrstva pred každým LLM callom.

**BR-TRN-002** — PII columns sú označené, nie vynechané zo schema  
Condition: Generovaný kód pre model s PII columns  
Rule: PII-classified columns sa zobrazujú v schema (column name + type) ale s explicitným komentárom / excluded marker v generovanom kóde. User musí vedieť že existujú — len ich hodnoty nesmú byť exponované. Výnimka: `python:sqlalchemy` môže vynechať column z modelu a pridať komentár `# PII: excluded`.

**BR-TRN-003** — Snippety neobsahujú hardcoded connection strings  
Condition: Každý generovaný snippet  
Rule: Žiadny snippet nesmie obsahovať connection string, API key, password alebo iné credentials. Connection details sú vždy cez environment variables alebo parameter funkcie.

---

## Execution a testing

**BR-TRN-010** — Ground truth je vždy DuckDB SQL execúcia  
Condition: Ekvivalenčný test  
Rule: Ground truth = výsledok execúcie pôvodného AIBIo SQL modelu v DuckDB. Toto je referencia pre všetky porovnania. Ak DuckDB execúcia zlyhá → test sa nevykoná, UI zobrazí "Ground truth unavailable".

**BR-TRN-011** — Python execution je izolovaná (no network, no FS write)  
Condition: `full-exec` Python tier  
Rule: `uv run --isolated` subprocess dostáva iba read-only prístup k DuckDB súboru. Žiadny network access (firewall rule). Žiadny write na filesystem okrem stdout. Timeout: 30s default, konfigurovateľné per language.

**BR-TRN-012** — Ekvivalenčný test používa sampling, nie full scan  
Condition: Porovnanie výsledkov  
Rule: Porovnanie rows je sample-based (prvých 100 rows, sorted by primary key). Schema porovnanie je full (všetky columns). Row count porovnanie je full. Dôvod: ochrana pred výkonnostnými problémami pri veľkých datasetoch.

**BR-TRN-013** — Timeout neznamená failure — znamená "untested"  
Condition: Execution timeout  
Rule: Ak execúcia presiahne timeout → status = `timeout`, nie `failed`. UI zobrazí "Execution timed out — try with a smaller model or increase timeout". Snippet zostáva v DB ako `generated`, test result ako `timeout`.

**BR-TRN-014** — Mismatch je informatívny, nie blokujúci  
Condition: Equivalence test result = `failed`  
Rule: Mismatch nezablokuje používateľa — snippet je stále dostupný na kopírovanie. UI prominentne zobrazí diff s vysvetlením (napr. "Column 'region' type mismatch: DuckDB=VARCHAR, pandas=object"). User môže snippet manuálne upraviť a retestovať.

---

## Code generation

**BR-TRN-020** — Haiku pre syntax translation, Sonnet pre semantic translation  
Condition: Voľba modelu pre code-generator  
Rule: Haiku sa používa pre: SQL dialekty, pandas/polars (priamy SQL→DataFrame preklad), gen-only jazyky. Sonnet sa používa pre: DAX (measures z metrics), KQL (materialized views), ibis (semantic intent), komplexné window functions → Python ekvivalent.

**BR-TRN-021** — Generácia je on-demand, nie pre-computed  
Condition: Language tab otvorený po prvýkrát  
Rule: Snippety sa generujú na vyžiadanie (user otvorí language tab alebo klikne "Generate"). Nie sú pre-generované pri uložení modelu. Výnimka: "Regenerate all" akcia v Export module.

**BR-TRN-022** — Snippet cache invalidácia pri zmene SQL  
Condition: SQL model je upravený a uložený  
Rule: Ak SQL modelu sa zmení → všetky snippety pre daný model sú označené `stale = true`. UI zobrazí "⚠️ Snippet may be outdated — Regenerate" warning. Stale snippet je stále dostupný na kopírovanie — nie automaticky zmazaný.

**BR-TRN-023** — Agent musí vyprodukovať `confidence` a `limitations`  
Condition: Každý LLM call code-generatora  
Rule: Výstup agenta obsahuje okrem kódu aj: `confidence: 'high' | 'medium' | 'low'` a `limitations: string[]` (zoznam vecí čo sa nedalo perfektne preložiť). Tieto sú zobrazené v UI vedľa snippetu.

**BR-TRN-024** — Fallback: ak agent zlyhá, UI zobrazí error — nevracia sa prázdny kód  
Condition: LLM call failure  
Rule: Ak `code-generator` zlyhá (timeout, API error, invalid output) → snippet status = `generation_error`. UI zobrazí error message a "Retry" button. Nikdy sa nevracia prázdny string ako "kód".

---

## Language Registry

**BR-TRN-030** — Nový jazyk nesmie meniť existujúci kód  
Condition: Pridanie jazyka do registra  
Rule: Language Registry je otvorená pre rozšírenie (Open/Closed). Pridanie = nová `LanguageDefinition` konfigurácia. Žiadna zmena v `TranslateService`, `CodeExecutor`, ani UI komponentoch.

**BR-TRN-031** — Tier `gen-only` nesmie zobrazovať "Test" button  
Condition: `gen-only` language tab v UI  
Rule: Pre jazyky s tier `gen-only` (R, Scala, Julia, GraphQL, MDX, TypeScript/Prisma) UI nezobrazí "Run & Compare" button. Zobrazí iba "Copy" a "Regenerate". Status badge = "📄 Generated".

**BR-TRN-032** — `sandbox` tier vyžaduje explicitný opt-in  
Condition: `sandbox` tier (PySpark, etc.)  
Rule: Sandbox execution (Docker) nie je default. User musí explicitne aktivovať v workspace settings. Ak Docker nie je dostupný / nie je aktivovaný → tier sa degraduje na `gen-only`, UI zobrazí banner "PySpark execution requires Docker — see settings".

---

## Snippet management

**BR-TRN-040** — Snippety sú workspace-scoped, nie user-scoped  
Condition: Snippet uloženie  
Rule: Snippet patrí workspacu (model_id + language_id + variant). V budúcnosti pri multi-user — snippety sú zdieľané v rámci workspace (nie private per user).

**BR-TRN-041** — History: posledné 5 verzií snippetu sú zachované  
Condition: "Regenerate" akcia  
Rule: Regenerácia nevymazáva predchádzajúci snippet — zachováva sa history posledných 5 generácií per model × language. User môže rollback na predchádzajúcu verziu. Staršie verzie sú soft-deleted.

**BR-TRN-042** — Export reuse snippet bez nového LLM callu  
Condition: Export operácia pre jazyk ktorý má existujúci non-stale snippet  
Rule: Ak existuje snippet s `stale = false` a `status = 'passed' | 'generated_only' | 'syntax_ok'` → Export modul ho reuse bez volania `code-generator` agenta. Ak snippet neexistuje alebo je `stale` → Export zavolá `code-generator`.

---

## UI a UX

**BR-TRN-050** — Translate Page je prístupná bez hotových modelov (prázdny stav)  
Condition: Workspace bez modelu  
Rule: Translate page sa načíta aj keď Model module nie je dokončený. Zobrazí empty state: "No models yet — build your first model in Model module". Navigácia nie je blokovaná.

**BR-TRN-051** — Monaco editor je read-only by default  
Condition: Snippet v Monaco editore  
Rule: Generovaný snippet je zobrazený v Monaco editore v read-only mode. "Edit" button prepína na editable mode. Manuálne editovaný snippet dostáva badge "✏️ Custom" a nie je prepísaný pri Regenerate pokiaľ user explicitne neklikne "Discard edits".

**BR-TRN-052** — Language selector pamätá posledný výber per workspace  
Condition: User prepína jazyky  
Rule: Naposledy vybraný jazyk + variant pre každý model je uložený v `localStorage`. Pri ďalšom otvorení model detailu sa automaticky zobrazí posledný použitý jazyk.
