import { Parser } from 'node-sql-parser';
import type { SqlRejectedError } from '@/core/types/workspace';

const parser = new Parser();

export class SqlRejectedErr extends Error {
  readonly structured: SqlRejectedError;

  constructor(structured: SqlRejectedError) {
    super(structured.reason);
    this.name = 'SqlRejectedErr';
    this.structured = structured;
  }
}

export function astValidate(sql: string): void {
  let ast: ReturnType<typeof parser.astify>;

  try {
    ast = parser.astify(sql, { database: 'PostgreSQL' });
  } catch {
    throw new SqlRejectedErr({
      code: 'SQL_REJECTED',
      reason: 'SQL could not be parsed — only valid SELECT statements are permitted',
      statement_type: 'UNKNOWN',
    });
  }

  const statements = Array.isArray(ast) ? ast : [ast];

  for (const stmt of statements) {
    if (!stmt || typeof stmt !== 'object') {
      throw new SqlRejectedErr({
        code: 'SQL_REJECTED',
        reason: 'Empty or malformed statement',
        statement_type: 'UNKNOWN',
      });
    }

    const type = (stmt as { type?: string }).type?.toUpperCase() ?? 'UNKNOWN';

    if (type !== 'SELECT') {
      throw new SqlRejectedErr({
        code: 'SQL_REJECTED',
        reason: `Only SELECT statements are permitted — got ${type}`,
        statement_type: type,
      });
    }

    // Reject SELECT ... INTO (window variable assignment)
    const hasInto = (stmt as { into?: unknown }).into;
    if (hasInto) {
      throw new SqlRejectedErr({
        code: 'SQL_REJECTED',
        reason: 'SELECT INTO is not permitted',
        statement_type: 'SELECT_INTO',
      });
    }
  }
}
