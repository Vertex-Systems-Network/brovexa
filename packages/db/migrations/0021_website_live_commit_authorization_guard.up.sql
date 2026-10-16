-- M04-WEB-036: authorization must still be active when live evidence COMMITs.
-- 0020's immutable FK proves that a grant existed; it cannot prove that the
-- grant has not expired, the owner remains active, or the persisted evidence
-- still belongs to the same bounded source approval at write time.
-- Deferred constraint trigger runs during COMMIT (after child observations),
-- without contacting the network or retaining raw HTML.
CREATE FUNCTION brovexa_internal.guard_website_live_commit_authorization()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1
    FROM website_live_inspection_grants AS g
    JOIN workspaces AS w
      ON w.id = g.workspace_id AND w.status = 'active'
    JOIN workspace_memberships AS wm
      ON wm.id = g.approved_by_membership_id
      AND wm.workspace_id = g.workspace_id
      AND wm.user_id = g.approved_by_user_id
      AND wm.status = 'active'
    JOIN users AS u
      ON u.id = wm.user_id AND u.status = 'active'
    JOIN workspace_membership_roles AS wmr
      ON wmr.membership_id = wm.id
      AND wmr.workspace_id = wm.workspace_id
    JOIN workspace_roles AS wr
      ON wr.id = wmr.role_id
      AND wr.workspace_id = wm.workspace_id
      AND wr.kind = 'owner'
    JOIN business_domain_verification_decisions AS d
      ON d.id = g.domain_verification_id
      AND d.workspace_id = g.workspace_id
      AND d.canonical_business_id = g.canonical_business_id
      AND d.normalized_domain = g.verified_domain
      AND d.decision = 'verified'
    JOIN source_admission_snapshots AS s
      ON s.id = g.source_admission_decision_ref
      AND s.workspace_id = g.workspace_id
      AND s.decision = 'allow'
      AND s.source_key = g.source_key
      AND s.policy_id = g.source_policy_id
      AND s.policy_version = g.source_policy_version
      AND s.request->>'targetUrl' = g.target_url
      AND s.request->>'executionIntent' = 'execute'
      AND s.request->>'operation' = 'fetch'
      AND s.request->>'robotsDecision' IN ('allowed', 'not_applicable')
      AND s.request->>'rawPayloadRequested' = 'false'
      AND s.request->>'exportRequested' = 'false'
    WHERE g.inspection_id = NEW.id
      AND g.workspace_id = NEW.workspace_id
      AND g.expires_at > clock_timestamp()
      AND NEW.received_at >= g.approved_at
      AND NEW.completed_at <= g.expires_at
      AND NEW.canonical_business_id = g.canonical_business_id
      AND NEW.domain_verification_id = g.domain_verification_id
      AND NEW.verified_domain = g.verified_domain
      AND NEW.target_url = g.target_url
      AND NEW.source_key = g.source_key
      AND NEW.source_admission_decision_ref = g.source_admission_decision_ref
      AND NEW.source_policy_id = g.source_policy_id
      AND NEW.source_policy_version = g.source_policy_version
      AND NEW.transport_policy_id = g.transport_policy_id
      AND NEW.transport_policy_version = g.transport_policy_version
      AND NEW.max_response_bytes <= g.max_response_bytes
      AND NEW.timeout_ms <= g.timeout_ms
      AND NEW.retention_ttl_seconds <= g.retention_ttl_seconds
      AND NEW.deletion_required = true
    -- Prevent concurrent owner, workspace, grant or source revocation from
    -- racing the deferred authorization check and transaction commit.
    FOR SHARE OF g, w, wm, u, wmr, wr, d, s;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Live inspection grant is expired, revoked, or inconsistent with evidence.'
      USING ERRCODE = '23514',
            CONSTRAINT = 'website_live_evidence_active_grant_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER website_live_evidence_active_grant_guard
  AFTER INSERT ON website_live_inspection_runs
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_website_live_commit_authorization();