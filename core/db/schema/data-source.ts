import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspace';

export const dataSources = sqliteTable(
  'data_sources',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    dbType: text('db_type', { enum: ['postgres', 'mssql', 'mysql', 'duckdb'] }).notNull(),
    connectionMode: text('connection_mode', { enum: ['form', 'connection_string'] }).notNull(),
    connectionCredentialsEncrypted: text('connection_credentials_encrypted').notNull(),
    connectionSettingsJson: text('connection_settings_json'),
    status: text('status', { enum: ['active', 'error', 'pending'] }).notNull().default('pending'),
    lastTestedAt: text('last_tested_at'),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [index('data_sources_workspace_idx').on(t.workspaceId)],
);
