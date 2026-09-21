CREATE TABLE research_jobs (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  preflight_id text NOT NULL,
  job_run_id uuid NOT NULL,
  spec jsonb NOT NULL,
  approved_source_keys jsonb NOT NULL,
  budget jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_jobs_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT research_jobs_run_workspace_unique UNIQUE (job_run_id, workspace_id),
  CONSTRAINT research_jobs_identity_unique UNIQUE (id, workspace_id, job_run_id),
  CONSTRAINT research_jobs_id_check CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'),
  CONSTRAINT research_jobs_preflight_id_check CHECK (preflight_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'),
  CONSTRAINT research_jobs_spec_object_check CHECK (jsonb_typeof(spec) = 'object'),
  CONSTRAINT research_jobs_sources_array_check CHECK (jsonb_typeof(approved_source_keys) = 'array'),
  CONSTRAINT research_jobs_sources_nonempty_check CHECK (jsonb_array_length(approved_source_keys) > 0),
  CONSTRAINT research_jobs_budget_object_check CHECK (jsonb_typeof(budget) = 'object'),
  CONSTRAINT research_jobs_preflight_fk
    FOREIGN KEY (preflight_id, workspace_id, id)
    REFERENCES research_job_preflights (id, workspace_id, research_job_id)
    ON DELETE RESTRICT,
  CONSTRAINT research_jobs_run_workspace_fk
    FOREIGN KEY (job_run_id, workspace_id)
    REFERENCES job_runs (id, workspace_id)
    ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX research_jobs_workspace_created_idx
  ON research_jobs (workspace_id, created_at DESC, id);
--> statement-breakpoint
CREATE TABLE acquisition_shards (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  research_job_id text NOT NULL,
  job_run_id uuid NOT NULL,
  work_unit_id uuid NOT NULL,
  shard_key text NOT NULL,
  ordinal integer NOT NULL,
  source_keys jsonb NOT NULL,
  budget jsonb NOT NULL,
  envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT acquisition_shards_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT acquisition_shards_workspace_work_unique UNIQUE (workspace_id, work_unit_id),
  CONSTRAINT acquisition_shards_workspace_job_key_unique UNIQUE (workspace_id, research_job_id, shard_key),
  CONSTRAINT acquisition_shards_id_check CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'),
  CONSTRAINT acquisition_shards_job_id_check CHECK (research_job_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'),
  CONSTRAINT acquisition_shards_key_check CHECK (shard_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'),
  CONSTRAINT acquisition_shards_ordinal_check CHECK (ordinal >= 0 AND ordinal <= 2147483647),
  CONSTRAINT acquisition_shards_sources_array_check CHECK (jsonb_typeof(source_keys) = 'array'),
  CONSTRAINT acquisition_shards_sources_nonempty_check CHECK (jsonb_array_length(source_keys) > 0),
  CONSTRAINT acquisition_shards_budget_object_check CHECK (jsonb_typeof(budget) = 'object'),
  CONSTRAINT acquisition_shards_envelope_object_check CHECK (jsonb_typeof(envelope) = 'object'),
  CONSTRAINT acquisition_shards_envelope_identity_check CHECK (
    envelope->>'id' = id
    AND envelope->>'workspaceId' = workspace_id::text
    AND envelope->>'researchJobId' = research_job_id
    AND envelope->>'jobRunId' = job_run_id::text
    AND envelope->>'workUnitId' = work_unit_id::text
    AND envelope->>'shardKey' = shard_key
    AND (envelope->>'ordinal')::integer = ordinal
    AND envelope->'sourceKeys' = source_keys
    AND envelope->'budget' = budget
  ),
  CONSTRAINT acquisition_shards_research_job_fk
    FOREIGN KEY (research_job_id, workspace_id, job_run_id)
    REFERENCES research_jobs (id, workspace_id, job_run_id)
    ON DELETE RESTRICT,
  CONSTRAINT acquisition_shards_work_unit_fk
    FOREIGN KEY (work_unit_id, workspace_id, job_run_id)
    REFERENCES job_work_units (id, workspace_id, job_run_id)
    ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX acquisition_shards_workspace_job_ordinal_idx
  ON acquisition_shards (workspace_id, research_job_id, ordinal, id);
--> statement-breakpoint
CREATE TRIGGER research_jobs_append_only
BEFORE UPDATE OR DELETE ON research_jobs
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('research_jobs_append_only');
--> statement-breakpoint
CREATE TRIGGER acquisition_shards_append_only
BEFORE UPDATE OR DELETE ON acquisition_shards
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('acquisition_shards_append_only');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_research_acquisition_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_job_type text;
  shard_work_type text;
BEGIN
  IF TG_TABLE_NAME = 'research_jobs' THEN
    SELECT job_type INTO parent_job_type
    FROM job_runs
    WHERE id = NEW.job_run_id AND workspace_id = NEW.workspace_id;

    IF parent_job_type IS DISTINCT FROM 'research.acquire' THEN
      RAISE EXCEPTION 'Research job must bind to canonical research.acquire job run.'
        USING ERRCODE = '23514', CONSTRAINT = 'research_jobs_job_type_guard';
    END IF;
    RETURN NEW;
  END IF;

  SELECT work_type INTO shard_work_type
  FROM job_work_units
  WHERE id = NEW.work_unit_id
    AND workspace_id = NEW.workspace_id
    AND job_run_id = NEW.job_run_id;

  IF shard_work_type IS DISTINCT FROM 'research.acquire.shard' THEN
    RAISE EXCEPTION 'Acquisition shard must bind to canonical research.acquire.shard work unit.'
      USING ERRCODE = '23514', CONSTRAINT = 'acquisition_shards_work_type_guard';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER research_jobs_identity_guard
BEFORE INSERT ON research_jobs
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_research_acquisition_identity();
--> statement-breakpoint
CREATE TRIGGER acquisition_shards_identity_guard
BEFORE INSERT ON acquisition_shards
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_research_acquisition_identity();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.guard_acquisition_progress_checkpoint()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  is_acquisition boolean;
  old_version bigint;
  new_version bigint;
  field_name text;
  old_value bigint;
  new_value bigint;
  monotonic_fields text[] := ARRAY[
    'completedUnits', 'failedUnits', 'returnedRecords', 'requests', 'pages',
    'bytes', 'currencyMicros', 'runtimeMs'
  ];
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM acquisition_shards WHERE work_unit_id = OLD.work_unit_id
  ) INTO is_acquisition;

  IF NOT is_acquisition OR OLD.checkpoint_key <> 'acquisition.progress' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Acquisition progress checkpoints are durable and cannot be deleted.'
      USING ERRCODE = '23514', CONSTRAINT = 'acquisition_progress_checkpoint_delete_guard';
  END IF;

  IF NEW.work_unit_id IS DISTINCT FROM OLD.work_unit_id
     OR NEW.checkpoint_key IS DISTINCT FROM OLD.checkpoint_key THEN
    RAISE EXCEPTION 'Acquisition progress checkpoint identity is immutable.'
      USING ERRCODE = '23514', CONSTRAINT = 'acquisition_progress_checkpoint_identity_guard';
  END IF;

  IF jsonb_typeof(NEW.data) <> 'object'
     OR NOT (NEW.data ? 'version')
     OR NOT (OLD.data ? 'version') THEN
    RAISE EXCEPTION 'Acquisition progress checkpoint requires an object with version.'
      USING ERRCODE = '23514', CONSTRAINT = 'acquisition_progress_checkpoint_shape_guard';
  END IF;

  BEGIN
    old_version := (OLD.data->>'version')::bigint;
    new_version := (NEW.data->>'version')::bigint;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Acquisition progress checkpoint version must be an integer.'
      USING ERRCODE = '23514', CONSTRAINT = 'acquisition_progress_checkpoint_version_guard';
  END;

  IF old_version < 1 OR new_version <> old_version + 1 THEN
    RAISE EXCEPTION 'Acquisition progress checkpoint version must advance by exactly one.'
      USING ERRCODE = '23514', CONSTRAINT = 'acquisition_progress_checkpoint_version_guard';
  END IF;

  FOREACH field_name IN ARRAY monotonic_fields LOOP
    IF OLD.data ? field_name OR NEW.data ? field_name THEN
      IF NOT (OLD.data ? field_name) OR NOT (NEW.data ? field_name) THEN
        RAISE EXCEPTION 'Acquisition progress counters cannot be removed or introduced after checkpoint creation.'
          USING ERRCODE = '23514', CONSTRAINT = 'acquisition_progress_checkpoint_counter_shape_guard';
      END IF;
      BEGIN
        old_value := (OLD.data->>field_name)::bigint;
        new_value := (NEW.data->>field_name)::bigint;
      EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'Acquisition progress counters must be integers.'
          USING ERRCODE = '23514', CONSTRAINT = 'acquisition_progress_checkpoint_counter_guard';
      END;
      IF old_value < 0 OR new_value < old_value THEN
        RAISE EXCEPTION 'Acquisition progress counters must be non-negative and monotonic.'
          USING ERRCODE = '23514', CONSTRAINT = 'acquisition_progress_checkpoint_counter_guard';
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER acquisition_progress_checkpoint_guard
BEFORE UPDATE OR DELETE ON job_checkpoints
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_acquisition_progress_checkpoint();
