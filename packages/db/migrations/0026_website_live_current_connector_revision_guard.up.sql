-- M04-WEB-060: an immutable M02 source admission is historical, not an
-- authorization to keep using a connector after a later registry revision.
-- Forward-only change; previously applied 0007/0024/0025 remain immutable.
--
-- A new connector definition and the deferred live COMMIT fence serialize
-- on the same source+connector identity. An older approved definition cannot
-- outlive a later disabled, dry-run, blocked-policy or even reapproved revision
-- without a fresh source admission and owner grant on the new version.
CREATE FUNCTION brovexa_internal.lock_website_live_connector_revision_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    23082716, hashtext(NEW.source_key || ':' || NEW.connector_key)
  );
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER website_live_connector_revision_insert_lock
  BEFORE INSERT ON connector_definitions
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.lock_website_live_connector_revision_insert();
--> statement-breakpoint
CREATE FUNCTION brovexa_internal.guard_website_live_current_connector_revision()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  grant_workspace uuid;
  admission_id text;
  grant_source text;
  scoped_connector text;
  pinned_definition uuid;
  latest_definition uuid;
  latest_status text;
  latest_activation text;
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Live connector revision guard requires current read committed snapshot.'
      USING ERRCODE='23514', CONSTRAINT='website_live_current_connector_revision_guard';
  END IF;

  grant_workspace := NEW.workspace_id;
  IF TG_TABLE_NAME='website_live_inspection_grants' THEN
    admission_id := NEW.source_admission_decision_ref;
    grant_source := NEW.source_key;
  ELSE
    admission_id := NEW.source_admission_decision_ref;
    grant_source := NEW.source_key;
  END IF;

  SELECT s.connector_key,s.connector_definition_id
    INTO scoped_connector,pinned_definition
    FROM source_admission_snapshots AS s
   WHERE s.id=admission_id AND s.workspace_id=grant_workspace
     AND s.source_key=grant_source AND s.decision='allow'
   FOR SHARE;

  IF pinned_definition IS NULL THEN
    RAISE EXCEPTION 'Live connector revision check lacks a scoped allowed admission.'
      USING ERRCODE='23514', CONSTRAINT='website_live_current_connector_revision_guard';
  END IF;

  -- Advisory lock is held to COMMIT. The companion INSERT trigger prevents
  -- an unseen newer revision from committing between our latest read and
  -- this transaction's authorization commit.
  PERFORM pg_advisory_xact_lock(
    23082716,hashtext(grant_source || ':' || scoped_connector)
  );

  SELECT cd.id,cd.status,cd.activation
    INTO latest_definition,latest_status,latest_activation
    FROM connector_definitions AS cd
   WHERE cd.source_key=grant_source AND cd.connector_key=scoped_connector
   ORDER BY cd.created_at DESC,cd.version DESC,cd.id DESC
   LIMIT 1 FOR SHARE;

  IF latest_definition IS DISTINCT FROM pinned_definition
      OR latest_status IS DISTINCT FROM 'approved'
      OR latest_activation IS DISTINCT FROM 'enabled' THEN
    RAISE EXCEPTION 'Live connector admission references a superseded or disabled registry revision.'
      USING ERRCODE='23514', CONSTRAINT='website_live_current_connector_revision_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER website_live_grant_current_connector_revision_guard
  AFTER INSERT ON website_live_inspection_grants
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_website_live_current_connector_revision();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER website_live_evidence_current_connector_revision_guard
  AFTER INSERT ON website_live_inspection_runs
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_website_live_current_connector_revision();
