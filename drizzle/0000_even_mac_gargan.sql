CREATE TABLE `achievements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`achieved_on` text NOT NULL,
	`started_on` text,
	`finished_on` text,
	`category` text NOT NULL,
	`custom_category` text,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`importance` text DEFAULT 'normal' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_achievements_user_date` ON `achievements` (`user_id`,`achieved_on`);--> statement-breakpoint
CREATE INDEX `idx_achievements_user_category` ON `achievements` (`user_id`,`category`);