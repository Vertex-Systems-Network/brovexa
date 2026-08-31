CREATE TABLE agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_run_id uuid,
  requested_by_membership_id uuid,
  agent_key text NOT NULL,
  agent_version integer NOT NULL,
  definition_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_runs_key_check CHECK (agent_key ~ '^agent\.[a-z][a-z0-9_.-]*$'),
  CONSTRAINT agent_runs_version_check CHECK (agent_version > 0),
  CONSTRAINT agent_runs_definition_hash_check CHECK (definition_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT agent_runs_status_check CHECK (
    status IN ('pending', 'running', 'paused', 'review', 'succeeded', 'failed', 'cancelled')
  ),
  CONSTRAINT agent_runs_input_object_check CHECK (jsonb_typeof(input) = 'object'),
  CONSTRAINT agent_runs_parent_not_self_check CHECK (parent_run_id IS NULL OR parent_run_id <> id),
  CONSTRAINT agent_runs_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT agent_runs_id_workspace_definition_unique UNIQUE (
    id,
    workspace_id,
    agent_key,
    agent_version
  ),
  CONSTRAINT agent_runs_parent_workspace_fk
    FOREIGN KEY (parent_run_id, workspace_id)
    REFERENCES agent_runs (id, workspace_id),
  CONSTRAINT agent_runs_requester_workspace_fk
    FOREIGN KEY (requested_by_membership_id, workspace_id)
    REFERENCES workspace_memberships (id, workspace_id)
);
--> statement-breakpoint
CREATE INDEX agent_runs_workspace_status_created_idx
  ON agent_runs (workspace_id, status, created_at DESC);
--> statement-breakpoint
CREATE INDEX agent_runs_workspace_agent_created_idx
  ON agent_runs (workspace_id, agent_key, agent_version, created_at DESC);
--> statement-breakpoint
CREATE TABLE agent_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_run_id uuid NOT NULL,
  sequence integer NOT NULL,
  checkpoint_key text NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  state_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_checkpoints_sequence_check CHECK (sequence > 0),
  CONSTRAINT agent_checkpoints_key_check CHECK (checkpoint_key ~ '^[a-z][a-z0-9_.-]*$'),
  CONSTRAINT agent_checkpoints_state_object_check CHECK (jsonb_typeof(state) = 'object'),
  CONSTRAINT agent_checkpoints_state_hash_check CHECK (state_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT agent_checkpoints_run_sequence_unique UNIQUE (agent_run_id, sequence),
  CONSTRAINT agent_checkpoints_run_state_unique UNIQUE (agent_run_id, checkpoint_key, state_hash),
  CONSTRAINT agent_checkpoints_run_workspace_fk
    FOREIGN KEY (agent_run_id, workspace_id)
    REFERENCES agent_runs (id, workspace_id)
    ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX agent_checkpoints_workspace_run_created_idx
  ON agent_checkpoints (workspace_id, agent_run_id, created_at DESC);
--> statement-breakpoint
CREATE TABLE memory_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid,
  agent_run_id uuid,
  revision_parent_id uuid,
  namespace text NOT NULL,
  memory_type text NOT NULL,
  subtype text NOT NULL,
  status text NOT NULL DEFAULT 'proposed',
  authority_class integer NOT NULL,
  content jsonb NOT NULL,
  provenance jsonb NOT NULL,
  writer_kind text NOT NULL,
  writer_agent_key text,
  writer_agent_version integer,
  confidence_bps integer NOT NULL,
  data_classification text NOT NULL DEFAULT 'internal',
  observed_at timestamptz,
  last_verified_at timestamptz,
  refresh_after timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memory_records_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT memory_records_namespace_length_check CHECK (length(namespace) BETWEEN 1 AND 512),
  CONSTRAINT memory_records_type_check CHECK (
    memory_type IN (
      'working',
      'semantic',
      'episodic',
      'procedural',
      'entity',
      'lead',
      'research',
      'workspace_user'
    )
  ),
  CONSTRAINT memory_records_subtype_check CHECK (subtype ~ '^[a-z][a-z0-9_.-]*$'),
  CONSTRAINT memory_records_status_check CHECK (
    status IN (
      'proposed',
      'active',
      'stale',
      'conflicted',
      'superseded',
      'rejected',
      'deleted',
      'quarantined'
    )
  ),
  CONSTRAINT memory_records_authority_check CHECK (authority_class BETWEEN 1 AND 7),
  CONSTRAINT memory_records_content_object_check CHECK (jsonb_typeof(content) = 'object'),
  CONSTRAINT memory_records_provenance_object_check CHECK (
    jsonb_typeof(provenance) = 'object' AND provenance <> '{}'::jsonb
  ),
  CONSTRAINT memory_records_writer_kind_check CHECK (writer_kind IN ('user', 'agent', 'system', 'curator')),
  CONSTRAINT memory_records_writer_agent_check CHECK (
    (
      writer_kind IN ('agent', 'curator')
      AND writer_agent_key ~ '^agent\.[a-z][a-z0-9_.-]*$'
      AND writer_agent_version > 0
    )
    OR (
      writer_kind IN ('user', 'system')
      AND writer_agent_key IS NULL
      AND writer_agent_version IS NULL
    )
  ),
  CONSTRAINT memory_records_confidence_check CHECK (confidence_bps BETWEEN 0 AND 10000),
  CONSTRAINT memory_records_classification_check CHECK (
    data_classification IN ('public', 'internal', 'confidential', 'restricted')
  ),
  CONSTRAINT memory_records_namespace_scope_check CHECK (
    namespace LIKE 'workspace/' || workspace_id::text || '/%'
    OR (
      user_id IS NOT NULL
      AND namespace LIKE 'user/' || user_id::text || '/workspace/' || workspace_id::text || '/%'
    )
    OR (
      agent_run_id IS NOT NULL
      AND namespace LIKE 'run/' || agent_run_id::text || '/%'
    )
  ),
  CONSTRAINT memory_records_revision_not_self_check CHECK (
    revision_parent_id IS NULL OR revision_parent_id <> id
  ),
  CONSTRAINT memory_records_user_workspace_fk
    FOREIGN KEY (workspace_id, user_id)
    REFERENCES workspace_memberships (workspace_id, user_id),
  CONSTRAINT memory_records_run_workspace_fk
    FOREIGN KEY (agent_run_id, workspace_id)
    REFERENCES agent_runs (id, workspace_id),
  CONSTRAINT memory_records_revision_workspace_fk
    FOREIGN KEY (revision_parent_id, workspace_id)
    REFERENCES memory_records (id, workspace_id)
);
--> statement-breakpoint
CREATE INDEX memory_records_workspace_status_type_idx
  ON memory_records (workspace_id, status, memory_type, updated_at DESC);
--> statement-breakpoint
CREATE INDEX memory_records_workspace_namespace_idx
  ON memory_records (workspace_id, namespace);
--> statement-breakpoint
CREATE INDEX memory_records_workspace_refresh_idx
  ON memory_records (workspace_id, refresh_after)
  WHERE status = 'active';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.enforce_memory_record_immutable_content()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.agent_run_id IS DISTINCT FROM OLD.agent_run_id
    OR NEW.revision_parent_id IS DISTINCT FROM OLD.revision_parent_id
    OR NEW.namespace IS DISTINCT FROM OLD.namespace
    OR NEW.memory_type IS DISTINCT FROM OLD.memory_type
    OR NEW.subtype IS DISTINCT FROM OLD.subtype
    OR NEW.authority_class IS DISTINCT FROM OLD.authority_class
    OR NEW.content IS DISTINCT FROM OLD.content
    OR NEW.provenance IS DISTINCT FROM OLD.provenance
    OR NEW.writer_kind IS DISTINCT FROM OLD.writer_kind
    OR NEW.writer_agent_key IS DISTINCT FROM OLD.writer_agent_key
    OR NEW.writer_agent_version IS DISTINCT FROM OLD.writer_agent_version
    OR NEW.confidence_bps IS DISTINCT FROM OLD.confidence_bps
    OR NEW.data_classification IS DISTINCT FROM OLD.data_classification
    OR NEW.observed_at IS DISTINCT FROM OLD.observed_at
  THEN
    RAISE EXCEPTION 'memory content/provenance is immutable; create a revision instead'
      USING ERRCODE = '23514', CONSTRAINT = 'memory_record_content_immutable';
  END IF;

  IF OLD.status IN ('superseded', 'rejected', 'deleted') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'terminal memory state cannot be reactivated'
      USING ERRCODE = '23514', CONSTRAINT = 'memory_record_terminal_state_immutable';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER memory_records_immutable_content
BEFORE UPDATE ON memory_records
FOR EACH ROW
EXECUTE FUNCTION brovexa_internal.enforce_memory_record_immutable_content();
--> statement-breakpoint
CREATE TABLE memory_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  left_memory_id uuid NOT NULL,
  right_memory_id uuid NOT NULL,
  conflict_type text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  resolution jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT memory_conflicts_distinct_records_check CHECK (left_memory_id <> right_memory_id),
  CONSTRAINT memory_conflicts_type_check CHECK (conflict_type ~ '^[a-z][a-z0-9_.-]*$'),
  CONSTRAINT memory_conflicts_status_check CHECK (status IN ('open', 'resolved')),
  CONSTRAINT memory_conflicts_resolution_object_check CHECK (jsonb_typeof(resolution) = 'object'),
  CONSTRAINT memory_conflicts_left_workspace_fk
    FOREIGN KEY (left_memory_id, workspace_id)
    REFERENCES memory_records (id, workspace_id)
    ON DELETE CASCADE,
  CONSTRAINT memory_conflicts_right_workspace_fk
    FOREIGN KEY (right_memory_id, workspace_id)
    REFERENCES memory_records (id, workspace_id)
    ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX memory_conflicts_workspace_pair_unique
  ON memory_conflicts (
    workspace_id,
    LEAST(left_memory_id, right_memory_id),
    GREATEST(left_memory_id, right_memory_id),
    conflict_type
  );
--> statement-breakpoint
CREATE INDEX memory_conflicts_workspace_status_idx
  ON memory_conflicts (workspace_id, status, created_at DESC);
--> statement-breakpoint
CREATE TABLE context_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_run_id uuid NOT NULL,
  agent_key text NOT NULL,
  agent_version integer NOT NULL,
  context_version integer NOT NULL,
  token_budget integer NOT NULL,
  selected_token_cost integer NOT NULL,
  selected_items jsonb NOT NULL,
  selection_digest text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT context_receipts_agent_key_check CHECK (agent_key ~ '^agent\.[a-z][a-z0-9_.-]*$'),
  CONSTRAINT context_receipts_agent_version_check CHECK (agent_version > 0),
  CONSTRAINT context_receipts_context_version_check CHECK (context_version > 0),
  CONSTRAINT context_receipts_token_budget_check CHECK (token_budget > 0),
  CONSTRAINT context_receipts_selected_cost_check CHECK (
    selected_token_cost >= 0 AND selected_token_cost <= token_budget
  ),
  CONSTRAINT context_receipts_items_array_check CHECK (jsonb_typeof(selected_items) = 'array'),
  CONSTRAINT context_receipts_digest_check CHECK (selection_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT context_receipts_run_context_unique UNIQUE (agent_run_id, context_version),
  CONSTRAINT context_receipts_run_definition_workspace_fk
    FOREIGN KEY (agent_run_id, workspace_id, agent_key, agent_version)
    REFERENCES agent_runs (id, workspace_id, agent_key, agent_version)
    ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX context_receipts_workspace_run_created_idx
  ON context_receipts (workspace_id, agent_run_id, created_at DESC);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.prevent_context_receipt_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'context receipts are immutable'
    USING ERRCODE = '23514', CONSTRAINT = 'context_receipt_immutable';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER context_receipts_immutable
BEFORE UPDATE ON context_receipts
FOR EACH ROW
EXECUTE FUNCTION brovexa_internal.prevent_context_receipt_update();
