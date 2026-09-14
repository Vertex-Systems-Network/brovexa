ALTER TABLE connector_definitions
  ADD CONSTRAINT connector_definitions_health_identity_unique UNIQUE (id, connector_key, version);
--> statement-breakpoint
CREATE TABLE connector_health_snapshots (
  id text PRIMARY KEY,
  connector_definition_id uuid NOT NULL,
  connector_key text NOT NULL,
  connector_version text NOT NULL,
  status text NOT NULL,
  observed_at timestamptz NOT NULL,
  quota_remaining bigint,
  rolling_error_rate double precision NOT NULL,
  p95_latency_ms bigint,
  reason_codes jsonb NOT NULL,
  envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connector_health_snapshots_id_check CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'),
  CONSTRAINT connector_health_snapshots_connector_key_check CHECK (connector_key ~ '^connector\.[a-z0-9_.-]+$'),
  CONSTRAINT connector_health_snapshots_version_check CHECK (length(btrim(connector_version)) > 0),
  CONSTRAINT connector_health_snapshots_status_check CHECK (
    status IN ('ready', 'degraded', 'rate_limited', 'circuit_open', 'disabled', 'unknown')
  ),
  CONSTRAINT connector_health_snapshots_quota_check CHECK (
    quota_remaining IS NULL OR (quota_remaining >= 0 AND quota_remaining <= 9007199254740991)
  ),
  CONSTRAINT connector_health_snapshots_error_rate_check CHECK (rolling_error_rate >= 0 AND rolling_error_rate <= 1),
  CONSTRAINT connector_health_snapshots_latency_check CHECK (
    p95_latency_ms IS NULL OR (p95_latency_ms >= 0 AND p95_latency_ms <= 9007199254740991)
  ),
  CONSTRAINT connector_health_snapshots_reason_codes_array_check CHECK (jsonb_typeof(reason_codes) = 'array'),
  CONSTRAINT connector_health_snapshots_envelope_object_check CHECK (jsonb_typeof(envelope) = 'object'),
  CONSTRAINT connector_health_snapshots_envelope_identity_check CHECK (
    envelope->>'connectorKey' IS NOT DISTINCT FROM connector_key
    AND envelope->>'connectorVersion' IS NOT DISTINCT FROM connector_version
    AND envelope->>'status' IS NOT DISTINCT FROM status
    AND (envelope->>'observedAt')::timestamptz IS NOT DISTINCT FROM observed_at
    AND envelope->'quotaRemaining' IS NOT DISTINCT FROM COALESCE(to_jsonb(quota_remaining), 'null'::jsonb)
    AND (envelope->>'rollingErrorRate')::double precision IS NOT DISTINCT FROM rolling_error_rate
    AND envelope->'p95LatencyMs' IS NOT DISTINCT FROM COALESCE(to_jsonb(p95_latency_ms), 'null'::jsonb)
    AND envelope->'reasonCodes' IS NOT DISTINCT FROM reason_codes
  ),
  CONSTRAINT connector_health_snapshots_definition_fk
    FOREIGN KEY (connector_definition_id, connector_key, connector_version)
    REFERENCES connector_definitions (id, connector_key, version)
    ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX connector_health_snapshots_latest_idx
  ON connector_health_snapshots (connector_key, connector_version, observed_at DESC, created_at DESC, id DESC);
--> statement-breakpoint
CREATE TRIGGER connector_health_snapshots_append_only
BEFORE UPDATE OR DELETE ON connector_health_snapshots
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('connector_health_snapshots_append_only');
