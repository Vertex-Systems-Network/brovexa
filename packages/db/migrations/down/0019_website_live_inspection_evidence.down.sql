DROP TRIGGER IF EXISTS website_live_observations_immutable ON website_live_capability_observations;
--> statement-breakpoint
DROP TRIGGER IF EXISTS website_live_runs_immutable ON website_live_inspection_runs;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.prevent_website_live_evidence_update();
--> statement-breakpoint
DROP TABLE IF EXISTS website_live_capability_observations;
--> statement-breakpoint
DROP TABLE IF EXISTS website_live_inspection_runs;