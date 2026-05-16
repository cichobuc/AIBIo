import { Parser } from 'node-sql-parser';
import { listModels } from './model-service';
import { extractRefs } from './lineage-parser';

const parser = new Parser();

export interface SqlValidationError {
  line: number;
  column: number;
  message: string;
}

export interface ValidateResult {
  valid: boolean;
  errors: SqlValidationError[];
  hasNonSelectStatements: boolean;
  unresolvedRefs: string[];
}

const NON_SELECT_PATTERN = /^\s*(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|EXEC|CALL)\s/im;

export async function validateSql(workspaceId: string, sql: string): Promise<ValidateResult> {
  const errors: SqlValidationError[] = [];
  let hasNonSelectStatements = false;

  if (NON_SELECT_PATTERN.test(sql)) {
    hasNonSelectStatements = true;
    errors.push({ line: 1, column: 1, message: 'Only SELECT statements are allowed in model files.' });
  }

  // Normalize AIBIo ref()/source() syntax before AST parse
  const normalized = sql
    .replace(/ref\(['"](\w+)['"]\)/g, '"_ref_$1_"')
    .replace(/source\(['"](\w+)['"]\s*,\s*['"](\w+)['"]\)/g, '"_src_$1__$2"');

  try {
    parser.parse(normalized, { database: 'DuckDB' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Extract line/column from error message if possible
    const loc = msg.match(/line\s+(\d+),\s+col\s+(\d+)/i);
    errors.push({
      line: loc?.[1] ? parseInt(loc[1], 10) : 1,
      column: loc?.[2] ? parseInt(loc[2], 10) : 1,
      message: `SQL parse error: ${msg}`,
    });
  }

  // Cross-check ref() names against known models
  const refs = extractRefs(sql);
  const knownModels = listModels(workspaceId);
  const knownNames = new Set(knownModels.map((m) => m.name));

  const unresolvedRefs = refs
    .filter((r) => r.refType === 'model_ref' && r.modelName && !knownNames.has(r.modelName))
    .map((r) => r.modelName!);

  return {
    valid: errors.length === 0 && unresolvedRefs.length === 0,
    errors,
    hasNonSelectStatements,
    unresolvedRefs,
  };
}
