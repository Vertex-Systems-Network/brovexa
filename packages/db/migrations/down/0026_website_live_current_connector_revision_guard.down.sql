DROP TRIGGER IF EXISTS website_live_evidence_current_connector_revision_guard ON website_live_inspection_runs;
--> statement-breakpoint
DROP TRIGGER IF EXISTS website_live_grant_current_connector_revision_guard ON website_live_inspection_grants;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_website_live_current_connector_revision();
--> statement-breakpoint
DROP TRIGGER IF EXISTS website_live_connector_revision_insert_lock ON connector_definitions;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.lock_website_live_connector_revision_insert();
