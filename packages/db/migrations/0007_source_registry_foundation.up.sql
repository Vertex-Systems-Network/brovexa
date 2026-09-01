CREATE TABLE source_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL,
  version text NOT NULL,
  source_class text NOT NULL,
  envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_capabilities_key_version_unique UNIQUE (source_key, version),
  CONSTRAINT source_capabilities_identity_unique UNIQUE (id, source_key, version),
  CONSTRAINT source_capabilities_source_key_check CHECK (source_key ~ '^source\.[a-z0-9_.-]+$'),
  CONSTRAINT source_capabilities_version_check CHECK (length(btrim(version)) > 0),
  CONSTRAINT source_capabilities_source_class_check CHECK (
    source_class IN (
      'maps_local_api',
      'official_registry_open_data',
      'industry_directory',
      'company_first_party',
      'careers_jobs',
      'procurement_tender',
      'news_search_index',
      'review_reputation',
      'social_community',
      'technical_technology',
      'funding_company_intelligence',
      'customer_first_party',
      'licensed_b2b',
      'customer_import',
      'browser_manual_capture',
      'partner_mcp'
    )
  ),
  CONSTRAINT source_capabilities_envelope_object_check CHECK (jsonb_typeof(envelope) = 'object'),
  CONSTRAINT source_capabilities_envelope_identity_check CHECK (
    envelope->>'sourceKey' = source_key
    AND envelope->>'version' = version
    AND envelope->>'sourceClass' = source_class
  )
);
--> statement-breakpoint
CREATE TRIGGER source_capabilities_append_only
BEFORE UPDATE OR DELETE ON source_capabilities
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('source_capabilities_append_only');
--> statement-breakpoint
CREATE TABLE connector_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id text NOT NULL,
  version text NOT NULL,
  source_key text NOT NULL,
  connector_key text NOT NULL,
  state text NOT NULL,
  access_method text NOT NULL,
  reviewed_at timestamptz NOT NULL,
  next_review_at timestamptz NOT NULL,
  envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connector_policies_key_version_unique UNIQUE (policy_id, version),
  CONSTRAINT connector_policies_registry_identity_unique UNIQUE (policy_id, version, source_key, connector_key),
  CONSTRAINT connector_policies_identity_unique UNIQUE (id, policy_id, version, source_key, connector_key),
  CONSTRAINT connector_policies_policy_id_check CHECK (length(btrim(policy_id)) > 0),
  CONSTRAINT connector_policies_version_check CHECK (length(btrim(version)) > 0),
  CONSTRAINT connector_policies_source_key_check CHECK (source_key ~ '^source\.[a-z0-9_.-]+$'),
  CONSTRAINT connector_policies_connector_key_check CHECK (connector_key ~ '^connector\.[a-z0-9_.-]+$'),
  CONSTRAINT connector_policies_state_check CHECK (
    state IN ('APPROVED', 'APPROVED_WITH_LIMITS', 'TRANSIENT_ONLY', 'REVIEW_REQUIRED', 'BLOCKED', 'EXPIRED')
  ),
  CONSTRAINT connector_policies_access_method_check CHECK (
    access_method IN (
      'official_api',
      'licensed_api',
      'public_web',
      'first_party_web',
      'open_data_dump',
      'customer_authorized',
      'user_import',
      'manual_capture',
      'webhook',
      'partner_protocol'
    )
  ),
  CONSTRAINT connector_policies_review_window_check CHECK (next_review_at > reviewed_at),
  CONSTRAINT connector_policies_envelope_object_check CHECK (jsonb_typeof(envelope) = 'object'),
  CONSTRAINT connector_policies_envelope_identity_check CHECK (
    envelope->>'policyId' = policy_id
    AND envelope->>'version' = version
    AND envelope->>'sourceKey' = source_key
    AND envelope->>'connectorKey' = connector_key
    AND envelope->>'state' = state
    AND envelope->>'accessMethod' = access_method
  )
);
--> statement-breakpoint
CREATE INDEX connector_policies_connector_review_idx
  ON connector_policies (connector_key, next_review_at, policy_id, version);
--> statement-breakpoint
CREATE TRIGGER connector_policies_append_only
BEFORE UPDATE OR DELETE ON connector_policies
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('connector_policies_append_only');
--> statement-breakpoint
CREATE TABLE connector_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_key text NOT NULL,
  version text NOT NULL,
  source_key text NOT NULL,
  capability_version text NOT NULL,
  policy_id text NOT NULL,
  policy_version text NOT NULL,
  access_method text NOT NULL,
  credential_mode text NOT NULL,
  status text NOT NULL,
  activation text NOT NULL,
  implementation_version text NOT NULL,
  envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connector_definitions_key_version_unique UNIQUE (connector_key, version),
  CONSTRAINT connector_definitions_identity_unique UNIQUE (
    id,
    connector_key,
    version,
    source_key,
    capability_version,
    policy_id,
    policy_version
  ),
  CONSTRAINT connector_definitions_connector_key_check CHECK (connector_key ~ '^connector\.[a-z0-9_.-]+$'),
  CONSTRAINT connector_definitions_version_check CHECK (length(btrim(version)) > 0),
  CONSTRAINT connector_definitions_source_key_check CHECK (source_key ~ '^source\.[a-z0-9_.-]+$'),
  CONSTRAINT connector_definitions_capability_version_check CHECK (length(btrim(capability_version)) > 0),
  CONSTRAINT connector_definitions_policy_id_check CHECK (length(btrim(policy_id)) > 0),
  CONSTRAINT connector_definitions_policy_version_check CHECK (length(btrim(policy_version)) > 0),
  CONSTRAINT connector_definitions_access_method_check CHECK (
    access_method IN (
      'official_api',
      'licensed_api',
      'public_web',
      'first_party_web',
      'open_data_dump',
      'customer_authorized',
      'user_import',
      'manual_capture',
      'webhook',
      'partner_protocol'
    )
  ),
  CONSTRAINT connector_definitions_credential_mode_check CHECK (
    credential_mode IN ('none', 'api_key_ref', 'oauth_ref', 'service_account_ref', 'user_authorized_ref')
  ),
  CONSTRAINT connector_definitions_status_check CHECK (status IN ('draft', 'approved', 'disabled')),
  CONSTRAINT connector_definitions_activation_check CHECK (activation IN ('disabled', 'dry_run', 'enabled')),
  CONSTRAINT connector_definitions_enabled_approved_check CHECK (activation <> 'enabled' OR status = 'approved'),
  CONSTRAINT connector_definitions_implementation_version_check CHECK (length(btrim(implementation_version)) > 0),
  CONSTRAINT connector_definitions_envelope_object_check CHECK (jsonb_typeof(envelope) = 'object'),
  CONSTRAINT connector_definitions_envelope_identity_check CHECK (
    envelope->>'connectorKey' = connector_key
    AND envelope->>'version' = version
    AND envelope->>'sourceKey' = source_key
    AND envelope->>'capabilityVersion' = capability_version
    AND envelope->>'policyId' = policy_id
    AND envelope->>'policyVersion' = policy_version
    AND envelope->>'accessMethod' = access_method
    AND envelope->>'credentialMode' = credential_mode
    AND envelope->>'status' = status
    AND envelope->>'activation' = activation
    AND envelope->>'implementationVersion' = implementation_version
  ),
  CONSTRAINT connector_definitions_capability_fk
    FOREIGN KEY (source_key, capability_version)
    REFERENCES source_capabilities (source_key, version)
    ON DELETE RESTRICT,
  CONSTRAINT connector_definitions_policy_fk
    FOREIGN KEY (policy_id, policy_version, source_key, connector_key)
    REFERENCES connector_policies (policy_id, version, source_key, connector_key)
    ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX connector_definitions_source_status_idx
  ON connector_definitions (source_key, status, activation, connector_key, version);
--> statement-breakpoint
CREATE TRIGGER connector_definitions_append_only
BEFORE UPDATE OR DELETE ON connector_definitions
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('connector_definitions_append_only');
--> statement-breakpoint
CREATE TABLE source_admission_snapshots (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_task_id text NOT NULL,
  request_id text NOT NULL,
  source_capability_id uuid NOT NULL,
  connector_policy_db_id uuid NOT NULL,
  connector_definition_id uuid NOT NULL,
  source_key text NOT NULL,
  capability_version text NOT NULL,
  connector_key text NOT NULL,
  connector_version text NOT NULL,
  policy_id text NOT NULL,
  policy_version text NOT NULL,
  decision text NOT NULL,
  reason_codes jsonb NOT NULL,
  warnings jsonb NOT NULL,
  request jsonb NOT NULL,
  admission jsonb NOT NULL,
  evaluated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_admission_snapshots_id_workspace_unique UNIQUE (id, workspace_id),
  CONSTRAINT source_admission_snapshots_task_request_unique UNIQUE (workspace_id, source_task_id, request_id),
  CONSTRAINT source_admission_snapshots_id_check CHECK (length(btrim(id)) > 0),
  CONSTRAINT source_admission_snapshots_task_id_check CHECK (length(btrim(source_task_id)) > 0),
  CONSTRAINT source_admission_snapshots_request_id_check CHECK (length(btrim(request_id)) > 0),
  CONSTRAINT source_admission_snapshots_decision_check CHECK (decision IN ('allow', 'review_required', 'blocked')),
  CONSTRAINT source_admission_snapshots_reason_codes_array_check CHECK (jsonb_typeof(reason_codes) = 'array'),
  CONSTRAINT source_admission_snapshots_warnings_array_check CHECK (jsonb_typeof(warnings) = 'array'),
  CONSTRAINT source_admission_snapshots_request_object_check CHECK (jsonb_typeof(request) = 'object'),
  CONSTRAINT source_admission_snapshots_admission_object_check CHECK (jsonb_typeof(admission) = 'object'),
  CONSTRAINT source_admission_snapshots_request_identity_check CHECK (
    request->>'requestId' = request_id
    AND request->>'workspaceId' = workspace_id::text
    AND request->>'sourceTaskId' = source_task_id
    AND request->>'sourceKey' = source_key
    AND request->>'connectorKey' = connector_key
    AND request->>'connectorVersion' = connector_version
    AND request->'policySnapshot'->>'policyId' = policy_id
    AND request->'policySnapshot'->>'policyVersion' = policy_version
  ),
  CONSTRAINT source_admission_snapshots_admission_identity_check CHECK (
    admission->>'decision' = decision
    AND admission->>'sourceKey' = source_key
    AND admission->>'connectorKey' = connector_key
    AND admission->>'connectorVersion' = connector_version
    AND admission->'policySnapshot'->>'policyId' = policy_id
    AND admission->'policySnapshot'->>'policyVersion' = policy_version
    AND admission->'reasonCodes' = reason_codes
    AND admission->'warnings' = warnings
  ),
  CONSTRAINT source_admission_snapshots_auth_secret_check CHECK (
    NOT (COALESCE(request->'requestedDataClassifications', '[]'::jsonb) @> '["AUTH_SECRET"]'::jsonb)
  ),
  CONSTRAINT source_admission_snapshots_capability_fk
    FOREIGN KEY (source_capability_id, source_key, capability_version)
    REFERENCES source_capabilities (id, source_key, version)
    ON DELETE RESTRICT,
  CONSTRAINT source_admission_snapshots_policy_fk
    FOREIGN KEY (connector_policy_db_id, policy_id, policy_version, source_key, connector_key)
    REFERENCES connector_policies (id, policy_id, version, source_key, connector_key)
    ON DELETE RESTRICT,
  CONSTRAINT source_admission_snapshots_definition_fk
    FOREIGN KEY (
      connector_definition_id,
      connector_key,
      connector_version,
      source_key,
      capability_version,
      policy_id,
      policy_version
    )
    REFERENCES connector_definitions (
      id,
      connector_key,
      version,
      source_key,
      capability_version,
      policy_id,
      policy_version
    )
    ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX source_admission_snapshots_workspace_task_idx
  ON source_admission_snapshots (workspace_id, source_task_id, evaluated_at DESC, id);
--> statement-breakpoint
CREATE TRIGGER source_admission_snapshots_append_only
BEFORE UPDATE OR DELETE ON source_admission_snapshots
FOR EACH ROW EXECUTE FUNCTION brovexa_internal.reject_append_only_lifecycle_mutation('source_admission_snapshots_append_only');