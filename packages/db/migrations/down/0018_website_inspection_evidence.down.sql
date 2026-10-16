DROP TRIGGER IF EXISTS website_observations_immutable ON website_capability_observations;
--> statement-breakpoint
DROP TRIGGER IF EXISTS website_runs_immutable ON website_inspection_runs;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.prevent_website_evidence_update();
--> statement-breakpoint
DROP TRIGGER IF EXISTS website_runs_assessed_observations_guard ON website_inspection_runs;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_website_assessed_observations();
--> statement-breakpoint
DROP TRIGGER IF EXISTS website_observations_receipt_binding_guard ON website_capability_observations;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_website_observation_receipt();
--> statement-breakpoint
DROP TABLE IF EXISTS website_capability_observations;
--> statement-breakpoint
DROP TABLE IF EXISTS website_inspection_runs;
--> statement-breakpoint
ALTER TABLE business_domain_verification_decisions
  DROP CONSTRAINT IF EXISTS domain_verification_website_binding_unique;
