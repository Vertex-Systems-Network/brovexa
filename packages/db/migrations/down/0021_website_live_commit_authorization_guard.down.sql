DROP TRIGGER IF EXISTS website_live_evidence_active_grant_guard ON website_live_inspection_runs;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_website_live_commit_authorization();