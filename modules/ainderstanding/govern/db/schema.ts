import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { workspaces } from '@/core/db/schema/workspace';
import { dataSources } from '@/core/db/schema/data-source';

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const sourcePermissions = sqliteTable(
  'source_permissions',
  {
    id: text('id').primaryKey(),
    dataSourceId: text('data_source_id')
      .notNull()
      .unique()
      .references(() => dataSources.id, { onDelete: 'cascade' }),
    permissionTier: text('permission_tier', {
      enum: ['metadata_only', 'with_reference_samples', 'with_full_samples', 'with_query_results'],
    })
      .notNull()
      .default('metadata_only'),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
);

export const tablePermissions = sqliteTable(
  'table_permissions',
  {
    id: text('id').primaryKey(),
    dataSourceId: text('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'cascade' }),
    tableName: text('table_name').notNull(),
    permissionOverride: text('permission_override', {
      enum: ['metadata_only', 'with_reference_samples', 'with_full_samples', 'with_query_results'],
    }),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [uniqueIndex('table_permissions_source_table_uidx').on(t.dataSourceId, t.tableName)],
);

export const columnPermissions = sqliteTable(
  'column_permissions',
  {
    id: text('id').primaryKey(),
    dataSourceId: text('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'cascade' }),
    tableName: text('table_name').notNull(),
    columnName: text('column_name').notNull(),
    piiClassification: text('pii_classification', {
      enum: ['none', 'pii', 'sensitive'],
    }),
    piiSubtype: text('pii_subtype', {
      enum: ['email', 'phone', 'national_id', 'address', 'ip', 'name', 'date_of_birth', 'iban', 'other'],
    }),
    setBy: text('set_by', { enum: ['user', 'heuristic'] }).notNull(),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [
    uniqueIndex('column_permissions_source_table_col_uidx').on(
      t.dataSourceId,
      t.tableName,
      t.columnName,
    ),
  ],
);

export const approvalSettings = sqliteTable('approval_settings', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  defaultPermissionTierNewSource: text('default_permission_tier_new_source', {
    enum: ['metadata_only', 'with_reference_samples', 'with_full_samples', 'with_query_results'],
  })
    .notNull()
    .default('metadata_only'),
  policyExecuteQuery: text('policy_execute_query', {
    enum: ['always_ask', 'never_ask', 'threshold_based'],
  })
    .notNull()
    .default('always_ask'),
  policyShareResults: text('policy_share_results', {
    enum: ['always_ask', 'never_ask', 'auto_reference'],
  })
    .notNull()
    .default('always_ask'),
  policyWriteToDocs: text('policy_write_to_docs', {
    enum: ['always_ask', 'threshold_based', 'never_ask'],
  })
    .notNull()
    .default('threshold_based'),
  policySchemaIntrospect: text('policy_schema_introspect', {
    enum: ['never_ask', 'always_ask'],
  })
    .notNull()
    .default('never_ask'),
  approvalTimeoutSec: integer('approval_timeout_sec').notNull().default(300),
  queryResultsMaxRows: integer('query_results_max_rows').notNull().default(1000),
  createdAt: text('created_at').notNull().default(now),
  updatedAt: text('updated_at').notNull().default(now),
});

export const auditEntries = sqliteTable(
  'audit_entries',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    dataSourceId: text('data_source_id').references(() => dataSources.id, { onDelete: 'set null' }),
    sessionId: text('session_id').notNull(),
    agentName: text('agent_name').notNull(),
    actionType: text('action_type', {
      enum: ['read_schema', 'read_sample', 'run_query', 'share_results', 'write_doc', 'write_model', 'write_test'],
    }).notNull(),
    tableName: text('table_name'),
    columnNamesJson: text('column_names_json'),
    sqlHash: text('sql_hash'),
    outcome: text('outcome', {
      enum: ['allowed', 'blocked', 'approval_granted', 'approval_denied', 'timeout'],
    }).notNull(),
    detailJson: text('detail_json'),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [
    index('audit_entries_workspace_idx').on(t.workspaceId),
    index('audit_entries_session_idx').on(t.sessionId),
    index('audit_entries_created_idx').on(t.createdAt),
  ],
);

export type PermissionTierValue =
  | 'metadata_only'
  | 'with_reference_samples'
  | 'with_full_samples'
  | 'with_query_results';

export type AuditActionType =
  | 'read_schema'
  | 'read_sample'
  | 'run_query'
  | 'share_results'
  | 'write_doc'
  | 'write_model'
  | 'write_test';

export type AuditOutcome = 'allowed' | 'blocked' | 'approval_granted' | 'approval_denied' | 'timeout';
