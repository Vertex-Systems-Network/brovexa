DROP TRIGGER IF EXISTS website_live_grant_commit_guard ON website_live_inspection_grants;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_website_live_grant_at_commit();