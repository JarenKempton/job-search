CREATE TABLE `application_events` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`kind` text NOT NULL,
	`occurred_on` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_events_application` ON `application_events` (`application_id`,`occurred_on`);--> statement-breakpoint
CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`company` text NOT NULL,
	`role` text NOT NULL,
	`job_url` text,
	`location` text,
	`work_mode` text,
	`employment_type` text,
	`source` text,
	`source_detail` text,
	`apply_method` text,
	`requirements` text DEFAULT '[]' NOT NULL,
	`resume_version` text,
	`salary_min` integer,
	`salary_max` integer,
	`years_required` integer,
	`fit` integer,
	`interest` integer,
	`status` text DEFAULT 'saved' NOT NULL,
	`applied_on` text,
	`heard_back_on` text,
	`follow_up_on` text,
	`contact_name` text,
	`contact_email` text,
	`description` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_applications_status` ON `applications` (`status`);--> statement-breakpoint
CREATE INDEX `idx_applications_applied_on` ON `applications` (`applied_on`);