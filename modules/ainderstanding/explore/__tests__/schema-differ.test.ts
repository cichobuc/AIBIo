import { describe, it, expect } from 'vitest';
import { diffSnapshots } from '../lib/schema-differ';
import type { SchemaSnapshot } from '@/core/types/workspace';

const makeSnapshot = (tables: { name: string; cols: { name: string; dataType: string; nullable: boolean }[] }[]): SchemaSnapshot => ({
  capturedAt: new Date().toISOString(),
  tables: tables.map((t) => ({
    name: t.name,
    columns: t.cols.map((c) => ({
      name: c.name,
      dataType: c.dataType,
      nullable: c.nullable,
      isPrimaryKey: false,
      isForeignKey: false,
    })),
  })),
});

describe('diffSnapshots', () => {
  it('treats null from-snapshot as all tables added', () => {
    const to = makeSnapshot([{ name: 'users', cols: [{ name: 'id', dataType: 'int', nullable: false }] }]);
    const diff = diffSnapshots(null, to);
    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(0);
    expect(diff.modified).toBe(0);
    expect(diff.entries[0]?.changeType).toBe('table_added');
  });

  it('detects added table', () => {
    const from = makeSnapshot([{ name: 'users', cols: [] }]);
    const to = makeSnapshot([{ name: 'users', cols: [] }, { name: 'orders', cols: [] }]);
    const diff = diffSnapshots(from, to);
    expect(diff.added).toBe(1);
    expect(diff.entries.some((e) => e.changeType === 'table_added' && e.tableName === 'orders')).toBe(true);
  });

  it('detects removed table', () => {
    const from = makeSnapshot([{ name: 'users', cols: [] }, { name: 'stale', cols: [] }]);
    const to = makeSnapshot([{ name: 'users', cols: [] }]);
    const diff = diffSnapshots(from, to);
    expect(diff.removed).toBe(1);
    expect(diff.entries.some((e) => e.changeType === 'table_removed' && e.tableName === 'stale')).toBe(true);
  });

  it('detects added column', () => {
    const from = makeSnapshot([{ name: 'users', cols: [{ name: 'id', dataType: 'int', nullable: false }] }]);
    const to = makeSnapshot([{ name: 'users', cols: [{ name: 'id', dataType: 'int', nullable: false }, { name: 'email', dataType: 'text', nullable: true }] }]);
    const diff = diffSnapshots(from, to);
    expect(diff.modified).toBe(1);
    expect(diff.entries.some((e) => e.changeType === 'column_added' && e.columnName === 'email')).toBe(true);
  });

  it('detects column type change', () => {
    const from = makeSnapshot([{ name: 'users', cols: [{ name: 'age', dataType: 'int', nullable: false }] }]);
    const to = makeSnapshot([{ name: 'users', cols: [{ name: 'age', dataType: 'bigint', nullable: false }] }]);
    const diff = diffSnapshots(from, to);
    expect(diff.modified).toBe(1);
    expect(diff.entries[0]?.changeType).toBe('column_type_changed');
    expect(diff.entries[0]?.detail).toEqual({ from: 'int', to: 'bigint' });
  });

  it('detects no changes when snapshots identical', () => {
    const snap = makeSnapshot([{ name: 'users', cols: [{ name: 'id', dataType: 'int', nullable: false }] }]);
    const diff = diffSnapshots(snap, snap);
    expect(diff.added).toBe(0);
    expect(diff.removed).toBe(0);
    expect(diff.modified).toBe(0);
    expect(diff.entries).toHaveLength(0);
  });
});
