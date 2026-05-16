import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { dataSources } from '@/core/db/schema/data-source';

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const schemaSnapshots = sqliteTable(
  'schema_snapshots',
  {
    id: text('id').primaryKey(),
    dataSourceId: text('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'cascade' }),
    snapshotJson: text('snapshot_json').notNull(),
    tableCount: integer('table_count').notNull().default(0),
    columnCount: integer('column_count').notNull().default(0),
    takenAt: text('taken_at').notNull(),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [index('schema_snapshots_source_idx').on(t.dataSourceId)],
);

export const schemaChanges = sqliteTable(
  'schema_changes',
  {
    id: text('id').primaryKey(),
    dataSourceId: text('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'cascade' }),
    fromSnapshotId: text('from_snapshot_id').references(() => schemaSnapshots.id, {
      onDelete: 'set null',
    }),
    toSnapshotId: text('to_snapshot_id')
      .notNull()
      .references(() => schemaSnapshots.id, { onDelete: 'cascade' }),
    changeType: text('change_type', {
      enum: [
        'table_added',
        'table_removed',
        'column_added',
        'column_removed',
        'column_type_changed',
        'column_nullability_changed',
      ],
    }).notNull(),
    tableName: text('table_name').notNull(),
    columnName: text('column_name'),
    detailJson: text('detail_json'),
    detectedAt: text('detected_at').notNull(),
  },
  (t) => [index('schema_changes_source_idx').on(t.dataSourceId)],
);

export const tableProfiles = sqliteTable(
  'table_profiles',
  {
    id: text('id').primaryKey(),
    dataSourceId: text('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'cascade' }),
    tableName: text('table_name').notNull(),
    rowCount: integer('row_count'),
    isReferenceTable: integer('is_reference_table', { mode: 'boolean' }).notNull().default(false),
    samplePermissionOverride: text('sample_permission_override', {
      enum: ['allow', 'deny'],
    }),
    profiledAt: text('profiled_at'),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [uniqueIndex('table_profiles_source_table_uidx').on(t.dataSourceId, t.tableName)],
);

export const columnProfiles = sqliteTable(
  'column_profiles',
  {
    id: text('id').primaryKey(),
    tableProfileId: text('table_profile_id')
      .notNull()
      .references(() => tableProfiles.id, { onDelete: 'cascade' }),
    dataSourceId: text('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'cascade' }),
    tableName: text('table_name').notNull(),
    columnName: text('column_name').notNull(),
    dataType: text('data_type').notNull(),
    nullCount: integer('null_count'),
    nullRate: real('null_rate'),
    distinctCount: integer('distinct_count'),
    topValuesJson: text('top_values_json'),
    minValue: text('min_value'),
    maxValue: text('max_value'),
    meanValue: real('mean_value'),
    percentilesJson: text('percentiles_json'),
    stringLengthDistributionJson: text('string_length_distribution_json'),
    piiCandidate: integer('pii_candidate', { mode: 'boolean' }).notNull().default(false),
    piiCandidateReason: text('pii_candidate_reason'),
    profiledAt: text('profiled_at'),
  },
  (t) => [
    uniqueIndex('column_profiles_profile_col_uidx').on(t.tableProfileId, t.columnName),
    index('column_profiles_source_table_idx').on(t.dataSourceId, t.tableName),
  ],
);

export type SchemaChangeType =
  | 'table_added'
  | 'table_removed'
  | 'column_added'
  | 'column_removed'
  | 'column_type_changed'
  | 'column_nullability_changed';
