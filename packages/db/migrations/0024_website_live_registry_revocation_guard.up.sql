-- M04-WEB-043/044: live grants cannot outlive current M02 connector activation.
-- A historical allow snapshot and an immutable grant are insufficient once
-- the connector is disabled, its policy blocked, or its review window expires.
-- Separate forward migration: 0018-0023 histories/checksums remain unchanged.
CREATE FUNCTION brovexa_internal.guard_website_live_current_registry()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  grant_inspection text;
  grant_workspace uuid;
  source_admission_ref text;
  grant_source_key text;
  grant_policy_id text;
  grant_policy_version text;
BEGIN
  IF TG_TABLE_NAME='website_live_inspection_grants' THEN
    grant_inspection := NEW.inspection_id;
    grant_workspace := NEW.workspace_id;
    source_admission_ref := NEW.source_admission_decision_ref;
    grant_source_key := NEW.source_key;
    grant_policy_id := NEW.source_policy_id;
    grant_policy_version := NEW.source_policy_version;
  ELSE
    SELECT g.inspection_id,g.workspace_id,g.source_admission_decision_ref,
           g.source_key,g.source_policy_id,g.source_policy_version
      INTO grant_inspection,grant_workspace,source_admission_ref,
           grant_source_key,grant_policy_id,grant_policy_version
      FROM website_live_inspection_grants AS g
      WHERE g.inspection_id=NEW.id AND g.workspace_id=NEW.workspace_id
      FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Live evidence missing its current authorization grant.'
        USING ERRCODE='23514',CONSTRAINT='website_live_registry_current_guard';
    END IF;
  END IF;

  PERFORM 1 FROM source_admission_snapshots AS s
    JOIN connector_definitions AS cd
      ON cd.id=s.connector_definition_id
      AND cd.connector_key=s.connector_key AND cd.version=s.connector_version
      AND cd.source_key=grant_source_key
      AND cd.policy_id=grant_policy_id AND cd.policy_version=grant_policy_version
      AND cd.status='approved' AND cd.activation='enabled'
      AND cd.credential_mode='none'
      AND cd.access_method IN ('public_web','first_party_web')
    JOIN connector_policies AS cp
      ON cp.id=s.connector_policy_db_id
      AND cp.policy_id=cd.policy_id AND cp.version=cd.policy_version
      AND cp.source_key=grant_source_key AND cp.connector_key=cd.connector_key
      AND cp.state IN ('APPROVED','APPROVED_WITH_LIMITS')
      AND cp.access_method=cd.access_method
      AND cp.reviewed_at<=clock_timestamp() AND cp.next_review_at>clock_timestamp()
    WHERE s.id=source_admission_ref AND s.workspace_id=grant_workspace
      AND s.source_key=grant_source_key AND s.policy_id=grant_policy_id
      AND s.policy_version=grant_policy_version AND s.decision='allow'
    LIMIT 1 FOR SHARE OF s,cd,cp;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'M04 live connector policy was revoked, expired or deactivated.'
      USING ERRCODE='23514',CONSTRAINT='website_live_registry_current_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER website_live_grant_registry_guard
  AFTER INSERT ON website_live_inspection_grants
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_website_live_current_registry();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER website_live_evidence_registry_guard
  AFTER INSERT ON website_live_inspection_runs
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_website_live_current_registry();