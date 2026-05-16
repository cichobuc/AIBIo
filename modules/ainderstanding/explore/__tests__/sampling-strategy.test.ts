import { describe, it, expect } from 'vitest';
import { buildProfileQuery, shouldSample } from '../lib/sampling-strategy';

describe('shouldSample', () => {
  it('returns false when rowCount is null', () => {
    expect(shouldSample(null)).toBe(false);
  });

  it('returns false when rowCount is below threshold', () => {
    expect(shouldSample(500_000)).toBe(false);
  });

  it('returns true when rowCount exceeds threshold', () => {
    expect(shouldSample(2_000_000)).toBe(true);
  });

  it('respects custom threshold', () => {
    expect(shouldSample(5000, 1000)).toBe(true);
    expect(shouldSample(500, 1000)).toBe(false);
  });
});

describe('buildProfileQuery', () => {
  it('returns LIMIT query for small tables', () => {
    const sql = buildProfileQuery('users', 50_000);
    expect(sql).toMatch(/LIMIT/);
    expect(sql).not.toMatch(/SAMPLE/);
    expect(sql).toContain('"users"');
  });

  it('returns SAMPLE query for large tables', () => {
    const sql = buildProfileQuery('big_table', 5_000_000);
    expect(sql).toMatch(/USING SAMPLE/);
    expect(sql).toContain('"big_table"');
  });

  it('returns LIMIT query when rowCount is null', () => {
    const sql = buildProfileQuery('unknown', null);
    expect(sql).toMatch(/LIMIT/);
  });

  it('respects custom threshold', () => {
    const sql = buildProfileQuery('t', 500, 100);
    expect(sql).toMatch(/USING SAMPLE/);
  });
});
