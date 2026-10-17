DROP TRIGGER IF EXISTS website_live_evidence_current_domain_guard ON website_live_inspection_runs;
--> statement-breakpoint
DROP TRIGGER IF EXISTS website_live_grant_current_domain_guard ON website_live_inspection_grants;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_website_live_current_domain_decision();
--> statement-breakpoint
DROP TRIGGER IF EXISTS website_live_domain_decision_insert_lock ON business_domain_verification_decisions;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.lock_website_live_domain_decision_insert();
