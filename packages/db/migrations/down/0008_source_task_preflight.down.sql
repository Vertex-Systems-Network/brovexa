DROP TRIGGER IF EXISTS source_task_usage_events_append_only ON source_task_usage_events;
--> statement-breakpoint
DROP TABLE IF EXISTS source_task_usage_events;
--> statement-breakpoint
DROP TRIGGER IF EXISTS source_tasks_append_only ON source_tasks;
--> statement-breakpoint
DROP TABLE IF EXISTS source_tasks;
--> statement-breakpoint
DROP TRIGGER IF EXISTS research_job_preflights_append_only ON research_job_preflights;
--> statement-breakpoint
DROP TABLE IF EXISTS research_job_preflights;
--> statement-breakpoint
DROP INDEX IF EXISTS job_work_units_source_task_identity_unique;
--> statement-breakpoint
DROP INDEX IF EXISTS job_runs_source_task_identity_unique;
--> statement-breakpoint
DROP INDEX IF EXISTS source_admission_snapshots_task_identity_unique;