# Test Sub-module — GOAL

*Working doc, slovensky. Verzia 0.1. Súčasť AInderstanding, pozri [parent GOAL](../AINDERSTANDING.md).*

---

## 1. Účel sub-modulu

**Test zabezpečuje data quality datamartu.** Plnohodnotný dbt-like test framework:

- Generic tests (uniqueness, not_null, FK referential, accepted_values)
- Custom SQL tests (user-written assertions)
- AI-generated tests (`test-generator` subagent navrhuje testy based on schema + profile)
- Test execution after materialization
- **GDPR-aware failure reporting** — AI vidí test failure metadata (čo failné a počty), nie failed rows
- Test results dashboard s drill-down

---

## 2. Koncepty

- **Test** — assertion ktorá vyhodnocuje materialized model. Output: pass / fail / error.
- **Test types:**
  - **Generic** — parametrized testy (uniqueness, not_null, FK, accepted_values, value_in_range)
  - **Singular / Custom** — user-written SQL ktorý vráti rows ak fail (dbt convention)
- **Test run** — execution batch ktorý spustí všetky testy (alebo subset), s aggregate results
- **Test failure** — keď test vráti aspoň jeden row porušujúci assertion. Failure metadata: row count, severity, sample failing IDs (s GDPR check).
- **Severity** — `error` (blocks downstream consumption) / `warn` (visible ale neblokuje)

---

## 3. Scope

### In scope (MVP)

- 4 generic test types: `unique`, `not_null`, `foreign_key`, `accepted_values`
- 1 custom test type: user-written SQL (returns 0 rows = pass)
- AI-generated tests cez `test-generator` subagent
- Test definitions ako `.yml` files v `workspaces/{id}/tests/` (dbt-compatible)
- Test runner — spustí všetky testy po materialization
- Per-model test triggering
- **Test results dashboard** UI s passed / failed / error badges
- Drill-down: čo failné, koľko rows, severity
- GDPR-aware failure detail: number of failing rows + sample IDs (NIE full row content)
- Test history (per-run results)
- Failure → fix loop (test fail → `sql-writer` dostane test failure metadata → opraví model)

### Out of scope

- Schema tests beyond 4 generics (z dbt: relationships, expression_is_true v MVP nezahrnuté ako generic, dajú sa cez custom SQL)
- dbt-utils-style test plugins
- Anomaly detection / statistical tests
- Test scheduling (testy bežia po materialization, nie ako separate cron)
- Test history retention nad 50 runov (BR-TST-070: limit = 50 runov per workspace, UI zobrazí posledných 50; archivačný cleanup job je follow-up)

---

## 4. Agenti

### `test-generator`

| Field | Value |
|---|---|
| Owner | Test |
| Model | Sonnet |
| Tools | `read_schema_snapshot`, `read_profiles`, `read_docs`, `write_test_file` (s approval gate) |

**Účel:** po vytvorení modelu (alebo na user request) `test-generator` analyzuje schému + profile + governance docs a navrhne sadu testov:

- Unique tests pre PK candidates (z naming heuristics: `*_id` + Profile shows 100% distinct)
- Not_null tests pre fields označené ako required v Document
- FK tests pre identified relationships
- Accepted_values tests pre fields s low cardinality + categorical pattern (Genre, Status, ...)
- Pri governance docs s `valid_values` definovanými → accepted_values test

**Output:** list test proposals, user schvaľuje per-test alebo bulk.

### Patterny demonštrované v Test

- **Sequential** — Materialization → automatic test run → results
- **Parallel** — testy bežia paralelne v rámci one test run
- **Loop** — test fail → `sql-writer` fix → re-materialize → re-test (max 3 retries v rámci self-heal)
- **Conditional** — `test-generator` volí ktorý test typ podľa data shape (high cardinality + unique pattern → unique test; low cardinality categorical → accepted_values)

---

## 5. Success criteria

1. **Auto-generated tests pre Chinook datamart** — po build-e Chinook-based dim_customer + fct_sales, `test-generator` navrhne aspoň 8 testov (PK uniqueness, FK integrity, not_null pre kritické fields, accepted_values pre Country)
2. **Test execution rýchla** — 20 testov nad 100k-row datamartom run pod 10 s
3. **Test failure feedback do `sql-writer`** — úmyselne broken JOIN v intermediate model spôsobí FK test fail → automatic handoff do `sql-writer` → fix navrhnutý → user approves → 2. run passes
4. **GDPR compliance verifikované** — `customers.email` PII flagovaný column, test fail report nezahŕňa sample emails, len `email` ako field name + failing PK ids
5. **Test results dashboard čitateľný** — passed: 18 / failed: 2 / errored: 0 layout, klikateľný drill-down

---

## 6. Phase plán

### Phase T1: Test framework foundation — ~2 dni

- Drizzle schema (tests, test_runs, test_results)
- File-system storage v `workspaces/{id}/tests/`
- Test runner (parallel execution)
- 4 generic test types compilation
- Custom SQL test support
- `TestResultsDashboard` UI
- `TestDetailView` drill-down
- Auto-run testy after materialization

**Output:** user vie manuálne pridať testy cez YAML/SQL files, run-núť ich po materialize, vidieť výsledky.

### Phase T2: AI test generation + self-heal handoff — ~2 dni

- `test-generator` subagent
- MCP tools: `write_test_file`
- Test approval UI (user schvaľuje navrhnuté testy)
- Test failure → `sql-writer` handoff flow
- TestEditor UI pre manual test creation

**Output:** user dá brief alebo klikne *"Generate tests for this model"* → agent navrhne testy → user approves → testy uložené + spustené. Pri fail počas build cyklu, handoff do `sql-writer` automaticky.

**Total Test: ~4 dni.**

**Dependencies:** Phase M1+M2+M3 (Model — testy bežia voči materialized models).

**Blocks:** Phase X1 (full integration), Phase DEMO (screencast — test results sú v demo).

---

## 7. Open questions

- **Test severity surfacing** — failed `error` tests blokujú downstream konzumáciu? *Predbežne:* len visual warning v MVP (datamart sa stále materializuje), block-on-error follow-up s opt-in flagom.
- **Test history retention** — koľko runov držať? *Rozhodnuté (BR-TST-070):* last 50 runs per workspace, older archived (cleanup job follow-up).
- **Multi-column tests** — unique na composite key (e.g., `(invoice_id, line_item_id)`)? *Rozhodnuté (BR-TST-071):* MVP UI len pre single column, composite key uniqueness cez custom SQL test.
- **Test data sampling pre big results** — failing 100k rows nevieme zobraziť. *Predbežne:* sample 5 PK ids, plus count. User môže manuálne dotaz spustiť cez Manual SQL editor (Model sub-module) pre detail.

---

## 8. Riziká

- **AI-generated test correctness** — `test-generator` môže navrhnúť irrelevantné testy alebo missnúť kritické. *Mitigation:* user vždy approves pred uložením, batch review UI, AI suggestion ≠ auto-apply.
- **Test execution overload** — 100 testov × 1M rows datamart môže byť slow. *Mitigation:* parallel execution, query optimization (test SQL musí byť indexed-friendly), max wall-time per test (5s default).
- **False positives v FK tests pri NULL-able FK** — `m.fk_col IS NULL AND r.pk IS NULL` confusion. *Mitigation:* test SQL explicitne handles nullable FK pattern (`WHERE m.fk IS NOT NULL`).
- **Test ako attack vector** — user napíše custom SQL test ktorý je destruktivny. *Mitigation:* SQL parser gate aplikuje aj na custom tests, len SELECT, žiadne DDL/DML.

---

## 9. Settings (Test owned)

| Setting | Tier | Default | Notes |
|---|---|---|---|
| Auto-run tests after materialize | `[Core]` | Yes | Trigger v Model materialization workflow |
| Test parallel concurrency | `[Polish]` | 8 | Max concurrent test queries |
| AI test generation enabled | `[Core]` | Yes | Whether `test-generator` is invokable |
| Sample failing rows count | `[Polish]` | 5 | How many failing PKs to surface |
| Test execution timeout | `[Polish]` | 30 s | Per test wall-time max |

---

## 10. Glossary (Test-specific)

- **Generic test** — parametrized test type s standard signature (unique, not_null, FK, accepted_values)
- **Singular / Custom test** — user-written SQL, vráti failing rows (0 = pass)
- **Test severity** — `error` (kritický issue) / `warn` (visible ale not blocking)
- **Test run** — batch execution všetkých alebo subset testov, s aggregate result counts
- **Failing sample IDs** — max 5 PK hodnôt riadkov ktoré failujú test, surface-d userovi pre debugging (GDPR-aware: PK only, not full row)

---

## 11. References

- Parent: [AINDERSTANDING.md](../AINDERSTANDING.md)
- Pravidlá sub-modulu: [RULES.md](./RULES.md)
- Architektúra (DB schema, test runner kód, SQL compilation, file storage): [ARCHITECTURE.md](../ARCHITECTURE.md) — sekcia 6
- Foundation: [core/GOAL.md](../00-core/GOAL.md) — MCP server, approval gate
- Závisí od:
  - [model/GOAL.md](../05-model/GOAL.md) — testy bežia voči materialized models
  - [explore/GOAL.md](../03-explore/GOAL.md) — profile data informuje `test-generator`
  - [document/GOAL.md](../06-document/GOAL.md) — `valid_values` v governance docs informujú accepted_values tests
- Konzumujú Test:
  - [model/GOAL.md](../05-model/GOAL.md) — test failures dostávajú handoff do `sql-writer`
  - [export/GOAL.md](../09-export/GOAL.md) — testy idú do export ako `.yml` súbory
- Top-level: [AIBIO.md](../AIBIO.md)
