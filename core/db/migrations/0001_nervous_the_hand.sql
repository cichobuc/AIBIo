CREATE TABLE `data_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`db_type` text NOT NULL,
	`connection_mode` text NOT NULL,
	`connection_credentials_encrypted` text NOT NULL,
	`connection_settings_json` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_tested_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `data_sources_workspace_idx` ON `data_sources` (`workspace_id`);