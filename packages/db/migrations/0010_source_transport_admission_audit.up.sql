CREATE TABLE source_transport_admission_audits (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  transport_request_id text NOT NULL,
  source_request_id text NOT NULL,
  source_task_id text NOT NULL,
  connector_key text NOT NULL,
  connector_version text NOT NULL,
  transport_policy_id text NOT NULL,
  transport_policy_version text NOT NULL,
  decision text NOT NULL,
  reason_codes jsonb NOT NULL,
  warnings jsonb NOT NULL,
  canonical_url text NOT NULL,
  hostname text NOT NULL,
  port integer,
  max_response_bytes bigint NOT NULL,
  timeout_ms bigint NOT NULL,
  evaluated_at timestamptz NOT NULL,
  envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_transport_admission_audits_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT source_transport_admission_audits_request_workspace_unique UNIQUE (workspace_id, transport_request_id),
  CONSTRAINT source_transport_admission_audits_id_check CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'),
  CONSTRAINT source_transport_admission_audits_transport_request_id_check CHECK (
    transport_request_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'
  ),
  CONSTRAINT source_transport_admission_audits_source_request_id_check CHECK (
    source_request_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'
  ),
  CONSTRAINT source_transport_admission_audits_connector_key_check CHECK (connector_key ~ '^connector\.[a-z0-9_.-]+$'),
  CONSTRAINT source_transport_admission_audits_connector_version_check CHECK (length(btrim(connector_version)) > 0),
  CONSTRAINT source_transport_admission_audits_policy_id_check CHECK (
    transport_policy_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'
  ),
  CONSTRAINT source_transport_admission_audits_policy_version_check CHECK (length(btrim(transport_policy_version)) > 0),
  CONSTRAINT source_transport_admission_audits_decision_check CHECK (decision IN ('allow', 'blocked')),
  CONSTRAINT source_transport_admission_audits_reason_codes_array_check CHECK (jsonb_typeof(reason_codes) = 'array'),
  CONSTRAINT source_transport_admission_audits_warnings_array_check CHECK (jsonb_typeof(warnings) = 'array'),
  CONSTRAINT source_transport_admission_audits_url_check CHECK (length(btrim(canonical_url)) > 0),
  CONSTRAINT source_transport_admission_audits_hostname_check CHECK (length(btrim(hostname)) > 0),
  CONSTRAINT source_transport_admission_audits_port_check CHECK (port IS NULL OR (port >= 1 AND port <= 65535)),
  CONSTRAINT source_transport_admission_audits_response_bytes_check CHECK (
    max_response_bytes >= 1 AND max_response_bytes <= 9007199254740991
  ),
  CONSTRAINT source_transport_admission_audits_timeout_check CHECK (timeout_ms >= 100 AND timeout_ms <= 120000),
  CONSTRAINT source_transport_admission_audits_envelope_object_check CHECK (jsonb_typeof(envelope) = 'object'),
  CONSTRAINT source_transport_admission_audits_envelope_identity_check CHECK (
    envelope->>'transportRequestId' IS NOT DISTINCT FROM transport_request_id
    AND envelope->>'sourceRequestId' IS NOT DISTINCT FROM source_request_id
    AND envelope->>'sourceTaskId' IS NOT DISTINCT FROM source_task_id
    AND envelope->>'connectorKey' IS NOT DISTINCT FROM connector_key
    AND envelope->>'connectorVersion' IS NOT DISTINCT FROM connector_version
    AND envelope->>'transportPolicyId' IS NOT DISTINCT FROM transport_policy_id
    AND envelope->>'transportPolicyVersion' IS NOT DISTINCT FROM transport_policy_version
    AND envelope->>'decision' IS NOT DISTINCT FROM decision
    AND envelope->'reasonCodes' IS NOT DISTINCT FROM reason_codes
    AND envelope->'warnings' IS NOT DISTINCT FROM warnings
    AND envelope->>'canonicalUrl' IS NOT DISTINCT FROM canonical_url
    AND envelope->>'hostname' IS NOT DISTINCT FROM hostname
    AND envelope->'port' IS NOT DISTINCT FROM COALESCE(to_jsonb(port), 'null'::jsonb)
    AND (envelope->>'maxResponseBytes')::bigint IS NOT DISTINCT FROM max_response_bytes
    AND (envelope->>'timeoutMs')::bigint IS NOT DISTINCT FROM timeout_ms
    AND (envelope->>'evaluatedAt')::timestamptz IS NOT DISTINCT FROM evaluated_at
  ),
  CONSTRAINT source_transport_admission_audits_task_workspace_fk
    FOREIGN KEY (source_task_id, workspace_id)
    REFERENCES source_tasks (id, workspace_id)
    ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX source_transport_admission_audits_task_time_idx
  ON source_transport_admission_audits (workspace_id, source_task_id, evaluated_at DESC, id DESC);
--> statement-breakpoint
CREATE INDEX source_transport_admission_audits_connector_time_idx
  ON source_transport_admission_audits (workspace_id, connector_key, connector_version, evaluated_at DESC, id DESC);
--> statement-breakpoint
CREATE TRIGGER source_transport_admission_audits_append_only
BEFORE UPDATE OR DELETE ON source_transport_admission_audits
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('source_transport_admission_audits_append_only');
