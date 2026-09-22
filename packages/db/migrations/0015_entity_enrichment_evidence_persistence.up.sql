CREATE TABLE business_domain_evidence (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  canonical_business_id text NOT NULL,
  normalized_domain text,
  kind text NOT NULL,
  effect text NOT NULL,
  source_key text NOT NULL,
  source_reference_ids jsonb NOT NULL,
  source_policy_id text NOT NULL,
  source_policy_version text NOT NULL,
  source_admission_decision_ref text NOT NULL,
  source_admission_decision text NOT NULL DEFAULT 'allow',
  storage_class text NOT NULL,
  retention_ttl_seconds bigint,
  deletion_required boolean NOT NULL,
  refresh_after_seconds bigint,
  observed_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL,
  purged_at timestamptz,
  purge_reason_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_domain_evidence_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT business_domain_evidence_business_fk
    FOREIGN KEY (canonical_business_id, workspace_id)
    REFERENCES canonical_businesses (id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT business_domain_evidence_id_check CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  CONSTRAINT business_domain_evidence_domain_check CHECK (
    normalized_domain IS NULL OR normalized_domain ~ '^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?[.])+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
  ),
  CONSTRAINT business_domain_evidence_kind_check CHECK (kind IN ('source_claim','official_website','registry_record','dns_control')),
  CONSTRAINT business_domain_evidence_effect_check CHECK (effect IN ('supports_domain','contradicts_domain')),
  CONSTRAINT business_domain_evidence_source_key_check CHECK (source_key ~ '^source\\.[a-z0-9_.-]+$'),
  CONSTRAINT business_domain_evidence_source_refs_check CHECK (jsonb_typeof(source_reference_ids) = 'array'),
  CONSTRAINT business_domain_evidence_policy_version_check CHECK (source_policy_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'),
  CONSTRAINT business_domain_evidence_admission_check CHECK (source_admission_decision = 'allow'),
  CONSTRAINT business_domain_evidence_storage_check CHECK (storage_class IN ('REFERENCE_ONLY','NORMALIZED_FACT','EVIDENCE_MINIMAL')),
  CONSTRAINT business_domain_evidence_retention_check CHECK (
    (retention_ttl_seconds IS NULL OR retention_ttl_seconds >= 0)
    AND (refresh_after_seconds IS NULL OR refresh_after_seconds >= 0)
  ),
  CONSTRAINT business_domain_evidence_time_check CHECK (recorded_at >= observed_at),
  CONSTRAINT business_domain_evidence_purge_shape_check CHECK (
    (purged_at IS NULL AND purge_reason_code IS NULL AND normalized_domain IS NOT NULL AND jsonb_array_length(source_reference_ids) > 0)
    OR
    (purged_at IS NOT NULL AND purge_reason_code IS NOT NULL AND normalized_domain IS NULL AND source_reference_ids = '[]'::jsonb AND deletion_required = true)
  )
);
--> statement-breakpoint
CREATE INDEX business_domain_evidence_business_domain_idx
  ON business_domain_evidence (workspace_id, canonical_business_id, normalized_domain, recorded_at DESC, id);
--> statement-breakpoint
CREATE TABLE business_domain_verification_decisions (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  canonical_business_id text NOT NULL,
  normalized_domain text NOT NULL,
  decision text NOT NULL,
  method text NOT NULL,
  confidence double precision NOT NULL,
  evidence_ids jsonb NOT NULL,
  reason_codes jsonb NOT NULL,
  review_decision_ref text,
  evaluated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_domain_verification_decisions_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT business_domain_verification_decisions_business_fk
    FOREIGN KEY (canonical_business_id, workspace_id)
    REFERENCES canonical_businesses (id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT business_domain_verification_decisions_id_check CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  CONSTRAINT business_domain_verification_decisions_decision_check CHECK (decision IN ('verified','review_required','rejected')),
  CONSTRAINT business_domain_verification_decisions_method_check CHECK (method IN ('deterministic','human_review')),
  CONSTRAINT business_domain_verification_decisions_confidence_check CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT business_domain_verification_decisions_evidence_check CHECK (jsonb_typeof(evidence_ids) = 'array' AND jsonb_array_length(evidence_ids) > 0),
  CONSTRAINT business_domain_verification_decisions_reasons_check CHECK (jsonb_typeof(reason_codes) = 'array' AND jsonb_array_length(reason_codes) > 0),
  CONSTRAINT business_domain_verification_decisions_review_shape_check CHECK (
    (method = 'human_review' AND review_decision_ref IS NOT NULL)
    OR (method = 'deterministic' AND review_decision_ref IS NULL)
  ),
  CONSTRAINT business_domain_verification_decisions_review_required_check CHECK (decision <> 'review_required' OR method = 'deterministic')
);
--> statement-breakpoint
CREATE INDEX business_domain_verification_decisions_business_domain_idx
  ON business_domain_verification_decisions (workspace_id, canonical_business_id, normalized_domain, evaluated_at DESC, id);
--> statement-breakpoint
CREATE TABLE contact_data_eligibility_decisions (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  canonical_business_id text NOT NULL,
  channel text NOT NULL,
  source_key text NOT NULL,
  connector_key text NOT NULL,
  connector_version text NOT NULL,
  source_request_id text NOT NULL,
  source_admission_decision_ref text NOT NULL,
  source_admission_decision text NOT NULL DEFAULT 'allow',
  source_reference_ids jsonb NOT NULL,
  source_policy_id text NOT NULL,
  source_policy_version text NOT NULL,
  compliance_policy_id text NOT NULL,
  compliance_policy_version text NOT NULL,
  purpose text NOT NULL,
  territory_mode text NOT NULL,
  country_codes jsonb NOT NULL,
  field_name text NOT NULL,
  data_classification text NOT NULL,
  storage_class text NOT NULL,
  retention_ttl_seconds bigint,
  deletion_required boolean NOT NULL,
  refresh_after_seconds bigint,
  decision text NOT NULL,
  display_allowed boolean NOT NULL,
  export_allowed boolean NOT NULL,
  reason_codes jsonb NOT NULL,
  evaluated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_data_eligibility_decisions_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT contact_data_eligibility_decisions_business_fk
    FOREIGN KEY (canonical_business_id, workspace_id)
    REFERENCES canonical_businesses (id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT contact_data_eligibility_decisions_id_check CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  CONSTRAINT contact_data_eligibility_decisions_channel_check CHECK (channel IN ('email','phone','website_form','social_profile','other_public_business_channel')),
  CONSTRAINT contact_data_eligibility_decisions_source_key_check CHECK (source_key ~ '^source\\.[a-z0-9_.-]+$'),
  CONSTRAINT contact_data_eligibility_decisions_connector_key_check CHECK (connector_key ~ '^connector\\.[a-z0-9_.-]+$'),
  CONSTRAINT contact_data_eligibility_decisions_versions_check CHECK (
    connector_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'
    AND source_policy_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'
    AND compliance_policy_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'
  ),
  CONSTRAINT contact_data_eligibility_decisions_admission_check CHECK (source_admission_decision = 'allow'),
  CONSTRAINT contact_data_eligibility_decisions_refs_check CHECK (jsonb_typeof(source_reference_ids) = 'array' AND jsonb_array_length(source_reference_ids) > 0),
  CONSTRAINT contact_data_eligibility_decisions_territory_check CHECK (
    jsonb_typeof(country_codes) = 'array'
    AND territory_mode IN ('global','country_allowlist','provider_defined')
    AND (territory_mode <> 'global' OR jsonb_array_length(country_codes) = 0)
    AND (territory_mode <> 'country_allowlist' OR jsonb_array_length(country_codes) > 0)
  ),
  CONSTRAINT contact_data_eligibility_decisions_classification_check CHECK (data_classification IN ('PUBLIC_BUSINESS','PERSONAL_BUSINESS_CONTACT')),
  CONSTRAINT contact_data_eligibility_decisions_storage_check CHECK (storage_class IN ('REFERENCE_ONLY','NORMALIZED_FACT','EVIDENCE_MINIMAL')),
  CONSTRAINT contact_data_eligibility_decisions_retention_check CHECK (
    (retention_ttl_seconds IS NULL OR retention_ttl_seconds >= 0)
    AND (refresh_after_seconds IS NULL OR refresh_after_seconds >= 0)
  ),
  CONSTRAINT contact_data_eligibility_decisions_decision_check CHECK (decision IN ('allow','review_required','blocked')),
  CONSTRAINT contact_data_eligibility_decisions_access_check CHECK (decision = 'allow' OR (display_allowed = false AND export_allowed = false)),
  CONSTRAINT contact_data_eligibility_decisions_reasons_check CHECK (jsonb_typeof(reason_codes) = 'array' AND jsonb_array_length(reason_codes) > 0)
);
--> statement-breakpoint
CREATE INDEX contact_data_eligibility_decisions_business_time_idx
  ON contact_data_eligibility_decisions (workspace_id, canonical_business_id, evaluated_at DESC, id);
--> statement-breakpoint
CREATE TABLE approved_business_contact_evidence (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  canonical_business_id text NOT NULL,
  channel text NOT NULL,
  normalized_value text,
  source_key text NOT NULL,
  source_reference_ids jsonb NOT NULL,
  eligibility_id text NOT NULL,
  outreach_authorization text NOT NULL DEFAULT 'not_evaluated',
  deletion_required boolean NOT NULL,
  observed_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL,
  purged_at timestamptz,
  purge_reason_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approved_business_contact_evidence_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT approved_business_contact_evidence_business_fk
    FOREIGN KEY (canonical_business_id, workspace_id)
    REFERENCES canonical_businesses (id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT approved_business_contact_evidence_eligibility_fk
    FOREIGN KEY (eligibility_id, workspace_id)
    REFERENCES contact_data_eligibility_decisions (id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT approved_business_contact_evidence_id_check CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  CONSTRAINT approved_business_contact_evidence_channel_check CHECK (channel IN ('email','phone','website_form','social_profile','other_public_business_channel')),
  CONSTRAINT approved_business_contact_evidence_source_key_check CHECK (source_key ~ '^source\\.[a-z0-9_.-]+$'),
  CONSTRAINT approved_business_contact_evidence_refs_check CHECK (jsonb_typeof(source_reference_ids) = 'array'),
  CONSTRAINT approved_business_contact_evidence_outreach_check CHECK (outreach_authorization = 'not_evaluated'),
  CONSTRAINT approved_business_contact_evidence_time_check CHECK (recorded_at >= observed_at),
  CONSTRAINT approved_business_contact_evidence_purge_shape_check CHECK (
    (purged_at IS NULL AND purge_reason_code IS NULL AND normalized_value IS NOT NULL AND jsonb_array_length(source_reference_ids) > 0)
    OR
    (purged_at IS NOT NULL AND purge_reason_code IS NOT NULL AND normalized_value IS NULL AND source_reference_ids = '[]'::jsonb AND deletion_required = true)
  )
);
--> statement-breakpoint
CREATE INDEX approved_business_contact_evidence_business_channel_idx
  ON approved_business_contact_evidence (workspace_id, canonical_business_id, channel, recorded_at DESC, id);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_entity_enrichment_value_policy()
RETURNS trigger LANGUAGE plpgsql AS $
DECLARE
  array_count integer;
  distinct_count integer;
BEGIN
  IF TG_TABLE_NAME = 'business_domain_evidence' THEN
    IF NEW.purged_at IS NULL THEN
      SELECT count(*), count(DISTINCT value)
        INTO array_count, distinct_count
      FROM jsonb_array_elements_text(NEW.source_reference_ids) AS item(value);
      IF array_count < 1 OR array_count <> distinct_count THEN
        RAISE EXCEPTION 'Domain evidence source references must be non-empty and unique.'
          USING ERRCODE = '23514', CONSTRAINT = 'business_domain_evidence_source_reference_uniqueness_guard';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'business_domain_verification_decisions' THEN
    SELECT count(*), count(DISTINCT value)
      INTO array_count, distinct_count
    FROM jsonb_array_elements_text(NEW.evidence_ids) AS item(value);
    IF array_count < 1 OR array_count <> distinct_count THEN
      RAISE EXCEPTION 'Domain verification evidence IDs must be non-empty and unique.'
        USING ERRCODE = '23514', CONSTRAINT = 'business_domain_verification_decisions_evidence_uniqueness_guard';
    END IF;
    SELECT count(*), count(DISTINCT value)
      INTO array_count, distinct_count
    FROM jsonb_array_elements_text(NEW.reason_codes) AS item(value);
    IF array_count < 1 OR array_count <> distinct_count THEN
      RAISE EXCEPTION 'Domain verification reason codes must be non-empty and unique.'
        USING ERRCODE = '23514', CONSTRAINT = 'business_domain_verification_decisions_reason_uniqueness_guard';
    END IF;
  ELSIF TG_TABLE_NAME = 'contact_data_eligibility_decisions' THEN
    SELECT count(*), count(DISTINCT value)
      INTO array_count, distinct_count
    FROM jsonb_array_elements_text(NEW.source_reference_ids) AS item(value);
    IF array_count < 1 OR array_count <> distinct_count THEN
      RAISE EXCEPTION 'Contact eligibility source references must be non-empty and unique.'
        USING ERRCODE = '23514', CONSTRAINT = 'contact_data_eligibility_decisions_source_reference_uniqueness_guard';
    END IF;
    SELECT count(*), count(DISTINCT value)
      INTO array_count, distinct_count
    FROM jsonb_array_elements_text(NEW.reason_codes) AS item(value);
    IF array_count < 1 OR array_count <> distinct_count THEN
      RAISE EXCEPTION 'Contact eligibility reason codes must be non-empty and unique.'
        USING ERRCODE = '23514', CONSTRAINT = 'contact_data_eligibility_decisions_reason_uniqueness_guard';
    END IF;
    SELECT count(*), count(DISTINCT value)
      INTO array_count, distinct_count
    FROM jsonb_array_elements_text(NEW.country_codes) AS item(value);
    IF array_count <> distinct_count OR EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(NEW.country_codes) AS country(code)
      WHERE country.code !~ '^[A-Z]{2}
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
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_contact_evidence_eligibility()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE eligibility contact_data_eligibility_decisions%ROWTYPE;
BEGIN
  SELECT * INTO eligibility FROM contact_data_eligibility_decisions
  WHERE id = NEW.eligibility_id AND workspace_id = NEW.workspace_id;
  IF eligibility.id IS NULL
     OR eligibility.decision <> 'allow'
     OR eligibility.source_admission_decision <> 'allow'
     OR eligibility.canonical_business_id <> NEW.canonical_business_id
     OR eligibility.channel <> NEW.channel
     OR eligibility.source_key <> NEW.source_key THEN
    RAISE EXCEPTION 'Contact evidence requires a matching allowed ContactDataEligibility decision.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_eligibility_guard';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(NEW.source_reference_ids) AS requested(reference_id)
    WHERE NOT eligibility.source_reference_ids ? requested.reference_id
  ) THEN
    RAISE EXCEPTION 'Contact evidence provenance must be a subset of approved eligibility references.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_provenance_guard';
  END IF;
  IF NEW.deletion_required IS DISTINCT FROM eligibility.deletion_required THEN
    RAISE EXCEPTION 'Contact evidence deletion policy must match its eligibility decision.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_deletion_policy_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER approved_business_contact_evidence_eligibility_guard
BEFORE INSERT ON approved_business_contact_evidence
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_contact_evidence_eligibility();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_domain_evidence_lifecycle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Domain evidence cannot be physically deleted; use policy purge.'
      USING ERRCODE = '23514', CONSTRAINT = 'business_domain_evidence_delete_guard';
  END IF;
  IF OLD.purged_at IS NOT NULL OR OLD.deletion_required IS NOT TRUE
     OR NEW.purged_at IS NULL OR NEW.purge_reason_code IS NULL
     OR NEW.normalized_domain IS NOT NULL OR NEW.source_reference_ids <> '[]'::jsonb
     OR NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.canonical_business_id IS DISTINCT FROM OLD.canonical_business_id
     OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.effect IS DISTINCT FROM OLD.effect
     OR NEW.source_key IS DISTINCT FROM OLD.source_key OR NEW.source_policy_id IS DISTINCT FROM OLD.source_policy_id
     OR NEW.source_policy_version IS DISTINCT FROM OLD.source_policy_version
     OR NEW.source_admission_decision_ref IS DISTINCT FROM OLD.source_admission_decision_ref
     OR NEW.source_admission_decision IS DISTINCT FROM OLD.source_admission_decision
     OR NEW.storage_class IS DISTINCT FROM OLD.storage_class OR NEW.retention_ttl_seconds IS DISTINCT FROM OLD.retention_ttl_seconds
     OR NEW.deletion_required IS DISTINCT FROM OLD.deletion_required OR NEW.refresh_after_seconds IS DISTINCT FROM OLD.refresh_after_seconds
     OR NEW.observed_at IS DISTINCT FROM OLD.observed_at OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Domain evidence only permits a one-way policy purge transition.'
      USING ERRCODE = '23514', CONSTRAINT = 'business_domain_evidence_purge_transition_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER business_domain_evidence_lifecycle_guard
BEFORE UPDATE OR DELETE ON business_domain_evidence
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_domain_evidence_lifecycle();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_contact_evidence_lifecycle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Contact evidence cannot be physically deleted; use policy purge.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_delete_guard';
  END IF;
  IF OLD.purged_at IS NOT NULL OR OLD.deletion_required IS NOT TRUE
     OR NEW.purged_at IS NULL OR NEW.purge_reason_code IS NULL
     OR NEW.normalized_value IS NOT NULL OR NEW.source_reference_ids <> '[]'::jsonb
     OR NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.canonical_business_id IS DISTINCT FROM OLD.canonical_business_id OR NEW.channel IS DISTINCT FROM OLD.channel
     OR NEW.source_key IS DISTINCT FROM OLD.source_key OR NEW.eligibility_id IS DISTINCT FROM OLD.eligibility_id
     OR NEW.outreach_authorization IS DISTINCT FROM OLD.outreach_authorization
     OR NEW.deletion_required IS DISTINCT FROM OLD.deletion_required
     OR NEW.observed_at IS DISTINCT FROM OLD.observed_at OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Contact evidence only permits a one-way policy purge transition.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_purge_transition_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER approved_business_contact_evidence_lifecycle_guard
BEFORE UPDATE OR DELETE ON approved_business_contact_evidence
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_contact_evidence_lifecycle();
--> statement-breakpoint
CREATE TRIGGER business_domain_verification_decisions_append_only
BEFORE UPDATE OR DELETE ON business_domain_verification_decisions
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('business_domain_verification_decisions_append_only');
--> statement-breakpoint
CREATE TRIGGER contact_data_eligibility_decisions_append_only
BEFORE UPDATE OR DELETE ON contact_data_eligibility_decisions
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('contact_data_eligibility_decisions_append_only');
    ) THEN
      RAISE EXCEPTION 'Contact eligibility country codes must be unique ISO-style uppercase alpha-2 values.'
        USING ERRCODE = '23514', CONSTRAINT = 'contact_data_eligibility_decisions_country_code_guard';
    END IF;
  ELSIF TG_TABLE_NAME = 'approved_business_contact_evidence' AND NEW.purged_at IS NULL THEN
    SELECT count(*), count(DISTINCT value)
      INTO array_count, distinct_count
    FROM jsonb_array_elements_text(NEW.source_reference_ids) AS item(value);
    IF array_count < 1 OR array_count <> distinct_count THEN
      RAISE EXCEPTION 'Contact evidence source references must be non-empty and unique.'
        USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_source_reference_uniqueness_guard';
    END IF;
    IF length(btrim(NEW.normalized_value)) < 1 OR length(NEW.normalized_value) > 2048 THEN
      RAISE EXCEPTION 'Contact evidence normalized value must contain between 1 and 2048 characters.'
        USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_value_length_guard';
    END IF;
    IF NEW.channel = 'email'
       AND (NEW.normalized_value <> lower(NEW.normalized_value)
            OR NEW.normalized_value !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+
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
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_contact_evidence_eligibility()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE eligibility contact_data_eligibility_decisions%ROWTYPE;
BEGIN
  SELECT * INTO eligibility FROM contact_data_eligibility_decisions
  WHERE id = NEW.eligibility_id AND workspace_id = NEW.workspace_id;
  IF eligibility.id IS NULL
     OR eligibility.decision <> 'allow'
     OR eligibility.source_admission_decision <> 'allow'
     OR eligibility.canonical_business_id <> NEW.canonical_business_id
     OR eligibility.channel <> NEW.channel
     OR eligibility.source_key <> NEW.source_key THEN
    RAISE EXCEPTION 'Contact evidence requires a matching allowed ContactDataEligibility decision.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_eligibility_guard';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(NEW.source_reference_ids) AS requested(reference_id)
    WHERE NOT eligibility.source_reference_ids ? requested.reference_id
  ) THEN
    RAISE EXCEPTION 'Contact evidence provenance must be a subset of approved eligibility references.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_provenance_guard';
  END IF;
  IF NEW.deletion_required IS DISTINCT FROM eligibility.deletion_required THEN
    RAISE EXCEPTION 'Contact evidence deletion policy must match its eligibility decision.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_deletion_policy_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER approved_business_contact_evidence_eligibility_guard
BEFORE INSERT ON approved_business_contact_evidence
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_contact_evidence_eligibility();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_domain_evidence_lifecycle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Domain evidence cannot be physically deleted; use policy purge.'
      USING ERRCODE = '23514', CONSTRAINT = 'business_domain_evidence_delete_guard';
  END IF;
  IF OLD.purged_at IS NOT NULL OR OLD.deletion_required IS NOT TRUE
     OR NEW.purged_at IS NULL OR NEW.purge_reason_code IS NULL
     OR NEW.normalized_domain IS NOT NULL OR NEW.source_reference_ids <> '[]'::jsonb
     OR NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.canonical_business_id IS DISTINCT FROM OLD.canonical_business_id
     OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.effect IS DISTINCT FROM OLD.effect
     OR NEW.source_key IS DISTINCT FROM OLD.source_key OR NEW.source_policy_id IS DISTINCT FROM OLD.source_policy_id
     OR NEW.source_policy_version IS DISTINCT FROM OLD.source_policy_version
     OR NEW.source_admission_decision_ref IS DISTINCT FROM OLD.source_admission_decision_ref
     OR NEW.source_admission_decision IS DISTINCT FROM OLD.source_admission_decision
     OR NEW.storage_class IS DISTINCT FROM OLD.storage_class OR NEW.retention_ttl_seconds IS DISTINCT FROM OLD.retention_ttl_seconds
     OR NEW.deletion_required IS DISTINCT FROM OLD.deletion_required OR NEW.refresh_after_seconds IS DISTINCT FROM OLD.refresh_after_seconds
     OR NEW.observed_at IS DISTINCT FROM OLD.observed_at OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Domain evidence only permits a one-way policy purge transition.'
      USING ERRCODE = '23514', CONSTRAINT = 'business_domain_evidence_purge_transition_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER business_domain_evidence_lifecycle_guard
BEFORE UPDATE OR DELETE ON business_domain_evidence
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_domain_evidence_lifecycle();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_contact_evidence_lifecycle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Contact evidence cannot be physically deleted; use policy purge.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_delete_guard';
  END IF;
  IF OLD.purged_at IS NOT NULL OR OLD.deletion_required IS NOT TRUE
     OR NEW.purged_at IS NULL OR NEW.purge_reason_code IS NULL
     OR NEW.normalized_value IS NOT NULL OR NEW.source_reference_ids <> '[]'::jsonb
     OR NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.canonical_business_id IS DISTINCT FROM OLD.canonical_business_id OR NEW.channel IS DISTINCT FROM OLD.channel
     OR NEW.source_key IS DISTINCT FROM OLD.source_key OR NEW.eligibility_id IS DISTINCT FROM OLD.eligibility_id
     OR NEW.outreach_authorization IS DISTINCT FROM OLD.outreach_authorization
     OR NEW.deletion_required IS DISTINCT FROM OLD.deletion_required
     OR NEW.observed_at IS DISTINCT FROM OLD.observed_at OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Contact evidence only permits a one-way policy purge transition.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_purge_transition_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER approved_business_contact_evidence_lifecycle_guard
BEFORE UPDATE OR DELETE ON approved_business_contact_evidence
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_contact_evidence_lifecycle();
--> statement-breakpoint
CREATE TRIGGER business_domain_verification_decisions_append_only
BEFORE UPDATE OR DELETE ON business_domain_verification_decisions
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('business_domain_verification_decisions_append_only');
--> statement-breakpoint
CREATE TRIGGER contact_data_eligibility_decisions_append_only
BEFORE UPDATE OR DELETE ON contact_data_eligibility_decisions
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('contact_data_eligibility_decisions_append_only');) THEN
      RAISE EXCEPTION 'Email contact evidence must be normalized lowercase email.'
        USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_email_guard';
    END IF;
    IF NEW.channel = 'phone' AND NEW.normalized_value !~ '^\+[1-9][0-9]{7,14}
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
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_contact_evidence_eligibility()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE eligibility contact_data_eligibility_decisions%ROWTYPE;
BEGIN
  SELECT * INTO eligibility FROM contact_data_eligibility_decisions
  WHERE id = NEW.eligibility_id AND workspace_id = NEW.workspace_id;
  IF eligibility.id IS NULL
     OR eligibility.decision <> 'allow'
     OR eligibility.source_admission_decision <> 'allow'
     OR eligibility.canonical_business_id <> NEW.canonical_business_id
     OR eligibility.channel <> NEW.channel
     OR eligibility.source_key <> NEW.source_key THEN
    RAISE EXCEPTION 'Contact evidence requires a matching allowed ContactDataEligibility decision.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_eligibility_guard';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(NEW.source_reference_ids) AS requested(reference_id)
    WHERE NOT eligibility.source_reference_ids ? requested.reference_id
  ) THEN
    RAISE EXCEPTION 'Contact evidence provenance must be a subset of approved eligibility references.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_provenance_guard';
  END IF;
  IF NEW.deletion_required IS DISTINCT FROM eligibility.deletion_required THEN
    RAISE EXCEPTION 'Contact evidence deletion policy must match its eligibility decision.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_deletion_policy_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER approved_business_contact_evidence_eligibility_guard
BEFORE INSERT ON approved_business_contact_evidence
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_contact_evidence_eligibility();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_domain_evidence_lifecycle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Domain evidence cannot be physically deleted; use policy purge.'
      USING ERRCODE = '23514', CONSTRAINT = 'business_domain_evidence_delete_guard';
  END IF;
  IF OLD.purged_at IS NOT NULL OR OLD.deletion_required IS NOT TRUE
     OR NEW.purged_at IS NULL OR NEW.purge_reason_code IS NULL
     OR NEW.normalized_domain IS NOT NULL OR NEW.source_reference_ids <> '[]'::jsonb
     OR NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.canonical_business_id IS DISTINCT FROM OLD.canonical_business_id
     OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.effect IS DISTINCT FROM OLD.effect
     OR NEW.source_key IS DISTINCT FROM OLD.source_key OR NEW.source_policy_id IS DISTINCT FROM OLD.source_policy_id
     OR NEW.source_policy_version IS DISTINCT FROM OLD.source_policy_version
     OR NEW.source_admission_decision_ref IS DISTINCT FROM OLD.source_admission_decision_ref
     OR NEW.source_admission_decision IS DISTINCT FROM OLD.source_admission_decision
     OR NEW.storage_class IS DISTINCT FROM OLD.storage_class OR NEW.retention_ttl_seconds IS DISTINCT FROM OLD.retention_ttl_seconds
     OR NEW.deletion_required IS DISTINCT FROM OLD.deletion_required OR NEW.refresh_after_seconds IS DISTINCT FROM OLD.refresh_after_seconds
     OR NEW.observed_at IS DISTINCT FROM OLD.observed_at OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Domain evidence only permits a one-way policy purge transition.'
      USING ERRCODE = '23514', CONSTRAINT = 'business_domain_evidence_purge_transition_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER business_domain_evidence_lifecycle_guard
BEFORE UPDATE OR DELETE ON business_domain_evidence
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_domain_evidence_lifecycle();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_contact_evidence_lifecycle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Contact evidence cannot be physically deleted; use policy purge.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_delete_guard';
  END IF;
  IF OLD.purged_at IS NOT NULL OR OLD.deletion_required IS NOT TRUE
     OR NEW.purged_at IS NULL OR NEW.purge_reason_code IS NULL
     OR NEW.normalized_value IS NOT NULL OR NEW.source_reference_ids <> '[]'::jsonb
     OR NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.canonical_business_id IS DISTINCT FROM OLD.canonical_business_id OR NEW.channel IS DISTINCT FROM OLD.channel
     OR NEW.source_key IS DISTINCT FROM OLD.source_key OR NEW.eligibility_id IS DISTINCT FROM OLD.eligibility_id
     OR NEW.outreach_authorization IS DISTINCT FROM OLD.outreach_authorization
     OR NEW.deletion_required IS DISTINCT FROM OLD.deletion_required
     OR NEW.observed_at IS DISTINCT FROM OLD.observed_at OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Contact evidence only permits a one-way policy purge transition.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_purge_transition_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER approved_business_contact_evidence_lifecycle_guard
BEFORE UPDATE OR DELETE ON approved_business_contact_evidence
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_contact_evidence_lifecycle();
--> statement-breakpoint
CREATE TRIGGER business_domain_verification_decisions_append_only
BEFORE UPDATE OR DELETE ON business_domain_verification_decisions
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('business_domain_verification_decisions_append_only');
--> statement-breakpoint
CREATE TRIGGER contact_data_eligibility_decisions_append_only
BEFORE UPDATE OR DELETE ON contact_data_eligibility_decisions
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('contact_data_eligibility_decisions_append_only'); THEN
      RAISE EXCEPTION 'Phone contact evidence must use E.164.'
        USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_phone_guard';
    END IF;
    IF NEW.channel IN ('website_form','social_profile')
       AND NEW.normalized_value !~ '^https?://[^/@[:space:]]+(?:[/:?#][^[:space:]]*)?
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
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_contact_evidence_eligibility()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE eligibility contact_data_eligibility_decisions%ROWTYPE;
BEGIN
  SELECT * INTO eligibility FROM contact_data_eligibility_decisions
  WHERE id = NEW.eligibility_id AND workspace_id = NEW.workspace_id;
  IF eligibility.id IS NULL
     OR eligibility.decision <> 'allow'
     OR eligibility.source_admission_decision <> 'allow'
     OR eligibility.canonical_business_id <> NEW.canonical_business_id
     OR eligibility.channel <> NEW.channel
     OR eligibility.source_key <> NEW.source_key THEN
    RAISE EXCEPTION 'Contact evidence requires a matching allowed ContactDataEligibility decision.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_eligibility_guard';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(NEW.source_reference_ids) AS requested(reference_id)
    WHERE NOT eligibility.source_reference_ids ? requested.reference_id
  ) THEN
    RAISE EXCEPTION 'Contact evidence provenance must be a subset of approved eligibility references.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_provenance_guard';
  END IF;
  IF NEW.deletion_required IS DISTINCT FROM eligibility.deletion_required THEN
    RAISE EXCEPTION 'Contact evidence deletion policy must match its eligibility decision.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_deletion_policy_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER approved_business_contact_evidence_eligibility_guard
BEFORE INSERT ON approved_business_contact_evidence
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_contact_evidence_eligibility();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_domain_evidence_lifecycle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Domain evidence cannot be physically deleted; use policy purge.'
      USING ERRCODE = '23514', CONSTRAINT = 'business_domain_evidence_delete_guard';
  END IF;
  IF OLD.purged_at IS NOT NULL OR OLD.deletion_required IS NOT TRUE
     OR NEW.purged_at IS NULL OR NEW.purge_reason_code IS NULL
     OR NEW.normalized_domain IS NOT NULL OR NEW.source_reference_ids <> '[]'::jsonb
     OR NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.canonical_business_id IS DISTINCT FROM OLD.canonical_business_id
     OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.effect IS DISTINCT FROM OLD.effect
     OR NEW.source_key IS DISTINCT FROM OLD.source_key OR NEW.source_policy_id IS DISTINCT FROM OLD.source_policy_id
     OR NEW.source_policy_version IS DISTINCT FROM OLD.source_policy_version
     OR NEW.source_admission_decision_ref IS DISTINCT FROM OLD.source_admission_decision_ref
     OR NEW.source_admission_decision IS DISTINCT FROM OLD.source_admission_decision
     OR NEW.storage_class IS DISTINCT FROM OLD.storage_class OR NEW.retention_ttl_seconds IS DISTINCT FROM OLD.retention_ttl_seconds
     OR NEW.deletion_required IS DISTINCT FROM OLD.deletion_required OR NEW.refresh_after_seconds IS DISTINCT FROM OLD.refresh_after_seconds
     OR NEW.observed_at IS DISTINCT FROM OLD.observed_at OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Domain evidence only permits a one-way policy purge transition.'
      USING ERRCODE = '23514', CONSTRAINT = 'business_domain_evidence_purge_transition_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER business_domain_evidence_lifecycle_guard
BEFORE UPDATE OR DELETE ON business_domain_evidence
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_domain_evidence_lifecycle();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_contact_evidence_lifecycle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Contact evidence cannot be physically deleted; use policy purge.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_delete_guard';
  END IF;
  IF OLD.purged_at IS NOT NULL OR OLD.deletion_required IS NOT TRUE
     OR NEW.purged_at IS NULL OR NEW.purge_reason_code IS NULL
     OR NEW.normalized_value IS NOT NULL OR NEW.source_reference_ids <> '[]'::jsonb
     OR NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.canonical_business_id IS DISTINCT FROM OLD.canonical_business_id OR NEW.channel IS DISTINCT FROM OLD.channel
     OR NEW.source_key IS DISTINCT FROM OLD.source_key OR NEW.eligibility_id IS DISTINCT FROM OLD.eligibility_id
     OR NEW.outreach_authorization IS DISTINCT FROM OLD.outreach_authorization
     OR NEW.deletion_required IS DISTINCT FROM OLD.deletion_required
     OR NEW.observed_at IS DISTINCT FROM OLD.observed_at OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Contact evidence only permits a one-way policy purge transition.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_purge_transition_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER approved_business_contact_evidence_lifecycle_guard
BEFORE UPDATE OR DELETE ON approved_business_contact_evidence
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_contact_evidence_lifecycle();
--> statement-breakpoint
CREATE TRIGGER business_domain_verification_decisions_append_only
BEFORE UPDATE OR DELETE ON business_domain_verification_decisions
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('business_domain_verification_decisions_append_only');
--> statement-breakpoint
CREATE TRIGGER contact_data_eligibility_decisions_append_only
BEFORE UPDATE OR DELETE ON contact_data_eligibility_decisions
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('contact_data_eligibility_decisions_append_only'); THEN
      RAISE EXCEPTION 'URL contact evidence must be credential-free HTTP(S).'
        USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_url_guard';
    END IF;
  END IF;
  RETURN NEW;
END;
$;
--> statement-breakpoint
CREATE TRIGGER business_domain_evidence_value_policy_guard
BEFORE INSERT OR UPDATE ON business_domain_evidence
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_entity_enrichment_value_policy();
--> statement-breakpoint
CREATE TRIGGER business_domain_verification_decisions_value_policy_guard
BEFORE INSERT ON business_domain_verification_decisions
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_entity_enrichment_value_policy();
--> statement-breakpoint
CREATE TRIGGER contact_data_eligibility_decisions_value_policy_guard
BEFORE INSERT ON contact_data_eligibility_decisions
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_entity_enrichment_value_policy();
--> statement-breakpoint
CREATE TRIGGER approved_business_contact_evidence_value_policy_guard
BEFORE INSERT OR UPDATE ON approved_business_contact_evidence
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_entity_enrichment_value_policy();
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
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_contact_evidence_eligibility()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE eligibility contact_data_eligibility_decisions%ROWTYPE;
BEGIN
  SELECT * INTO eligibility FROM contact_data_eligibility_decisions
  WHERE id = NEW.eligibility_id AND workspace_id = NEW.workspace_id;
  IF eligibility.id IS NULL
     OR eligibility.decision <> 'allow'
     OR eligibility.source_admission_decision <> 'allow'
     OR eligibility.canonical_business_id <> NEW.canonical_business_id
     OR eligibility.channel <> NEW.channel
     OR eligibility.source_key <> NEW.source_key THEN
    RAISE EXCEPTION 'Contact evidence requires a matching allowed ContactDataEligibility decision.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_eligibility_guard';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(NEW.source_reference_ids) AS requested(reference_id)
    WHERE NOT eligibility.source_reference_ids ? requested.reference_id
  ) THEN
    RAISE EXCEPTION 'Contact evidence provenance must be a subset of approved eligibility references.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_provenance_guard';
  END IF;
  IF NEW.deletion_required IS DISTINCT FROM eligibility.deletion_required THEN
    RAISE EXCEPTION 'Contact evidence deletion policy must match its eligibility decision.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_deletion_policy_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER approved_business_contact_evidence_eligibility_guard
BEFORE INSERT ON approved_business_contact_evidence
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_contact_evidence_eligibility();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_domain_evidence_lifecycle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Domain evidence cannot be physically deleted; use policy purge.'
      USING ERRCODE = '23514', CONSTRAINT = 'business_domain_evidence_delete_guard';
  END IF;
  IF OLD.purged_at IS NOT NULL OR OLD.deletion_required IS NOT TRUE
     OR NEW.purged_at IS NULL OR NEW.purge_reason_code IS NULL
     OR NEW.normalized_domain IS NOT NULL OR NEW.source_reference_ids <> '[]'::jsonb
     OR NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.canonical_business_id IS DISTINCT FROM OLD.canonical_business_id
     OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.effect IS DISTINCT FROM OLD.effect
     OR NEW.source_key IS DISTINCT FROM OLD.source_key OR NEW.source_policy_id IS DISTINCT FROM OLD.source_policy_id
     OR NEW.source_policy_version IS DISTINCT FROM OLD.source_policy_version
     OR NEW.source_admission_decision_ref IS DISTINCT FROM OLD.source_admission_decision_ref
     OR NEW.source_admission_decision IS DISTINCT FROM OLD.source_admission_decision
     OR NEW.storage_class IS DISTINCT FROM OLD.storage_class OR NEW.retention_ttl_seconds IS DISTINCT FROM OLD.retention_ttl_seconds
     OR NEW.deletion_required IS DISTINCT FROM OLD.deletion_required OR NEW.refresh_after_seconds IS DISTINCT FROM OLD.refresh_after_seconds
     OR NEW.observed_at IS DISTINCT FROM OLD.observed_at OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Domain evidence only permits a one-way policy purge transition.'
      USING ERRCODE = '23514', CONSTRAINT = 'business_domain_evidence_purge_transition_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER business_domain_evidence_lifecycle_guard
BEFORE UPDATE OR DELETE ON business_domain_evidence
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_domain_evidence_lifecycle();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_contact_evidence_lifecycle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Contact evidence cannot be physically deleted; use policy purge.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_delete_guard';
  END IF;
  IF OLD.purged_at IS NOT NULL OR OLD.deletion_required IS NOT TRUE
     OR NEW.purged_at IS NULL OR NEW.purge_reason_code IS NULL
     OR NEW.normalized_value IS NOT NULL OR NEW.source_reference_ids <> '[]'::jsonb
     OR NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.canonical_business_id IS DISTINCT FROM OLD.canonical_business_id OR NEW.channel IS DISTINCT FROM OLD.channel
     OR NEW.source_key IS DISTINCT FROM OLD.source_key OR NEW.eligibility_id IS DISTINCT FROM OLD.eligibility_id
     OR NEW.outreach_authorization IS DISTINCT FROM OLD.outreach_authorization
     OR NEW.deletion_required IS DISTINCT FROM OLD.deletion_required
     OR NEW.observed_at IS DISTINCT FROM OLD.observed_at OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Contact evidence only permits a one-way policy purge transition.'
      USING ERRCODE = '23514', CONSTRAINT = 'approved_business_contact_evidence_purge_transition_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER approved_business_contact_evidence_lifecycle_guard
BEFORE UPDATE OR DELETE ON approved_business_contact_evidence
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_contact_evidence_lifecycle();
--> statement-breakpoint
CREATE TRIGGER business_domain_verification_decisions_append_only
BEFORE UPDATE OR DELETE ON business_domain_verification_decisions
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('business_domain_verification_decisions_append_only');
--> statement-breakpoint
CREATE TRIGGER contact_data_eligibility_decisions_append_only
BEFORE UPDATE OR DELETE ON contact_data_eligibility_decisions
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('contact_data_eligibility_decisions_append_only');