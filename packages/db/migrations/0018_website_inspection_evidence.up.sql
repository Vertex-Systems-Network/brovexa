-- M04-WEB-002: verified website inspection evidence. No HTML bodies, credentials
-- or active network transport are persisted by this schema.
ALTER TABLE business_domain_verification_decisions
  ADD CONSTRAINT domain_verification_website_binding_unique
  UNIQUE (id, workspace_id, canonical_business_id, normalized_domain, decision);
--> statement-breakpoint
CREATE TABLE website_inspection_runs (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  canonical_business_id text NOT NULL,
  domain_verification_id text NOT NULL,
  verification_decision text NOT NULL DEFAULT 'verified',
  verified_domain text NOT NULL,
  target_url text NOT NULL,
  source_key text NOT NULL,
  source_admission_decision_ref text NOT NULL,
  source_admission_decision text NOT NULL DEFAULT 'allow',
  source_policy_id text NOT NULL,
  source_policy_version text NOT NULL,
  transport_policy_id text NOT NULL,
  transport_policy_version text NOT NULL,
  max_pages smallint NOT NULL,
  max_response_bytes integer NOT NULL,
  timeout_ms integer NOT NULL,
  inspection_version text NOT NULL DEFAULT '1.0.0',
  status text NOT NULL,
  coverage text NOT NULL,
  transport_receipt_ids jsonb NOT NULL,
  reason_codes jsonb NOT NULL,
  payload_hash text NOT NULL,
  body_included boolean NOT NULL DEFAULT false,
  network_requested boolean NOT NULL DEFAULT false,
  credentialed_fetch_requested boolean NOT NULL DEFAULT false,
  outreach_requested boolean NOT NULL DEFAULT false,
  retention_ttl_seconds bigint NOT NULL,
  deletion_required boolean NOT NULL,
  requested_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_runs_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT website_runs_id_workspace_coverage_unique UNIQUE (id, workspace_id, coverage),
  CONSTRAINT website_runs_business_fk FOREIGN KEY (canonical_business_id, workspace_id)
    REFERENCES canonical_businesses (id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT website_runs_verified_domain_fk
    FOREIGN KEY (domain_verification_id, workspace_id, canonical_business_id, verified_domain, verification_decision)
    REFERENCES business_domain_verification_decisions
      (id, workspace_id, canonical_business_id, normalized_domain, decision) ON DELETE RESTRICT,
  CONSTRAINT website_runs_id_check CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  CONSTRAINT website_runs_verified_check CHECK (verification_decision = 'verified'),
  CONSTRAINT website_runs_domain_check CHECK (
    verified_domain ~ '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?[.])+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
    AND verified_domain !~ '^[0-9]+([.][0-9]+){3}$'
    AND verified_domain !~ '[.](localhost|local|internal|invalid|test)$'
  ),
  CONSTRAINT website_runs_url_check CHECK (target_url = 'https://' || verified_domain || '/'),
  CONSTRAINT website_runs_source_check CHECK (source_key ~ '^source[.][a-z0-9_.-]+$'
    AND source_admission_decision = 'allow'),
  CONSTRAINT website_runs_budget_check CHECK (
    max_pages BETWEEN 1 AND 5 AND max_response_bytes BETWEEN 1 AND 1000000
    AND timeout_ms BETWEEN 100 AND 30000
  ),
  CONSTRAINT website_runs_versions_check CHECK (source_policy_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'
    AND transport_policy_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'
    AND inspection_version = '1.0.0'),
  CONSTRAINT website_runs_result_check CHECK (
    status IN ('assessed','review_required','unavailable')
    AND coverage IN ('none','partial','bounded')
    AND jsonb_typeof(transport_receipt_ids) = 'array'
    AND jsonb_array_length(transport_receipt_ids) <= 5
    AND jsonb_typeof(reason_codes) = 'array'
    AND jsonb_array_length(reason_codes) <= 16
    AND ((coverage = 'none' AND jsonb_array_length(transport_receipt_ids) = 0)
      OR (coverage <> 'none' AND jsonb_array_length(transport_receipt_ids) > 0))
    AND (status <> 'assessed' OR (coverage = 'bounded' AND reason_codes = '[]'::jsonb))
    AND (status <> 'unavailable' OR (coverage = 'none' AND jsonb_array_length(reason_codes) > 0))
  ),
  CONSTRAINT website_runs_safety_check CHECK (
    NOT body_included AND NOT network_requested AND NOT credentialed_fetch_requested AND NOT outreach_requested
  ),
  CONSTRAINT website_runs_time_check CHECK (completed_at >= requested_at),
  CONSTRAINT website_runs_retention_check CHECK (
    retention_ttl_seconds BETWEEN 1 AND 31536000 AND deletion_required
  ),
  CONSTRAINT website_runs_payload_hash_check CHECK (payload_hash ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE INDEX website_runs_workspace_business_idx
  ON website_inspection_runs (workspace_id, canonical_business_id, completed_at DESC, id);
--> statement-breakpoint
CREATE TABLE website_capability_observations (
  inspection_id text NOT NULL,
  workspace_id uuid NOT NULL,
  coverage text NOT NULL,
  capability text NOT NULL,
  observation text NOT NULL,
  reason text NOT NULL,
  confidence double precision,
  evidence_reference_ids jsonb NOT NULL,
  transport_receipt_ids jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_capability_observations_pk PRIMARY KEY (inspection_id, capability),
  CONSTRAINT website_observations_inspection_fk
    FOREIGN KEY (inspection_id, workspace_id, coverage)
    REFERENCES website_inspection_runs (id, workspace_id, coverage) ON DELETE CASCADE,
  CONSTRAINT website_observations_capability_check CHECK (
    capability IN ('booking','commerce','contact_form','business_contact',
      'mobile_viewport','structured_data','social_link','https')
  ),
  CONSTRAINT website_observations_shape_check CHECK (
    observation IN ('observed_present','not_detected','unknown')
    AND jsonb_typeof(evidence_reference_ids) = 'array'
    AND jsonb_array_length(evidence_reference_ids) <= 32
    AND jsonb_typeof(transport_receipt_ids) = 'array'
    AND jsonb_array_length(transport_receipt_ids) <= 5
    AND (
      (observation = 'unknown' AND reason = 'insufficient_evidence' AND confidence IS NULL
        AND evidence_reference_ids = '[]'::jsonb AND transport_receipt_ids = '[]'::jsonb)
      OR
      (observation = 'observed_present' AND reason = 'detected'
        AND confidence BETWEEN 0 AND 1
        AND jsonb_array_length(evidence_reference_ids) > 0
        AND jsonb_array_length(transport_receipt_ids) > 0)
      OR
      (observation = 'not_detected' AND reason = 'not_detected_with_bounded_coverage'
        AND coverage = 'bounded'
        AND confidence BETWEEN 0 AND 1
        AND jsonb_array_length(evidence_reference_ids) > 0
        AND jsonb_array_length(transport_receipt_ids) > 0)
    )
  )
);
--> statement-breakpoint
CREATE INDEX website_observations_workspace_idx
  ON website_capability_observations (workspace_id, inspection_id, capability);
--> statement-breakpoint
CREATE FUNCTION brovexa_internal.guard_website_observation_receipt()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_receipts jsonb;
BEGIN
  SELECT transport_receipt_ids INTO parent_receipts
    FROM website_inspection_runs
    WHERE id = NEW.inspection_id AND workspace_id = NEW.workspace_id;
  IF NOT FOUND OR EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(NEW.transport_receipt_ids) AS receipt(id)
      WHERE NOT (parent_receipts ? receipt.id)
  ) THEN
    RAISE EXCEPTION 'Website observation receipts must belong to the same inspection and workspace.'
      USING ERRCODE = '23514', CONSTRAINT = 'website_observations_receipt_binding_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER website_observations_receipt_binding_guard
  BEFORE INSERT OR UPDATE ON website_capability_observations
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_website_observation_receipt();
--> statement-breakpoint
CREATE FUNCTION brovexa_internal.guard_website_assessed_observations()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'assessed' AND (
    NOT EXISTS (
      SELECT 1 FROM website_capability_observations
      WHERE inspection_id = NEW.id AND workspace_id = NEW.workspace_id
    ) OR EXISTS (
      SELECT 1 FROM website_capability_observations
      WHERE inspection_id = NEW.id AND workspace_id = NEW.workspace_id AND observation = 'unknown'
    )
  ) THEN
    RAISE EXCEPTION 'Assessed website inspection requires at least one fully evidenced known observation.'
      USING ERRCODE = '23514', CONSTRAINT = 'website_runs_assessed_observations_guard';
  END IF;
  IF NEW.status = 'review_required' AND NEW.coverage = 'bounded'
     AND NEW.reason_codes = '[]'::jsonb
     AND EXISTS (SELECT 1 FROM website_capability_observations
       WHERE inspection_id = NEW.id AND workspace_id = NEW.workspace_id)
     AND NOT EXISTS (SELECT 1 FROM website_capability_observations
       WHERE inspection_id = NEW.id AND workspace_id = NEW.workspace_id
         AND observation = 'unknown') THEN
    RAISE EXCEPTION 'Review-required evidence must retain uncertainty.'
      USING ERRCODE = '23514', CONSTRAINT = 'website_runs_review_reason_guard';
  END IF;
  RETURN NEW;
END;
$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER website_runs_assessed_observations_guard
  AFTER INSERT ON website_inspection_runs
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_website_assessed_observations();
--> statement-breakpoint
CREATE FUNCTION brovexa_internal.prevent_website_evidence_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Website inspection evidence is immutable; create a new inspection revision.'
    USING ERRCODE = '23514', CONSTRAINT = 'website_inspection_evidence_immutable_guard';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER website_runs_immutable
  BEFORE UPDATE ON website_inspection_runs
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.prevent_website_evidence_update();
--> statement-breakpoint
CREATE TRIGGER website_observations_immutable
  BEFORE UPDATE ON website_capability_observations
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.prevent_website_evidence_update();
