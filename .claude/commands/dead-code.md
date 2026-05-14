Run a dead code analysis on the AIBIo codebase.

Arguments (optional): $ARGUMENTS
(directory to scope the scan, e.g. "src/core" or leave empty for full codebase)

Delegate this task to the `dead-code-analyzer` subagent which has specialized instructions for this analysis.

## Scope

If `$ARGUMENTS` is provided, limit the analysis to that directory. Otherwise scan the full `src/` directory.

## What to find

The dead-code-analyzer will run these checks in order:

1. **knip** — unused exports, unused files, unresolved imports, unused dependencies
2. **TypeScript diagnostics** — TS6133 (declared but never read), TS6196 (declared but never used)
3. **depcheck** — packages in `package.json` not actually imported
4. **Orphaned files** — `.ts`/`.tsx` files with no import pointing to them
5. **TODO/FIXME markers** — should not exist per CLAUDE.md
6. **console.log** in production code — should not exist

## Report expected

```
## Dead Code Analysis Report
Date: <today>
Scope: <directory>

### 🔴 Critical (blocks clean build)
### 🟡 Unused Exports
### 🟠 Unused Dependencies
### 🟣 Orphaned Files
### 🔵 Code Hygiene (console.log, TODOs)

Summary:
Total: N issues
Effort: XS/S/M/L
Priority order: ...
```

## Context for the analyzer

- Next.js App Router convention exports (`default`, `GET`, `POST`, `generateMetadata`) are NOT dead code
- Drizzle schema table definitions are used at runtime by the ORM — not dead code
- Files under `docs/` are documentation — not analyzed
- Type-only exports used only as `import type` are fine
- `_` prefixed variables are intentionally unused
