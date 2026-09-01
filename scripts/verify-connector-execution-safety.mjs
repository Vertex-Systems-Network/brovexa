import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  ConnectorHealthPersistenceError,
  applyPendingMigrations,
  createPgPool,
  getLatestConnectorHealthSnapshot,
  persistConnectorDefinition,
  persistConnectorHealthSnapshot,
  persistConnectorPolicy,
  persistSourceCapability,
  probeDatabase,
} from '../packages/db/dist/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for connector execution safety verification.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for destructive connector safety verification.');
}

const migrationsDir = resolve('packages/db/migrations');
const pool = createPgPool({ connectionString, max: 4 });
const expectedMigrations = [
  '0000_workspace_foundation',
  '0001_job_execution_foundation',
  '0002_identity_authorization_foundation',
  '0003_agent_runtime_core',
  '0004_memory_evaluation_core',
  '0005_agent_memory_lifecycle',
  '0006_agent_execution_plan',
  '0007_source_registry_foundation',
  '0008_source_task_preflight',
  '0009_connector_execution_safety',
];

function findPostgresError(error) {
  let current = error;
  for (let depth = 0; depth < 8; depth += 1) {
    if (!current || typeof current !== 'object') return null;
    if (typeof current.code === 'string' && /^[0-9A-Z]{5}$/.test(current.code)) return current;
    current = current.cause;
  }
  return null;
}

function expectPostgresConstraint(expectedCode, expectedConstraint) {
  return (error) => {
    const postgresError = findPostgresError(error);
    assert.ok(postgresError, `Expected PostgreSQL constraint ${expectedConstraint}.`);
    assert.equal(postgresError.code, expectedCode);
    assert.equal(postgresError.constraint, expectedConstraint);
    return true;
  };
}

function expectHealthCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ConnectorHealthPersistenceError, `Expected ${expectedCode}.`);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function resetDatabase() {
  for (const table of [
    'connector_health_snapshots',
    'source_task_usage_events',
    'source_tasks',
    'research_job_preflights',
    'source_admission_snapshots',
    'connector_definitions',
    'connector_policies',
    'source_capabilities',
    'agent_execution_plans',
    'memory_record_lifecycle_events',
    'agent_run_transitions',
    'agent_eval_results',
    'memory_records',
    'agent_runs',
    'agent_context_receipts',
    'agent_definitions',
    'authorization_audit_events',
    'workspace_membership_roles',
    'workspace_role_permissions',
    'workspace_roles',
    'permissions',
    'workspace_memberships',
    'users',
    'job_effects',
    'job_checkpoints',
    'job_work_units',
    'job_runs',
    'workspace_preferences',
    'workspaces',
  ]) {
    await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
  }
  await pool.query('DROP SCHEMA IF EXISTS brovexa_internal CASCADE');
}

const capability = {
  sourceKey: 'source.health_fixture',
  version: '1.0.0',
  sourceClass: 'company_first_party',
  accessMethods: ['first_party_web'],
  operations: ['fetch'],
  supportedFields: ['business.name'],
  dataClassifications: ['PUBLIC_BUSINESS'],
  geography: {
    mode: 'global',
    countryCodes: [],
    supportsRadius: false,
    supportsPolygon: false,
    supportsAdministrativeAreas: true,
  },
  pagination: { mode: 'none' },
  hardLimits: {
    maxRequests: 10,
    maxPages: 10,
    maxBytes: 100_000,
    maxCurrencyMicros: 10_000,
    maxRuntimeMs: 10_000,
    maxConcurrency: 1,
  },
  supportsAttribution: true,
  supportsDeletion: true,
  supportsRefresh: true,
  supportsRawPayloadReference: false,
};

const policy = {
  policyId: 'policy.source.health_fixture',
  version: '1.0.0',
  sourceKey: capability.sourceKey,
  connectorKey: 'connector.health_fixture',
  state: 'APPROVED',
  accessMethod: 'first_party_web',
  policyLicenseRef: 'policy-ref.health-fixture.v1',
  policyLicenseVersion: '1.0.0',
  allowedPurposes: ['research.website'],
  prohibitedPurposes: [],
  allowedFields: capability.supportedFields,
  allowedDataClassifications: ['PUBLIC_BUSINESS'],
  storage: {
    allowedClasses: ['EVIDENCE_MINIMAL'],
    defaultClass: 'EVIDENCE_MINIMAL',
    rawPayloadStorageAllowed: false,
    cacheTtlSeconds: 300,
    retentionTtlSeconds: 86_400,
    deletionRequired: true,
    refreshAfterSeconds: 3_600,
  },
  canonicalizationRule: 'independent_verification_required',
  attribution: { required: true, policyRef: 'attribution.health-fixture.v1' },
  export: { mode: 'none', allowedFields: [], attributionRequired: true },
  personalData: { allowed: false, allowedFields: [], requiresPurposeReview: false, exportAllowed: false },
  geography: { mode: 'global', allowedCountryCodes: [], blockedCountryCodes: [] },
  robots: { mode: 'respect', barrierBypassProhibited: true },
  quotas: {
    maxRequests: 10,
    maxPages: 10,
    maxBytes: 100_000,
    maxCurrencyMicros: 10_000,
    maxRuntimeMs: 10_000,
    maxConcurrency: 1,
  },
  cost: { currency: 'USD', estimatedRequestMicros: 0 },
  credentials: { allowedModes: ['none'], secretLoggingProhibited: true, promptExposureProhibited: true },
  fallback: { allowed: false, connectorKeys: [] },
  owner: 'platform.sources',
  reviewedAt: '2026-08-01T00:00:00.000Z',
  nextReviewAt: '2027-08-01T00:00:00.000Z',
};

const definition = {
  connectorKey: policy.connectorKey,
  version: '1.0.0',
  sourceKey: capability.sourceKey,
  capabilityVersion: capability.version,
  policyId: policy.policyId,
  policyVersion: policy.version,
  accessMethod: 'first_party_web',
  credentialMode: 'none',
  status: 'approved',
  activation: 'enabled',
  implementationVersion: '1.0.0',
  owner: 'platform.sources',
  changeReason: 'M02 connector execution safety verification fixture; no provider transport.',
};

try {
  const databaseName = (await pool.query('SELECT current_database() AS name')).rows[0]?.name;
  assert.ok(databaseName?.endsWith('_test'), `Refusing destructive verification against database: ${databaseName}`);

  await resetDatabase();
  assert.deepEqual(await applyPendingMigrations(pool, migrationsDir), expectedMigrations);
  assert.equal((await probeDatabase(pool)).schemaReady, true);

  await persistSourceCapability(pool, {
    sourceKey: capability.sourceKey,
    version: capability.version,
    sourceClass: capability.sourceClass,
    capability,
  });
  await persistConnectorPolicy(pool, {
    policyId: policy.policyId,
    version: policy.version,
    sourceKey: policy.sourceKey,
    connectorKey: policy.connectorKey,
    state: policy.state,
    accessMethod: policy.accessMethod,
    reviewedAt: new Date(policy.reviewedAt),
    nextReviewAt: new Date(policy.nextReviewAt),
    policy,
  });
  const definitionId = await persistConnectorDefinition(pool, {
    connectorKey: definition.connectorKey,
    version: definition.version,
    sourceKey: definition.sourceKey,
    capabilityVersion: definition.capabilityVersion,
    policyId: definition.policyId,
    policyVersion: definition.policyVersion,
    accessMethod: definition.accessMethod,
    credentialMode: definition.credentialMode,
    status: definition.status,
    activation: definition.activation,
    implementationVersion: definition.implementationVersion,
    definition,
  });

  await assert.rejects(
    () => persistConnectorHealthSnapshot(pool, {
      id: 'health-unregistered',
      connectorKey: 'connector.not_registered',
      connectorVersion: '1.0.0',
      status: 'ready',
      observedAt: new Date('2026-09-01T14:00:00.000Z'),
      quotaRemaining: 10,
      rollingErrorRate: 0,
      p95LatencyMs: 25,
      reasonCodes: [],
    }),
    expectHealthCode('CONNECTOR_HEALTH_REGISTRY_NOT_FOUND'),
  );

  const readyInput = {
    id: 'health-ready-1',
    connectorKey: definition.connectorKey,
    connectorVersion: definition.version,
    status: 'ready',
    observedAt: new Date('2026-09-01T14:00:00.000Z'),
    quotaRemaining: 10,
    rollingErrorRate: 0.01,
    p95LatencyMs: 25,
    reasonCodes: ['health_probe_ok'],
  };
  const ready = await persistConnectorHealthSnapshot(pool, readyInput);
  assert.equal(ready.created, true);
  assert.equal(ready.snapshot.connectorDefinitionId, definitionId);
  assert.equal((await persistConnectorHealthSnapshot(pool, readyInput)).created, false);

  await assert.rejects(
    () => persistConnectorHealthSnapshot(pool, { ...readyInput, quotaRemaining: 9 }),
    expectHealthCode('CONNECTOR_HEALTH_ID_CONFLICT'),
  );

  await new Promise((resolveWait) => setTimeout(resolveWait, 5));
  const degraded = await persistConnectorHealthSnapshot(pool, {
    id: 'health-degraded-older-observation',
    connectorKey: definition.connectorKey,
    connectorVersion: definition.version,
    status: 'degraded',
    observedAt: new Date('2026-09-01T13:59:59.000Z'),
    quotaRemaining: null,
    rollingErrorRate: 0.2,
    p95LatencyMs: null,
    reasonCodes: ['health_provider_degraded'],
  });
  assert.equal(degraded.created, true);
  assert.equal((await getLatestConnectorHealthSnapshot(pool, {
    connectorKey: definition.connectorKey,
    connectorVersion: definition.version,
  }))?.id, readyInput.id);

  await assert.rejects(
    () => pool.query(
      `UPDATE connector_health_snapshots SET status = 'disabled' WHERE id = $1`,
      [readyInput.id],
    ),
    expectPostgresConstraint('23514', 'connector_health_snapshots_append_only'),
  );

  await assert.rejects(
    () => pool.query(
      `INSERT INTO connector_health_snapshots (
         id, connector_definition_id, connector_key, connector_version, status,
         observed_at, quota_remaining, rolling_error_rate, p95_latency_ms, reason_codes, envelope
       ) VALUES ($1, $2, $3, $4, 'ready', $5, NULL, 0, NULL, '[]'::jsonb, $6::jsonb)`,
      [
        'health-malformed-envelope',
        definitionId,
        definition.connectorKey,
        definition.version,
        new Date('2026-09-01T14:00:01.000Z'),
        JSON.stringify({
          connectorKey: definition.connectorKey,
          connectorVersion: definition.version,
          status: 'ready',
          observedAt: '2026-09-01T14:00:01.000Z',
          rollingErrorRate: 0,
          reasonCodes: [],
        }),
      ],
    ),
    expectPostgresConstraint('23514', 'connector_health_snapshots_envelope_identity_check'),
  );

  await assert.rejects(
    () => pool.query(
      `INSERT INTO connector_health_snapshots (
         id, connector_definition_id, connector_key, connector_version, status,
         observed_at, quota_remaining, rolling_error_rate, p95_latency_ms, reason_codes, envelope
       ) VALUES ($1, $2, $3, '9.9.9', 'ready', $4, 1, 0, 1, '[]'::jsonb, $5::jsonb)`,
      [
        'health-wrong-version',
        definitionId,
        definition.connectorKey,
        new Date('2026-09-01T14:00:02.000Z'),
        JSON.stringify({
          connectorKey: definition.connectorKey,
          connectorVersion: '9.9.9',
          status: 'ready',
          observedAt: '2026-09-01T14:00:02.000Z',
          quotaRemaining: 1,
          rollingErrorRate: 0,
          p95LatencyMs: 1,
          reasonCodes: [],
        }),
      ],
    ),
    expectPostgresConstraint('23503', 'connector_health_snapshots_definition_fk'),
  );

  console.log('Brovexa M02 connector execution safety persistence verification passed.');
} finally {
  await resetDatabase();
  await pool.end();
}
