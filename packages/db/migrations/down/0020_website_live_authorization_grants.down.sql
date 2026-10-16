ALTER TABLE website_live_inspection_runs
  DROP CONSTRAINT IF EXISTS website_live_runs_owner_grant_fk;
--> statement-breakpoint
DROP TRIGGER IF EXISTS website_live_grants_immutable ON website_live_inspection_grants;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.prevent_website_live_grant_update();
--> statement-breakpoint
DROP TRIGGER IF EXISTS website_live_grants_owner_source_guard ON website_live_inspection_grants;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_website_live_grant();
--> statement-breakpoint
DROP TABLE IF EXISTS website_live_inspection_grants;