-- Add thread_id to chat_messages for multi-turn conversation memory
ALTER TABLE `chat_messages` ADD COLUMN `thread_id` text;
--> statement-breakpoint
UPDATE `chat_messages` SET `thread_id` = `session_id` WHERE `thread_id` IS NULL;
--> statement-breakpoint
CREATE INDEX `chat_messages_thread_idx` ON `chat_messages` (`workspace_id`, `thread_id`, `created_at`);
