# Test Sub-module — Business Rules

*BR-TST = Test Business Rules. Verzia 0.1. Pozri [GOAL](./GOAL.md) pre kontext.*

---

## SQL bezpečnosť

**BR-TST-001** — Custom test SQL musí byť SELECT  
Condition: User-written custom SQL test  
Rule: SQL parser gate (identický ako v Connect) sa aplikuje na custom test SQL pred uložením testu. Non-SELECT statement je rejected.

**BR-TST-002** — Generic test compilation používa quoted identifiers  
Condition: `compileGenericTest` funkcia  
Rule: Table a column identifiers sú vždy quoted (`"table_name"."column_name"`) — nikdy string-interpolated priamo. Hodnoty v `accepted_values` sú escaped pred vložením do SQL.

**BR-TST-003** — FK test handluje nullable FK  
Condition: Generic `foreign_key` test SQL  
Rule: Test SQL explicitne obsahuje `WHERE fk_col IS NOT NULL` — nullable FK sú ignorované (nie failed). Len non-null FK sú testované na referential integrity.

---

## Test execution rules

**BR-TST-010** — Testy bežia automaticky po materialization  
Condition: Materialization dokončená s `status = success`  
Rule: Test runner sa spustí automaticky keď `auto_run_tests_after_materialize = true` (default). User môže manuálne trigger-núť test run kedykoľvek nezávisle.

**BR-TST-011** — Testy bežia paralelne v rámci run-u  
Condition: Test run  
Rule: Všetky testy v rámci jedného run-u bežia paralelne (max concurrency = `test_parallel_concurrency`, default 8). Výsledky sa agregujú po dokončení všetkých.

**BR-TST-012** — Max wall-time per test  
Condition: Jednotlivý test execution  
Rule: Test je zabitý po `test_execution_timeout` (default 30 s) s `outcome = 'error', reason = 'timeout'`.

**BR-TST-013** — 0 rows = pass, > 0 rows = fail  
Condition: Generic alebo custom SQL test  
Rule: Test SQL vracia rows ktoré **porušujú** assertion. 0 rows = pass. > 0 rows = fail. SQL crash alebo timeout = `error` (odlišné od fail).

---

## GDPR-aware failure reporting

**BR-TST-020** — AI dostane iba test metadata pri failure  
Condition: Test fail → handoff do `sql-writer`  
Rule: `sql-writer` dostane: `{ test_name, table, column, failure_reason, row_count }`. **Nedostane** sample failed rows. Agent nesmie vidieť actual data hodnoty z failing rows.

**BR-TST-021** — Failing sample IDs sú PK only  
Condition: Failure detail zobrazovaný v UI  
Rule: Max `sample_failing_rows_count` (default 5) hodnôt PK stĺpca. **Nie** full rows. PII stĺpce sú vynechané aj z PK display ak sú PK zároveň PII-classified.

**BR-TST-022** — Failing rows idú priamo do UI, nie cez agenta  
Condition: User chce vidieť failing rows  
Rule: Failing rows sú zobrazené priamo userovi cez direct query bez agent intermediary. Pre hlbší prieskum: manuálny SQL editor v Model sub-module.

---

## Test generation rules

**BR-TST-030** — AI-generated test vyžaduje approval  
Condition: `write_test_file` tool call od `test-generator`  
Rule: Approval gate musí byť resolved pred zápisom. `test-generator` nikdy nezapíše test bez user potvrdenia — ani v batch review.

**BR-TST-031** — Unique test iba ak profile potvrdzuje high distinctness  
Condition: `test-generator` navrhuje `unique` test  
Rule: Navrhnutý len ak sú splnené obe podmienky: (a) column name matchuje `*_id` pattern, AND (b) `column_profiles.distinct_count >= 99%` row count.

**BR-TST-032** — Accepted_values test iba pre nízkokardinálne stĺpce  
Condition: `test-generator` navrhuje `accepted_values` test  
Rule: Navrhnutý len ak: `distinct_count <= 20` AND `top_values` pokrývajú >= 95% všetkých riadkov. `valid_values` z Document docs sú preferovaný zdroj hodnôt ak existujú.

---

## Self-heal handoff rules

**BR-TST-040** — Test failure → sql-writer handoff je podmienený  
Condition: Test run vráti `outcome = 'fail'`  
Rule: Handoff do `sql-writer` prebehne automaticky len ak: (a) failure severity = `error` AND (b) self-heal retry counter pre daný model ešte nedosiahol 3. Inak sa failure len zobrazí userovi.

**BR-TST-041** — Retry counter je per-model, nie per-test-run  
Condition: Retry počítadlo  
Rule: Max 3 retries platí per model naprieč celým build cyklom. Ak bol model opravovaný 2× skôr, zostáva 1 retry — aj keď sa spustí nový test run.

---

## Test severity rules

**BR-TST-050** — `error` severity je visual warning v MVP, neblokuje materializáciu  
Condition: Test vráti `outcome = 'fail'` so severity `error`  
Rule: V MVP sa zobrazí červený badge v TestResultsDashboard. Datamart sa napriek tomu považuje za materialized — downstream konzumácia nie je technicky zablokovaná. Block-on-error je opt-in follow-up feature.

**BR-TST-051** — `warn` severity je informačný  
Condition: Test vráti `outcome = 'fail'` so severity `warn`  
Rule: Zobrazí sa žltý badge. Žiadna automatická akcia — len viditeľnosť. Neblokuje build ani downstream konzumáciu.

---

## Test generation conditions (kompletné)

**BR-TST-060** — FK test generovaný z identifikovaných FK vzťahov  
Condition: `test-generator` analyzuje schema + lineage  
Rule: `foreign_key` test je navrhnutý pre column ak: FK vzťah je identifikovaný v `lineage_edges` ALEBO `column_profiles` ukazuje 100% hodnôt prítomných v inej tabuľke. Test SQL explicitne handluje nullable FK (pozri BR-TST-003).

**BR-TST-061** — `not_null` test pre required fields z Document  
Condition: `test-generator` číta `read_docs` výsledky  
Rule: `not_null` test je navrhnutý pre column ak: (a) Document má `column_descriptions.is_required = true` pre daný field, ALEBO (b) column name matchuje `*_id` pattern a profile ukazuje 0% NULL rate. Priority: Document docs sú primárny zdroj, profile je fallback.

---

## Test retention rules

**BR-TST-070** — Test history retention: posledných 50 runov  
Condition: `test_runs` tabuľka per workspace  
Rule: Retenčný limit je 50 runov per workspace. Staršie runs sú archivované (cleanup job follow-up) — v MVP sa jednoducho nezobrazia v UI, ale zostanú v DB. Používateľ vidí posledných 50.

**BR-TST-071** — Multi-column unique test je len cez custom SQL  
Condition: User chce testovať uniqueness na composite key (napr. `(invoice_id, line_item_id)`)  
Rule: Generic `unique` test podporuje iba single column. Composite key uniqueness sa musí implementovať ako custom SQL test. MVP UI pre generic test zobrazí iba single column selector.
