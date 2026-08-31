DROP TABLE IF EXISTS context_receipts;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.prevent_context_receipt_update();
--> statement-breakpoint
DROP TABLE IF EXISTS memory_conflicts;
--> statement-breakpoint
DROP TABLE IF EXISTS memory_records;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.enforce_memory_record_immutable_content();
--> statement-breakpoint
DROP TABLE IF EXISTS agent_checkpoints;
--> statement-breakpoint
DROP TABLE IF EXISTS agent_runs;
