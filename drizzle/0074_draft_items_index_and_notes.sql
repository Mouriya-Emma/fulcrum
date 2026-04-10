CREATE INDEX `idx_draft_items_task_id` ON `draft_items`(`task_id`);--> statement-breakpoint
ALTER TABLE `draft_items` ADD `notes` text;
