import { randomUUID } from 'node:crypto';
import { db } from '@/core/db/client';
import {
  sourcePermissions,
  tablePermissions,
  columnMetadata,
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
      .from(columnMetadata)
      .where(
        and(
          eq(columnMetadata.dataSourceId, dataSourceId),
          eq(columnMetadata.tableName, tableName),
          eq(columnMetadata.columnName, columnName),
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
    .from(columnMetadata)
    .where(
      and(
        eq(columnMetadata.dataSourceId, dataSourceId),
        eq(columnMetadata.tableName, tableName),
        eq(columnMetadata.columnName, columnName),
      ),
    )
    .get();

  return col?.piiClassification != null && col.piiClassification !== 'none';
}

// Profiler-only write — never clobbers user classifications (set_by='user')
export function upsertHeuristicPiiSignal(
  dataSourceId: string,
  tableName: string,
  columnName: string,
  piiCandidate: boolean,
  piiCandidateReason: string | null,
): void {
  const now = new Date().toISOString();
  const existing = db
    .select()
    .from(columnMetadata)
    .where(
      and(
        eq(columnMetadata.dataSourceId, dataSourceId),
        eq(columnMetadata.tableName, tableName),
        eq(columnMetadata.columnName, columnName),
      ),
    )
    .get();

  if (existing) {
    // Only update the heuristic signal; never touch classification fields set by user
    db.update(columnMetadata)
      .set({ piiCandidate, piiCandidateReason, updatedAt: now })
      .where(eq(columnMetadata.id, existing.id))
      .run();
  } else {
    db.insert(columnMetadata)
      .values({
        id: randomUUID(),
        dataSourceId,
        tableName,
        columnName,
        piiCandidate,
        piiCandidateReason,
        setBy: 'heuristic',
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
}

export function getPiiColumns(
  dataSourceId: string,
  tableName: string,
): Array<{ columnName: string; piiSubtype: string | null }> {
  return db
    .select({ columnName: columnMetadata.columnName, piiSubtype: columnMetadata.piiSubtype })
    .from(columnMetadata)
    .where(
      and(
        eq(columnMetadata.dataSourceId, dataSourceId),
        eq(columnMetadata.tableName, tableName),
      ),
    )
    .all()
    .filter((r) => r.piiSubtype !== null);
}
