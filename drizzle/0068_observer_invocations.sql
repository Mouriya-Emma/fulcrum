CREATE TABLE `observer_invocations` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_message_id` text,
	`channel_type` text NOT NULL,
	`connection_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`sender_name` text,
	`message_preview` text NOT NULL,
	`provider` text NOT NULL,
	`status` text NOT NULL,
	`actions` text,
	`error` text,
	`started_at` text NOT NULL,
	`completed_at` text,
	`created_at` text NOT NULL
);
