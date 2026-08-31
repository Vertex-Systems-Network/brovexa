CREATE TABLE memory_records (
  id text PRIMARY KEY,
  version text NOT NULL,
  revision_parent_id text,
  namespace text NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  run_id text,
  entity_id text,
  lead_id text,
  memory_type text NOT NULL,
  subtype text NOT NULL,
  writer text NOT NULL,
  ai_derived boolean NOT NULL,
  derivation jsonb,
  confidence double precision NOT NULL,
  authority text NOT NULL,
  status text NOT NULL,
  retention_policy_id text NOT NULL,
  deletion_reason text,
  data_classification text NOT NULL,
  envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  expires_at timestamptz,
  CONSTRAINT memory_records_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT memory_records_id_check CHECK (length(btrim(id)) > 0),
  CONSTRAINT memory_records_version_check CHECK (length(btrim(version)) > 0),
  CONSTRAINT memory_records_namespace_check CHECK (length(btrim(namespace)) > 0),
  CONSTRAINT memory_records_type_check CHECK (
    memory_type IN ('working', 'semantic', 'episodic', 'procedural', 'entity', 'lead', 'research', 'workspace_user')
  ),
  CONSTRAINT memory_records_writer_check CHECK (writer IN ('user', 'agent', 'system', 'curator')),
  CONSTRAINT memory_records_authority_check CHECK (
    authority IN (
      'platform_policy',
      'explicit_configuration',
      'verified_fact',
      'reviewed_human_decision',
      'evaluated_agent_conclusion',
      'agent_inference',
      'historical_context'
    )
  ),
  CONSTRAINT memory_records_status_check CHECK (
    status IN ('proposed', 'active', 'stale', 'conflicted', 'superseded', 'rejected', 'deleted')
  ),
  CONSTRAINT memory_records_data_classification_check CHECK (
    data_classification IN (
      'PUBLIC_SOURCE_TRANSIENT',
      'PUBLIC_SOURCE_STORABLE',
      'BUSINESS_DATA',
      'PERSONAL_BUSINESS_CONTACT',
      'WORKSPACE_CONFIDENTIAL',
      'SECURITY_SENSITIVE',
      'BILLING_FINANCIAL',
      'AUDIT_IMMUTABLE',
      'AI_DERIVED'
    )
  ),
  CONSTRAINT memory_records_confidence_check CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT memory_records_ai_derivation_check CHECK (
    (ai_derived = true AND derivation IS NOT NULL)
    OR (ai_derived = false AND derivation IS NULL)
  ),
  CONSTRAINT memory_records_deletion_reason_check CHECK (
    (status = 'deleted' AND deletion_reason IS NOT NULL AND length(btrim(deletion_reason)) > 0)
    OR (status <> 'deleted' AND deletion_reason IS NULL)
  ),
  CONSTRAINT memory_records_protected_procedural_write_check CHECK (
    NOT (writer = 'agent' AND namespace LIKE 'system/procedural/%')
  ),
  CONSTRAINT memory_records_revision_not_self_check CHECK (
    revision_parent_id IS NULL OR revision_parent_id <> id
  ),
  CONSTRAINT memory_records_namespace_scope_check CHECK (
    namespace LIKE 'system/procedural/%'
    OR namespace LIKE ('workspace/' || workspace_id::text || '/%')
    OR (
      user_id IS NOT NULL
      AND namespace LIKE ('user/' || user_id::text || '/workspace/' || workspace_id::text || '/%')
    )
    OR (
      run_id IS NOT NULL
      AND namespace LIKE ('run/' || run_id || '/%')
    )
  ),
  CONSTRAINT memory_records_revision_workspace_fk
    FOREIGN KEY (revision_parent_id, workspace_id)
    REFERENCES memory_records (id, workspace_id)
    ON DELETE RESTRICT,
  CONSTRAINT memory_records_run_workspace_fk
    FOREIGN KEY (run_id, workspace_id)
    REFERENCES agent_runs (id, workspace_id)
    ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX memory_records_workspace_status_idx
  ON memory_records (workspace_id, status, updated_at DESC);
--> statement-breakpoint
CREATE INDEX memory_records_workspace_namespace_idx
  ON memory_records (workspace_id, namespace, updated_at DESC);
--> statement-breakpoint
CREATE INDEX memory_records_revision_parent_idx
  ON memory_records (workspace_id, revision_parent_id);
--> statement-breakpoint
CREATE TABLE agent_eval_results (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  evaluator_run_id text NOT NULL,
  subject_run_id text NOT NULL,
  decision text NOT NULL,
  evidence_state text NOT NULL,
  reason_codes jsonb NOT NULL,
  evidence_refs jsonb NOT NULL,
  policy_refs jsonb NOT NULL,
  confidence double precision NOT NULL,
  envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT agent_eval_results_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT agent_eval_results_id_check CHECK (length(btrim(id)) > 0),
  CONSTRAINT agent_eval_results_decision_check CHECK (decision IN ('accept', 'reject', 'review')),
  CONSTRAINT agent_eval_results_evidence_state_check CHECK (
    evidence_state IN ('verified', 'insufficient', 'contradicted', 'stale', 'policy_invalid')
  ),
  CONSTRAINT agent_eval_results_confidence_check CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT agent_eval_results_independent_run_check CHECK (evaluator_run_id <> subject_run_id),
  CONSTRAINT agent_eval_results_accept_verified_check CHECK (
    decision <> 'accept' OR evidence_state = 'verified'
  ),
  CONSTRAINT agent_eval_results_reason_codes_check CHECK (
    jsonb_typeof(reason_codes) = 'array' AND jsonb_array_length(reason_codes) >= 1
  ),
  CONSTRAINT agent_eval_results_evidence_refs_check CHECK (jsonb_typeof(evidence_refs) = 'array'),
  CONSTRAINT agent_eval_results_policy_refs_check CHECK (
    jsonb_typeof(policy_refs) = 'array' AND jsonb_array_length(policy_refs) >= 1
  ),
  CONSTRAINT agent_eval_results_evaluator_workspace_fk
    FOREIGN KEY (evaluator_run_id, workspace_id)
    REFERENCES agent_runs (id, workspace_id)
    ON DELETE RESTRICT,
  CONSTRAINT agent_eval_results_subject_workspace_fk
    FOREIGN KEY (subject_run_id, workspace_id)
    REFERENCES agent_runs (id, workspace_id)
    ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX agent_eval_results_workspace_subject_idx
  ON agent_eval_results (workspace_id, subject_run_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX agent_eval_results_workspace_evaluator_idx
  ON agent_eval_results (workspace_id, evaluator_run_id, created_at DESC);
