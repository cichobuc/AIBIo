const DEFAULT_THRESHOLD = 1_000_000;
const SAMPLE_PCT = 10;

export function buildProfileQuery(
  tableName: string,
  rowCount: number | null,
  thresholdRows: number = DEFAULT_THRESHOLD,
): string {
  const quoted = `"${tableName}"`;
  if (rowCount !== null && rowCount > thresholdRows) {
    // DuckDB TABLESAMPLE SYSTEM syntax
    return `SELECT * FROM ${quoted} USING SAMPLE ${SAMPLE_PCT}%`;
  }
  return `SELECT * FROM ${quoted} LIMIT 10000`;
}

export function shouldSample(rowCount: number | null, thresholdRows: number = DEFAULT_THRESHOLD): boolean {
  return rowCount !== null && rowCount > thresholdRows;
}
