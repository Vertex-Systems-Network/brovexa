DROP TRIGGER IF EXISTS research_job_controls_terminal_propagation ON research_job_controls;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.propagate_research_job_terminal_control();
--> statement-breakpoint
DROP TRIGGER IF EXISTS acquisition_work_claim_guard ON job_work_units;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_acquisition_work_claim();
--> statement-breakpoint
DROP TRIGGER IF EXISTS acquisition_shards_control_guard ON acquisition_shards;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_acquisition_shard_control();
--> statement-breakpoint
DROP TRIGGER IF EXISTS research_job_controls_update_guard ON research_job_controls;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_research_job_control_update();
--> statement-breakpoint
DROP TRIGGER IF EXISTS research_jobs_control_default ON research_jobs;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.ensure_research_job_control();
--> statement-breakpoint
DROP TABLE IF EXISTS research_job_controls;
