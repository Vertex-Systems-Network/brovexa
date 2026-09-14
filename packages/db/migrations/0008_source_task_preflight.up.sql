CREATE UNIQUE INDEX source_admission_snapshots_task_identity_unique
  ON source_admission_snapshots (
    id,
    workspace_id,
    source_task_id,
    request_id,
    source_key,
    capability_version,
    connector_key,
    connector_version,
    policy_id,
    policy_version
  );
--> statement-breakpoint
CREATE UNIQUE INDEX job_runs_source_task_identity_unique
  ON job_runs (id, workspace_id);
--> statement-breakpoint
CREATE UNIQUE INDEX job_work_units_source_task_identity_unique
  ON job_work_units (id, workspace_id, job_run_id);
--> statement-breakpoint
CREATE TABLE research_job_preflights (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  research_job_id text NOT NULL,
  idempotency_key text NOT NULL,
  decision text NOT NULL,
  admission_snapshot_ids jsonb NOT NULL,
  aggregate_budget jsonb NOT NULL,
  envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_job_preflights_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT research_job_preflights_identity_unique UNIQUE (id, workspace_id, research_job_id),
  CONSTRAINT research_job_preflights_workspace_job_idempotency_unique UNIQUE (
    workspace_id,
    research_job_id,
    idempotency_key
  ),
  CONSTRAINT research_job_preflights_id_check CHECK (length(btrim(id)) > 0),
  CONSTRAINT research_job_preflights_job_id_check CHECK (length(btrim(research_job_id)) > 0),
  CONSTRAINT research_job_preflights_idempotency_check CHECK (length(btrim(idempotency_key)) > 0),
  CONSTRAINT research_job_preflights_decision_check CHECK (decision IN ('allow', 'review_required', 'blocked')),
  CONSTRAINT research_job_preflights_snapshot_ids_array_check CHECK (jsonb_typeof(admission_snapshot_ids) = 'array'),
  CONSTRAINT research_job_preflights_snapshot_ids_nonempty_check CHECK (jsonb_array_length(admission_snapshot_ids) > 0),
  CONSTRAINT research_job_preflights_budget_object_check CHECK (jsonb_typeof(aggregate_budget) = 'object'),
  CONSTRAINT research_job_preflights_envelope_object_check CHECK (jsonb_typeof(envelope) = 'object'),
  CONSTRAINT research_job_preflights_envelope_identity_check CHECK (
    envelope->>'id' = id
    AND envelope->>'workspaceId' = workspace_id::text
    AND envelope->>'researchJobId' = research_job_id
    AND envelope->>'idempotencyKey' = idempotency_key
    AND envelope->>'decision' = decision
    AND envelope->'admissionSnapshotIds' = admission_snapshot_ids
    AND envelope->'aggregateBudget' = aggregate_budget
  )
);
--> statement-breakpoint
CREATE INDEX research_job_preflights_workspace_job_idx
  ON research_job_preflights (workspace_id, research_job_id, created_at DESC, id);
--> statement-breakpoint
CREATE TRIGGER research_job_preflights_append_only
BEFORE UPDATE OR DELETE ON research_job_preflights
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('research_job_preflights_append_only');
--> statement-breakpoint
CREATE TABLE source_tasks (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  research_job_id text NOT NULL,
  preflight_id text NOT NULL,
  admission_snapshot_id text NOT NULL,
  request_id text NOT NULL,
  source_key text NOT NULL,
  capability_version text NOT NULL,
  connector_key text NOT NULL,
  connector_version text NOT NULL,
  policy_id text NOT NULL,
  policy_version text NOT NULL,
  operation text NOT NULL,
  job_run_id uuid NOT NULL,
  work_unit_id uuid NOT NULL,
  max_attempts integer NOT NULL,
  effective_budget jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_tasks_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT source_tasks_workspace_snapshot_unique UNIQUE (workspace_id, admission_snapshot_id),
  CONSTRAINT source_tasks_workspace_work_unique UNIQUE (workspace_id, work_unit_id),
  CONSTRAINT source_tasks_id_check CHECK (length(btrim(id)) > 0),
  CONSTRAINT source_tasks_job_id_check CHECK (length(btrim(research_job_id)) > 0),
  CONSTRAINT source_tasks_source_key_check CHECK (source_key ~ '^source\.[a-z0-9_.-]+$'),
  CONSTRAINT source_tasks_connector_key_check CHECK (connector_key ~ '^connector\.[a-z0-9_.-]+$'),
  CONSTRAINT source_tasks_operation_check CHECK (operation IN ('discover', 'search', 'list', 'lookup', 'fetch', 'detail', 'import', 'sync')),
  CONSTRAINT source_tasks_max_attempts_check CHECK (max_attempts >= 1 AND max_attempts <= 10),
  CONSTRAINT source_tasks_budget_object_check CHECK (jsonb_typeof(effective_budget) = 'object'),
  CONSTRAINT source_tasks_preflight_fk
    FOREIGN KEY (preflight_id, workspace_id, research_job_id)
    REFERENCES research_job_preflights (id, workspace_id, research_job_id)
    ON DELETE RESTRICT,
  CONSTRAINT source_tasks_admission_identity_fk
    FOREIGN KEY (
      admission_snapshot_id,
      workspace_id,
      id,
      request_id,
      source_key,
      capability_version,
      connector_key,
      connector_version,
      policy_id,
      policy_version
    )
    REFERENCES source_admission_snapshots (
      id,
      workspace_id,
      source_task_id,
      request_id,
      source_key,
      capability_version,
      connector_key,
      connector_version,
      policy_id,
      policy_version
    )
    ON DELETE RESTRICT,
  CONSTRAINT source_tasks_job_run_workspace_fk
    FOREIGN KEY (job_run_id, workspace_id)
    REFERENCES job_runs (id, workspace_id)
    ON DELETE RESTRICT,
  CONSTRAINT source_tasks_work_unit_workspace_run_fk
    FOREIGN KEY (work_unit_id, workspace_id, job_run_id)
    REFERENCES job_work_units (id, workspace_id, job_run_id)
    ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX source_tasks_workspace_research_job_idx
  ON source_tasks (workspace_id, research_job_id, created_at, id);
--> statement-breakpoint
CREATE TRIGGER source_tasks_append_only
BEFORE UPDATE OR DELETE ON source_tasks
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('source_tasks_append_only');
--> statement-breakpoint
CREATE TABLE source_task_usage_events (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_task_id text NOT NULL,
  requests bigint NOT NULL DEFAULT 0,
  pages bigint NOT NULL DEFAULT 0,
  bytes bigint NOT NULL DEFAULT 0,
  currency_micros bigint NOT NULL DEFAULT 0,
  runtime_ms bigint NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_task_usage_events_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT source_task_usage_events_requests_check CHECK (requests >= 0),
  CONSTRAINT source_task_usage_events_pages_check CHECK (pages >= 0),
  CONSTRAINT source_task_usage_events_bytes_check CHECK (bytes >= 0),
  CONSTRAINT source_task_usage_events_currency_check CHECK (currency_micros >= 0),
  CONSTRAINT source_task_usage_events_runtime_check CHECK (runtime_ms >= 0),
  CONSTRAINT source_task_usage_events_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT source_task_usage_events_task_workspace_fk
    FOREIGN KEY (source_task_id, workspace_id)
    REFERENCES source_tasks (id, workspace_id)
    ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX source_task_usage_events_task_time_idx
  ON source_task_usage_events (workspace_id, source_task_id, occurred_at, id);
--> statement-breakpoint
CREATE TRIGGER source_task_usage_events_append_only
BEFORE UPDATE OR DELETE ON source_task_usage_events
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('source_task_usage_events_append_only');