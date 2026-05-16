CREATE TABLE `lineage_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`from_model_id` text,
	`to_model_id` text NOT NULL,
	`from_source_ref` text,
	`ref_type` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lineage_edges_uidx` ON `lineage_edges` (`workspace_id`,`from_model_id`,`to_model_id`,`from_source_ref`);--> statement-breakpoint
CREATE INDEX `lineage_edges_to_idx` ON `lineage_edges` (`to_model_id`);--> statement-breakpoint
CREATE TABLE `model_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`triggering_model_id` text,
	`parent_run_id` text,
	`session_id` text,
	`run_scope` text NOT NULL,
	`status` text NOT NULL,
	`models_affected_json` text,
	`started_at` text NOT NULL,
	`finished_at` text,
	`error_message` text,
	`self_heal_attempt` integer DEFAULT 0 NOT NULL,
	`models_total` integer,
	`models_succeeded` integer,
	`models_failed` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`triggering_model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parent_run_id`) REFERENCES `model_runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `model_runs_workspace_idx` ON `model_runs` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `model_runs_session_idx` ON `model_runs` (`session_id`);--> statement-breakpoint
CREATE TABLE `models` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`layer` text NOT NULL,
	`materialization` text DEFAULT 'table' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`file_path` text NOT NULL,
	`description` text,
	`is_dirty` integer DEFAULT false NOT NULL,
	`last_run_status` text,
	`last_run_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `models_workspace_name_uidx` ON `models` (`workspace_id`,`name`);--> statement-breakpoint
CREATE INDEX `models_workspace_layer_idx` ON `models` (`workspace_id`,`layer`);