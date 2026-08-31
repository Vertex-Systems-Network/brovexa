ALTER TABLE agent_runs
  ADD COLUMN last_transition_id text;
--> statement-breakpoint
ALTER TABLE memory_records
  ADD COLUMN last_lifecycle_event_id text;
--> statement-breakpoint
CREATE TABLE agent_run_transitions (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id text NOT NULL,
  from_status text NOT NULL,
  to_status text NOT NULL,
  reason_code text NOT NULL,
  actor_type text NOT NULL,
  actor_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL,
  CONSTRAINT agent_run_transitions_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT agent_run_transitions_id_check CHECK (length(btrim(id)) > 0),
  CONSTRAINT agent_run_transitions_reason_check CHECK (length(btrim(reason_code)) > 0),
  CONSTRAINT agent_run_transitions_actor_type_check CHECK (
    actor_type IN ('system', 'user', 'agent', 'worker', 'curator')
  ),
  CONSTRAINT agent_run_transitions_metadata_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT agent_run_transitions_from_status_check CHECK (
    from_status IN ('queued', 'running', 'succeeded', 'failed', 'blocked', 'budget_stopped', 'cancelled', 'review_required')
  ),
  CONSTRAINT agent_run_transitions_to_status_check CHECK (
    to_status IN ('queued', 'running', 'succeeded', 'failed', 'blocked', 'budget_stopped', 'cancelled', 'review_required')
  ),
  CONSTRAINT agent_run_transitions_change_check CHECK (from_status <> to_status),
  CONSTRAINT agent_run_transitions_terminal_source_check CHECK (
    from_status NOT IN ('succeeded', 'failed', 'budget_stopped', 'cancelled')
  ),
  CONSTRAINT agent_run_transitions_run_workspace_fk
    FOREIGN KEY (run_id, workspace_id)
    REFERENCES agent_runs (id, workspace_id)
    ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX agent_run_transitions_workspace_run_idx
  ON agent_run_transitions (workspace_id, run_id, occurred_at, id);
--> statement-breakpoint
CREATE TABLE memory_record_lifecycle_events (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  memory_id text NOT NULL,
  event_type text NOT NULL,
  from_status text NOT NULL,
  to_status text NOT NULL,
  successor_memory_id text,
  reason text NOT NULL,
  actor_type text NOT NULL,
  actor_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL,
  CONSTRAINT memory_record_lifecycle_events_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT memory_record_lifecycle_events_id_check CHECK (length(btrim(id)) > 0),
  CONSTRAINT memory_record_lifecycle_events_reason_check CHECK (length(btrim(reason)) > 0),
  CONSTRAINT memory_record_lifecycle_events_type_check CHECK (
    event_type IN ('status_changed', 'superseded', 'deleted')
  ),
  CONSTRAINT memory_record_lifecycle_events_status_check CHECK (
    from_status IN ('proposed', 'active', 'stale', 'conflicted', 'superseded', 'rejected', 'deleted')
    AND to_status IN ('proposed', 'active', 'stale', 'conflicted', 'superseded', 'rejected', 'deleted')
    AND from_status <> to_status
  ),
  CONSTRAINT memory_record_lifecycle_events_actor_type_check CHECK (
    actor_type IN ('system', 'user', 'agent', 'worker', 'curator')
  ),
  CONSTRAINT memory_record_lifecycle_events_metadata_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT memory_record_lifecycle_events_semantics_check CHECK (
    (event_type = 'superseded' AND to_status = 'superseded' AND successor_memory_id IS NOT NULL AND successor_memory_id <> memory_id)
    OR (event_type = 'deleted' AND to_status = 'deleted' AND successor_memory_id IS NULL)
    OR (event_type = 'status_changed' AND to_status NOT IN ('superseded', 'deleted') AND successor_memory_id IS NULL)
  ),
  CONSTRAINT memory_record_lifecycle_events_memory_workspace_fk
    FOREIGN KEY (memory_id, workspace_id)
    REFERENCES memory_records (id, workspace_id)
    ON DELETE CASCADE,
  CONSTRAINT memory_record_lifecycle_events_successor_workspace_fk
    FOREIGN KEY (successor_memory_id, workspace_id)
    REFERENCES memory_records (id, workspace_id)
    ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX memory_record_lifecycle_events_workspace_memory_idx
  ON memory_record_lifecycle_events (workspace_id, memory_id, occurred_at, id);
--> statement-breakpoint
CREATE UNIQUE INDEX memory_record_terminal_lifecycle_unique
  ON memory_record_lifecycle_events (workspace_id, memory_id)
  WHERE event_type IN ('superseded', 'deleted');
--> statement-breakpoint
ALTER TABLE agent_runs
  ADD CONSTRAINT agent_runs_last_transition_workspace_fk
  FOREIGN KEY (last_transition_id, workspace_id)
  REFERENCES agent_run_transitions (id, workspace_id)
  ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE memory_records
  ADD CONSTRAINT memory_records_last_lifecycle_event_workspace_fk
  FOREIGN KEY (last_lifecycle_event_id, workspace_id)
  REFERENCES memory_record_lifecycle_events (id, workspace_id)
  ON DELETE RESTRICT;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Lifecycle history is append-only.'
    USING ERRCODE = '23514', CONSTRAINT = TG_ARGV[0];
END;
$$;
--> statement-breakpoint
CREATE TRIGGER agent_run_transitions_append_only
BEFORE UPDATE OR DELETE ON agent_run_transitions
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('agent_run_transitions_append_only');
--> statement-breakpoint
CREATE TRIGGER memory_record_lifecycle_events_append_only
BEFORE UPDATE OR DELETE ON memory_record_lifecycle_events
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('memory_record_lifecycle_events_append_only');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_agent_run_lifecycle_projection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  transition_row agent_run_transitions%ROWTYPE;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.started_at IS NOT DISTINCT FROM OLD.started_at
     AND NEW.completed_at IS NOT DISTINCT FROM OLD.completed_at
     AND NEW.last_transition_id IS NOT DISTINCT FROM OLD.last_transition_id THEN
    RETURN NEW;
  END IF;

  IF NEW.last_transition_id IS NULL OR NEW.last_transition_id IS NOT DISTINCT FROM OLD.last_transition_id THEN
    RAISE EXCEPTION 'AgentRun lifecycle projection requires a new transition event.'
      USING ERRCODE = '23514', CONSTRAINT = 'agent_runs_lifecycle_projection_guard';
  END IF;

  SELECT * INTO transition_row
  FROM agent_run_transitions
  WHERE id = NEW.last_transition_id
    AND workspace_id = NEW.workspace_id
    AND run_id = NEW.id;

  IF NOT FOUND
     OR transition_row.from_status IS DISTINCT FROM OLD.status
     OR transition_row.to_status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'AgentRun transition does not match lifecycle projection.'
      USING ERRCODE = '23514', CONSTRAINT = 'agent_runs_lifecycle_projection_guard';
  END IF;

  IF NEW.envelope->>'status' IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'AgentRun envelope status must match projected status.'
      USING ERRCODE = '23514', CONSTRAINT = 'agent_runs_lifecycle_projection_guard';
  END IF;

  IF NEW.updated_at IS DISTINCT FROM transition_row.occurred_at THEN
    RAISE EXCEPTION 'AgentRun projection timestamp must match transition timestamp.'
      USING ERRCODE = '23514', CONSTRAINT = 'agent_runs_lifecycle_projection_guard';
  END IF;

  IF NEW.status = 'running' AND NEW.started_at IS NULL THEN
    RAISE EXCEPTION 'Running AgentRun requires started_at.'
      USING ERRCODE = '23514', CONSTRAINT = 'agent_runs_lifecycle_projection_guard';
  END IF;

  IF NEW.status IN ('succeeded', 'failed', 'budget_stopped', 'cancelled')
     AND (NEW.started_at IS NULL OR NEW.completed_at IS NULL OR NEW.completed_at < NEW.started_at) THEN
    RAISE EXCEPTION 'Terminal AgentRun requires valid start/completion timestamps.'
      USING ERRCODE = '23514', CONSTRAINT = 'agent_runs_lifecycle_projection_guard';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER agent_runs_lifecycle_projection_guard
BEFORE UPDATE OF status, started_at, completed_at, last_transition_id ON agent_runs
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_agent_run_lifecycle_projection();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_memory_lifecycle_projection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  lifecycle_row memory_record_lifecycle_events%ROWTYPE;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.deletion_reason IS NOT DISTINCT FROM OLD.deletion_reason
     AND NEW.last_lifecycle_event_id IS NOT DISTINCT FROM OLD.last_lifecycle_event_id THEN
    RETURN NEW;
  END IF;

  IF NEW.last_lifecycle_event_id IS NULL
     OR NEW.last_lifecycle_event_id IS NOT DISTINCT FROM OLD.last_lifecycle_event_id THEN
    RAISE EXCEPTION 'Memory lifecycle projection requires a new lifecycle event.'
      USING ERRCODE = '23514', CONSTRAINT = 'memory_records_lifecycle_projection_guard';
  END IF;

  SELECT * INTO lifecycle_row
  FROM memory_record_lifecycle_events
  WHERE id = NEW.last_lifecycle_event_id
    AND workspace_id = NEW.workspace_id
    AND memory_id = NEW.id;

  IF NOT FOUND
     OR lifecycle_row.from_status IS DISTINCT FROM OLD.status
     OR lifecycle_row.to_status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'Memory lifecycle event does not match lifecycle projection.'
      USING ERRCODE = '23514', CONSTRAINT = 'memory_records_lifecycle_projection_guard';
  END IF;

  IF NEW.envelope->>'status' IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'Memory envelope status must match projected status.'
      USING ERRCODE = '23514', CONSTRAINT = 'memory_records_lifecycle_projection_guard';
  END IF;

  IF NEW.updated_at IS DISTINCT FROM lifecycle_row.occurred_at THEN
    RAISE EXCEPTION 'Memory projection timestamp must match lifecycle event timestamp.'
      USING ERRCODE = '23514', CONSTRAINT = 'memory_records_lifecycle_projection_guard';
  END IF;

  IF NEW.status = 'deleted' THEN
    IF NEW.deletion_reason IS NULL
       OR length(btrim(NEW.deletion_reason)) = 0
       OR NEW.envelope->>'deletionReason' IS DISTINCT FROM NEW.deletion_reason THEN
      RAISE EXCEPTION 'Deleted memory requires synchronized deletion reason.'
        USING ERRCODE = '23514', CONSTRAINT = 'memory_records_lifecycle_projection_guard';
    END IF;
  ELSIF NEW.deletion_reason IS NOT NULL THEN
    RAISE EXCEPTION 'Non-deleted memory cannot retain a deletion reason.'
      USING ERRCODE = '23514', CONSTRAINT = 'memory_records_lifecycle_projection_guard';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER memory_records_lifecycle_projection_guard
BEFORE UPDATE OF status, deletion_reason, last_lifecycle_event_id ON memory_records
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_memory_lifecycle_projection();
