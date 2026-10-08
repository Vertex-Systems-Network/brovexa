-- Rollback restores the original migration-0015 checks exactly. This can
-- fail if rows written after 0017 contain canonical dotted keys; audit/migrate
-- those rows before rollback. The migration runner applies this file atomically.
ALTER TABLE approved_business_contact_evidence
  DROP CONSTRAINT approved_business_contact_evidence_source_key_check;
--> statement-breakpoint
ALTER TABLE approved_business_contact_evidence
  ADD CONSTRAINT approved_business_contact_evidence_source_key_check
  CHECK (source_key ~ '^source\\.[a-z0-9_.-]+$');
--> statement-breakpoint
ALTER TABLE contact_data_eligibility_decisions
  DROP CONSTRAINT contact_data_eligibility_decisions_connector_key_check;
--> statement-breakpoint
ALTER TABLE contact_data_eligibility_decisions
  ADD CONSTRAINT contact_data_eligibility_decisions_connector_key_check
  CHECK (connector_key ~ '^connector\\.[a-z0-9_.-]+$');
--> statement-breakpoint
ALTER TABLE contact_data_eligibility_decisions
  DROP CONSTRAINT contact_data_eligibility_decisions_source_key_check;
--> statement-breakpoint
ALTER TABLE contact_data_eligibility_decisions
  ADD CONSTRAINT contact_data_eligibility_decisions_source_key_check
  CHECK (source_key ~ '^source\\.[a-z0-9_.-]+$');
--> statement-breakpoint
ALTER TABLE business_domain_evidence
  DROP CONSTRAINT business_domain_evidence_source_key_check;
--> statement-breakpoint
ALTER TABLE business_domain_evidence
  ADD CONSTRAINT business_domain_evidence_source_key_check
  CHECK (source_key ~ '^source\\.[a-z0-9_.-]+$');
