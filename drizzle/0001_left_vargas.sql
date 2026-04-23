ALTER TABLE `rounds` ADD `mode` text DEFAULT 'classic' NOT NULL;--> statement-breakpoint
ALTER TABLE `rounds` ADD `tournament` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `rounds` ADD `bot_accuracy` integer;