DROP TRIGGER IF EXISTS contact_data_eligibility_decisions_append_only ON contact_data_eligibility_decisions;
--> statement-breakpoint
DROP TRIGGER IF EXISTS business_domain_verification_decisions_append_only ON business_domain_verification_decisions;
--> statement-breakpoint
DROP TRIGGER IF EXISTS approved_business_contact_evidence_lifecycle_guard ON approved_business_contact_evidence;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_contact_evidence_lifecycle();
--> statement-breakpoint
DROP TRIGGER IF EXISTS business_domain_evidence_lifecycle_guard ON business_domain_evidence;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_domain_evidence_lifecycle();
--> statement-breakpoint
DROP TRIGGER IF EXISTS approved_business_contact_evidence_eligibility_guard ON approved_business_contact_evidence;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_contact_evidence_eligibility();
--> statement-breakpoint
DROP TRIGGER IF EXISTS business_domain_verification_decisions_policy_guard ON business_domain_verification_decisions;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_domain_verification_decision();
--> statement-breakpoint
DROP TABLE IF EXISTS approved_business_contact_evidence;
--> statement-breakpoint
DROP TABLE IF EXISTS contact_data_eligibility_decisions;
--> statement-breakpoint
DROP TABLE IF EXISTS business_domain_verification_decisions;
--> statement-breakpoint
DROP TABLE IF EXISTS business_domain_evidence;