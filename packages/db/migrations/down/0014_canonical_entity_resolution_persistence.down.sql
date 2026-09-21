DROP TRIGGER IF EXISTS canonical_business_lineage_operations_evidence_guard ON canonical_business_lineage_operations;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_lineage_evidence();
--> statement-breakpoint
DROP TRIGGER IF EXISTS canonical_businesses_origin_guard ON canonical_businesses;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_canonical_business_origin();
--> statement-breakpoint
DROP TRIGGER IF EXISTS business_resolution_decisions_policy_guard ON business_resolution_decisions;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_resolution_decision_policy();
--> statement-breakpoint
DROP TRIGGER IF EXISTS candidate_business_match_evidence_provenance_guard ON candidate_business_match_evidence;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_candidate_match_evidence_provenance();
--> statement-breakpoint
DROP TRIGGER IF EXISTS canonical_business_lineage_operations_append_only ON canonical_business_lineage_operations;
--> statement-breakpoint
DROP TRIGGER IF EXISTS canonical_business_aliases_append_only ON canonical_business_aliases;
--> statement-breakpoint
DROP TRIGGER IF EXISTS business_resolution_decisions_append_only ON business_resolution_decisions;
--> statement-breakpoint
DROP TRIGGER IF EXISTS candidate_business_match_evidence_append_only ON candidate_business_match_evidence;
--> statement-breakpoint
DROP TRIGGER IF EXISTS source_business_observations_append_only ON source_business_observations;
--> statement-breakpoint
DROP TRIGGER IF EXISTS canonical_business_aliases_binding_guard ON canonical_business_aliases;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_canonical_business_alias_binding();
--> statement-breakpoint
DROP TRIGGER IF EXISTS canonical_businesses_supersession_guard ON canonical_businesses;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_canonical_business_supersession();
--> statement-breakpoint
DROP TABLE IF EXISTS canonical_business_lineage_operations;
--> statement-breakpoint
DROP TABLE IF EXISTS canonical_business_aliases;
--> statement-breakpoint
DROP TABLE IF EXISTS business_resolution_decisions;
--> statement-breakpoint
DROP TABLE IF EXISTS candidate_business_match_evidence;
--> statement-breakpoint
DROP TABLE IF EXISTS source_business_observations;
--> statement-breakpoint
DROP TABLE IF EXISTS canonical_businesses;
