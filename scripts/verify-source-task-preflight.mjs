import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  SourceTaskPersistenceError,
  applyPendingMigrations,
  cancelSourceTask,
  claimSourceTask,
  completeSourceTask,
  createPgPool,
  createSourceTask,
  getResearchJobPreflight,
  getResearchJobPreflightState,
  getSourceTaskState,
  persistConnectorDefinition,
  persistConnectorPolicy,
  persistResearchJobPreflight,
  persistSourceAdmissionSnapshot,
  persistSourceCapability,
  probeDatabase,
  recordSourceTaskFailure,
  recordSourceTaskUsage,
} from '../packages/db/dist/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for source-task preflight verification.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for destructive source-task preflight verification.');
}

const migrationsDir = resolve('packages/db/migrations');
const pool = createPgPool({ connectionString, max: 6 });

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

function expectPostgresConstraint(constraint) {
  return (error) => {
    const postgres = findPostgresError(error);
    assert.ok(postgres, `Expected PostgreSQL constraint ${constraint}.`);
    assert.equal(postgres.code, '23514');
    assert.equal(postgres.constraint, constraint);
    return true;
  };
}

function expectSourceTaskCode(code) {
  return (error) => {
    assert.ok(error instanceof SourceTaskPersistenceError, `Expected SourceTaskPersistenceError(${code}).`);
    assert.equal(error.code, code);
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
    [slug, `Source Task ${slug}`],
  );
  const id = result.rows[0]?.id;
  assert.ok(id);
  return id;
}

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
  hardLimits: { ...budget, maxRequests: 10, maxPages: 10, maxBytes: 500_000, maxCurrencyMicros: 10_000, maxRuntimeMs: 10_000 },
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
  export: { mode: 'policy_filtered', allowedFields: capability.supportedFields, attributionRequired: true },
  personalData: { allowed: false, allowedFields: [], requiresPurposeReview: false, exportAllowed: false },
  geography: { mode: 'global', allowedCountryCodes: [], blockedCountryCodes: [] },
  robots: { mode: 'respect', barrierBypassProhibited: true },
  quotas: { ...budget, maxRequests: 8, maxPages: 8, maxBytes: 300_000, maxCurrencyMicros: 8_000, maxRuntimeMs: 8_000 },
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
  changeReason: 'M02 source-task persistence verification fixture; no transport is implemented.',
};

async function persistRegistry() {
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
}

async function createAdmission({ workspaceId, researchJobId, sourceTaskId, snapshotId, requestId, decision = 'allow', evaluatedAt }) {
  const request = {
    version: '1.0.0',
    requestId,
    workspaceId,
    researchJobId,
    sourceTaskId,
    connectorKey: definition.connectorKey,
    connectorVersion: definition.version,
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
    requestedAt: new Date(evaluatedAt.getTime() - 1_000).toISOString(),
  };
  const admission = {
    decision,
    reasonCodes: decision === 'allow' ? ['source_policy_admitted'] : [`source_policy_${decision}`],
    warnings: [],
    sourceKey: capability.sourceKey,
    connectorKey: definition.connectorKey,
    connectorVersion: definition.version,
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
    id: snapshotId,
    workspaceId,
    sourceTaskId,
    requestId,
    connectorKey: definition.connectorKey,
    connectorVersion: definition.version,
    request,
    admission,
    evaluatedAt,
  });
  return { request, admission };
}

try {
  const databaseName = (await pool.query('SELECT current_database() AS name')).rows[0]?.name;
  assert.ok(databaseName?.endsWith('_test'), `Refusing destructive verification against database: ${databaseName}`);

  await resetDatabase();
  assert.deepEqual(await applyPendingMigrations(pool, migrationsDir), expectedMigrations);
  assert.equal((await probeDatabase(pool)).schemaReady, true);

  const workspaceA = await createWorkspace('source-task-a');
  const workspaceB = await createWorkspace('source-task-b');
  await persistRegistry();

  const now = new Date('2026-09-01T12:00:00.000Z');
  await createAdmission({
    workspaceId: workspaceA,
    researchJobId: 'research-job-1',
    sourceTaskId: 'source-task-1',
    snapshotId: 'admission-task-1',
    requestId: 'request-task-1',
    evaluatedAt: now,
  });

  const preflightInput = {
    id: 'preflight-job-1',
    workspaceId: workspaceA,
    researchJobId: 'research-job-1',
    idempotencyKey: 'preflight-v1',
    admissionSnapshotIds: ['admission-task-1'],
    createdAt: new Date('2026-09-01T12:00:01.000Z'),
  };
  const preflight = await persistResearchJobPreflight(pool, preflightInput);
  assert.equal(preflight.created, true);
  assert.equal(preflight.envelope.decision, 'allow');
  assert.deepEqual(preflight.envelope.aggregateBudget, budget);
  const preflightReplay = await persistResearchJobPreflight(pool, preflightInput);
  assert.equal(preflightReplay.created, false);
  assert.deepEqual(preflightReplay.envelope, preflight.envelope);
  assert.deepEqual(await getResearchJobPreflight(pool, workspaceA, preflightInput.id), preflight.envelope);
  assert.equal(await getResearchJobPreflight(pool, workspaceB, preflightInput.id), null);

  await assert.rejects(
    () => persistResearchJobPreflight(pool, { ...preflightInput, id: 'preflight-job-conflict' }),
    expectSourceTaskCode('SOURCE_PREFLIGHT_IDEMPOTENCY_CONFLICT'),
  );

  await createAdmission({
    workspaceId: workspaceA,
    researchJobId: 'research-job-review',
    sourceTaskId: 'source-task-review',
    snapshotId: 'admission-task-review',
    requestId: 'request-task-review',
    decision: 'review_required',
    evaluatedAt: new Date('2026-09-01T12:01:00.000Z'),
  });
  const reviewPreflight = await persistResearchJobPreflight(pool, {
    id: 'preflight-review',
    workspaceId: workspaceA,
    researchJobId: 'research-job-review',
    idempotencyKey: 'preflight-review-v1',
    admissionSnapshotIds: ['admission-task-review'],
    createdAt: new Date('2026-09-01T12:01:01.000Z'),
  });
  assert.equal(reviewPreflight.envelope.decision, 'review_required');
  await assert.rejects(
    () => createSourceTask(pool, {
      workspaceId: workspaceA,
      researchJobId: 'research-job-review',
      preflightId: 'preflight-review',
      admissionSnapshotId: 'admission-task-review',
      sourceTaskId: 'source-task-review',
    }),
    expectSourceTaskCode('SOURCE_TASK_PREFLIGHT_NOT_ALLOWED'),
  );

  await createAdmission({
    workspaceId: workspaceA,
    researchJobId: 'research-job-blocked',
    sourceTaskId: 'source-task-blocked',
    snapshotId: 'admission-task-blocked',
    requestId: 'request-task-blocked',
    decision: 'blocked',
    evaluatedAt: new Date('2026-09-01T12:02:00.000Z'),
  });
  const blockedPreflight = await persistResearchJobPreflight(pool, {
    id: 'preflight-blocked',
    workspaceId: workspaceA,
    researchJobId: 'research-job-blocked',
    idempotencyKey: 'preflight-blocked-v1',
    admissionSnapshotIds: ['admission-task-blocked'],
    createdAt: new Date('2026-09-01T12:02:01.000Z'),
  });
  assert.equal(blockedPreflight.envelope.decision, 'blocked');

  const taskInput = {
    workspaceId: workspaceA,
    researchJobId: 'research-job-1',
    preflightId: preflightInput.id,
    admissionSnapshotId: 'admission-task-1',
    sourceTaskId: 'source-task-1',
    maxAttempts: 2,
  };
  const task = await createSourceTask(pool, taskInput);
  assert.equal(task.created, true);
  assert.equal(task.state.status, 'runnable');
  assert.equal(task.state.attemptCount, 0);
  assert.equal(task.state.maxAttempts, 2);
  assert.deepEqual(task.state.effectiveBudget, budget);
  assert.deepEqual(task.state.consumed, { requests: 0, pages: 0, bytes: 0, currencyMicros: 0, runtimeMs: 0 });
  const taskReplay = await createSourceTask(pool, taskInput);
  assert.equal(taskReplay.created, false);
  assert.equal(taskReplay.state.workUnitId, task.state.workUnitId);
  assert.equal(await getSourceTaskState(pool, workspaceB, taskInput.sourceTaskId), null);
  await assert.rejects(
    () => createSourceTask(pool, { ...taskInput, maxAttempts: 3 }),
    expectSourceTaskCode('SOURCE_TASK_ID_CONFLICT'),
  );

  const claimed1 = await claimSourceTask(pool, {
    workspaceId: workspaceA,
    sourceTaskId: taskInput.sourceTaskId,
    workerId: 'source-ci-worker',
    expectedAttempt: 1,
    leaseSeconds: 30,
  });
  assert.ok(claimed1);
  assert.equal(claimed1.payload.kind, 'source_task_execution');
  assert.equal((await getSourceTaskState(pool, workspaceA, taskInput.sourceTaskId))?.status, 'running');

  const usage1 = {
    eventId: 'source-usage-1',
    workspaceId: workspaceA,
    sourceTaskId: taskInput.sourceTaskId,
    usage: { requests: 2, pages: 1, bytes: 10_000, currencyMicros: 500, runtimeMs: 500 },
    metadata: { phase: 'attempt-1' },
    occurredAt: new Date('2026-09-01T12:03:00.000Z'),
  };
  assert.equal(await recordSourceTaskUsage(pool, usage1), true);
  assert.equal(await recordSourceTaskUsage(pool, usage1), false);
  await assert.rejects(
    () => recordSourceTaskUsage(pool, { ...usage1, usage: { ...usage1.usage, requests: 3 } }),
    expectSourceTaskCode('SOURCE_TASK_USAGE_ID_CONFLICT'),
  );
  await assert.rejects(
    () => recordSourceTaskUsage(pool, {
      ...usage1,
      eventId: 'source-usage-overflow',
      usage: { requests: 4, pages: 0, bytes: 0, currencyMicros: 0, runtimeMs: 0 },
      occurredAt: new Date('2026-09-01T12:03:01.000Z'),
    }),
    expectSourceTaskCode('SOURCE_TASK_BUDGET_EXCEEDED'),
  );

  const failed = await recordSourceTaskFailure(pool, {
    workspaceId: workspaceA,
    sourceTaskId: taskInput.sourceTaskId,
    errorClass: 'retryable',
    errorCode: 'TEST_TRANSIENT',
    retryDelayMs: 0,
  });
  assert.equal(failed.status, 'retry_wait');
  const claimed2 = await claimSourceTask(pool, {
    workspaceId: workspaceA,
    sourceTaskId: taskInput.sourceTaskId,
    workerId: 'source-ci-worker',
    expectedAttempt: 2,
  });
  assert.ok(claimed2);

  assert.equal(await recordSourceTaskUsage(pool, {
    eventId: 'source-usage-2',
    workspaceId: workspaceA,
    sourceTaskId: taskInput.sourceTaskId,
    usage: { requests: 1, pages: 1, bytes: 5_000, currencyMicros: 250, runtimeMs: 250 },
    metadata: { phase: 'attempt-2' },
    occurredAt: new Date('2026-09-01T12:04:00.000Z'),
  }), true);

  const completionInput = {
    workspaceId: workspaceA,
    sourceTaskId: taskInput.sourceTaskId,
    sourceReferenceIds: ['source-ref-1'],
    provenanceRefs: ['admission-task-1', 'policy.source.company_sites:1.0.0'],
    resultRef: 'source-result-ref-1',
  };
  assert.deepEqual(await completeSourceTask(pool, completionInput), { effectCreated: true });
  assert.deepEqual(await completeSourceTask(pool, completionInput), { effectCreated: false });
  const completed = await getSourceTaskState(pool, workspaceA, taskInput.sourceTaskId);
  assert.equal(completed?.status, 'succeeded');
  assert.equal(completed?.jobStatus, 'succeeded');
  assert.deepEqual(completed?.consumed, { requests: 3, pages: 2, bytes: 15_000, currencyMicros: 750, runtimeMs: 750 });

  const jobState = await getResearchJobPreflightState(pool, workspaceA, preflightInput.id);
  assert.equal(jobState?.preflight.decision, 'allow');
  assert.equal(jobState?.tasks.length, 1);
  assert.equal(jobState?.tasks[0]?.status, 'succeeded');

  await assert.rejects(
    () => pool.query(`UPDATE source_tasks SET max_attempts = 4 WHERE id = $1`, [taskInput.sourceTaskId]),
    expectPostgresConstraint('source_tasks_append_only'),
  );
  await assert.rejects(
    () => pool.query(`DELETE FROM research_job_preflights WHERE id = $1`, [preflightInput.id]),
    expectPostgresConstraint('research_job_preflights_append_only'),
  );
  await assert.rejects(
    () => pool.query(`UPDATE source_task_usage_events SET requests = requests + 1 WHERE id = 'source-usage-1'`),
    expectPostgresConstraint('source_task_usage_events_append_only'),
  );

  await createAdmission({
    workspaceId: workspaceA,
    researchJobId: 'research-job-cancel',
    sourceTaskId: 'source-task-cancel',
    snapshotId: 'admission-task-cancel',
    requestId: 'request-task-cancel',
    evaluatedAt: new Date('2026-09-01T12:05:00.000Z'),
  });
  await persistResearchJobPreflight(pool, {
    id: 'preflight-cancel',
    workspaceId: workspaceA,
    researchJobId: 'research-job-cancel',
    idempotencyKey: 'preflight-cancel-v1',
    admissionSnapshotIds: ['admission-task-cancel'],
    createdAt: new Date('2026-09-01T12:05:01.000Z'),
  });
  await createSourceTask(pool, {
    workspaceId: workspaceA,
    researchJobId: 'research-job-cancel',
    preflightId: 'preflight-cancel',
    admissionSnapshotId: 'admission-task-cancel',
    sourceTaskId: 'source-task-cancel',
    maxAttempts: 2,
  });
  assert.equal(await cancelSourceTask(pool, workspaceA, 'source-task-cancel'), 'cancelled');
  assert.equal(await cancelSourceTask(pool, workspaceA, 'source-task-cancel'), 'cancelled');

  await createAdmission({
    workspaceId: workspaceA,
    researchJobId: 'research-job-dead',
    sourceTaskId: 'source-task-dead',
    snapshotId: 'admission-task-dead',
    requestId: 'request-task-dead',
    evaluatedAt: new Date('2026-09-01T12:06:00.000Z'),
  });
  await persistResearchJobPreflight(pool, {
    id: 'preflight-dead',
    workspaceId: workspaceA,
    researchJobId: 'research-job-dead',
    idempotencyKey: 'preflight-dead-v1',
    admissionSnapshotIds: ['admission-task-dead'],
    createdAt: new Date('2026-09-01T12:06:01.000Z'),
  });
  await createSourceTask(pool, {
    workspaceId: workspaceA,
    researchJobId: 'research-job-dead',
    preflightId: 'preflight-dead',
    admissionSnapshotId: 'admission-task-dead',
    sourceTaskId: 'source-task-dead',
    maxAttempts: 1,
  });
  assert.ok(await claimSourceTask(pool, {
    workspaceId: workspaceA,
    sourceTaskId: 'source-task-dead',
    workerId: 'source-ci-worker',
    expectedAttempt: 1,
  }));
  assert.equal((await recordSourceTaskFailure(pool, {
    workspaceId: workspaceA,
    sourceTaskId: 'source-task-dead',
    errorClass: 'retryable',
    errorCode: 'TEST_EXHAUSTED',
  })).status, 'dead_letter');
  assert.equal((await getSourceTaskState(pool, workspaceA, 'source-task-dead'))?.status, 'dead_letter');

  assert.equal((await pool.query(`SELECT count(*)::int AS count FROM job_effects WHERE effect_key = 'source.execution.result'`)).rows[0]?.count, 1);
  console.log('Brovexa M02 ResearchJob preflight + durable SourceTask lifecycle verification passed.');
} finally {
  await resetDatabase();
  await pool.end();
}
