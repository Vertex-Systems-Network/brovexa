DROP TRIGGER IF EXISTS website_live_evidence_registry_guard ON website_live_inspection_runs;
--> statement-breakpoint
DROP TRIGGER IF EXISTS website_live_grant_registry_guard ON website_live_inspection_grants;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_website_live_current_registry();