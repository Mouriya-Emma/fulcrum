CREATE TABLE `draft_items` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`title` text NOT NULL,
	`completed` integer DEFAULT false,
	`issue_url` text,
	`issue_number` integer,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
