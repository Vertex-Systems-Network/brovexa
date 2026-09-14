DROP TRIGGER IF EXISTS source_admission_snapshots_append_only ON source_admission_snapshots;
--> statement-breakpoint
DROP TABLE IF EXISTS source_admission_snapshots;
--> statement-breakpoint
DROP TRIGGER IF EXISTS connector_definitions_append_only ON connector_definitions;
--> statement-breakpoint
DROP TABLE IF EXISTS connector_definitions;
--> statement-breakpoint
DROP TRIGGER IF EXISTS connector_policies_append_only ON connector_policies;
--> statement-breakpoint
DROP TABLE IF EXISTS connector_policies;
--> statement-breakpoint
DROP TRIGGER IF EXISTS source_capabilities_append_only ON source_capabilities;
--> statement-breakpoint
DROP TABLE IF EXISTS source_capabilities;