CREATE TABLE `approval_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`default_permission_tier_new_source` text DEFAULT 'metadata_only' NOT NULL,
	`policy_execute_query` text DEFAULT 'always_ask' NOT NULL,
	`policy_share_results` text DEFAULT 'always_ask' NOT NULL,
	`policy_write_to_docs` text DEFAULT 'threshold_based' NOT NULL,
	`policy_schema_introspect` text DEFAULT 'never_ask' NOT NULL,
	`approval_timeout_sec` integer DEFAULT 300 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `approval_settings_workspace_id_unique` ON `approval_settings` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `audit_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`data_source_id` text,
	`session_id` text NOT NULL,
	`agent_name` text NOT NULL,
	`action_type` text NOT NULL,
	`table_name` text,
	`column_names_json` text,
	`sql_hash` text,
	`outcome` text NOT NULL,
	`detail_json` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`data_source_id`) REFERENCES `data_sources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_entries_workspace_idx` ON `audit_entries` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `audit_entries_session_idx` ON `audit_entries` (`session_id`);--> statement-breakpoint
CREATE INDEX `audit_entries_created_idx` ON `audit_entries` (`created_at`);--> statement-breakpoint
CREATE TABLE `column_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`data_source_id` text NOT NULL,
	`table_name` text NOT NULL,
	`column_name` text NOT NULL,
	`pii_classification` text,
	`pii_subtype` text,
	`set_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`data_source_id`) REFERENCES `data_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `column_permissions_source_table_col_uidx` ON `column_permissions` (`data_source_id`,`table_name`,`column_name`);--> statement-breakpoint
CREATE TABLE `source_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`data_source_id` text NOT NULL,
	`permission_tier` text DEFAULT 'metadata_only' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`data_source_id`) REFERENCES `data_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_permissions_data_source_id_unique` ON `source_permissions` (`data_source_id`);--> statement-breakpoint
CREATE TABLE `table_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`data_source_id` text NOT NULL,
	`table_name` text NOT NULL,
	`permission_override` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`data_source_id`) REFERENCES `data_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `table_permissions_source_table_uidx` ON `table_permissions` (`data_source_id`,`table_name`);