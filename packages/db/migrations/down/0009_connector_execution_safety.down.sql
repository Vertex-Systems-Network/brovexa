DROP TABLE IF EXISTS connector_health_snapshots;
--> statement-breakpoint
ALTER TABLE connector_definitions
  DROP CONSTRAINT IF EXISTS connector_definitions_health_identity_unique;
