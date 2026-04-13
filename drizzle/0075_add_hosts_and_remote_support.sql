CREATE TABLE `hosts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`hostname` text NOT NULL,
	`port` integer NOT NULL DEFAULT 22,
	`username` text NOT NULL,
	`auth_method` text NOT NULL DEFAULT 'key',
	`private_key_path` text,
	`default_directory` text,
	`fulcrum_url` text,
	`status` text NOT NULL DEFAULT 'unknown',
	`last_connected_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `host_id` text;--> statement-breakpoint
ALTER TABLE `terminals` ADD `host_id` text;