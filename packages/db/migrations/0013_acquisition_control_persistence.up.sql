CREATE TABLE research_job_controls (
  research_job_id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  state text NOT NULL DEFAULT 'active',
  reason_code text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_job_controls_job_workspace_unique UNIQUE (research_job_id, workspace_id),
  CONSTRAINT research_job_controls_research_job_fk
    FOREIGN KEY (research_job_id, workspace_id)
    REFERENCES research_jobs (id, workspace_id)
    ON DELETE CASCADE,
  CONSTRAINT research_job_controls_version_check CHECK (version > 0),
  CONSTRAINT research_job_controls_state_check CHECK (state IN ('active', 'paused', 'cancelled', 'killed')),
  CONSTRAINT research_job_controls_reason_code_check CHECK (
    reason_code IS NULL OR reason_code ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'
  )
);
--> statement-breakpoint
CREATE INDEX research_job_controls_workspace_state_idx
  ON research_job_controls (workspace_id, state, changed_at DESC, research_job_id);
--> statement-breakpoint
INSERT INTO research_job_controls (research_job_id, workspace_id)
SELECT id, workspace_id
FROM research_jobs
ON CONFLICT (research_job_id) DO NOTHING;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.ensure_research_job_control()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO research_job_controls (research_job_id, workspace_id)
  VALUES (NEW.id, NEW.workspace_id)
  ON CONFLICT (research_job_id) DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER research_jobs_control_default
AFTER INSERT ON research_jobs
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.ensure_research_job_control();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_research_job_control_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Research job control state is durable and cannot be deleted.'
      USING ERRCODE = '23514', CONSTRAINT = 'research_job_controls_delete_guard';
  END IF;

  IF NEW.research_job_id IS DISTINCT FROM OLD.research_job_id
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Research job control identity is immutable.'
      USING ERRCODE = '23514', CONSTRAINT = 'research_job_controls_identity_guard';
  END IF;

  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'Research job control version must advance by exactly one.'
      USING ERRCODE = '23514', CONSTRAINT = 'research_job_controls_version_guard';
  END IF;

  IF NEW.changed_at < OLD.changed_at THEN
    RAISE EXCEPTION 'Research job control time cannot regress.'
      USING ERRCODE = '23514', CONSTRAINT = 'research_job_controls_time_guard';
  END IF;

  IF OLD.state IN ('cancelled', 'killed') THEN
    RAISE EXCEPTION 'Terminal research job control state cannot transition.'
      USING ERRCODE = '23514', CONSTRAINT = 'research_job_controls_terminal_guard';
  END IF;

  IF OLD.state = 'active' AND NEW.state NOT IN ('paused', 'cancelled', 'killed') THEN
    RAISE EXCEPTION 'Invalid research job control transition from active.'
      USING ERRCODE = '23514', CONSTRAINT = 'research_job_controls_transition_guard';
  END IF;

  IF OLD.state = 'paused' AND NEW.state NOT IN ('active', 'cancelled', 'killed') THEN
    RAISE EXCEPTION 'Invalid research job control transition from paused.'
      USING ERRCODE = '23514', CONSTRAINT = 'research_job_controls_transition_guard';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER research_job_controls_update_guard
BEFORE UPDATE OR DELETE ON research_job_controls
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_research_job_control_update();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_acquisition_shard_control()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  control_state text;
BEGIN
  SELECT state INTO control_state
  FROM research_job_controls
  WHERE research_job_id = NEW.research_job_id
    AND workspace_id = NEW.workspace_id;

  IF control_state IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Acquisition shard creation requires active research job control state.'
      USING ERRCODE = '23514', CONSTRAINT = 'acquisition_shards_control_guard';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER acquisition_shards_control_guard
BEFORE INSERT ON acquisition_shards
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_acquisition_shard_control();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_acquisition_work_claim()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  control_state text;
BEGIN
  IF NEW.status <> 'running'
     OR NEW.attempt_count <> OLD.attempt_count + 1 THEN
    RETURN NEW;
  END IF;

  SELECT rjc.state INTO control_state
  FROM acquisition_shards ash
  JOIN research_job_controls rjc
    ON rjc.research_job_id = ash.research_job_id
   AND rjc.workspace_id = ash.workspace_id
  WHERE ash.work_unit_id = OLD.id
    AND ash.workspace_id = OLD.workspace_id;

  IF FOUND AND control_state IS DISTINCT FROM 'active' THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER acquisition_work_claim_guard
BEFORE UPDATE OF status, attempt_count, worker_id, lease_expires_at ON job_work_units
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_acquisition_work_claim();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.propagate_research_job_terminal_control()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.state NOT IN ('cancelled', 'killed') THEN
    RETURN NEW;
  END IF;

  UPDATE job_work_units jwu
  SET cancellation_requested_at = COALESCE(jwu.cancellation_requested_at, NEW.changed_at),
      status = CASE
        WHEN jwu.status IN ('runnable', 'retry_wait') THEN 'cancelled'
        ELSE jwu.status
      END,
      completed_at = CASE
        WHEN jwu.status IN ('runnable', 'retry_wait') THEN COALESCE(jwu.completed_at, NEW.changed_at)
        ELSE jwu.completed_at
      END,
      updated_at = NEW.changed_at
  FROM acquisition_shards ash
  WHERE ash.work_unit_id = jwu.id
    AND ash.workspace_id = NEW.workspace_id
    AND ash.research_job_id = NEW.research_job_id
    AND jwu.status NOT IN ('succeeded', 'cancelled', 'dead_letter', 'review');

  UPDATE job_runs jr
  SET status = 'cancelled',
      completed_at = COALESCE(jr.completed_at, NEW.changed_at),
      updated_at = NEW.changed_at
  FROM research_jobs rj
  WHERE rj.id = NEW.research_job_id
    AND rj.workspace_id = NEW.workspace_id
    AND jr.id = rj.job_run_id
    AND jr.workspace_id = rj.workspace_id
    AND jr.status IN ('pending', 'running');

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER research_job_controls_terminal_propagation
AFTER UPDATE OF state ON research_job_controls
FOR EACH ROW
WHEN (NEW.state IN ('cancelled', 'killed'))
EXECUTE FUNCTION brovexa_internal.propagate_research_job_terminal_control();
