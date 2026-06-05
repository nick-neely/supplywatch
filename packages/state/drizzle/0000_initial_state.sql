CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_hash` text NOT NULL,
	`event_type` text NOT NULL,
	`product_id` text,
	`payload_json` text NOT NULL,
	`notification_status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_attempt_at` text,
	`notification_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`notified_at` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`stable_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_event_hash_unique` ON `events` (`event_hash`);--> statement-breakpoint
CREATE INDEX `events_notification_status_idx` ON `events` (`notification_status`,`attempt_count`,`created_at`);--> statement-breakpoint
CREATE TABLE `product_overrides` (
	`product_id` text PRIMARY KEY NOT NULL,
	`denylisted` integer DEFAULT false NOT NULL,
	`force_retired` integer DEFAULT false NOT NULL,
	`force_watched` integer DEFAULT false NOT NULL,
	`known_employee_only` integer DEFAULT false NOT NULL,
	`annotation` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`stable_id` text PRIMARY KEY NOT NULL,
	`name` text,
	`url` text,
	`image_url` text,
	`description` text,
	`collection` text,
	`price` text,
	`normalized_snapshot_json` text NOT NULL,
	`raw_fingerprint` text,
	`buyable_state` text NOT NULL,
	`available_sizes_json` text DEFAULT '[]' NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`first_public_at` text,
	`out_of_stock_confirmations` integer DEFAULT 0 NOT NULL,
	`retired_at` text,
	`retirement_reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`product_count` integer DEFAULT 0 NOT NULL,
	`error_message` text
);
