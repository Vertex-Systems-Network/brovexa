-- M04-WEB-035: short-lived, owner-approved live website inspection grants.
-- This is an authorization record, not a web fetch or permission to store HTML.
-- Grants are never derived from a queue work payload.
CREATE TABLE website_live_inspection_grants (
  inspection_id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  canonical_business_id text NOT NULL,
  domain_verification_id text NOT NULL,
  verified_domain text NOT NULL,
  verification_decision text NOT NULL DEFAULT 'verified',
  source_admission_decision_ref text NOT NULL,
  source_key text NOT NULL,
  source_policy_id text NOT NULL,
  source_policy_version text NOT NULL,
  transport_policy_id text NOT NULL,
  transport_policy_version text NOT NULL,
  target_url text NOT NULL,
  max_response_bytes integer NOT NULL,
  timeout_ms integer NOT NULL,
  retention_ttl_seconds integer NOT NULL,
  m02_transport_policy jsonb NOT NULL,
  approved_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_by_membership_id uuid NOT NULL REFERENCES workspace_memberships(id) ON DELETE RESTRICT,
  approved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  grant_hash text NOT NULL,
  CONSTRAINT website_live_grants_scope_unique UNIQUE (inspection_id,workspace_id),
  CONSTRAINT website_live_grants_domain_fk FOREIGN KEY (
    domain_verification_id,workspace_id,canonical_business_id,verified_domain,verification_decision
  ) REFERENCES business_domain_verification_decisions (
    id,workspace_id,canonical_business_id,normalized_domain,decision
  ) ON DELETE RESTRICT,
  CONSTRAINT website_live_grants_source_fk FOREIGN KEY (source_admission_decision_ref,workspace_id)
    REFERENCES source_admission_snapshots(id,workspace_id) ON DELETE RESTRICT,
  CONSTRAINT website_live_grants_identity_check CHECK (
    inspection_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$' AND
    source_key ~ '^source[.][a-z0-9_.-]+$' AND
    verification_decision='verified' AND
    verified_domain ~ '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?[.])+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$' AND
    verified_domain !~ '[.](localhost|local|internal|invalid|test)$' AND
    target_url='https://' || verified_domain || '/'
  ),
  CONSTRAINT website_live_grants_policy_check CHECK (
    source_policy_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$' AND
    transport_policy_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$' AND
    jsonb_typeof(m02_transport_policy)='object' AND
    m02_transport_policy->>'transportPolicyId'=transport_policy_id AND
    m02_transport_policy->>'transportPolicyVersion'=transport_policy_version AND
    m02_transport_policy->>'networkMode'='provider_network'
  ),
  CONSTRAINT website_live_grants_bounds_check CHECK (
    max_response_bytes BETWEEN 1 AND 1000000 AND timeout_ms BETWEEN 100 AND 30000 AND
    retention_ttl_seconds BETWEEN 1 AND 31536000 AND
    expires_at > approved_at AND expires_at <= approved_at + interval '5 minutes' AND
    grant_hash ~ '^[0-9a-f]{64}$'
  )
);
--> statement-breakpoint
CREATE INDEX website_live_grants_workspace_expiry_idx
  ON website_live_inspection_grants(workspace_id,expires_at,inspection_id);
--> statement-breakpoint
CREATE FUNCTION brovexa_internal.guard_website_live_grant()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workspace_memberships wm
      JOIN users u ON u.id=wm.user_id
      JOIN workspaces w ON w.id=wm.workspace_id
      JOIN workspace_membership_roles wmr
        ON wmr.membership_id=wm.id AND wmr.workspace_id=wm.workspace_id
      JOIN workspace_roles wr
        ON wr.id=wmr.role_id AND wr.workspace_id=wm.workspace_id
    WHERE wm.id=NEW.approved_by_membership_id AND wm.user_id=NEW.approved_by_user_id
      AND wm.workspace_id=NEW.workspace_id AND wm.status='active'
      AND u.status='active' AND w.status='active' AND wr.kind='owner'
  ) THEN
    RAISE EXCEPTION 'Live website inspection requires an active workspace owner approval.'
      USING ERRCODE='23514',CONSTRAINT='website_live_grant_owner_guard';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM source_admission_snapshots s
    WHERE s.id=NEW.source_admission_decision_ref AND s.workspace_id=NEW.workspace_id
      AND s.source_key=NEW.source_key AND s.policy_id=NEW.source_policy_id
      AND s.policy_version=NEW.source_policy_version AND s.decision='allow'
      AND s.request->>'targetUrl'=NEW.target_url
      AND s.request->>'executionIntent'='execute'
      AND s.request->>'operation'='fetch'
      AND s.request->>'robotsDecision' IN ('allowed','not_applicable')
      AND s.request->>'rawPayloadRequested'='false'
      AND s.request->>'exportRequested'='false'
  ) THEN
    RAISE EXCEPTION 'Live website grant must retain an approved M02 source admission.'
      USING ERRCODE='23514',CONSTRAINT='website_live_grant_source_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER website_live_grants_owner_source_guard
  BEFORE INSERT ON website_live_inspection_grants
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_website_live_grant();
--> statement-breakpoint
CREATE FUNCTION brovexa_internal.prevent_website_live_grant_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Live website grants are immutable; replace them using a new inspection id.'
    USING ERRCODE='23514',CONSTRAINT='website_live_grant_immutable_guard';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER website_live_grants_immutable
  BEFORE UPDATE ON website_live_inspection_grants
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.prevent_website_live_grant_update();
--> statement-breakpoint
-- No v2 evidence may be written without an immutable, tenant-scoped owner grant.
ALTER TABLE website_live_inspection_runs
  ADD CONSTRAINT website_live_runs_owner_grant_fk
  FOREIGN KEY (id,workspace_id)
  REFERENCES website_live_inspection_grants(inspection_id,workspace_id)
  ON DELETE RESTRICT;