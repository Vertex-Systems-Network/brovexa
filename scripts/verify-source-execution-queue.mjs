import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  ConnectorAdmissionDecisionSchema,
  ConnectorDefinitionSchema,
  ConnectorPolicySchema,
  SourceCapabilitySchema,
  SourceRequestEnvelopeSchema,
  SourceResultEnvelopeSchema,
  validateSourceResultAgainstAdmission,
} from '../packages/contracts/dist/index.js';
import {
  applyPendingMigrations,
  createPgPool,
  createSourceTask,
  getSourceTaskState,
  persistConnectorDefinition,
  persistConnectorHealthSnapshot,
  persistConnectorPolicy,
  persistResearchJobPreflight,
  persistSourceAdmissionSnapshot,
  persistSourceCapability,
} from '../packages/db/dist/index.js';
import { createWorkQueue, parseQueueRedisUrl } from '../packages/queue/dist/index.js';
import { createSourceExecutionHandlers } from '../apps/worker/dist/source-execution-runtime.js';
import { createCanonicalWorkerRuntime } from '../apps/worker/dist/runtime.js';

const databaseUrl = process.env.DATABASE_URL;
const queueRedisUrl = process.env.QUEUE_REDIS_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for source execution queue verification.');
if (!queueRedisUrl) throw new Error('QUEUE_REDIS_URL is required for source execution queue verification.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for destructive source execution verification.');
}

const pool = createPgPool({ connectionString: databaseUrl, max: 6 });
const connection = parseQueueRedisUrl(queueRedisUrl);
const migrationsDir = resolve('packages/db/migrations');
const expectedMigrations = (await readdir(migrationsDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /^\d{4}_.+\.up\.sql$/.test(entry.name))
  .map((entry) => entry.name.slice(0, -'.up.sql'.length))
  .sort();

const budget = {
  maxRequests: 5,
  maxPages: 5,
  maxBytes: 100_000,
  maxCurrencyMicros: 5_000,
  maxRuntimeMs: 5_000,
  maxConcurrency: 1,
};

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
    ...budget,
    maxRequests: 10,
    maxPages: 10,
    maxBytes: 500_000,
    maxCurrencyMicros: 10_000,
    maxRuntimeMs: 10_000,
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
  state: 'APPROVED',
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
  export: {
    mode: 'policy_filtered',
    allowedFields: capability.supportedFields,
    attributionRequired: true,
  },
  personalData: {
    allowed: false,
    allowedFields: [],
    requiresPurposeReview: false,
    exportAllowed: false,
  },
  geography: { mode: 'global', allowedCountryCodes: [], blockedCountryCodes: [] },
  robots: { mode: 'respect', barrierBypassProhibited: true },
  quotas: {
    ...budget,
    maxRequests: 8,
    maxPages: 8,
    maxBytes: 300_000,
    maxCurrencyMicros: 8_000,
    maxRuntimeMs: 8_000,
  },
  cost: { currency: 'USD', estimatedRequestMicros: 0 },
  credentials: {
    allowedModes: ['none'],
    secretLoggingProhibited: true,
    promptExposureProhibited: true,
  },
  fallback: { allowed: false, connectorKeys: [] },
  owner: 'platform.sources',
  reviewedAt: '2026-08-01T00:00:00.000Z',
  nextReviewAt: '2027-08-01T00:00:00.000Z',
};

const contractAdapter = {
  parseRequest: (value) => SourceRequestEnvelopeSchema.parse(value),
  parseAdmission: (value) => ConnectorAdmissionDecisionSchema.parse(value),
  parseCapability: (value) => SourceCapabilitySchema.parse(value),
  parsePolicy: (value) => ConnectorPolicySchema.parse(value),
  parseDefinition: (value) => ConnectorDefinitionSchema.parse(value),
  parseResult: (value) => SourceResultEnvelopeSchema.parse(value),
  validateResult: (input) => validateSourceResultAgainstAdmission(input),
};

async function waitFor(label, predicate, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function resetDatabase() {
  for (const table of [
    'source_transport_audit_records',
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

async function persistRegistryDefinition(version, activation) {
  const definition = {
    connectorKey: policy.connectorKey,
    version,
    sourceKey: capability.sourceKey,
    capabilityVersion: capability.version,
    policyId: policy.policyId,
    policyVersion: policy.version,
    accessMethod: 'first_party_web',
    credentialMode: 'none',
    status: 'approved',
    activation,
    implementationVersion: '1.0.0',
    owner: 'platform.sources',
    changeReason: `M02 source execution verification fixture (${activation}); no network transport.`,
  };
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
  });
  return definition;
}

async function persistHealth({ id, connectorVersion = '1.0.0', status = 'ready', observedAt, quotaRemaining = 10 }) {
  return persistConnectorHealthSnapshot(pool, {
    id,
    connectorKey: policy.connectorKey,
    connectorVersion,
    status,
    observedAt: new Date(observedAt),
    quotaRemaining,
    rollingErrorRate: status === 'degraded' ? 0.2 : 0,
    p95LatencyMs: 25,
    reasonCodes: status === 'ready' ? ['health_probe_ok'] : [`health_${status}`],
  });
}

async function createTask({ workspaceId, suffix, connectorVersion = '1.0.0', maxAttempts = 2 }) {
  const sourceTaskId = `source-task-${suffix}`;
  const researchJobId = `research-job-${suffix}`;
  const requestId = `request-${suffix}`;
  const admissionSnapshotId = `admission-${suffix}`;
  const preflightId = `preflight-${suffix}`;
  const evaluatedAt = new Date('2026-09-01T14:00:00.000Z');
  const request = {
    version: '1.0.0',
    requestId,
    workspaceId,
    researchJobId,
    sourceTaskId,
    connectorKey: policy.connectorKey,
    connectorVersion,
    sourceKey: capability.sourceKey,
    operation: 'fetch',
    executionIntent: 'execute',
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
    budget,
    policySnapshot: { policyId: policy.policyId, policyVersion: policy.version },
    requestedAt: '2026-09-01T13:59:59.000Z',
  };
  const admission = {
    decision: 'allow',
    reasonCodes: ['source_policy_admitted'],
    warnings: [],
    sourceKey: capability.sourceKey,
    connectorKey: policy.connectorKey,
    connectorVersion,
    policySnapshot: { policyId: policy.policyId, policyVersion: policy.version },
    operation: request.operation,
    storageClass: request.storageClass,
    allowedStorageClasses: ['EVIDENCE_MINIMAL'],
    exportAllowed: false,
    rawPayloadAllowed: false,
    effectiveBudget: budget,
    evaluatedAt: evaluatedAt.toISOString(),
  };
  await persistSourceAdmissionSnapshot(pool, {
    id: admissionSnapshotId,
    workspaceId,
    sourceTaskId,
    requestId,
    connectorKey: policy.connectorKey,
    connectorVersion,
    request,
    admission,
    evaluatedAt,
  });
  await persistResearchJobPreflight(pool, {
    id: preflightId,
    workspaceId,
    researchJobId,
    idempotencyKey: `preflight-key-${suffix}`,
    admissionSnapshotIds: [admissionSnapshotId],
    createdAt: new Date('2026-09-01T14:00:01.000Z'),
  });
  return createSourceTask(pool, {
    workspaceId,
    researchJobId,
    preflightId,
    admissionSnapshotId,
    sourceTaskId,
    maxAttempts,
  });
}

function baseResult(context, status, completedAt) {
  return {
    version: '1.0.0',
    requestId: context.request.requestId,
    workspaceId: context.workspaceId,
    sourceTaskId: context.sourceTaskId,
    connectorKey: context.request.connectorKey,
    connectorVersion: context.request.connectorVersion,
    sourceKey: context.request.sourceKey,
    policySnapshot: context.request.policySnapshot,
    status,
    sourceReferences: [],
    candidates: [],
    rawPayloadRefs: [],
    usage: { requests: 1, pages: 1, bytes: 100, currencyMicros: 10, runtimeMs: 25 },
    coverage: {
      state: status === 'empty' ? 'complete' : 'unknown',
      returnedRecords: 0,
      estimatedTotalRecords: status === 'empty' ? 0 : null,
      notes: [],
    },
    errors: [],
    completedAt,
  };
}

function completeResult(context) {
  const result = baseResult(context, 'complete', '2026-09-01T14:02:00.000Z');
  result.sourceReferences = [
    {
      referenceId: `source-ref-${context.sourceTaskId}`,
      sourceKey: context.request.sourceKey,
      connectorKey: context.request.connectorKey,
      connectorVersion: context.request.connectorVersion,
      url: 'https://example.com/',
      fetchedAt: result.completedAt,
      attribution: 'Example Company website',
    },
  ];
  result.candidates = [
    {
      candidateId: `candidate-${context.sourceTaskId}`,
      objectType: 'business',
      candidateState: 'unverified',
      fields: {
        'business.name': 'Example Company',
        'website.url': 'https://example.com/',
      },
      fieldNames: ['business.name', 'website.url'],
      dataClassifications: ['PUBLIC_BUSINESS'],
      storageClass: 'EVIDENCE_MINIMAL',
      sourceReferenceIds: [result.sourceReferences[0].referenceId],
      observedAt: result.completedAt,
    },
  ];
  result.coverage = {
    state: 'complete',
    returnedRecords: 1,
    estimatedTotalRecords: 1,
    notes: [],
  };
  return result;
}

async function assertTerminalError({ task, expectedStatus, expectedCode, label }) {
  await waitFor(label, async () =>
    (await getSourceTaskState(pool, task.state.workspaceId, task.state.sourceTaskId))?.status === expectedStatus,
  );
  const work = await pool.query('SELECT last_error_code FROM job_work_units WHERE id = $1', [task.state.workUnitId]);
  assert.equal(work.rows[0]?.last_error_code, expectedCode);
}

let runtime;
try {
  const databaseName = (await pool.query('SELECT current_database() AS name')).rows[0]?.name;
  assert.ok(databaseName?.endsWith('_test'), `Refusing destructive verification against database: ${databaseName}`);

  await resetDatabase();
  assert.deepEqual(await applyPendingMigrations(pool, migrationsDir), expectedMigrations);

  const workspace = await pool.query(
    `INSERT INTO workspaces (slug, display_name) VALUES ('source-execution', 'Source Execution') RETURNING id`,
  );
  const workspaceId = workspace.rows[0]?.id;
  assert.ok(workspaceId);

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
  await persistRegistryDefinition('1.0.0', 'enabled');
  await persistRegistryDefinition('1.0.1', 'dry_run');
  await persistRegistryDefinition('1.0.2', 'enabled');
  await persistHealth({ id: 'health-ready-1', observedAt: '2026-09-01T14:00:20.000Z', quotaRemaining: 10 });

  assert.throws(
    () => createSourceExecutionHandlers({
      pool,
      registryVersion: 'source-executors.v1',
      maxHealthAgeSeconds: 60,
      contracts: contractAdapter,
      executors: {
        [policy.connectorKey]: {
          connectorVersion: '1.0.0',
          implementationVersion: '1.0.0',
          networkAccess: 'network',
          execute: async () => { throw new Error('must not execute'); },
        },
      },
    }),
    /must not request network access/,
  );

  const setupQueue = createWorkQueue(connection);
  await setupQueue.waitUntilReady();
  await setupQueue.obliterate({ force: true });
  await setupQueue.close();

  const invocations = [];
  let runtimeNow = new Date('2026-09-01T14:00:30.000Z');
  const handlers = createSourceExecutionHandlers({
    pool,
    registryVersion: 'source-executors.v1',
    maxHealthAgeSeconds: 60,
    now: () => runtimeNow,
    contracts: contractAdapter,
    executors: {
      [policy.connectorKey]: {
        connectorVersion: '1.0.0',
        implementationVersion: '1.0.0',
        networkAccess: 'none',
        execute: async (context) => {
          invocations.push({ sourceTaskId: context.sourceTaskId, attempt: context.attempt, healthSnapshotId: context.health.id });
          assert.equal(context.request.executionIntent, 'execute');
          assert.equal(context.request.workspaceId, workspaceId);
          assert.equal(context.admission.decision, 'allow');
          assert.equal(context.definition.implementationVersion, '1.0.0');
          assert.equal(context.health.connectorVersion, '1.0.0');

          if (context.sourceTaskId === 'source-task-retry' && context.attempt === 1) {
            const result = baseResult(context, 'failed', '2026-09-01T14:01:00.000Z');
            result.errors = [
              {
                code: 'SOURCE_TEST_TRANSIENT',
                classification: 'retryable',
                message: 'Synthetic retryable source failure.',
              },
            ];
            return {
              result,
              resultRef: 'source-result-retry-1',
              provenanceRefs: ['admission-retry', 'policy.source.company_sites:1.0.0'],
            };
          }

          if (context.sourceTaskId === 'source-task-empty') {
            return {
              result: baseResult(context, 'empty', '2026-09-01T14:03:00.000Z'),
              resultRef: 'source-result-empty',
              provenanceRefs: ['admission-empty', 'policy.source.company_sites:1.0.0'],
            };
          }

          if (context.sourceTaskId === 'source-task-invalid') {
            const result = completeResult(context);
            result.sourceKey = 'source.other';
            return {
              result,
              resultRef: 'source-result-invalid',
              provenanceRefs: ['admission-invalid', 'policy.source.company_sites:1.0.0'],
            };
          }

          return {
            result: completeResult(context),
            resultRef: `source-result-${context.sourceTaskId}`,
            provenanceRefs: [
              `admission-${context.sourceTaskId.replace('source-task-', '')}`,
              'policy.source.company_sites:1.0.0',
            ],
          };
        },
      },
    },
  });

  runtime = await createCanonicalWorkerRuntime({
    pool,
    connection,
    handlers,
    workerId: 'source-execution-ci-worker',
    leaseSeconds: 1,
    retryBaseDelayMs: 10,
    retryMaxDelayMs: 25,
  });
  await runtime.queue.waitUntilReady();

  const retryTask = await createTask({ workspaceId, suffix: 'retry' });
  assert.equal(await runtime.reconcile(), 1);
  await waitFor('source retry then success', async () =>
    (await getSourceTaskState(pool, workspaceId, retryTask.state.sourceTaskId))?.status === 'succeeded',
  );
  const retryState = await getSourceTaskState(pool, workspaceId, retryTask.state.sourceTaskId);
  assert.equal(retryState?.attemptCount, 2);
  assert.deepEqual(retryState?.consumed, {
    requests: 2,
    pages: 2,
    bytes: 200,
    currencyMicros: 20,
    runtimeMs: 50,
  });
  assert.deepEqual(
    invocations.filter((entry) => entry.sourceTaskId === retryTask.state.sourceTaskId).map((entry) => entry.attempt),
    [1, 2],
  );

  const retryEffect = await pool.query(
    `SELECT data FROM job_effects WHERE work_unit_id = $1 AND effect_key = 'source.execution.result'`,
    [retryTask.state.workUnitId],
  );
  assert.equal(retryEffect.rows.length, 1);
  assert.equal(retryEffect.rows[0]?.data?.kind, 'source_task_result_reference');
  assert.equal(retryEffect.rows[0]?.data?.resultRef, 'source-result-source-task-retry');
  assert.equal(retryEffect.rows[0]?.data?.healthSnapshotId, 'health-ready-1');
  assert.deepEqual(retryEffect.rows[0]?.data?.sourceReferenceIds, ['source-ref-source-task-retry']);
  assert.equal('candidates' in retryEffect.rows[0].data, false);
  assert.equal('fields' in retryEffect.rows[0].data, false);

  const retryUsage = await pool.query(
    'SELECT metadata FROM source_task_usage_events WHERE source_task_id = $1 ORDER BY occurred_at, id',
    [retryTask.state.sourceTaskId],
  );
  assert.deepEqual(retryUsage.rows.map((row) => row.metadata.healthSnapshotId), ['health-ready-1', 'health-ready-1']);

  const emptyTask = await createTask({ workspaceId, suffix: 'empty', maxAttempts: 1 });
  assert.equal(await runtime.reconcile(), 1);
  await waitFor('empty source result completion', async () =>
    (await getSourceTaskState(pool, workspaceId, emptyTask.state.sourceTaskId))?.status === 'succeeded',
  );
  const emptyEffect = await pool.query(
    `SELECT data FROM job_effects WHERE work_unit_id = $1 AND effect_key = 'source.execution.result'`,
    [emptyTask.state.workUnitId],
  );
  assert.deepEqual(emptyEffect.rows[0]?.data?.sourceReferenceIds, []);
  assert.equal(emptyEffect.rows[0]?.data?.resultRef, 'source-result-empty');
  assert.equal(emptyEffect.rows[0]?.data?.healthSnapshotId, 'health-ready-1');

  const invalidTask = await createTask({ workspaceId, suffix: 'invalid', maxAttempts: 1 });
  assert.equal(await runtime.reconcile(), 1);
  await waitFor('invalid source result review', async () =>
    (await getSourceTaskState(pool, workspaceId, invalidTask.state.sourceTaskId))?.status === 'review',
  );
  const invalidState = await getSourceTaskState(pool, workspaceId, invalidTask.state.sourceTaskId);
  assert.equal(invalidState?.consumed.requests, 0);
  assert.equal(
    (await pool.query('SELECT count(*)::int AS count FROM job_effects WHERE work_unit_id = $1', [invalidTask.state.workUnitId])).rows[0]?.count,
    0,
  );

  const dryTask = await createTask({
    workspaceId,
    suffix: 'dry-run',
    connectorVersion: '1.0.1',
    maxAttempts: 1,
  });
  const invocationsBeforeDryRun = invocations.length;
  assert.equal(await runtime.reconcile(), 1);
  await assertTerminalError({
    task: dryTask,
    expectedStatus: 'review',
    expectedCode: 'SOURCE_EXECUTION_REGISTRY_IDENTITY_MISMATCH',
    label: 'dry-run connector review',
  });
  assert.equal(invocations.length, invocationsBeforeDryRun);

  const missingHealthTask = await createTask({
    workspaceId,
    suffix: 'missing-health',
    connectorVersion: '1.0.2',
    maxAttempts: 1,
  });
  const invocationsBeforeMissingHealth = invocations.length;
  assert.equal(await runtime.reconcile(), 1);
  await assertTerminalError({
    task: missingHealthTask,
    expectedStatus: 'review',
    expectedCode: 'SOURCE_EXECUTION_HEALTH_MISSING',
    label: 'missing health review',
  });
  assert.equal(invocations.length, invocationsBeforeMissingHealth);

  await persistHealth({
    id: 'health-unknown-2',
    status: 'unknown',
    observedAt: '2026-09-01T14:00:26.000Z',
    quotaRemaining: 10,
  });
  const unknownTask = await createTask({ workspaceId, suffix: 'health-unknown', maxAttempts: 1 });
  const invocationsBeforeUnknown = invocations.length;
  assert.equal(await runtime.reconcile(), 1);
  await assertTerminalError({
    task: unknownTask,
    expectedStatus: 'review',
    expectedCode: 'SOURCE_EXECUTION_HEALTH_NOT_EXECUTABLE',
    label: 'unknown health review',
  });
  assert.equal(invocations.length, invocationsBeforeUnknown);

  await persistHealth({
    id: 'health-circuit-3',
    status: 'circuit_open',
    observedAt: '2026-09-01T14:00:31.000Z',
    quotaRemaining: 10,
  });
  runtimeNow = new Date('2026-09-01T14:00:32.000Z');
  const circuitTask = await createTask({ workspaceId, suffix: 'health-circuit', maxAttempts: 1 });
  const invocationsBeforeCircuit = invocations.length;
  assert.equal(await runtime.reconcile(), 1);
  await assertTerminalError({
    task: circuitTask,
    expectedStatus: 'dead_letter',
    expectedCode: 'SOURCE_EXECUTION_HEALTH_CIRCUIT_OPEN',
    label: 'circuit-open retry exhaustion',
  });
  assert.equal(invocations.length, invocationsBeforeCircuit);

  await persistHealth({
    id: 'health-low-quota-4',
    status: 'ready',
    observedAt: '2026-09-01T14:00:33.000Z',
    quotaRemaining: 4,
  });
  runtimeNow = new Date('2026-09-01T14:00:34.000Z');
  const quotaTask = await createTask({ workspaceId, suffix: 'health-quota', maxAttempts: 1 });
  const invocationsBeforeQuota = invocations.length;
  assert.equal(await runtime.reconcile(), 1);
  await assertTerminalError({
    task: quotaTask,
    expectedStatus: 'dead_letter',
    expectedCode: 'SOURCE_EXECUTION_HEALTH_QUOTA_INSUFFICIENT',
    label: 'live quota retry exhaustion',
  });
  assert.equal(invocations.length, invocationsBeforeQuota);

  runtimeNow = new Date('2026-09-01T14:10:34.000Z');
  const staleTask = await createTask({ workspaceId, suffix: 'health-stale', maxAttempts: 1 });
  const invocationsBeforeStale = invocations.length;
  assert.equal(await runtime.reconcile(), 1);
  await assertTerminalError({
    task: staleTask,
    expectedStatus: 'review',
    expectedCode: 'SOURCE_EXECUTION_HEALTH_STALE',
    label: 'stale health review',
  });
  assert.equal(invocations.length, invocationsBeforeStale);

  runtimeNow = new Date(policy.nextReviewAt);
  const expiredPolicyTask = await createTask({ workspaceId, suffix: 'policy-expired', maxAttempts: 1 });
  const invocationsBeforePolicyExpiry = invocations.length;
  assert.equal(await runtime.reconcile(), 1);
  await assertTerminalError({
    task: expiredPolicyTask,
    expectedStatus: 'review',
    expectedCode: 'SOURCE_EXECUTION_POLICY_REVIEW_EXPIRED',
    label: 'expired policy review',
  });
  assert.equal(invocations.length, invocationsBeforePolicyExpiry);

  console.log('Brovexa M02 source execution policy/health gate + canonical worker/Valkey verification passed.');
} finally {
  await runtime?.close();
  await resetDatabase();
  await pool.end();
}
