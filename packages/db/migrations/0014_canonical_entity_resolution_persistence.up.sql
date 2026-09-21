CREATE TABLE canonical_businesses (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  identity_state text NOT NULL DEFAULT 'active',
  superseded_by_canonical_business_id text,
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
    ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX business_resolution_decisions_observation_idx
  ON business_resolution_decisions (workspace_id, source_observation_id, evaluated_at DESC, id);
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
CREATE OR REPLACE FUNCTION brovexa_internal.guard_canonical_business_supersession()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.display_name IS DISTINCT FROM OLD.display_name
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
