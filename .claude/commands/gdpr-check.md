Audit the current branch changes for GDPR compliance violations specific to AIBIo's 3-tier data exposure model.

Arguments (optional): $ARGUMENTS
(file path or module name to scope the check, e.g. "src/modules/explore" or leave empty for full diff)

## AIBIo GDPR rules (from docs/ARCHITECTURE.md §8)

| Tier | What | Default | Override |
|------|------|---------|----------|
| 1 | Schema metadata (table/column names, types, counts) | ALLOW | — |
| 2 | Sample data rows from source DB | DENY | User opts in per-table (`is_reference_table = true`) |
| 3 | Query result rows | DENY | User approves per-query via approval gate |

## Audit steps

1. **Get the diff** — run `git diff main...HEAD -- src/` (or the path from `$ARGUMENTS` if provided). If no git branch, check the last modified TypeScript files.

2. **Check Tier 2 violations** — search for any code that reads actual data rows from a source DB:
   - Any `SELECT *` or `SELECT <columns>` against user tables without first checking `table_profiles.is_reference_table`
   - `data-profiler` agent or DuckDB queries that return rows to the LLM without a guard
   - Pattern to look for: DuckDB `conn.all(...)` call results passed directly to a Claude message

3. **Check Tier 3 violations** — search for query results being returned without `awaitApproval()`:
   - Any tool handler that produces rows from an analytical query must call `awaitApproval('execute_query', ...)` before returning
   - Look for `callTool(...)` or `conn.all(...)` results that flow into `messages.push(...)` without an intervening approval call

4. **Check AI mode filtering** — the supervisor must respect `activeMode` (BR-SHL-010–013):
   - `documentation` mode: only `document-coordinator` and `explore-coordinator` (read-only) can be dispatched; `model-coordinator` and `quality-coordinator` are blocked
   - `queries` mode: only `model-coordinator`, `quality-coordinator`, and `explore-coordinator` (read-only) can be dispatched; `document-coordinator` is blocked
   - `manual` mode: no coordinator or atomic agent dispatched at all; chat input disabled
   - `auto` mode: all 4 coordinators allowed
   - Look for coordinator dispatch calls that don't check `ctx.aiMode` before invoking `Task()`

5. **Check PII column exclusion** — any column listed in `table_profiles.pii_columns[]` must be:
   - Excluded from sample data returned to LLM
   - Redacted (replaced with `[REDACTED]`) in profiling output

6. **Report findings** — list each violation with:
   - File path + line number
   - Which GDPR tier is violated
   - What the code does
   - How to fix it (call `awaitApproval()`, check `is_reference_table`, filter by `pii_columns`)

If no violations found, confirm that and note which GDPR checks passed.
