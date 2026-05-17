-- Add agent-edit tracking columns to query_sessions
ALTER TABLE `query_sessions` ADD COLUMN `sql_baseline` text;
--> statement-breakpoint
ALTER TABLE `query_sessions` ADD COLUMN `has_unreverted_agent_edit` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `query_sessions` ADD COLUMN `last_agent_edit_at` text;
