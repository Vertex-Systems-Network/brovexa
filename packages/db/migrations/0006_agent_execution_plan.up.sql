ALTER TABLE agent_context_receipts
  ADD CONSTRAINT agent_context_receipts_plan_identity_unique
  UNIQUE (id, workspace_id, agent_definition_id, user_id);
--> statement-breakpoint
ALTER TABLE agent_runs
  ADD CONSTRAINT agent_runs_plan_identity_unique
  UNIQUE (id, workspace_id, agent_definition_id, context_receipt_id, agent_key, agent_version);
--> statement-breakpoint
CREATE TABLE agent_execution_plans (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  run_id text NOT NULL,
  context_receipt_id text NOT NULL,
  orchestrator_definition_id uuid NOT NULL,
  orchestrator_key text NOT NULL,
  orchestrator_version text NOT NULL,
  plan_version integer NOT NULL,
  max_parallelism integer NOT NULL,
  step_count integer NOT NULL,
  envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT agent_execution_plans_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT agent_execution_plans_run_workspace_unique UNIQUE (run_id, workspace_id),
  CONSTRAINT agent_execution_plans_id_check CHECK (length(btrim(id)) > 0),
  CONSTRAINT agent_execution_plans_orchestrator_key_check CHECK (orchestrator_key = 'agent.control.orchestrator'),
  CONSTRAINT agent_execution_plans_orchestrator_version_check CHECK (length(btrim(orchestrator_version)) > 0),
  CONSTRAINT agent_execution_plans_plan_version_check CHECK (plan_version > 0),
  CONSTRAINT agent_execution_plans_step_count_check CHECK (step_count BETWEEN 1 AND 64),
  CONSTRAINT agent_execution_plans_parallelism_check CHECK (
    max_parallelism BETWEEN 1 AND 256 AND max_parallelism <= step_count
  ),
  CONSTRAINT agent_execution_plans_envelope_object_check CHECK (jsonb_typeof(envelope) = 'object'),
  CONSTRAINT agent_execution_plans_envelope_identity_check CHECK (
    envelope->>'id' = id
    AND envelope->>'workspaceId' = workspace_id::text
    AND envelope->>'userId' = user_id::text
    AND envelope->>'runId' = run_id
    AND envelope->>'contextReceiptId' = context_receipt_id
    AND envelope->>'orchestratorKey' = orchestrator_key
    AND envelope->>'orchestratorVersion' = orchestrator_version
    AND envelope->'planVersion' = to_jsonb(plan_version)
    AND envelope->'maxParallelism' = to_jsonb(max_parallelism)
    AND jsonb_typeof(envelope->'steps') = 'array'
    AND jsonb_array_length(envelope->'steps') = step_count
  ),
  CONSTRAINT agent_execution_plans_context_identity_fk
    FOREIGN KEY (context_receipt_id, workspace_id, orchestrator_definition_id, user_id)
    REFERENCES agent_context_receipts (id, workspace_id, agent_definition_id, user_id)
    ON DELETE RESTRICT,
  CONSTRAINT agent_execution_plans_run_identity_fk
    FOREIGN KEY (
      run_id,
      workspace_id,
      orchestrator_definition_id,
      context_receipt_id,
      orchestrator_key,
      orchestrator_version
    )
    REFERENCES agent_runs (
      id,
      workspace_id,
      agent_definition_id,
      context_receipt_id,
      agent_key,
      agent_version
    )
    ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX agent_execution_plans_workspace_created_idx
  ON agent_execution_plans (workspace_id, created_at DESC, id);
--> statement-breakpoint
CREATE TRIGGER agent_execution_plans_append_only
BEFORE UPDATE OR DELETE ON agent_execution_plans
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('agent_execution_plans_append_only');