import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  aiMode: text('ai_mode').notNull().default('auto'),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const workspaceSettings = sqliteTable('workspace_settings', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  // Query / explore
  queryTimeoutSec: integer('query_timeout_sec').notNull().default(30),
  autoProfileOnSourceAdd: integer('auto_profile_on_source_add', { mode: 'boolean' })
    .notNull()
    .default(true),
  profileSampleThresholdRows: integer('profile_sample_threshold_rows').notNull().default(1_000_000),
  topValuesPerColumn: integer('top_values_per_column').notNull().default(10),
  schemaChangeAutoDetect: integer('schema_change_auto_detect', { mode: 'boolean' })
    .notNull()
    .default(true),
  piiHeuristicsEnabled: integer('pii_heuristics_enabled', { mode: 'boolean' })
    .notNull()
    .default(true),
  // Model / test
  selfHealMaxRetries: integer('self_heal_max_retries').notNull().default(3),
  parallelBuildConcurrency: integer('parallel_build_concurrency').notNull().default(4),
  autoRunTestsAfterMaterialize: integer('auto_run_tests_after_materialize', { mode: 'boolean' })
    .notNull()
    .default(true),
  aiTestGenerationEnabled: integer('ai_test_generation_enabled', { mode: 'boolean' })
    .notNull()
    .default(true),
  testExecutionTimeoutSec: integer('test_execution_timeout_sec').notNull().default(30),
  failingPkSamplesCount: integer('failing_pk_samples_count').notNull().default(5),
  testParallelConcurrency: integer('test_parallel_concurrency').notNull().default(8),
  // Document
  autoWriteDocs: integer('auto_write_docs', { mode: 'boolean' }).notNull().default(true),
  docVerbosity: text('doc_verbosity').notNull().default('standard'),
  docConfidenceThreshold: text('doc_confidence_threshold').notNull().default('high'),
  includeSampleDataInDocs: integer('include_sample_data_in_docs', { mode: 'boolean' })
    .notNull()
    .default(false),
  // Shell / session
  showToolCalls: integer('show_tool_calls', { mode: 'boolean' }).notNull().default(true),
  maxSupervisorTurns: integer('max_supervisor_turns').notNull().default(20),
  sessionTimeoutMin: integer('session_timeout_min').notNull().default(60),
  chatHistoryRetentionCount: integer('chat_history_retention_count').notNull().default(100),
  maxSessionTokens: integer('max_session_tokens').notNull().default(100_000),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString())
    .$onUpdateFn(() => new Date().toISOString()),
});
