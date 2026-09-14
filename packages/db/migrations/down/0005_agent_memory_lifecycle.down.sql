DROP TRIGGER IF EXISTS memory_records_lifecycle_projection_guard ON memory_records;
--> statement-breakpoint
DROP TRIGGER IF EXISTS agent_runs_lifecycle_projection_guard ON agent_runs;
--> statement-breakpoint
ALTER TABLE memory_records
  DROP CONSTRAINT IF EXISTS memory_records_last_lifecycle_event_workspace_fk;
--> statement-breakpoint
ALTER TABLE agent_runs
  DROP CONSTRAINT IF EXISTS agent_runs_last_transition_workspace_fk;
--> statement-breakpoint
DROP TABLE IF EXISTS memory_record_lifecycle_events;
--> statement-breakpoint
DROP TABLE IF EXISTS agent_run_transitions;
--> statement-breakpoint
ALTER TABLE memory_records
  DROP COLUMN IF EXISTS last_lifecycle_event_id;
--> statement-breakpoint
ALTER TABLE agent_runs
  DROP COLUMN IF EXISTS last_transition_id;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_memory_lifecycle_projection();
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.guard_agent_run_lifecycle_projection();
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.reject_append_only_lifecycle_mutation();
