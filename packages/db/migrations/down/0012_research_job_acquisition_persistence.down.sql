DROP TRIGGER IF EXISTS acquisition_progress_checkpoint_guard ON job_checkpoints;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_acquisition_progress_checkpoint();
--> statement-breakpoint
DROP TRIGGER IF EXISTS acquisition_shards_identity_guard ON acquisition_shards;
--> statement-breakpoint
DROP TRIGGER IF EXISTS research_jobs_identity_guard ON research_jobs;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_research_acquisition_identity();
--> statement-breakpoint
DROP TABLE IF EXISTS acquisition_shards;
--> statement-breakpoint
DROP TABLE IF EXISTS research_jobs;
