CREATE TABLE "job_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "job_type" text NOT NULL,
  "job_version" integer DEFAULT 1 NOT NULL,
  "idempotency_key" text NOT NULL,
  "correlation_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "job_runs_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  CONSTRAINT "job_runs_type_format_check" CHECK ("job_type" ~ '^[a-z][a-z0-9_.-]*$'),
  CONSTRAINT "job_runs_version_check" CHECK ("job_version" > 0),
  CONSTRAINT "job_runs_status_check" CHECK ("status" in ('pending', 'running', 'succeeded', 'failed', 'cancelled', 'review'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "job_runs_workspace_type_idempotency_unique"
  ON "job_runs" ("workspace_id", "job_type", "idempotency_key");
--> statement-breakpoint
CREATE INDEX "job_runs_workspace_status_idx" ON "job_runs" ("workspace_id", "status");
--> statement-breakpoint
CREATE TABLE "job_work_units" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_run_id" uuid NOT NULL,
  "workspace_id" uuid NOT NULL,
  "queue_name" text NOT NULL,
  "work_type" text NOT NULL,
  "work_version" integer DEFAULT 1 NOT NULL,
  "idempotency_key" text NOT NULL,
  "correlation_id" uuid NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'runnable' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "next_attempt_at" timestamptz,
  "cancellation_requested_at" timestamptz,
  "worker_id" text,
  "lease_expires_at" timestamptz,
  "last_error_code" text,
  "last_error_class" text,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "job_work_units_job_run_id_job_runs_id_fk"
    FOREIGN KEY ("job_run_id") REFERENCES "public"."job_runs"("id") ON DELETE cascade,
  CONSTRAINT "job_work_units_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  CONSTRAINT "job_work_units_queue_format_check" CHECK ("queue_name" ~ '^brovexa-[a-z0-9-]+-v[1-9][0-9]*$'),
  CONSTRAINT "job_work_units_type_format_check" CHECK ("work_type" ~ '^[a-z][a-z0-9_.-]*$'),
  CONSTRAINT "job_work_units_version_check" CHECK ("work_version" > 0),
  CONSTRAINT "job_work_units_attempt_count_check" CHECK ("attempt_count" >= 0),
  CONSTRAINT "job_work_units_max_attempts_check" CHECK ("max_attempts" >= 1),
  CONSTRAINT "job_work_units_status_check" CHECK ("status" in ('runnable', 'running', 'retry_wait', 'succeeded', 'cancelled', 'dead_letter', 'review')),
  CONSTRAINT "job_work_units_error_class_check" CHECK ("last_error_class" is null or "last_error_class" in ('retryable', 'permanent', 'cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "job_work_units_run_type_idempotency_unique"
  ON "job_work_units" ("job_run_id", "work_type", "idempotency_key");
--> statement-breakpoint
CREATE INDEX "job_work_units_recovery_idx"
  ON "job_work_units" ("status", "next_attempt_at", "lease_expires_at");
--> statement-breakpoint
CREATE INDEX "job_work_units_workspace_status_idx"
  ON "job_work_units" ("workspace_id", "status");
--> statement-breakpoint
CREATE TABLE "job_checkpoints" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "work_unit_id" uuid NOT NULL,
  "checkpoint_key" text NOT NULL,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "job_checkpoints_work_unit_id_job_work_units_id_fk"
    FOREIGN KEY ("work_unit_id") REFERENCES "public"."job_work_units"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX "job_checkpoints_work_unit_key_unique"
  ON "job_checkpoints" ("work_unit_id", "checkpoint_key");
--> statement-breakpoint
CREATE TABLE "job_effects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "work_unit_id" uuid NOT NULL,
  "effect_key" text NOT NULL,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "job_effects_work_unit_id_job_work_units_id_fk"
    FOREIGN KEY ("work_unit_id") REFERENCES "public"."job_work_units"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX "job_effects_work_unit_key_unique"
  ON "job_effects" ("work_unit_id", "effect_key");
