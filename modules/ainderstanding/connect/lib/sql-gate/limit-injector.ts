import { Parser } from 'node-sql-parser';

const parser = new Parser();

// Ensures SQL has a LIMIT <= max. Appends or overrides via AST; falls back to regex.
export function injectLimit(sql: string, max: number): string {
  try {
    const ast = parser.astify(sql);
    const stmt = Array.isArray(ast) ? ast[0] : ast;
    if (!stmt) throw new Error('empty ast');
    const s = stmt as unknown as Record<string, unknown>;

    const currentLimit =
      s.limit && typeof s.limit === 'object'
        ? (s.limit as Record<string, unknown[]>).value?.[0]
        : null;
    const currentVal = typeof currentLimit === 'object' && currentLimit !== null
      ? (currentLimit as Record<string, unknown>).value
      : null;

    if (currentVal !== null && typeof currentVal === 'number' && currentVal <= max) {
      return sql;
    }

    s.limit = { seperator: '', value: [{ type: 'number', value: max }] };
    const stmtArr = Array.isArray(ast) ? ast.filter(Boolean) : [stmt];
    return parser.sqlify(stmtArr as Parameters<typeof parser.sqlify>[0], { database: 'PostgreSQL' });
  } catch {
    // Fallback: strip trailing semicolons and append LIMIT
    const stripped = sql.trimEnd().replace(/;+$/, '');
    const existing = /\bLIMIT\s+\d+\b/i.test(stripped);
    if (existing) {
      return stripped.replace(/\bLIMIT\s+\d+\b/i, `LIMIT ${max}`);
    }
    return `${stripped} LIMIT ${max}`;
  }
}
