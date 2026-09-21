CREATE TABLE canonical_businesses (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  identity_state text NOT NULL DEFAULT 'active',
  superseded_by_canonical_business_id text,
  origin_decision_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT canonical_businesses_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT canonical_businesses_id_check
    CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  CONSTRAINT canonical_businesses_display_name_check
    CHECK (length(btrim(display_name)) BETWEEN 1 AND 512),
  CONSTRAINT canonical_businesses_state_check
    CHECK (identity_state IN ('active', 'superseded')),
  CONSTRAINT canonical_businesses_supersession_shape_check CHECK (
    (identity_state = 'active' AND superseded_by_canonical_business_id IS NULL)
    OR (
      identity_state = 'superseded'
      AND superseded_by_canonical_business_id IS NOT NULL
      AND superseded_by_canonical_business_id <> id
    )
  ),
  CONSTRAINT canonical_businesses_superseded_workspace_fk
    FOREIGN KEY (superseded_by_canonical_business_id, workspace_id)
    REFERENCES canonical_businesses (id, workspace_id)
    ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX canonical_businesses_workspace_state_idx
  ON canonical_businesses (workspace_id, identity_state, id);
--> statement-breakpoint
CREATE TABLE source_business_observations (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_candidate_id text NOT NULL,
  source_key text NOT NULL,
  observed_at timestamptz NOT NULL,
  source_reference_ids jsonb NOT NULL,
  identity_signals jsonb NOT NULL,
  envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_business_observations_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT source_business_observations_id_check
    CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  CONSTRAINT source_business_observations_candidate_id_check
    CHECK (source_candidate_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  CONSTRAINT source_business_observations_source_key_check
    CHECK (source_key ~ '^source\.[a-z0-9_.-]+$'),
  CONSTRAINT source_business_observations_refs_array_check
    CHECK (jsonb_typeof(source_reference_ids) = 'array' AND jsonb_array_length(source_reference_ids) > 0),
  CONSTRAINT source_business_observations_signals_array_check
    CHECK (jsonb_typeof(identity_signals) = 'array' AND jsonb_array_length(identity_signals) > 0),
  CONSTRAINT source_business_observations_envelope_object_check
    CHECK (jsonb_typeof(envelope) = 'object'),
  CONSTRAINT source_business_observations_envelope_identity_check CHECK (
    envelope->>'version' = '1.0.0'
    AND envelope->>'workspaceId' = workspace_id::text
    AND envelope->>'sourceObservationId' = id
    AND envelope->>'sourceCandidateId' = source_candidate_id
    AND envelope->>'sourceKey' = source_key
    AND (envelope->>'observedAt')::timestamptz = observed_at
    AND envelope->'sourceReferenceIds' = source_reference_ids
    AND envelope->'identitySignals' = identity_signals
  )
);
--> statement-breakpoint
CREATE INDEX source_business_observations_workspace_source_time_idx
  ON source_business_observations (workspace_id, source_key, observed_at DESC, id);
--> statement-breakpoint
CREATE TABLE candidate_business_match_evidence (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_observation_id text NOT NULL,
  candidate_canonical_business_id text NOT NULL,
  observation_signal_ids jsonb NOT NULL,
  source_reference_ids jsonb NOT NULL,
  method text NOT NULL,
  inference_ref text,
  effect text NOT NULL,
  reason_code text NOT NULL,
  confidence double precision NOT NULL,
  recorded_at timestamptz NOT NULL,
  envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_business_match_evidence_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT candidate_business_match_evidence_id_check
    CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  CONSTRAINT candidate_business_match_evidence_method_check
    CHECK (method IN ('deterministic', 'structured_ai')),
  CONSTRAINT candidate_business_match_evidence_effect_check
    CHECK (effect IN ('supports_match', 'contradicts_match')),
  CONSTRAINT candidate_business_match_evidence_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT candidate_business_match_evidence_inference_check CHECK (
    (method = 'deterministic' AND inference_ref IS NULL)
    OR (method = 'structured_ai' AND inference_ref IS NOT NULL)
  ),
  CONSTRAINT candidate_business_match_evidence_signal_array_check
    CHECK (jsonb_typeof(observation_signal_ids) = 'array' AND jsonb_array_length(observation_signal_ids) > 0),
  CONSTRAINT candidate_business_match_evidence_refs_array_check
    CHECK (jsonb_typeof(source_reference_ids) = 'array' AND jsonb_array_length(source_reference_ids) > 0),
  CONSTRAINT candidate_business_match_evidence_envelope_object_check
    CHECK (jsonb_typeof(envelope) = 'object'),
  CONSTRAINT candidate_business_match_evidence_envelope_identity_check CHECK (
    envelope->>'evidenceId' = id
    AND envelope->>'workspaceId' = workspace_id::text
    AND envelope->>'sourceObservationId' = source_observation_id
    AND envelope->>'candidateCanonicalBusinessId' = candidate_canonical_business_id
    AND envelope->'observationSignalIds' = observation_signal_ids
    AND envelope->'sourceReferenceIds' = source_reference_ids
    AND envelope->>'method' = method
    AND ((inference_ref IS NULL AND envelope->>'inferenceRef' IS NULL) OR envelope->>'inferenceRef' = inference_ref)
    AND envelope->>'effect' = effect
    AND envelope->>'reasonCode' = reason_code
    AND (envelope->>'confidence')::double precision = confidence
    AND (envelope->>'recordedAt')::timestamptz = recorded_at
  ),
  CONSTRAINT candidate_business_match_evidence_observation_fk
    FOREIGN KEY (source_observation_id, workspace_id)
    REFERENCES source_business_observations (id, workspace_id)
    ON DELETE RESTRICT,
  CONSTRAINT candidate_business_match_evidence_candidate_fk
    FOREIGN KEY (candidate_canonical_business_id, workspace_id)
    REFERENCES canonical_businesses (id, workspace_id)
    ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX candidate_business_match_evidence_candidate_idx
  ON candidate_business_match_evidence (workspace_id, candidate_canonical_business_id, recorded_at DESC, id);
--> statement-breakpoint
CREATE INDEX candidate_business_match_evidence_observation_idx
  ON candidate_business_match_evidence (workspace_id, source_observation_id, recorded_at DESC, id);
--> statement-breakpoint
CREATE TABLE business_resolution_decisions (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_observation_id text NOT NULL,
  candidate_canonical_business_id text,
  decision text NOT NULL,
  confidence double precision NOT NULL,
  review_state text NOT NULL,
  review_decision_ref text,
  reason_codes jsonb NOT NULL,
  evidence_ids jsonb NOT NULL,
  threshold_policy_id text NOT NULL,
  threshold_policy_version text NOT NULL,
  review_minimum double precision NOT NULL,
  auto_match_minimum double precision NOT NULL,
  evaluated_at timestamptz NOT NULL,
  envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_resolution_decisions_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT business_resolution_decisions_id_check
    CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  CONSTRAINT business_resolution_decisions_decision_check
    CHECK (decision IN ('match_existing', 'create_new', 'review_required')),
  CONSTRAINT business_resolution_decisions_review_state_check
    CHECK (review_state IN ('not_required', 'pending', 'approved', 'rejected')),
  CONSTRAINT business_resolution_decisions_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT business_resolution_decisions_reasons_array_check
    CHECK (jsonb_typeof(reason_codes) = 'array' AND jsonb_array_length(reason_codes) > 0),
  CONSTRAINT business_resolution_decisions_evidence_array_check
    CHECK (jsonb_typeof(evidence_ids) = 'array' AND jsonb_array_length(evidence_ids) > 0),
  CONSTRAINT business_resolution_decisions_threshold_policy_id_check
    CHECK (threshold_policy_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  CONSTRAINT business_resolution_decisions_threshold_policy_version_check
    CHECK (threshold_policy_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'),
  CONSTRAINT business_resolution_decisions_review_minimum_check
    CHECK (review_minimum >= 0 AND review_minimum <= 1),
  CONSTRAINT business_resolution_decisions_auto_match_minimum_check
    CHECK (auto_match_minimum >= 0 AND auto_match_minimum <= 1),
  CONSTRAINT business_resolution_decisions_threshold_order_check
    CHECK (review_minimum < auto_match_minimum),
  CONSTRAINT business_resolution_decisions_candidate_shape_check CHECK (
    (decision = 'match_existing' AND candidate_canonical_business_id IS NOT NULL)
    OR (decision = 'create_new' AND candidate_canonical_business_id IS NULL)
    OR decision = 'review_required'
  ),
  CONSTRAINT business_resolution_decisions_review_shape_check CHECK (
    (decision = 'review_required' AND review_state = 'pending')
    OR (decision <> 'review_required' AND review_state <> 'pending')
  ),
  CONSTRAINT business_resolution_decisions_review_ref_check CHECK (
    (review_state IN ('approved', 'rejected') AND review_decision_ref IS NOT NULL)
    OR (review_state NOT IN ('approved', 'rejected') AND review_decision_ref IS NULL)
  ),
  CONSTRAINT business_resolution_decisions_observation_fk
    FOREIGN KEY (source_observation_id, workspace_id)
    REFERENCES source_business_observations (id, workspace_id)
    ON DELETE RESTRICT,
  CONSTRAINT business_resolution_decisions_candidate_fk
    FOREIGN KEY (candidate_canonical_business_id, workspace_id)
    REFERENCES canonical_businesses (id, workspace_id)
    ON DELETE RESTRICT,
  CONSTRAINT business_resolution_decisions_envelope_object_check
    CHECK (jsonb_typeof(envelope) = 'object'),
  CONSTRAINT business_resolution_decisions_envelope_identity_check CHECK (
    envelope->>'decisionId' = id
    AND envelope->>'workspaceId' = workspace_id::text
    AND envelope->>'sourceObservationId' = source_observation_id
    AND ((candidate_canonical_business_id IS NULL AND envelope->>'candidateCanonicalBusinessId' IS NULL)
         OR envelope->>'candidateCanonicalBusinessId' = candidate_canonical_business_id)
    AND envelope->>'decision' = decision
    AND (envelope->>'confidence')::double precision = confidence
    AND envelope->>'reviewState' = review_state
    AND ((review_decision_ref IS NULL AND envelope->>'reviewDecisionRef' IS NULL)
         OR envelope->>'reviewDecisionRef' = review_decision_ref)
    AND envelope->'reasonCodes' = reason_codes
    AND envelope->'evidenceIds' = evidence_ids
    AND envelope->'thresholdPolicy'->>'policyId' = threshold_policy_id
    AND envelope->'thresholdPolicy'->>'version' = threshold_policy_version
    AND (envelope->'thresholdPolicy'->>'reviewMinimum')::double precision = review_minimum
    AND (envelope->'thresholdPolicy'->>'autoMatchMinimum')::double precision = auto_match_minimum
    AND (envelope->>'evaluatedAt')::timestamptz = evaluated_at
  )
);
--> statement-breakpoint
CREATE INDEX business_resolution_decisions_observation_idx
  ON business_resolution_decisions (workspace_id, source_observation_id, evaluated_at DESC, id);
--> statement-breakpoint
ALTER TABLE canonical_businesses
  ADD CONSTRAINT canonical_businesses_origin_decision_fk
  FOREIGN KEY (origin_decision_id, workspace_id)
  REFERENCES business_resolution_decisions (id, workspace_id)
  ON DELETE RESTRICT;
--> statement-breakpoint
CREATE TABLE canonical_business_aliases (
  source_observation_id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  canonical_business_id text NOT NULL,
  decision_id text NOT NULL,
  attached_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT canonical_business_aliases_observation_workspace_unique
    UNIQUE (source_observation_id, workspace_id),
  CONSTRAINT canonical_business_aliases_decision_workspace_unique
    UNIQUE (decision_id, workspace_id),
  CONSTRAINT canonical_business_aliases_observation_fk
    FOREIGN KEY (source_observation_id, workspace_id)
    REFERENCES source_business_observations (id, workspace_id)
    ON DELETE RESTRICT,
  CONSTRAINT canonical_business_aliases_business_fk
    FOREIGN KEY (canonical_business_id, workspace_id)
    REFERENCES canonical_businesses (id, workspace_id)
    ON DELETE RESTRICT,
  CONSTRAINT canonical_business_aliases_decision_fk
    FOREIGN KEY (decision_id, workspace_id)
    REFERENCES business_resolution_decisions (id, workspace_id)
    ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX canonical_business_aliases_business_idx
  ON canonical_business_aliases (workspace_id, canonical_business_id, attached_at DESC, source_observation_id);
--> statement-breakpoint
CREATE TABLE canonical_business_lineage_operations (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  operation_type text NOT NULL,
  request_id text NOT NULL,
  target_canonical_business_id text NOT NULL,
  source_canonical_business_ids jsonb NOT NULL,
  restore_canonical_business_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  parent_lineage_operation_id text,
  evidence_ids jsonb NOT NULL,
  reason_codes jsonb NOT NULL,
  requested_by_actor_id text NOT NULL,
  requested_at timestamptz NOT NULL,
  review_request_id text NOT NULL,
  review_state text NOT NULL DEFAULT 'pending',
  reversible boolean NOT NULL DEFAULT true,
  envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT canonical_business_lineage_operations_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT canonical_business_lineage_operations_request_workspace_unique UNIQUE (request_id, workspace_id),
  CONSTRAINT canonical_business_lineage_operations_id_check
    CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  CONSTRAINT canonical_business_lineage_operations_type_check
    CHECK (operation_type IN ('merge', 'split')),
  CONSTRAINT canonical_business_lineage_operations_review_check
    CHECK (review_state = 'pending'),
  CONSTRAINT canonical_business_lineage_operations_reversible_check
    CHECK (reversible = true),
  CONSTRAINT canonical_business_lineage_operations_source_array_check
    CHECK (jsonb_typeof(source_canonical_business_ids) = 'array' AND jsonb_array_length(source_canonical_business_ids) > 0),
  CONSTRAINT canonical_business_lineage_operations_restore_array_check
    CHECK (jsonb_typeof(restore_canonical_business_ids) = 'array'),
  CONSTRAINT canonical_business_lineage_operations_evidence_array_check
    CHECK (jsonb_typeof(evidence_ids) = 'array' AND jsonb_array_length(evidence_ids) > 0),
  CONSTRAINT canonical_business_lineage_operations_reason_array_check
    CHECK (jsonb_typeof(reason_codes) = 'array' AND jsonb_array_length(reason_codes) > 0),
  CONSTRAINT canonical_business_lineage_operations_target_fk
    FOREIGN KEY (target_canonical_business_id, workspace_id)
    REFERENCES canonical_businesses (id, workspace_id)
    ON DELETE RESTRICT,
  CONSTRAINT canonical_business_lineage_operations_parent_fk
    FOREIGN KEY (parent_lineage_operation_id, workspace_id)
    REFERENCES canonical_business_lineage_operations (id, workspace_id)
    ON DELETE RESTRICT,
  CONSTRAINT canonical_business_lineage_operations_shape_check CHECK (
    (
      operation_type = 'merge'
      AND parent_lineage_operation_id IS NULL
      AND jsonb_array_length(source_canonical_business_ids) >= 2
      AND source_canonical_business_ids ? target_canonical_business_id
      AND jsonb_array_length(restore_canonical_business_ids) = 0
    )
    OR (
      operation_type = 'split'
      AND parent_lineage_operation_id IS NOT NULL
      AND jsonb_array_length(restore_canonical_business_ids) >= 2
      AND restore_canonical_business_ids ? target_canonical_business_id
    )
  )
);
--> statement-breakpoint
CREATE INDEX canonical_business_lineage_operations_target_idx
  ON canonical_business_lineage_operations (workspace_id, target_canonical_business_id, requested_at DESC, id);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_candidate_match_evidence_provenance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  observation_refs jsonb;
  observation_signals jsonb;
BEGIN
  SELECT source_reference_ids, identity_signals
    INTO observation_refs, observation_signals
  FROM source_business_observations
  WHERE id = NEW.source_observation_id
    AND workspace_id = NEW.workspace_id;

  IF observation_refs IS NULL OR observation_signals IS NULL THEN
    RAISE EXCEPTION 'Candidate evidence requires an existing source observation in the same workspace.'
      USING ERRCODE = '23514', CONSTRAINT = 'candidate_business_match_evidence_observation_provenance_guard';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(NEW.observation_signal_ids) AS requested(signal_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(observation_signals) AS signal
      WHERE signal->>'signalId' = requested.signal_id
    )
  ) THEN
    RAISE EXCEPTION 'Candidate evidence may reference only signals from the source observation.'
      USING ERRCODE = '23514', CONSTRAINT = 'candidate_business_match_evidence_signal_guard';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(NEW.source_reference_ids) AS requested(reference_id)
    WHERE NOT observation_refs ? requested.reference_id
       OR NOT EXISTS (
         SELECT 1
         FROM jsonb_array_elements(observation_signals) AS signal
         WHERE NEW.observation_signal_ids ? (signal->>'signalId')
           AND (signal->'sourceReferenceIds') ? requested.reference_id
       )
  ) THEN
    RAISE EXCEPTION 'Candidate evidence references must be bound to the referenced observation signals.'
      USING ERRCODE = '23514', CONSTRAINT = 'candidate_business_match_evidence_reference_guard';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER candidate_business_match_evidence_provenance_guard
BEFORE INSERT ON candidate_business_match_evidence
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_candidate_match_evidence_provenance();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_resolution_decision_policy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  referenced_count integer;
  requires_review boolean := false;
BEGIN
  SELECT count(DISTINCT evidence.id)
    INTO referenced_count
  FROM candidate_business_match_evidence AS evidence
  WHERE evidence.workspace_id = NEW.workspace_id
    AND evidence.source_observation_id = NEW.source_observation_id
    AND NEW.evidence_ids ? evidence.id;

  IF referenced_count <> jsonb_array_length(NEW.evidence_ids) THEN
    RAISE EXCEPTION 'Every decision evidence ID must exist in the same workspace and source observation.'
      USING ERRCODE = '23514', CONSTRAINT = 'business_resolution_decisions_evidence_binding_guard';
  END IF;

  IF NEW.decision = 'match_existing' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM candidate_business_match_evidence AS evidence
      WHERE evidence.workspace_id = NEW.workspace_id
        AND evidence.source_observation_id = NEW.source_observation_id
        AND evidence.candidate_canonical_business_id = NEW.candidate_canonical_business_id
        AND NEW.evidence_ids ? evidence.id
        AND evidence.effect = 'supports_match'
    ) THEN
      RAISE EXCEPTION 'match_existing requires supporting evidence for the selected canonical business.'
        USING ERRCODE = '23514', CONSTRAINT = 'business_resolution_decisions_match_support_guard';
    END IF;

    requires_review :=
      NEW.confidence < NEW.auto_match_minimum
      OR EXISTS (
        SELECT 1
        FROM candidate_business_match_evidence AS evidence
        WHERE evidence.workspace_id = NEW.workspace_id
          AND evidence.source_observation_id = NEW.source_observation_id
          AND evidence.candidate_canonical_business_id = NEW.candidate_canonical_business_id
          AND evidence.effect = 'contradicts_match'
      )
      OR EXISTS (
        SELECT 1
        FROM candidate_business_match_evidence AS evidence
        WHERE evidence.workspace_id = NEW.workspace_id
          AND evidence.source_observation_id = NEW.source_observation_id
          AND evidence.candidate_canonical_business_id = NEW.candidate_canonical_business_id
          AND NEW.evidence_ids ? evidence.id
          AND evidence.method = 'structured_ai'
      );
  ELSIF NEW.decision = 'create_new' THEN
    requires_review := EXISTS (
      SELECT 1
      FROM candidate_business_match_evidence AS evidence
      WHERE evidence.workspace_id = NEW.workspace_id
        AND evidence.source_observation_id = NEW.source_observation_id
        AND evidence.effect = 'supports_match'
        AND evidence.confidence >= NEW.review_minimum
    );
  END IF;

  IF requires_review AND NEW.review_state <> 'approved' THEN
    RAISE EXCEPTION 'Resolution policy requires explicit review approval.'
      USING ERRCODE = '23514', CONSTRAINT = 'business_resolution_decisions_review_policy_guard';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER business_resolution_decisions_policy_guard
BEFORE INSERT ON business_resolution_decisions
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_resolution_decision_policy();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_canonical_business_origin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  origin_decision text;
  origin_review_state text;
BEGIN
  IF NEW.origin_decision_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT decision, review_state
    INTO origin_decision, origin_review_state
  FROM business_resolution_decisions
  WHERE id = NEW.origin_decision_id
    AND workspace_id = NEW.workspace_id;

  IF origin_decision IS DISTINCT FROM 'create_new'
     OR origin_review_state IN ('pending', 'rejected') THEN
    RAISE EXCEPTION 'Canonical business origin must reference a finalized create_new decision in the same workspace.'
      USING ERRCODE = '23514', CONSTRAINT = 'canonical_businesses_origin_decision_guard';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER canonical_businesses_origin_guard
BEFORE INSERT ON canonical_businesses
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_canonical_business_origin();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_lineage_evidence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  referenced_count integer;
BEGIN
  SELECT count(DISTINCT evidence.id)
    INTO referenced_count
  FROM candidate_business_match_evidence AS evidence
  WHERE evidence.workspace_id = NEW.workspace_id
    AND NEW.evidence_ids ? evidence.id;

  IF referenced_count <> jsonb_array_length(NEW.evidence_ids) THEN
    RAISE EXCEPTION 'Every lineage evidence ID must exist in the same workspace.'
      USING ERRCODE = '23514', CONSTRAINT = 'canonical_business_lineage_operations_evidence_guard';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER canonical_business_lineage_operations_evidence_guard
BEFORE INSERT ON canonical_business_lineage_operations
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_lineage_evidence();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_canonical_business_supersession()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.display_name IS DISTINCT FROM OLD.display_name
     OR NEW.origin_decision_id IS DISTINCT FROM OLD.origin_decision_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Canonical business durable identity fields are immutable.'
      USING ERRCODE = '23514', CONSTRAINT = 'canonical_businesses_identity_immutable_guard';
  END IF;

  IF OLD.identity_state <> 'active'
     OR NEW.identity_state <> 'superseded'
     OR NEW.superseded_by_canonical_business_id IS NULL
     OR NEW.superseded_by_canonical_business_id = OLD.id THEN
    RAISE EXCEPTION 'Canonical business state may only transition active -> superseded to another identity.'
      USING ERRCODE = '23514', CONSTRAINT = 'canonical_businesses_supersession_transition_guard';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER canonical_businesses_supersession_guard
BEFORE UPDATE ON canonical_businesses
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_canonical_business_supersession();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_canonical_business_alias_binding()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  bound_observation_id text;
  bound_candidate_id text;
  bound_decision text;
  bound_review_state text;
  bound_origin_decision_id text;
BEGIN
  SELECT source_observation_id, candidate_canonical_business_id, decision, review_state
    INTO bound_observation_id, bound_candidate_id, bound_decision, bound_review_state
  FROM business_resolution_decisions
  WHERE id = NEW.decision_id
    AND workspace_id = NEW.workspace_id;

  IF bound_observation_id IS DISTINCT FROM NEW.source_observation_id THEN
    RAISE EXCEPTION 'Canonical alias decision must resolve the same source observation.'
      USING ERRCODE = '23514', CONSTRAINT = 'canonical_business_aliases_decision_observation_guard';
  END IF;

  IF bound_decision = 'review_required' OR bound_review_state IN ('pending', 'rejected') THEN
    RAISE EXCEPTION 'Canonical alias cannot be attached from an unresolved or rejected decision.'
      USING ERRCODE = '23514', CONSTRAINT = 'canonical_business_aliases_decision_state_guard';
  END IF;

  SELECT origin_decision_id
    INTO bound_origin_decision_id
  FROM canonical_businesses
  WHERE id = NEW.canonical_business_id
    AND workspace_id = NEW.workspace_id;

  IF bound_decision = 'create_new'
     AND bound_origin_decision_id IS DISTINCT FROM NEW.decision_id THEN
    RAISE EXCEPTION 'create_new alias must bind to the canonical business created by the same decision.'
      USING ERRCODE = '23514', CONSTRAINT = 'canonical_business_aliases_origin_decision_guard';
  END IF;

  IF bound_decision = 'match_existing'
     AND bound_candidate_id IS DISTINCT FROM NEW.canonical_business_id THEN
    RAISE EXCEPTION 'match_existing alias must bind to the selected canonical candidate.'
      USING ERRCODE = '23514', CONSTRAINT = 'canonical_business_aliases_candidate_guard';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER canonical_business_aliases_binding_guard
BEFORE INSERT ON canonical_business_aliases
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_canonical_business_alias_binding();
--> statement-breakpoint
CREATE TRIGGER source_business_observations_append_only
BEFORE UPDATE OR DELETE ON source_business_observations
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('source_business_observations_append_only');
--> statement-breakpoint
CREATE TRIGGER candidate_business_match_evidence_append_only
BEFORE UPDATE OR DELETE ON candidate_business_match_evidence
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('candidate_business_match_evidence_append_only');
--> statement-breakpoint
CREATE TRIGGER business_resolution_decisions_append_only
BEFORE UPDATE OR DELETE ON business_resolution_decisions
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('business_resolution_decisions_append_only');
--> statement-breakpoint
CREATE TRIGGER canonical_business_aliases_append_only
BEFORE UPDATE OR DELETE ON canonical_business_aliases
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('canonical_business_aliases_append_only');
--> statement-breakpoint
CREATE TRIGGER canonical_business_lineage_operations_append_only
BEFORE UPDATE OR DELETE ON canonical_business_lineage_operations
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('canonical_business_lineage_operations_append_only');
