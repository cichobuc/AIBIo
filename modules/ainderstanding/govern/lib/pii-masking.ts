import { db } from '@/core/db/client';
import { columnMetadata } from '../db/schema';
import { and, eq } from 'drizzle-orm';

type PiiColumnInfo = {
  columnName: string;
  piiSubtype: string | null;
  piiClassification: string | null;
};

function maskLabel(info: PiiColumnInfo): string {
  const subtype = info.piiSubtype?.toUpperCase() ?? info.piiClassification?.toUpperCase() ?? 'PII';
  return `[${subtype}_MASKED]`;
}

// BR-GOV-030: non-bypassable masking of PII-classified columns
export function maskRow(
  row: Record<string, unknown>,
  piiColumns: PiiColumnInfo[],
): Record<string, unknown> {
  if (piiColumns.length === 0) return row;

  const piiSet = new Map(piiColumns.map((c) => [c.columnName, c]));
  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    const piiInfo = piiSet.get(key);
    masked[key] = piiInfo ? maskLabel(piiInfo) : value;
  }

  return masked;
}

export function loadPiiColumnsForTable(
  dataSourceId: string,
  tableName: string,
): PiiColumnInfo[] {
  return db
    .select({
      columnName: columnMetadata.columnName,
      piiSubtype: columnMetadata.piiSubtype,
      piiClassification: columnMetadata.piiClassification,
    })
    .from(columnMetadata)
    .where(
      and(
        eq(columnMetadata.dataSourceId, dataSourceId),
        eq(columnMetadata.tableName, tableName),
      ),
    )
    .all()
    .filter((r) => r.piiClassification !== null && r.piiClassification !== 'none');
}

export function maskRows(
  rows: Record<string, unknown>[],
  dataSourceId: string,
  tableName: string,
): Record<string, unknown>[] {
  const piiColumns = loadPiiColumnsForTable(dataSourceId, tableName);
  if (piiColumns.length === 0) return rows;
  return rows.map((row) => maskRow(row, piiColumns));
}
