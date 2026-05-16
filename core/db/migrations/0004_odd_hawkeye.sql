CREATE TABLE `query_history` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`workspace_id` text NOT NULL,
	`data_source_id` text NOT NULL,
	`sql_text` text NOT NULL,
	`sql_hash` text NOT NULL,
	`row_count` integer,
	`duration_ms` integer,
	`outcome` text NOT NULL,
	`error_message` text,
	`result_columns_json` text,
	`executed_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `query_sessions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`data_source_id`) REFERENCES `data_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `query_history_workspace_idx` ON `query_history` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `query_history_session_idx` ON `query_history` (`session_id`);--> statement-breakpoint
CREATE INDEX `query_history_executed_idx` ON `query_history` (`executed_at`);--> statement-breakpoint
CREATE TABLE `query_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`data_source_id` text NOT NULL,
	`title` text,
	`sql_draft` text DEFAULT '' NOT NULL,
	`is_closed` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`data_source_id`) REFERENCES `data_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `query_sessions_workspace_open_idx` ON `query_sessions` (`workspace_id`,`is_closed`);--> statement-breakpoint
ALTER TABLE `approval_settings` ADD `query_results_max_rows` integer DEFAULT 1000 NOT NULL;