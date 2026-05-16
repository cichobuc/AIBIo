import { randomUUID } from 'node:crypto';
import { db } from '@/core/db/client';
import { schemaSnapshots, schemaChanges, tableProfiles, columnProfiles } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { SchemaSnapshot } from '@/core/types/workspace';
import { diffSnapshots } from './schema-differ';
import { detectPii } from './pii-heuristics';
import { computeColumnStats } from './profile-runner';
import { buildProfileQuery } from './sampling-strategy';
import { profileTable } from '@/modules/ainderstanding/govern/lib/internal-adapter';
import type { SourceAdapter } from '@/modules/ainderstanding/connect/lib/adapters/factory';

// Layer 1 — no permission check (schema metadata)
export function readSchemaSnapshot(dataSourceId: string): SchemaSnapshot | null {
  const row = db
    .select()
    .from(schemaSnapshots)
    .where(eq(schemaSnapshots.dataSourceId, dataSourceId))
    .orderBy(desc(schemaSnapshots.takenAt))
    .limit(1)
    .get();

  if (!row) return null;
  return JSON.parse(row.snapshotJson) as SchemaSnapshot;
}

export function readProfiles(dataSourceId: string) {
  const tables = db
    .select()
    .from(tableProfiles)
    .where(eq(tableProfiles.dataSourceId, dataSourceId))
    .all();

  const cols = db
    .select()
    .from(columnProfiles)
    .where(eq(columnProfiles.dataSourceId, dataSourceId))
    .all();

  return { tables, columns: cols };
}

type DetectChangesResult = {
  added: number;
  removed: number;
  modified: number;
  snapshotId: string;
};

export async function detectSchemaChanges(
  dataSourceId: string,
  newSnapshot: SchemaSnapshot,
): Promise<DetectChangesResult> {
  const now = new Date().toISOString();
  const snapshotId = randomUUID();

  const tableCount = newSnapshot.tables.length;
  const columnCount = newSnapshot.tables.reduce((s, t) => s + t.columns.length, 0);

  db.insert(schemaSnapshots)
    .values({
      id: snapshotId,
      dataSourceId,
      snapshotJson: JSON.stringify(newSnapshot),
      tableCount,
      columnCount,
      takenAt: now,
    })
    .run();

  const prevRow = db
    .select()
    .from(schemaSnapshots)
    .where(eq(schemaSnapshots.dataSourceId, dataSourceId))
    .orderBy(desc(schemaSnapshots.takenAt))
    .limit(2)
    .all()[1];

  const prev = prevRow ? (JSON.parse(prevRow.snapshotJson) as SchemaSnapshot) : null;
  const diff = diffSnapshots(prev, newSnapshot);

  for (const entry of diff.entries) {
    db.insert(schemaChanges)
      .values({
        id: randomUUID(),
        dataSourceId,
        fromSnapshotId: prevRow?.id ?? null,
        toSnapshotId: snapshotId,
        changeType: entry.changeType,
        tableName: entry.tableName,
        columnName: entry.columnName ?? null,
        detailJson: entry.detail ? JSON.stringify(entry.detail) : null,
        detectedAt: now,
      })
      .run();
  }

  return {
    added: diff.added,
    removed: diff.removed,
    modified: diff.modified,
    snapshotId,
  };
}

export type PiiCandidateResult = Array<{
  columnName: string;
  isPiiCandidate: boolean;
  reason: string;
}>;

// BR-XPL-003: name-based heuristics only
export function detectPiiCandidates(columnNames: string[]): PiiCandidateResult {
  return columnNames.map((columnName) => {
    const result = detectPii(columnName);
    return { columnName, ...result };
  });
}

export type ReferenceSuggestion = { tableName: string; reason: string };

export async function suggestReferenceTableFlags(
  dataSourceId: string,
): Promise<ReferenceSuggestion[]> {
  const profiles = db
    .select()
    .from(tableProfiles)
    .where(eq(tableProfiles.dataSourceId, dataSourceId))
    .all();

  const suggestions: ReferenceSuggestion[] = [];

  for (const profile of profiles) {
    if (!profile.rowCount || profile.rowCount >= 10_000) continue;

    const cols = db
      .select()
      .from(columnProfiles)
      .where(
        and(
          eq(columnProfiles.dataSourceId, dataSourceId),
          eq(columnProfiles.tableName, profile.tableName),
        ),
      )
      .all();

    const hasPii = cols.some((c) => c.piiCandidate);
    if (hasPii) continue;

    const highCardinality = cols.some((c) => {
      if (!c.distinctCount || !profile.rowCount) return false;
      return c.distinctCount / profile.rowCount >= 0.8;
    });
    if (highCardinality) continue;

    suggestions.push({
      tableName: profile.tableName,
      reason: `row_count=${profile.rowCount} < 10000, low cardinality, no PII candidates`,
    });
  }

  return suggestions;
}

type RunProfileQueryInput = {
  dataSourceId: string;
  tableName: string;
  adapter: SourceAdapter;
  thresholdRows?: number;
  topN?: number;
};

export async function runProfileQuery(input: RunProfileQueryInput): Promise<void> {
  const { dataSourceId, tableName, adapter, thresholdRows, topN = 20 } = input;
  const now = new Date().toISOString();

  const existingProfile = db
    .select()
    .from(tableProfiles)
    .where(
      and(
        eq(tableProfiles.dataSourceId, dataSourceId),
        eq(tableProfiles.tableName, tableName),
      ),
    )
    .get();

  const sql = buildProfileQuery(tableName, existingProfile?.rowCount ?? null, thresholdRows);
  const result = await profileTable({ dataSourceId, tableName, adapter, sql });

  const rowCount = result.rowCount;
  const tableProfileId = existingProfile?.id ?? randomUUID();

  if (!existingProfile) {
    db.insert(tableProfiles)
      .values({
        id: tableProfileId,
        dataSourceId,
        tableName,
        rowCount,
        profiledAt: now,
      })
      .run();
  } else {
    db.update(tableProfiles)
      .set({ rowCount, profiledAt: now, updatedAt: now })
      .where(eq(tableProfiles.id, tableProfileId))
      .run();
  }

  const snapshot = readSchemaSnapshot(dataSourceId);
  const snapshotTable = snapshot?.tables.find((t) => t.name === tableName);
  const columnTypes: Record<string, string> = {};
  if (snapshotTable) {
    for (const col of snapshotTable.columns) {
      columnTypes[col.name] = col.dataType;
    }
  }

  for (const colName of result.columns) {
    const stats = computeColumnStats(colName, columnTypes[colName] ?? 'unknown', result.rows, topN);
    const piiResult = detectPii(colName);

    const topValuesRaw = stats.topValues;
    const topValuesFiltered = piiResult.isPiiCandidate ? '[REDACTED]' : JSON.stringify(topValuesRaw);

    const existing = db
      .select()
      .from(columnProfiles)
      .where(
        and(
          eq(columnProfiles.tableProfileId, tableProfileId),
          eq(columnProfiles.columnName, colName),
        ),
      )
      .get();

    const colProfileData = {
      tableProfileId,
      dataSourceId,
      tableName,
      columnName: colName,
      dataType: stats.dataType,
      nullCount: stats.nullCount,
      nullRate: stats.nullRate,
      distinctCount: stats.distinctCount,
      topValuesJson: topValuesFiltered,
      minValue: stats.minValue,
      maxValue: stats.maxValue,
      meanValue: stats.meanValue,
      percentilesJson: stats.percentiles ? JSON.stringify(stats.percentiles) : null,
      stringLengthDistributionJson: stats.stringLengthDistribution
        ? JSON.stringify(stats.stringLengthDistribution)
        : null,
      piiCandidate: piiResult.isPiiCandidate,
      piiCandidateReason: piiResult.isPiiCandidate ? piiResult.reason : null,
      profiledAt: now,
    };

    if (existing) {
      db.update(columnProfiles).set(colProfileData).where(eq(columnProfiles.id, existing.id)).run();
    } else {
      db.insert(columnProfiles)
        .values({ id: randomUUID(), ...colProfileData })
        .run();
    }
  }
}
