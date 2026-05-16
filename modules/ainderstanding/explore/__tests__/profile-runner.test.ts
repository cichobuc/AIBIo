import { describe, it, expect } from 'vitest';
import { computeColumnStats } from '../lib/profile-runner';

const makeRows = (col: string, values: unknown[]): Record<string, unknown>[] =>
  values.map((v) => ({ [col]: v }));

describe('computeColumnStats', () => {
  it('computes null rate correctly', () => {
    const rows = makeRows('x', [1, null, null, 4]);
    const stats = computeColumnStats('x', 'int', rows);
    expect(stats.nullCount).toBe(2);
    expect(stats.nullRate).toBeCloseTo(0.5);
  });

  it('computes distinct count', () => {
    const rows = makeRows('x', [1, 1, 2, 3]);
    const stats = computeColumnStats('x', 'int', rows);
    expect(stats.distinctCount).toBe(3);
  });

  it('computes min/max/mean for numeric', () => {
    const rows = makeRows('x', [10, 20, 30]);
    const stats = computeColumnStats('x', 'integer', rows);
    expect(stats.minValue).toBe('10');
    expect(stats.maxValue).toBe('30');
    expect(stats.meanValue).toBeCloseTo(20);
  });

  it('computes percentiles for numeric', () => {
    const rows = makeRows('x', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const stats = computeColumnStats('x', 'int', rows);
    expect(stats.percentiles).not.toBeNull();
    expect(stats.percentiles!.p50).toBeGreaterThan(0);
  });

  it('returns top N values limited by topN param', () => {
    const rows = makeRows('x', ['a', 'a', 'b', 'b', 'c', 'd', 'e']);
    const stats = computeColumnStats('x', 'text', rows, 2);
    expect(stats.topValues.length).toBeLessThanOrEqual(2);
    expect(stats.topValues).toContain('a');
    expect(stats.topValues).toContain('b');
  });

  it('handles all-null column', () => {
    const rows = makeRows('x', [null, null]);
    const stats = computeColumnStats('x', 'text', rows);
    expect(stats.nullRate).toBe(1);
    expect(stats.distinctCount).toBe(0);
    expect(stats.topValues).toHaveLength(0);
  });

  it('computes string length distribution', () => {
    const rows = makeRows('x', ['hello', 'world', 'hi']);
    const stats = computeColumnStats('x', 'varchar', rows);
    expect(stats.stringLengthDistribution).not.toBeNull();
  });
});
