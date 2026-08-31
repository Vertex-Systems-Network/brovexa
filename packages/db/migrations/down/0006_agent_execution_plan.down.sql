DROP TRIGGER IF EXISTS agent_execution_plans_append_only ON agent_execution_plans;
--> statement-breakpoint
DROP TABLE IF EXISTS agent_execution_plans;
--> statement-breakpoint
ALTER TABLE agent_runs
  DROP CONSTRAINT IF EXISTS agent_runs_plan_identity_unique;
--> statement-breakpoint
ALTER TABLE agent_context_receipts
  DROP CONSTRAINT IF EXISTS agent_context_receipts_plan_identity_unique;