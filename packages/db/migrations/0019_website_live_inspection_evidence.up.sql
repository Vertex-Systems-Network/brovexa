-- M04-WEB-027: independent live v2 evidence. Never relax migration 0018 test-only guards.
CREATE TABLE website_live_inspection_runs (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  canonical_business_id text NOT NULL,
  domain_verification_id text NOT NULL,
  verification_decision text NOT NULL DEFAULT 'verified',
  verified_domain text NOT NULL,
  target_url text NOT NULL,
  source_key text NOT NULL,
  source_admission_decision_ref text NOT NULL,
  source_policy_id text NOT NULL,
  source_policy_version text NOT NULL,
  transport_policy_id text NOT NULL,
  transport_policy_version text NOT NULL,
  max_response_bytes integer NOT NULL,
  timeout_ms integer NOT NULL,
  receipt_id text NOT NULL UNIQUE,
  remote_ipv4 inet NOT NULL,
  status_code smallint NOT NULL,
  content_type text NOT NULL,
  body_length integer NOT NULL,
  body_sha256 text NOT NULL,
  received_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'review_required',
  coverage text NOT NULL DEFAULT 'partial',
  reason_codes jsonb NOT NULL,
  payload_hash text NOT NULL,
  inspection_version text NOT NULL DEFAULT '2.0.0',
  execution_mode text NOT NULL DEFAULT 'live',
  network_requested boolean NOT NULL DEFAULT true,
  credentialed_fetch_requested boolean NOT NULL DEFAULT false,
  raw_payload_requested boolean NOT NULL DEFAULT false,
  outreach_requested boolean NOT NULL DEFAULT false,
  body_included boolean NOT NULL DEFAULT false,
  retention_ttl_seconds bigint NOT NULL,
  deletion_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_live_identity_fk FOREIGN KEY (canonical_business_id, workspace_id)
    REFERENCES canonical_businesses(id,workspace_id) ON DELETE RESTRICT,
  CONSTRAINT website_live_domain_fk FOREIGN KEY (
    domain_verification_id,workspace_id,canonical_business_id,verified_domain,verification_decision)
    REFERENCES business_domain_verification_decisions(id,workspace_id,canonical_business_id,normalized_domain,decision)
    ON DELETE RESTRICT,
  CONSTRAINT website_live_workspace_unique UNIQUE(id,workspace_id),
  CONSTRAINT website_live_receipt_workspace_unique UNIQUE(id,workspace_id,receipt_id),
  CONSTRAINT website_live_id_check CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  CONSTRAINT website_live_verification_check CHECK (verification_decision='verified'),
  CONSTRAINT website_live_domain_check CHECK (
    verified_domain ~ '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?[.])+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
    AND verified_domain !~ '[.](localhost|local|internal|invalid|test)$'
    AND target_url='https://' || verified_domain || '/'
  ),
  CONSTRAINT website_live_source_check CHECK (
    source_key ~ '^source[.][a-z0-9_.-]+$' AND
    source_policy_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$' AND
    transport_policy_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'
  ),
  CONSTRAINT website_live_budget_check CHECK (
    max_response_bytes BETWEEN 1 AND 1000000 AND timeout_ms BETWEEN 100 AND 30000 AND
    body_length BETWEEN 0 AND max_response_bytes AND status_code=200 AND content_type='text/html'
  ),
  CONSTRAINT website_live_address_check CHECK (
    family(remote_ipv4)=4 AND NOT (
      remote_ipv4 <<= inet '0.0.0.0/8' OR remote_ipv4 <<= inet '10.0.0.0/8' OR
      remote_ipv4 <<= inet '100.64.0.0/10' OR remote_ipv4 <<= inet '127.0.0.0/8' OR
      remote_ipv4 <<= inet '169.254.0.0/16' OR remote_ipv4 <<= inet '172.16.0.0/12' OR
      remote_ipv4 <<= inet '192.0.0.0/24' OR remote_ipv4 <<= inet '192.0.2.0/24' OR
      remote_ipv4 <<= inet '192.88.99.0/24' OR remote_ipv4 <<= inet '192.168.0.0/16' OR
      remote_ipv4 <<= inet '198.18.0.0/15' OR remote_ipv4 <<= inet '198.51.100.0/24' OR
      remote_ipv4 <<= inet '203.0.113.0/24' OR remote_ipv4 <<= inet '224.0.0.0/4' OR
      remote_ipv4 <<= inet '240.0.0.0/4'
    )
  ),
  CONSTRAINT website_live_provenance_check CHECK (
    inspection_version='2.0.0' AND execution_mode='live' AND network_requested AND
    NOT credentialed_fetch_requested AND NOT raw_payload_requested AND
    NOT outreach_requested AND NOT body_included AND status='review_required' AND coverage='partial'
  ),
  CONSTRAINT website_live_hash_check CHECK (
    body_sha256 ~ '^[0-9a-f]{64}$' AND payload_hash ~ '^[0-9a-f]{64}$' AND
    receipt_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'
  ),
  CONSTRAINT website_live_reason_check CHECK (
    jsonb_typeof(reason_codes)='array' AND jsonb_array_length(reason_codes) BETWEEN 1 AND 16
    AND reason_codes ? 'website.single_page_only'
  ),
  CONSTRAINT website_live_lifecycle_check CHECK (
    received_at<=completed_at AND
    completed_at <= received_at + interval '30 seconds' AND
    retention_ttl_seconds BETWEEN 1 AND 31536000 AND deletion_required
  )
);
--> statement-breakpoint
CREATE INDEX website_live_workspace_expiry_idx
  ON website_live_inspection_runs(workspace_id,received_at,id);
--> statement-breakpoint
CREATE TABLE website_live_capability_observations (
  inspection_id text NOT NULL,
  workspace_id uuid NOT NULL,
  receipt_id text,
  capability text NOT NULL,
  observation text NOT NULL,
  reason text NOT NULL,
  confidence double precision,
  evidence_reference_ids jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_live_obs_pk PRIMARY KEY(inspection_id,capability),
  CONSTRAINT website_live_obs_parent_fk FOREIGN KEY (inspection_id,workspace_id)
    REFERENCES website_live_inspection_runs(id,workspace_id) ON DELETE CASCADE,
  CONSTRAINT website_live_obs_receipt_fk FOREIGN KEY (inspection_id,workspace_id,receipt_id)
    REFERENCES website_live_inspection_runs(id,workspace_id,receipt_id) ON DELETE CASCADE,
  CONSTRAINT website_live_obs_kind_check CHECK (
    capability IN ('booking','commerce','contact_form','business_contact',
      'mobile_viewport','structured_data','social_link','https')
  ),
  CONSTRAINT website_live_obs_shape_check CHECK (
    jsonb_typeof(evidence_reference_ids)='array' AND jsonb_array_length(evidence_reference_ids)<=32 AND
    ((observation='unknown' AND reason='insufficient_evidence' AND confidence IS NULL
      AND receipt_id IS NULL AND evidence_reference_ids='[]'::jsonb)
     OR (observation='observed_present' AND reason='detected' AND receipt_id IS NOT NULL
      AND confidence BETWEEN 0 AND 1 AND jsonb_array_length(evidence_reference_ids)>0))
  )
);
--> statement-breakpoint
CREATE INDEX website_live_obs_scope_idx ON website_live_capability_observations(workspace_id,inspection_id);
--> statement-breakpoint
CREATE FUNCTION brovexa_internal.prevent_website_live_evidence_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Live website evidence is immutable; create a new inspection.'
    USING ERRCODE='23514', CONSTRAINT='website_live_immutable_guard';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER website_live_runs_immutable BEFORE UPDATE ON website_live_inspection_runs
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.prevent_website_live_evidence_update();
--> statement-breakpoint
CREATE TRIGGER website_live_observations_immutable BEFORE UPDATE ON website_live_capability_observations
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.prevent_website_live_evidence_update();