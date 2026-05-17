import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { dataSources } from '@/core/db/schema/data-source';
import { workspaces } from '@/core/db/schema/workspace';

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

export const querySessions = sqliteTable(
  'query_sessions',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    dataSourceId: text('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'cascade' }),
    title: text('title'),
    sqlDraft: text('sql_draft').notNull().default(''),
    sqlBaseline: text('sql_baseline'),
    hasUnrevertedAgentEdit: integer('has_unreverted_agent_edit', { mode: 'boolean' }).notNull().default(false),
    lastAgentEditAt: text('last_agent_edit_at'),
    isClosed: integer('is_closed', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [index('query_sessions_workspace_open_idx').on(t.workspaceId, t.isClosed)],
);

export const queryHistory = sqliteTable(
  'query_history',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id').references(() => querySessions.id, { onDelete: 'set null' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    dataSourceId: text('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'cascade' }),
    sqlText: text('sql_text').notNull(),
    sqlHash: text('sql_hash').notNull(),
    rowCount: integer('row_count'),
    durationMs: integer('duration_ms'),
    outcome: text('outcome', {
      enum: ['success', 'blocked_sqlgate', 'blocked_tier', 'error', 'timeout'],
    }).notNull(),
    errorMessage: text('error_message'),
    resultColumnsJson: text('result_columns_json'),
    executedAt: text('executed_at').notNull().default(now),
  },
  (t) => [
    index('query_history_workspace_idx').on(t.workspaceId),
    index('query_history_session_idx').on(t.sessionId),
    index('query_history_executed_idx').on(t.executedAt),
  ],
);

export type QueryHistoryOutcome = 'success' | 'blocked_sqlgate' | 'blocked_tier' | 'error' | 'timeout';
