import { db } from '@/core/db/client';
import {
  sourcePermissions,
  tablePermissions,
  columnPermissions,
  type PermissionTierValue,
} from '../db/schema';
import { eq, and } from 'drizzle-orm';

export const TIER_RANK: Record<PermissionTierValue, number> = {
  metadata_only: 0,
  with_reference_samples: 1,
  with_full_samples: 2,
  with_query_results: 3,
};

function strictest(a: PermissionTierValue, b: PermissionTierValue): PermissionTierValue {
  return TIER_RANK[a] <= TIER_RANK[b] ? a : b;
}

// BR-GOV-012: strictest tier wins (column > table > source)
export function getEffectivePermission(
  dataSourceId: string,
  tableName?: string,
  columnName?: string,
): PermissionTierValue {
  const source = db
    .select()
    .from(sourcePermissions)
    .where(eq(sourcePermissions.dataSourceId, dataSourceId))
    .get();

  let effective: PermissionTierValue = source?.permissionTier ?? 'metadata_only';

  if (tableName) {
    const table = db
      .select()
      .from(tablePermissions)
      .where(
        and(
          eq(tablePermissions.dataSourceId, dataSourceId),
          eq(tablePermissions.tableName, tableName),
        ),
      )
      .get();

    if (table?.permissionOverride) {
      effective = strictest(effective, table.permissionOverride);
    }
  }

  if (tableName && columnName) {
    const col = db
      .select()
      .from(columnPermissions)
      .where(
        and(
          eq(columnPermissions.dataSourceId, dataSourceId),
          eq(columnPermissions.tableName, tableName),
          eq(columnPermissions.columnName, columnName),
        ),
      )
      .get();

    if (col?.piiClassification && col.piiClassification !== 'none') {
      effective = 'metadata_only';
    }
  }

  return effective;
}

export function isColumnPii(dataSourceId: string, tableName: string, columnName: string): boolean {
  const col = db
    .select()
    .from(columnPermissions)
    .where(
      and(
        eq(columnPermissions.dataSourceId, dataSourceId),
        eq(columnPermissions.tableName, tableName),
        eq(columnPermissions.columnName, columnName),
      ),
    )
    .get();

  return col?.piiClassification != null && col.piiClassification !== 'none';
}

export function getPiiColumns(
  dataSourceId: string,
  tableName: string,
): Array<{ columnName: string; piiSubtype: string | null }> {
  return db
    .select({ columnName: columnPermissions.columnName, piiSubtype: columnPermissions.piiSubtype })
    .from(columnPermissions)
    .where(
      and(
        eq(columnPermissions.dataSourceId, dataSourceId),
        eq(columnPermissions.tableName, tableName),
      ),
    )
    .all()
    .filter((r) => r.piiSubtype !== null);
}
