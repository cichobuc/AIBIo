CREATE TABLE `column_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`table_profile_id` text NOT NULL,
	`data_source_id` text NOT NULL,
	`table_name` text NOT NULL,
	`column_name` text NOT NULL,
	`data_type` text NOT NULL,
	`null_count` integer,
	`null_rate` real,
	`distinct_count` integer,
	`top_values_json` text,
	`min_value` text,
	`max_value` text,
	`mean_value` real,
	`percentiles_json` text,
	`string_length_distribution_json` text,
	`pii_candidate` integer DEFAULT false NOT NULL,
	`pii_candidate_reason` text,
	`profiled_at` text,
	FOREIGN KEY (`table_profile_id`) REFERENCES `table_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`data_source_id`) REFERENCES `data_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `column_profiles_profile_col_uidx` ON `column_profiles` (`table_profile_id`,`column_name`);--> statement-breakpoint
CREATE INDEX `column_profiles_source_table_idx` ON `column_profiles` (`data_source_id`,`table_name`);--> statement-breakpoint
CREATE TABLE `schema_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`data_source_id` text NOT NULL,
	`from_snapshot_id` text,
	`to_snapshot_id` text NOT NULL,
	`change_type` text NOT NULL,
	`table_name` text NOT NULL,
	`column_name` text,
	`detail_json` text,
	`detected_at` text NOT NULL,
	FOREIGN KEY (`data_source_id`) REFERENCES `data_sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_snapshot_id`) REFERENCES `schema_snapshots`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`to_snapshot_id`) REFERENCES `schema_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `schema_changes_source_idx` ON `schema_changes` (`data_source_id`);--> statement-breakpoint
CREATE TABLE `schema_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`data_source_id` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`table_count` integer DEFAULT 0 NOT NULL,
	`column_count` integer DEFAULT 0 NOT NULL,
	`taken_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`data_source_id`) REFERENCES `data_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `schema_snapshots_source_idx` ON `schema_snapshots` (`data_source_id`);--> statement-breakpoint
CREATE TABLE `table_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`data_source_id` text NOT NULL,
	`table_name` text NOT NULL,
	`row_count` integer,
	`is_reference_table` integer DEFAULT false NOT NULL,
	`sample_permission_override` text,
	`profiled_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`data_source_id`) REFERENCES `data_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `table_profiles_source_table_uidx` ON `table_profiles` (`data_source_id`,`table_name`);