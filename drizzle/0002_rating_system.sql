ALTER TABLE `user` ADD `rating` integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `rank` text DEFAULT 'Silver' NOT NULL;--> statement-breakpoint
ALTER TABLE `rounds` ADD `rating_processed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `rounds` ADD `rated` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE `rating_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`round_id` text NOT NULL,
	`old_rating` integer NOT NULL,
	`new_rating` integer NOT NULL,
	`change` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade
);
