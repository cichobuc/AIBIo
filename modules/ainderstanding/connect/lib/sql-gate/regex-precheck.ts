// Reject known DML/DDL keywords before AST parse (BR-CON-010, BR-CON-013)
const DML_DDL_PATTERN =
  /\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|MERGE|EXEC(?:UTE)?|sp_executesql|CALL|GRANT|REVOKE|COMMENT)\b/i;

// SELECT ... INTO <variable|table> — BR-CON-012
const SELECT_INTO_PATTERN = /\bSELECT\b[\s\S]*?\bINTO\b/i;

function stripComments(sql: string): string {
  // Remove line comments
  let result = sql.replace(/--[^\r\n]*/g, ' ');
  // Remove block comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return result;
}

export type RegexCheckResult =
  | { passed: true }
  | { passed: false; reason: string; keyword: string };

export function regexPrecheck(sql: string): RegexCheckResult {
  const stripped = stripComments(sql);

  const dmlMatch = DML_DDL_PATTERN.exec(stripped);
  if (dmlMatch) {
    return {
      passed: false,
      reason: `Statement contains forbidden keyword: ${dmlMatch[0].toUpperCase()}`,
      keyword: dmlMatch[0].toUpperCase(),
    };
  }

  if (SELECT_INTO_PATTERN.test(stripped)) {
    return {
      passed: false,
      reason: 'SELECT INTO is not permitted — use a plain SELECT',
      keyword: 'SELECT INTO',
    };
  }

  return { passed: true };
}
