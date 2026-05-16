import { Parser } from 'node-sql-parser';

const parser = new Parser();

// Returns unique table names referenced in FROM/JOIN clauses.
// CTE aliases are excluded — only physical table names are returned.
export function extractTableRefs(sql: string): string[] {
  let tableList: string[] = [];
  let cteNames = new Set<string>();

  try {
    tableList = parser.tableList(sql);
  } catch {
    return [];
  }

  try {
    const ast = parser.astify(sql);
    const stmts = Array.isArray(ast) ? ast : [ast];
    for (const stmt of stmts) {
      const withs: unknown[] = ((stmt as unknown as Record<string, unknown>).with as unknown[]) ?? [];
      for (const w of withs) {
        const nameObj = (w as Record<string, unknown>).name as Record<string, unknown> | null;
        if (nameObj?.value && typeof nameObj.value === 'string') {
          cteNames.add(nameObj.value.toLowerCase());
        }
      }
    }
  } catch {}

  const result = new Set<string>();
  for (const entry of tableList) {
    const parts = entry.split('::');
    if (parts.length < 3) continue;
    const tableName = parts[2];
    if (!tableName || tableName === 'null') continue;
    if (cteNames.has(tableName.toLowerCase())) continue;
    result.add(tableName);
  }

  return Array.from(result);
}
