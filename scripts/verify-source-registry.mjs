import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  SourceRegistryPersistenceError,
  applyPendingMigrations,
  createPgPool,
  getSourceAdmissionSnapshot,
  persistConnectorDefinition,
  persistConnectorPolicy,
  persistSourceAdmissionSnapshot,
  persistSourceCapability,
  probeDatabase,
  resolveConnectorRegistryEntry,
} from '../packages/db/dist/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for source registry verification.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for destructive source registry verification.');
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

function expectPostgresConstraint(expectedConstraint) {
  return (error) => {
    const postgresError = findPostgresError(error);
    assert.ok(postgresError, `Expected PostgreSQL constraint ${expectedConstraint}.`);
    assert.equal(postgresError.code, '23514');
    assert.equal(postgresError.constraint, expectedConstraint);
    return true;
  };
}

function expectSourceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof SourceRegistryPersistenceError, `Expected ${expectedCode}.`);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function resetDatabase() {
  for (const table of [
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

async function createWorkspace(slug) {
  const result = await pool.query(
    'INSERT INTO workspaces (slug, display_name) VALUES ($1, $2) RETURNING id',
    [slug, `Source Registry ${slug}`],
  );
  const id = result.rows[0]?.id;
  assert.ok(id);
  return id;
}

const capability = {
  sourceKey: 'source.company_sites',
  version: '1.0.0',
  sourceClass: 'company_first_party',
  accessMethods: ['first_party_web'],
  operations: ['fetch'],
  supportedFields: ['business.name', 'website.url'],
  dataClassifications: ['PUBLIC_BUSINESS'],
  geography: {
    mode: 'global',
    countryCodes: [],
    supportsRadius: false,
    supportsPolygon: false,
    supportsAdministrativeAreas: true,
  },
  pagination: { mode: 'cursor', maxPageSize: 100, maxCursorLength: 128 },
  hardLimits: {
    maxRequests: 20,
    maxPages: 20,
    maxBytes: 1_000_000,
    maxCurrencyMicros: 20_000,
    maxRuntimeMs: 20_000,
    maxConcurrency: 2,
  },
  supportsAttribution: true,
  supportsDeletion: true,
  supportsRefresh: true,
  supportsRawPayloadReference: false,
};

const policy = {
  policyId: 'policy.source.company_sites',
  version: '1.0.0',
  sourceKey: capability.sourceKey,
  connectorKey: 'connector.company_sites',
  state: 'APPROVED_WITH_LIMITS',
  accessMethod: 'first_party_web',
  policyLicenseRef: 'policy-ref.company-sites.v1',
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
  attribution: { required: true, policyRef: 'attribution.company-sites.v1' },
  export: { mode: 'policy_filtered', allowedFields: capability.supportedFields, attributionRequired: true },
  personalData: { allowed: false, allowedFields: [], requiresPurposeReview: false, exportAllowed: false },
  geography: { mode: 'global', allowedCountryCodes: [], blockedCountryCodes: [] },
  robots: { mode: 'respect', barrierBypassProhibited: true },
  quotas: {
    maxRequests: 10,
    maxPages: 10,
    maxBytes: 500_000,
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
  activation: 'dry_run',
  implementationVersion: '1.0.0',
  owner: 'platform.sources',
  changeReason: 'M02 source registry verification fixture.',
};

try {
  const databaseName = (await pool.query('SELECT current_database() AS name')).rows[0]?.name;
  assert.ok(databaseName?.endsWith('_test'), `Refusing destructive verification against database: ${databaseName}`);

  await resetDatabase();
  assert.deepEqual(await applyPendingMigrations(pool, migrationsDir), expectedMigrations);
  assert.equal((await probeDatabase(pool)).schemaReady, true);

  await assert.rejects(
    () =>
      pool.query(
        `INSERT INTO source_capabilities (source_key, version, source_class, envelope)
         VALUES ('source.direct-invalid', '1.0.0', 'company_first_party', '{}'::jsonb)`,
      ),
    expectPostgresConstraint('source_capabilities_envelope_identity_check'),
  );

  const capabilityId = await persistSourceCapability(pool, {
    sourceKey: capability.sourceKey,
    version: capability.version,
    sourceClass: capability.sourceClass,
    capability,
  });
  assert.equal(
    await persistSourceCapability(pool, {
      sourceKey: capability.sourceKey,
      version: capability.version,
      sourceClass: capability.sourceClass,
      capability,
    }),
    capabilityId,
  );
  await assert.rejects(
    () =>
      persistSourceCapability(pool, {
        sourceKey: capability.sourceKey,
        version: capability.version,
        sourceClass: capability.sourceClass,
        capability: { ...capability, supportedFields: [...capability.supportedFields, 'website.summary'] },
      }),
    expectSourceCode('SOURCE_CAPABILITY_VERSION_CONFLICT'),
  );

  const reviewedAt = new Date(policy.reviewedAt);
  const nextReviewAt = new Date(policy.nextReviewAt);
  const policyDbId = await persistConnectorPolicy(pool, {
    policyId: policy.policyId,
    version: policy.version,
    sourceKey: policy.sourceKey,
    connectorKey: policy.connectorKey,
    state: policy.state,
    accessMethod: policy.accessMethod,
    reviewedAt,
    nextReviewAt,
    policy,
  });
  assert.equal(
    await persistConnectorPolicy(pool, {
      policyId: policy.policyId,
      version: policy.version,
      sourceKey: policy.sourceKey,
      connectorKey: policy.connectorKey,
      state: policy.state,
      accessMethod: policy.accessMethod,
      reviewedAt,
      nextReviewAt,
      policy,
    }),
    policyDbId,
  );
  await assert.rejects(
    () =>
      persistConnectorPolicy(pool, {
        policyId: policy.policyId,
        version: policy.version,
        sourceKey: policy.sourceKey,
        connectorKey: policy.connectorKey,
        state: 'BLOCKED',
        accessMethod: policy.accessMethod,
        reviewedAt,
        nextReviewAt,
        policy: { ...policy, state: 'BLOCKED' },
      }),
    expectSourceCode('CONNECTOR_POLICY_VERSION_CONFLICT'),
  );

  await assert.rejects(
    () =>
      persistConnectorDefinition(pool, {
        connectorKey: 'connector.missing-capability',
        version: '1.0.0',
        sourceKey: 'source.missing',
        capabilityVersion: '1.0.0',
        policyId: 'policy.missing',
        policyVersion: '1.0.0',
        accessMethod: 'official_api',
        credentialMode: 'none',
        status: 'approved',
        activation: 'dry_run',
        implementationVersion: '1.0.0',
        definition: {
          connectorKey: 'connector.missing-capability',
          version: '1.0.0',
          sourceKey: 'source.missing',
          capabilityVersion: '1.0.0',
          policyId: 'policy.missing',
          policyVersion: '1.0.0',
          accessMethod: 'official_api',
          credentialMode: 'none',
          status: 'approved',
          activation: 'dry_run',
          implementationVersion: '1.0.0',
        },
      }),
    expectSourceCode('CONNECTOR_CAPABILITY_NOT_FOUND'),
  );

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
  assert.equal(
    await persistConnectorDefinition(pool, {
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
    }),
    definitionId,
  );
  await assert.rejects(
    () =>
      persistConnectorDefinition(pool, {
        connectorKey: definition.connectorKey,
        version: definition.version,
        sourceKey: definition.sourceKey,
        capabilityVersion: definition.capabilityVersion,
        policyId: definition.policyId,
        policyVersion: definition.policyVersion,
        accessMethod: definition.accessMethod,
        credentialMode: definition.credentialMode,
        status: definition.status,
        activation: 'disabled',
        implementationVersion: definition.implementationVersion,
        definition: { ...definition, activation: 'disabled' },
      }),
    expectSourceCode('CONNECTOR_DEFINITION_VERSION_CONFLICT'),
  );

  const registry = await resolveConnectorRegistryEntry(pool, {
    connectorKey: definition.connectorKey,
    connectorVersion: definition.version,
  });
  assert.ok(registry);
  assert.equal(registry.connectorDefinitionId, definitionId);
  assert.equal(registry.sourceCapabilityId, capabilityId);
  assert.equal(registry.connectorPolicyDbId, policyDbId);
  assert.equal(registry.activation, 'dry_run');
  assert.equal(registry.policyState, 'APPROVED_WITH_LIMITS');
  assert.equal(
    await resolveConnectorRegistryEntry(pool, { connectorKey: 'connector.unknown', connectorVersion: '1.0.0' }),
    null,
  );

  await assert.rejects(
    () => pool.query(`UPDATE source_capabilities SET source_class = 'industry_directory' WHERE id = $1`, [capabilityId]),
    expectPostgresConstraint('source_capabilities_append_only'),
  );
  await assert.rejects(
    () => pool.query(`DELETE FROM connector_policies WHERE id = $1`, [policyDbId]),
    expectPostgresConstraint('connector_policies_append_only'),
  );

  const workspaceA = await createWorkspace('source-registry-a');
  const workspaceB = await createWorkspace('source-registry-b');
  const evaluatedAt = new Date('2026-09-01T11:30:00.000Z');
  const request = {
    version: '1.0.0',
    requestId: 'source-request-registry-1',
    workspaceId: workspaceA,
    sourceTaskId: 'source-task-registry-1',
    connectorKey: definition.connectorKey,
    connectorVersion: definition.version,
    sourceKey: capability.sourceKey,
    operation: 'fetch',
    executionIntent: 'preflight',
    purpose: 'research.website',
    intendedUse: 'business.verification',
    requestedFields: ['business.name', 'website.url'],
    requestedDataClassifications: ['PUBLIC_BUSINESS'],
    geography: { countryCodes: ['TR'], areaRefs: [] },
    storageClass: 'EVIDENCE_MINIMAL',
    exportRequested: false,
    rawPayloadRequested: false,
    robotsDecision: 'allowed',
    targetUrl: 'https://example.com/',
    query: { categories: [], externalRefs: [], filters: {} },
    pagination: { pageSize: 25 },
    budget: {
      maxRequests: 5,
      maxPages: 5,
      maxBytes: 250_000,
      maxCurrencyMicros: 5_000,
      maxRuntimeMs: 5_000,
      maxConcurrency: 1,
    },
    policySnapshot: { policyId: policy.policyId, policyVersion: policy.version },
    requestedAt: '2026-09-01T11:29:00.000Z',
  };
  const admission = {
    decision: 'allow',
    reasonCodes: ['source_policy_admitted'],
    warnings: [],
    policySnapshot: { policyId: policy.policyId, policyVersion: policy.version },
    connectorKey: definition.connectorKey,
    connectorVersion: definition.version,
    sourceKey: capability.sourceKey,
    operation: request.operation,
    storageClass: request.storageClass,
    allowedStorageClasses: ['EVIDENCE_MINIMAL'],
    exportAllowed: false,
    rawPayloadAllowed: false,
    effectiveBudget: request.budget,
    evaluatedAt: evaluatedAt.toISOString(),
  };

  const snapshotInput = {
    id: 'source-admission-registry-1',
    workspaceId: workspaceA,
    sourceTaskId: request.sourceTaskId,
    requestId: request.requestId,
    connectorKey: definition.connectorKey,
    connectorVersion: definition.version,
    request,
    admission,
    evaluatedAt,
  };
  assert.equal(await persistSourceAdmissionSnapshot(pool, snapshotInput), snapshotInput.id);
  assert.equal(await persistSourceAdmissionSnapshot(pool, snapshotInput), snapshotInput.id);

  const snapshot = await getSourceAdmissionSnapshot(pool, workspaceA, snapshotInput.id);
  assert.ok(snapshot);
  assert.equal(snapshot.workspaceId, workspaceA);
  assert.equal(snapshot.sourceTaskId, request.sourceTaskId);
  assert.equal(snapshot.decision, 'allow');
  assert.deepEqual(snapshot.reasonCodes, ['source_policy_admitted']);
  assert.equal(snapshot.admission.operation, request.operation);
  assert.equal(snapshot.admission.storageClass, request.storageClass);
  assert.equal(await getSourceAdmissionSnapshot(pool, workspaceB, snapshotInput.id), null);

  await assert.rejects(
    () =>
      persistSourceAdmissionSnapshot(pool, {
        ...snapshotInput,
        workspaceId: workspaceB,
        request: { ...request, workspaceId: workspaceB },
      }),
    expectSourceCode('SOURCE_ADMISSION_ID_CONFLICT'),
  );
  await assert.rejects(
    () =>
      persistSourceAdmissionSnapshot(pool, {
        ...snapshotInput,
        request: { ...request, requestedDataClassifications: ['AUTH_SECRET'] },
      }),
    expectSourceCode('SOURCE_ADMISSION_AUTH_SECRET_FORBIDDEN'),
  );
  await assert.rejects(
    () =>
      persistSourceAdmissionSnapshot(pool, {
        ...snapshotInput,
        admission: { ...admission, connectorVersion: '2.0.0' },
      }),
    expectSourceCode('SOURCE_ADMISSION_IDENTITY_MISMATCH'),
  );
  await assert.rejects(
    () =>
      persistSourceAdmissionSnapshot(pool, {
        ...snapshotInput,
        admission: { ...admission, operation: 'lookup' },
      }),
    expectSourceCode('SOURCE_ADMISSION_IDENTITY_MISMATCH'),
  );
  await assert.rejects(
    () =>
      persistSourceAdmissionSnapshot(pool, {
        ...snapshotInput,
        admission: { ...admission, storageClass: 'REFERENCE_ONLY' },
      }),
    expectSourceCode('SOURCE_ADMISSION_IDENTITY_MISMATCH'),
  );
  await assert.rejects(
    () =>
      persistSourceAdmissionSnapshot(pool, {
        ...snapshotInput,
        admission: { ...admission, evaluatedAt: new Date(evaluatedAt.getTime() + 1_000).toISOString() },
      }),
    expectSourceCode('SOURCE_ADMISSION_IDENTITY_MISMATCH'),
  );
  await assert.rejects(
    () => pool.query(`UPDATE source_admission_snapshots SET decision = 'blocked' WHERE id = $1`, [snapshotInput.id]),
    expectPostgresConstraint('source_admission_snapshots_append_only'),
  );

  const directMismatch = {
    ...definition,
    connectorKey: 'connector.bad-policy-link',
  };
  await assert.rejects(
    () =>
      pool.query(
        `INSERT INTO connector_definitions (
           connector_key, version, source_key, capability_version, policy_id, policy_version,
           access_method, credential_mode, status, activation, implementation_version, envelope
         ) VALUES ($1, '1.0.0', $2, $3, $4, $5, 'first_party_web', 'none', 'approved', 'dry_run', '1.0.0', $6::jsonb)`,
        [
          directMismatch.connectorKey,
          capability.sourceKey,
          capability.version,
          policy.policyId,
          policy.version,
          JSON.stringify(directMismatch),
        ],
      ),
    (error) => findPostgresError(error)?.code === '23503',
  );

  console.log('Brovexa M02 durable source registry and admission snapshot verification passed.');
} finally {
  await resetDatabase();
  await pool.end();
}
