CREATE TABLE `workspace_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`query_timeout_sec` integer DEFAULT 30 NOT NULL,
	`auto_profile_on_source_add` integer DEFAULT true NOT NULL,
	`profile_sample_threshold_rows` integer DEFAULT 1000000 NOT NULL,
	`top_values_per_column` integer DEFAULT 10 NOT NULL,
	`schema_change_auto_detect` integer DEFAULT true NOT NULL,
	`pii_heuristics_enabled` integer DEFAULT true NOT NULL,
	`self_heal_max_retries` integer DEFAULT 3 NOT NULL,
	`parallel_build_concurrency` integer DEFAULT 4 NOT NULL,
	`auto_run_tests_after_materialize` integer DEFAULT true NOT NULL,
	`ai_test_generation_enabled` integer DEFAULT true NOT NULL,
	`test_execution_timeout_sec` integer DEFAULT 30 NOT NULL,
	`failing_pk_samples_count` integer DEFAULT 5 NOT NULL,
	`test_parallel_concurrency` integer DEFAULT 8 NOT NULL,
	`auto_write_docs` integer DEFAULT true NOT NULL,
	`doc_verbosity` text DEFAULT 'standard' NOT NULL,
	`doc_confidence_threshold` text DEFAULT 'high' NOT NULL,
	`include_sample_data_in_docs` integer DEFAULT false NOT NULL,
	`show_tool_calls` integer DEFAULT true NOT NULL,
	`max_supervisor_turns` integer DEFAULT 20 NOT NULL,
	`session_timeout_min` integer DEFAULT 60 NOT NULL,
	`chat_history_retention_count` integer DEFAULT 100 NOT NULL,
	`max_session_tokens` integer DEFAULT 100000 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_settings_workspace_id_unique` ON `workspace_settings` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`ai_mode` text DEFAULT 'auto' NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`agent_name` text,
	`active_module` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_messages_workspace_session_idx` ON `chat_messages` (`workspace_id`,`session_id`,`created_at`);