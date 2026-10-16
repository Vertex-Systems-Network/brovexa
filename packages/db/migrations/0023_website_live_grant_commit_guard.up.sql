-- M04-WEB-040: close the race between the original BEFORE INSERT grant
-- check (0020) and COMMIT. A concurrent owner deactivation, domain reversal
-- or source-admission change cannot sneak in while the grant commits.
-- Unlike a one-time admission decision, this is a PostgreSQL commit fence.
CREATE FUNCTION brovexa_internal.guard_website_live_grant_at_commit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1
    FROM website_live_inspection_grants AS g
    JOIN workspaces AS w ON w.id=g.workspace_id AND w.status='active'
    JOIN workspace_memberships AS wm
      ON wm.id=g.approved_by_membership_id AND wm.workspace_id=g.workspace_id
      AND wm.user_id=g.approved_by_user_id AND wm.status='active'
    JOIN users AS u ON u.id=wm.user_id AND u.status='active'
    JOIN workspace_membership_roles AS wmr
      ON wmr.membership_id=wm.id AND wmr.workspace_id=wm.workspace_id
    JOIN workspace_roles AS wr
      ON wr.id=wmr.role_id AND wr.workspace_id=wm.workspace_id AND wr.kind='owner'
    JOIN business_domain_verification_decisions AS d
      ON d.id=g.domain_verification_id AND d.workspace_id=g.workspace_id
      AND d.canonical_business_id=g.canonical_business_id
      AND d.normalized_domain=g.verified_domain AND d.decision='verified'
    JOIN source_admission_snapshots AS s
      ON s.id=g.source_admission_decision_ref AND s.workspace_id=g.workspace_id
      AND s.decision='allow' AND s.source_key=g.source_key
      AND s.policy_id=g.source_policy_id AND s.policy_version=g.source_policy_version
      AND s.request->>'targetUrl'=g.target_url
      AND s.request->>'executionIntent'='execute'
      AND s.request->>'operation'='fetch'
      AND s.request->>'robotsDecision' IN ('allowed','not_applicable')
      AND s.request->>'rawPayloadRequested'='false'
      AND s.request->>'exportRequested'='false'
    WHERE g.inspection_id=NEW.inspection_id AND g.workspace_id=NEW.workspace_id
      AND g.grant_hash=NEW.grant_hash
      AND g.approved_at<=clock_timestamp() AND g.expires_at>clock_timestamp()
    FOR SHARE OF g,w,wm,u,wmr,wr,d,s;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Live website grant authority was revoked or expired before commit.'
      USING ERRCODE='23514',CONSTRAINT='website_live_grant_commit_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER website_live_grant_commit_guard
  AFTER INSERT ON website_live_inspection_grants
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_website_live_grant_at_commit();