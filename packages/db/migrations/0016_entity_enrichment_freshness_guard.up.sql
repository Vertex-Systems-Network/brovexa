DROP TRIGGER IF EXISTS business_domain_verification_decisions_policy_guard ON business_domain_verification_decisions;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_domain_verification_decision()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE referenced_count integer;
BEGIN
  SELECT count(DISTINCT evidence.id) INTO referenced_count
  FROM business_domain_evidence AS evidence
  WHERE evidence.workspace_id = NEW.workspace_id
    AND evidence.canonical_business_id = NEW.canonical_business_id
    AND evidence.normalized_domain = NEW.normalized_domain
    AND evidence.purged_at IS NULL
    AND NEW.evidence_ids ? evidence.id;
  IF referenced_count <> jsonb_array_length(NEW.evidence_ids) THEN
    RAISE EXCEPTION 'Every domain decision evidence ID must exist for the same workspace, canonical business and domain.'
      USING ERRCODE = '23514', CONSTRAINT = 'business_domain_verification_decisions_evidence_binding_guard';
  END IF;
  IF NEW.decision = 'verified' AND EXISTS (
    SELECT 1 FROM business_domain_evidence AS evidence
    WHERE evidence.workspace_id = NEW.workspace_id
      AND evidence.canonical_business_id = NEW.canonical_business_id
      AND evidence.normalized_domain = NEW.normalized_domain
      AND evidence.purged_at IS NULL
      AND NEW.evidence_ids ? evidence.id
      AND NEW.evaluated_at < evidence.observed_at
  ) THEN
    RAISE EXCEPTION 'Domain verification cannot be evaluated before referenced evidence was observed.'
      USING ERRCODE = '23514', CONSTRAINT = 'business_domain_verification_decisions_evidence_time_guard';
  END IF;
  IF NEW.decision = 'verified' AND NOT EXISTS (
    SELECT 1 FROM business_domain_evidence AS evidence
    WHERE evidence.workspace_id = NEW.workspace_id
      AND evidence.canonical_business_id = NEW.canonical_business_id
      AND evidence.normalized_domain = NEW.normalized_domain
      AND evidence.purged_at IS NULL
      AND NEW.evidence_ids ? evidence.id
      AND evidence.effect = 'supports_domain'
  ) THEN
    RAISE EXCEPTION 'A verified domain requires supporting evidence.'
      USING ERRCODE = '23514', CONSTRAINT = 'business_domain_verification_decisions_support_guard';
  END IF;
  IF NEW.decision = 'verified' AND NEW.method = 'deterministic' THEN
    IF EXISTS (
      SELECT 1 FROM business_domain_evidence AS evidence
      WHERE evidence.workspace_id = NEW.workspace_id
        AND evidence.canonical_business_id = NEW.canonical_business_id
        AND evidence.normalized_domain = NEW.normalized_domain
        AND evidence.purged_at IS NULL
        AND NEW.evidence_ids ? evidence.id
        AND evidence.refresh_after_seconds IS NOT NULL
        AND NEW.evaluated_at > evidence.observed_at
          + make_interval(secs => evidence.refresh_after_seconds::double precision)
    ) THEN
      RAISE EXCEPTION 'Deterministic domain verification cannot reuse stale evidence beyond its refresh window.'
        USING ERRCODE = '23514', CONSTRAINT = 'business_domain_verification_decisions_freshness_guard';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM business_domain_evidence AS evidence
      WHERE evidence.workspace_id = NEW.workspace_id
        AND evidence.canonical_business_id = NEW.canonical_business_id
        AND evidence.normalized_domain = NEW.normalized_domain
        AND evidence.purged_at IS NULL
        AND NEW.evidence_ids ? evidence.id
        AND evidence.effect = 'supports_domain'
        AND evidence.kind <> 'source_claim'
    ) THEN
      RAISE EXCEPTION 'Deterministic domain verification requires independent evidence beyond a source claim.'
        USING ERRCODE = '23514', CONSTRAINT = 'business_domain_verification_decisions_independent_guard';
    END IF;
    IF EXISTS (
      SELECT 1 FROM business_domain_evidence AS evidence
      WHERE evidence.workspace_id = NEW.workspace_id
        AND evidence.canonical_business_id = NEW.canonical_business_id
        AND evidence.normalized_domain = NEW.normalized_domain
        AND evidence.purged_at IS NULL
        AND NEW.evidence_ids ? evidence.id
        AND evidence.effect = 'contradicts_domain'
    ) THEN
      RAISE EXCEPTION 'Contradictory domain evidence requires human review.'
        USING ERRCODE = '23514', CONSTRAINT = 'business_domain_verification_decisions_contradiction_guard';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER business_domain_verification_decisions_policy_guard
BEFORE INSERT ON business_domain_verification_decisions
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_domain_verification_decision();
