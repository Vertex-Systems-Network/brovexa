-- M04-WEB-059. Forward-only protection for current domain authorization.
-- Do not rewrite already applied M03 0015/0016 or M04 0020-0024 histories.
-- Historical VERIFIED domain decisions are not sufficient after a newer
-- append-only review/rejection/superseding decision for that business+domain.
--
-- Serialize the INSERT of a new domain decision with the deferred grant and
-- evidence COMMIT checks. Without this, a SELECT-only "latest" guard is
-- vulnerable to a concurrent newer domain decision arriving after its read.
CREATE FUNCTION brovexa_internal.lock_website_live_domain_decision_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    23082715,
    hashtext(NEW.workspace_id::text || ':' || NEW.canonical_business_id || ':' || NEW.normalized_domain)
  );
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER website_live_domain_decision_insert_lock
  BEFORE INSERT ON business_domain_verification_decisions
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.lock_website_live_domain_decision_insert();
--> statement-breakpoint
CREATE FUNCTION brovexa_internal.guard_website_live_current_domain_decision()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  expected_verification_id text;
  expected_workspace uuid;
  expected_business text;
  expected_domain text;
  latest_id text;
  latest_decision text;
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Live website authorization requires current read committed domain verification.'
      USING ERRCODE='23514', CONSTRAINT='website_live_current_domain_decision_guard';
  END IF;

  IF TG_TABLE_NAME='website_live_inspection_grants' THEN
    expected_verification_id := NEW.domain_verification_id;
    expected_workspace := NEW.workspace_id;
    expected_business := NEW.canonical_business_id;
    expected_domain := NEW.verified_domain;
  ELSE
    expected_verification_id := NEW.domain_verification_id;
    expected_workspace := NEW.workspace_id;
    expected_business := NEW.canonical_business_id;
    expected_domain := NEW.verified_domain;
  END IF;

  -- Held through COMMIT. A later domain decision cannot become visible between
  -- this check and the authorized evidence/grant COMMIT, and an already staged
  -- decision must complete before this guard can read it.
  PERFORM pg_advisory_xact_lock(
    23082715,
    hashtext(expected_workspace::text || ':' || expected_business || ':' || expected_domain)
  );

  SELECT d.id, d.decision INTO latest_id, latest_decision
    FROM business_domain_verification_decisions AS d
   WHERE d.workspace_id=expected_workspace
     AND d.canonical_business_id=expected_business
     AND d.normalized_domain=expected_domain
   ORDER BY d.evaluated_at DESC, d.created_at DESC, d.id DESC
   LIMIT 1
   FOR SHARE;

  IF latest_id IS DISTINCT FROM expected_verification_id
     OR latest_decision IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'Live website authorization references an outdated or rejected domain verification.'
      USING ERRCODE='23514', CONSTRAINT='website_live_current_domain_decision_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER website_live_grant_current_domain_guard
  AFTER INSERT ON website_live_inspection_grants
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_website_live_current_domain_decision();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER website_live_evidence_current_domain_guard
  AFTER INSERT ON website_live_inspection_runs
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_website_live_current_domain_decision();
