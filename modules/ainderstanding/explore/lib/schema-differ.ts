import type { SchemaSnapshot, SchemaTable } from '@/core/types/workspace';
import type { SchemaChangeType } from '../db/schema';

export type SchemaDiffEntry = {
  changeType: SchemaChangeType;
  tableName: string;
  columnName?: string;
  detail?: Record<string, unknown>;
};

export type SchemaDiff = {
  added: number;
  removed: number;
  modified: number;
  entries: SchemaDiffEntry[];
};

export function diffSnapshots(from: SchemaSnapshot | null, to: SchemaSnapshot): SchemaDiff {
  const entries: SchemaDiffEntry[] = [];

  if (!from) {
    for (const table of to.tables) {
      entries.push({ changeType: 'table_added', tableName: table.name });
    }
    return { added: to.tables.length, removed: 0, modified: 0, entries };
  }

  const fromMap = new Map<string, SchemaTable>(from.tables.map((t) => [t.name, t]));
  const toMap = new Map<string, SchemaTable>(to.tables.map((t) => [t.name, t]));

  let added = 0;
  let removed = 0;
  let modified = 0;

  for (const [name, table] of toMap) {
    if (!fromMap.has(name)) {
      entries.push({ changeType: 'table_added', tableName: name });
      added++;
    } else {
      const fromTable = fromMap.get(name)!;
      const fromCols = new Map(fromTable.columns.map((c) => [c.name, c]));
      const toCols = new Map(table.columns.map((c) => [c.name, c]));

      for (const [colName, col] of toCols) {
        if (!fromCols.has(colName)) {
          entries.push({ changeType: 'column_added', tableName: name, columnName: colName });
          modified++;
        } else {
          const fromCol = fromCols.get(colName)!;
          if (fromCol.dataType !== col.dataType) {
            entries.push({
              changeType: 'column_type_changed',
              tableName: name,
              columnName: colName,
              detail: { from: fromCol.dataType, to: col.dataType },
            });
            modified++;
          } else if (fromCol.nullable !== col.nullable) {
            entries.push({
              changeType: 'column_nullability_changed',
              tableName: name,
              columnName: colName,
              detail: { from: fromCol.nullable, to: col.nullable },
            });
            modified++;
          }
        }
      }

      for (const colName of fromCols.keys()) {
        if (!toCols.has(colName)) {
          entries.push({ changeType: 'column_removed', tableName: name, columnName: colName });
          modified++;
        }
      }
    }
  }

  for (const name of fromMap.keys()) {
    if (!toMap.has(name)) {
      entries.push({ changeType: 'table_removed', tableName: name });
      removed++;
    }
  }

  return { added, removed, modified, entries };
}
