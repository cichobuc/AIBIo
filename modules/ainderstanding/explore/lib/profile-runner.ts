import type { QueryResult } from '@/core/types/workspace';

export type ColumnStats = {
  columnName: string;
  dataType: string;
  nullCount: number;
  nullRate: number;
  distinctCount: number;
  topValues: unknown[];
  minValue: string | null;
  maxValue: string | null;
  meanValue: number | null;
  percentiles: { p25: number; p50: number; p75: number; p95: number } | null;
  stringLengthDistribution: Record<string, number> | null;
};

export type TableStats = {
  tableName: string;
  rowCount: number;
  columns: ColumnStats[];
};

function safeString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

export function computeColumnStats(
  columnName: string,
  dataType: string,
  rows: Record<string, unknown>[],
  topN: number = 20,
): ColumnStats {
  const total = rows.length;
  const values = rows.map((r) => r[columnName]);

  const nullCount = values.filter((v) => v === null || v === undefined).length;
  const nullRate = total > 0 ? nullCount / total : 0;

  const nonNull = values.filter((v) => v !== null && v !== undefined);
  const uniqueVals = new Set(nonNull.map(String));
  const distinctCount = uniqueVals.size;

  // Top N values by frequency
  const freq = new Map<string, number>();
  for (const v of nonNull) {
    const key = String(v);
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  const topValues = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([val]) => val);

  const lowerType = dataType.toLowerCase();
  const isNumeric = /int|float|double|decimal|numeric|real|number/.test(lowerType);
  const isString = /char|text|varchar|string/.test(lowerType);

  let minValue: string | null = null;
  let maxValue: string | null = null;
  let meanValue: number | null = null;
  let percentiles: ColumnStats['percentiles'] = null;
  let stringLengthDistribution: ColumnStats['stringLengthDistribution'] = null;

  if (isNumeric && nonNull.length > 0) {
    const nums = nonNull.map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b);
    if (nums.length > 0) {
      minValue = safeString(nums[0]);
      maxValue = safeString(nums[nums.length - 1]);
      meanValue = nums.reduce((s, n) => s + n, 0) / nums.length;
      const pct = (p: number): number => nums[Math.floor((nums.length - 1) * p)] ?? 0;
      percentiles = { p25: pct(0.25), p50: pct(0.5), p75: pct(0.75), p95: pct(0.95) };
    }
  } else if (!isNumeric && nonNull.length > 0) {
    const sorted = nonNull.map(String).sort();
    minValue = sorted[0] ?? null;
    maxValue = sorted[sorted.length - 1] ?? null;
  }

  if (isString && nonNull.length > 0) {
    const dist: Record<string, number> = {};
    for (const v of nonNull) {
      const len = String(v).length;
      const bucket = String(Math.floor(len / 10) * 10);
      dist[bucket] = (dist[bucket] ?? 0) + 1;
    }
    stringLengthDistribution = dist;
  }

  return {
    columnName,
    dataType,
    nullCount,
    nullRate,
    distinctCount,
    topValues,
    minValue,
    maxValue,
    meanValue,
    percentiles,
    stringLengthDistribution,
  };
}

export function computeTableStats(
  tableName: string,
  result: QueryResult,
  columnTypes: Record<string, string>,
  topN: number = 20,
): TableStats {
  const columns: ColumnStats[] = result.columns.map((col) =>
    computeColumnStats(col, columnTypes[col] ?? 'unknown', result.rows, topN),
  );
  return { tableName, rowCount: result.rowCount, columns };
}
