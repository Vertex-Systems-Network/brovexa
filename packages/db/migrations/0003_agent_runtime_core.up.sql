CREATE TABLE agent_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key text NOT NULL,
  version text NOT NULL,
  status text NOT NULL,
  autonomy_tier text NOT NULL,
  requires_human_approval boolean NOT NULL,
  specification jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_definitions_key_version_unique UNIQUE (agent_key, version),
  CONSTRAINT agent_definitions_identity_unique UNIQUE (id, agent_key, version),
  CONSTRAINT agent_definitions_key_check CHECK (agent_key ~ '^agent\.[a-z0-9_.-]+$'),
  CONSTRAINT agent_definitions_version_check CHECK (length(btrim(version)) > 0),
  CONSTRAINT agent_definitions_status_check CHECK (status IN ('draft', 'approved', 'disabled')),
  CONSTRAINT agent_definitions_autonomy_tier_check CHECK (autonomy_tier IN ('T0', 'T1', 'T2', 'T3', 'T4')),
  CONSTRAINT agent_definitions_t4_human_approval_check CHECK (
    autonomy_tier <> 'T4' OR requires_human_approval = true
  )
);
--> statement-breakpoint
CREATE TABLE agent_context_receipts (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  run_scope_id text,
  agent_definition_id uuid NOT NULL REFERENCES agent_definitions(id) ON DELETE RESTRICT,
  agent_key text NOT NULL,
  agent_version text NOT NULL,
  receipt jsonb NOT NULL,
  token_budget bigint NOT NULL,
  max_currency_micros bigint NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT agent_context_receipts_identity_workspace_definition_unique
    UNIQUE (id, workspace_id, agent_definition_id),
  CONSTRAINT agent_context_receipts_definition_identity_fk
    FOREIGN KEY (agent_definition_id, agent_key, agent_version)
    REFERENCES agent_definitions (id, agent_key, version)
    ON DELETE RESTRICT,
  CONSTRAINT agent_context_receipts_id_check CHECK (length(btrim(id)) > 0),
  CONSTRAINT agent_context_receipts_token_budget_check CHECK (token_budget >= 0),
  CONSTRAINT agent_context_receipts_currency_budget_check CHECK (max_currency_micros >= 0)
);
--> statement-breakpoint
CREATE INDEX agent_context_receipts_workspace_created_idx
  ON agent_context_receipts (workspace_id, created_at DESC);
--> statement-breakpoint
CREATE TABLE agent_runs (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_definition_id uuid NOT NULL REFERENCES agent_definitions(id) ON DELETE RESTRICT,
  agent_key text NOT NULL,
  agent_version text NOT NULL,
  context_receipt_id text NOT NULL,
  parent_run_id text,
  handoff_id text,
  execution_mode text NOT NULL,
  provider_id text,
  model_id text,
  status text NOT NULL,
  envelope jsonb NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_runs_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT agent_runs_definition_identity_fk
    FOREIGN KEY (agent_definition_id, agent_key, agent_version)
    REFERENCES agent_definitions (id, agent_key, version)
    ON DELETE RESTRICT,
  CONSTRAINT agent_runs_context_workspace_definition_fk
    FOREIGN KEY (context_receipt_id, workspace_id, agent_definition_id)
    REFERENCES agent_context_receipts (id, workspace_id, agent_definition_id)
    ON DELETE RESTRICT,
  CONSTRAINT agent_runs_parent_workspace_fk
    FOREIGN KEY (parent_run_id, workspace_id)
    REFERENCES agent_runs (id, workspace_id)
    ON DELETE RESTRICT,
  CONSTRAINT agent_runs_id_check CHECK (length(btrim(id)) > 0),
  CONSTRAINT agent_runs_execution_mode_check CHECK (execution_mode IN ('deterministic', 'model')),
  CONSTRAINT agent_runs_status_check CHECK (
    status IN (
      'queued',
      'running',
      'succeeded',
      'failed',
      'blocked',
      'budget_stopped',
      'cancelled',
      'review_required'
    )
  ),
  CONSTRAINT agent_runs_execution_route_check CHECK (
    (execution_mode = 'deterministic' AND provider_id IS NULL AND model_id IS NULL)
    OR (execution_mode = 'model' AND provider_id IS NOT NULL AND model_id IS NOT NULL)
  ),
  CONSTRAINT agent_runs_completion_time_check CHECK (
    completed_at IS NULL OR (started_at IS NOT NULL AND completed_at >= started_at)
  )
);
--> statement-breakpoint
CREATE INDEX agent_runs_workspace_status_idx
  ON agent_runs (workspace_id, status);
--> statement-breakpoint
CREATE INDEX agent_runs_workspace_definition_idx
  ON agent_runs (workspace_id, agent_definition_id);
