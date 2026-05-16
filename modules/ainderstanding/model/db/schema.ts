import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { workspaces } from '@/core/db/schema/workspace';

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const models = sqliteTable(
  'models',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    layer: text('layer', { enum: ['staging', 'intermediate', 'marts'] }).notNull(),
    materialization: text('materialization', { enum: ['table', 'view'] })
      .notNull()
      .default('table'),
    status: text('status', { enum: ['draft', 'active', 'archived'] })
      .notNull()
      .default('draft'),
    filePath: text('file_path').notNull(),
    description: text('description'),
    isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(false),
    lastRunStatus: text('last_run_status', {
      enum: ['success', 'failed', 'approval_denied'],
    }),
    lastRunAt: text('last_run_at'),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [
    uniqueIndex('models_workspace_name_uidx').on(t.workspaceId, t.name),
    index('models_workspace_layer_idx').on(t.workspaceId, t.layer),
  ],
);

export const modelRuns = sqliteTable(
  'model_runs',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    triggeringModelId: text('triggering_model_id').references(() => models.id, {
      onDelete: 'set null',
    }),
    parentRunId: text('parent_run_id').references(
      (): AnySQLiteColumn => modelRuns.id,
      { onDelete: 'set null' },
    ),
    sessionId: text('session_id'),
    runScope: text('run_scope', { enum: ['single', 'all'] }).notNull(),
    status: text('status', {
      enum: ['pending', 'running', 'success', 'failed', 'approval_denied'],
    }).notNull(),
    modelsAffectedJson: text('models_affected_json'),
    startedAt: text('started_at').notNull(),
    finishedAt: text('finished_at'),
    errorMessage: text('error_message'),
    selfHealAttempt: integer('self_heal_attempt').notNull().default(0),
    modelsTotal: integer('models_total'),
    modelsSucceeded: integer('models_succeeded'),
    modelsFailed: integer('models_failed'),
  },
  (t) => [
    index('model_runs_workspace_idx').on(t.workspaceId),
    index('model_runs_session_idx').on(t.sessionId),
  ],
);

export const lineageEdges = sqliteTable(
  'lineage_edges',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    fromModelId: text('from_model_id').references(() => models.id, {
      onDelete: 'cascade',
    }),
    toModelId: text('to_model_id')
      .notNull()
      .references(() => models.id, { onDelete: 'cascade' }),
    fromSourceRef: text('from_source_ref'),
    refType: text('ref_type', { enum: ['model_ref', 'source_ref'] }).notNull(),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [
    uniqueIndex('lineage_edges_uidx').on(
      t.workspaceId,
      t.fromModelId,
      t.toModelId,
      t.fromSourceRef,
    ),
    index('lineage_edges_to_idx').on(t.toModelId),
  ],
);

export type ModelLayer = 'staging' | 'intermediate' | 'marts';
export type ModelMaterialization = 'table' | 'view';
export type ModelStatus = 'draft' | 'active' | 'archived';
export type ModelRunStatus = 'pending' | 'running' | 'success' | 'failed' | 'approval_denied';
export type ModelRunScope = 'single' | 'all';
export type LineageRefType = 'model_ref' | 'source_ref';

export type Model = typeof models.$inferSelect;
export type ModelInsert = typeof models.$inferInsert;
export type ModelRun = typeof modelRuns.$inferSelect;
export type ModelRunInsert = typeof modelRuns.$inferInsert;
export type LineageEdge = typeof lineageEdges.$inferSelect;
