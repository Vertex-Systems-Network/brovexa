import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  AgentExecutionDispatchError,
  AgentPersistenceConflictError,
  applyPendingMigrations,
  bootstrapWorkspaceOwner,
  cancelAgentExecutionDispatch,
  claimWorkUnit,
  completeWorkUnitWithEffect,
  createIdentityUser,
  createPgPool,
  createWorkspaceMembership,
  dispatchAgentExecutionPlan,
  getAgentExecutionDispatchState,
  listRecoverableWorkUnits,
  persistAgentDefinition,
  persistAgentExecutionPlan,
  persistContextReceipt,
  probeDatabase,
  reconcileAgentExecutionDispatch,
  recordAgentExecutionBudgetUsage,
  resolveWorkspaceAuthorization,
  setWorkspaceMembershipStatus,
  writeAgentExecutionCheckpoint,
} from '../packages/db/dist/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for dispatcher verification.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for destructive dispatcher verification.');
}

const migrationsDir = resolve('packages/db/migrations');
const pool = createPgPool({ connectionString, max: 6 });

function expectDispatchCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof AgentExecutionDispatchError, `Expected ${expectedCode}.`);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function resetDatabase() {
  for (const table of [
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
    [slug, `Dispatcher ${slug}`],
  );
  const id = result.rows[0]?.id;
  assert.ok(id);
  return id;
}

function definition(key, overrides = {}) {
  const base = {
    key,
    version: '1.0.0',
    status: 'approved',
    purpose: `Dispatcher verification for ${key}.`,
    nonGoals: ['Do not invoke production providers, models or external tools.'],
    triggerTypes: ['agent_run'],
    inputSchemaId: 'agent.execution.work.v1',
    outputSchemaId: 'agent.execution.result.v1',
    allowedTools: [],
    allowedCommands: [],
    memory: { read: ['workspace/*', 'run/*'], propose: [], commit: [], supersede: [] },
    autonomyTier: 'T1',
    humanInterrupts: ['budget_exceeded', 'dependency_failed'],
    requiresHumanApproval: false,
    modelPolicy: {
      routingMode: 'deterministic_only',
      allowedProviderIds: [],
      allowedModelIds: [],
      fallbackModelIds: [],
    },
    promptVersion: '1.0.0',
    skillVersions: {},
    contextVersion: '1.0.0',
    retryLimit: 2,
    budget: {
      maxTokens: 500,
      maxSearches: 0,
      maxApiCalls: 5,
      maxCredits: 0,
      maxCurrencyMicros: 10_000,
      maxRuntimeMs: 20_000,
      maxConcurrency: 1,
    },
    deterministicValidators: ['tenant_scope', 'budget_scope'],
    evidenceRequired: false,
    minimumConfidence: 0.8,
    reviewBelowConfidence: 0.9,
    evalSuiteId: 'AI-DISPATCH-001',
    evalThreshold: 0.99,
    dataClassifications: ['WORKSPACE_CONFIDENTIAL'],
    telemetryRedactionPolicyId: 'telemetry.default',
    owner: 'platform-ai',
    changeReason: 'Deterministic dispatcher verification.',
  };
  return { ...base, ...overrides, budget: { ...base.budget, ...(overrides.budget ?? {}) } };
}

const orchestrator = definition('agent.control.orchestrator', {
  autonomyTier: 'T2',
  retryLimit: 1,
  budget: { maxTokens: 2_000, maxApiCalls: 20, maxConcurrency: 2 },
});
const discover = definition('agent.research.discover');
const enrich = definition('agent.research.enrich');
const verify = definition('agent.research.verify');

async function persistDefinition(specification) {
  return persistAgentDefinition(pool, {
    agentKey: specification.key,
    version: specification.version,
    status: specification.status,
    autonomyTier: specification.autonomyTier,
    requiresHumanApproval: specification.requiresHumanApproval,
    specification,
  });
}

async function createPlanFixture({ workspaceId, userId, suffix, maxParallelism = 2 }) {
  const orchestratorId = await persistDefinition(orchestrator);
  await persistDefinition(discover);
  await persistDefinition(enrich);
  await persistDefinition(verify);

  const receiptId = `ctx-dispatch-${suffix}`;
  const receipt = {
    id: receiptId,
    taskId: `task-dispatch-${suffix}`,
    workspaceId,
    userId,
    agentKey: orchestrator.key,
    agentVersion: orchestrator.version,
    policyRefs: ['policy.dispatch.v1'],
    canonicalRefs: ['business:target'],
    memoryRefs: [],
    tokenBudget: 2_000,
    maxCurrencyMicros: 30_000,
    createdAt: '2026-09-01T01:00:00.000Z',
  };
  await persistContextReceipt(pool, {
    id: receipt.id,
    workspaceId,
    userId,
    agentDefinitionId: orchestratorId,
    agentKey: orchestrator.key,
    agentVersion: orchestrator.version,
    receipt,
    tokenBudget: receipt.tokenBudget,
    maxCurrencyMicros: receipt.maxCurrencyMicros,
    createdAt: new Date(receipt.createdAt),
  });

  const budget = {
    maxTokens: 100,
    maxSearches: 0,
    maxApiCalls: 2,
    maxCredits: 0,
    maxCurrencyMicros: 1_000,
    maxRuntimeMs: 1_000,
    maxConcurrency: 1,
  };
  const planId = `plan-dispatch-${suffix}`;
  await persistAgentExecutionPlan(pool, {
    id: planId,
    workspaceId,
    userId,
    runId: `run-dispatch-${suffix}`,
    contextReceiptId: receiptId,
    orchestratorKey: orchestrator.key,
    orchestratorVersion: orchestrator.version,
    planVersion: 1,
    maxParallelism,
    steps: [
      {
        key: 'discover',
        agentKey: discover.key,
        agentVersion: discover.version,
        dependencies: [],
        toolKeys: [],
        commandKeys: [],
        policyRefs: ['policy.dispatch.v1'],
        canonicalRefs: ['business:target'],
        memoryRefs: [],
        budget,
      },
      {
        key: 'enrich',
        agentKey: enrich.key,
        agentVersion: enrich.version,
        dependencies: [],
        toolKeys: [],
        commandKeys: [],
        policyRefs: ['policy.dispatch.v1'],
        canonicalRefs: ['business:target'],
        memoryRefs: [],
        budget,
      },
      {
        key: 'verify',
        agentKey: verify.key,
        agentVersion: verify.version,
        dependencies: ['discover'],
        toolKeys: [],
        commandKeys: [],
        policyRefs: ['policy.dispatch.v1'],
        canonicalRefs: ['business:target'],
        memoryRefs: [],
        budget,
      },
    ],
    createdAt: new Date('2026-09-01T01:01:00.000Z'),
  });
  return { planId, supportedAgentKeys: [discover.key, enrich.key, verify.key] };
}

try {
  const databaseName = (await pool.query('SELECT current_database() AS name')).rows[0]?.name;
  assert.ok(databaseName?.endsWith('_test'), `Refusing destructive verification against database: ${databaseName}`);

  await resetDatabase();
  assert.deepEqual(await applyPendingMigrations(pool, migrationsDir), [
    '0000_workspace_foundation',
    '0001_job_execution_foundation',
    '0002_identity_authorization_foundation',
    '0003_agent_runtime_core',
    '0004_memory_evaluation_core',
    '0005_agent_memory_lifecycle',
    '0006_agent_execution_plan',
  ]);
  assert.equal((await probeDatabase(pool)).schemaReady, true);

  const workspaceA = await createWorkspace('agent-dispatch-a');
  const workspaceB = await createWorkspace('agent-dispatch-b');
  const ownerA = await createIdentityUser(pool);
  const ownerB = await createIdentityUser(pool);
  await bootstrapWorkspaceOwner(pool, { workspaceId: workspaceA, userId: ownerA.id });
  await bootstrapWorkspaceOwner(pool, { workspaceId: workspaceB, userId: ownerB.id });

  const fixture = await createPlanFixture({ workspaceId: workspaceA, userId: ownerA.id, suffix: 'main' });
  const dispatchInput = {
    dispatchId: 'dispatch-main',
    workspaceId: workspaceA,
    planId: fixture.planId,
    handlerRegistryVersion: '1.0.0',
    supportedAgentKeys: fixture.supportedAgentKeys,
    createdAt: new Date('2026-09-01T01:02:00.000Z'),
  };

  await assert.rejects(
    () =>
      dispatchAgentExecutionPlan(pool, {
        ...dispatchInput,
        supportedAgentKeys: fixture.supportedAgentKeys.filter((key) => key !== verify.key),
      }),
    expectDispatchCode('AGENT_DISPATCH_HANDLER_UNAVAILABLE'),
  );
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM job_runs')).rows[0]?.count, 0);

  const dispatched = await dispatchAgentExecutionPlan(pool, dispatchInput);
  assert.equal(dispatched.created, true);
  assert.equal(dispatched.jobRunStatus, 'pending');
  assert.equal(dispatched.newlyRunnableWorkUnitIds.length, 2);
  assert.deepEqual(
    Object.fromEntries(dispatched.workUnits.map((work) => [work.stepKey, work.status])),
    { discover: 'runnable', enrich: 'runnable', verify: 'blocked' },
  );
  assert.equal(dispatched.workUnits.find((work) => work.stepKey === 'discover')?.maxAttempts, 3);

  const recoverableIds = (await listRecoverableWorkUnits(pool)).map((work) => work.id);
  assert.ok(dispatched.newlyRunnableWorkUnitIds.every((id) => recoverableIds.includes(id)));
  assert.equal(recoverableIds.includes(dispatched.workUnits.find((work) => work.stepKey === 'verify').workUnitId), false);

  const replay = await dispatchAgentExecutionPlan(pool, {
    ...dispatchInput,
    supportedAgentKeys: fixture.supportedAgentKeys.slice().reverse(),
  });
  assert.equal(replay.created, false);
  assert.equal(replay.jobRunId, dispatched.jobRunId);
  await assert.rejects(
    () => dispatchAgentExecutionPlan(pool, { ...dispatchInput, handlerRegistryVersion: '2.0.0' }),
    (error) =>
      error instanceof AgentPersistenceConflictError && error.code === 'AGENT_EXECUTION_DISPATCH_CONFLICT',
  );
  assert.equal(await getAgentExecutionDispatchState(pool, workspaceB, dispatchInput.dispatchId), null);

  const discoverWork = dispatched.workUnits.find((work) => work.stepKey === 'discover');
  const enrichWork = dispatched.workUnits.find((work) => work.stepKey === 'enrich');
  const verifyWork = dispatched.workUnits.find((work) => work.stepKey === 'verify');
  assert.ok(discoverWork && enrichWork && verifyWork);

  assert.ok(await claimWorkUnit(pool, discoverWork.workUnitId, 'dispatcher-ci-worker', 1, 30));
  const checkpointId = await writeAgentExecutionCheckpoint(pool, {
    workspaceId: workspaceA,
    dispatchId: dispatchInput.dispatchId,
    stepKey: 'discover',
    checkpointKey: 'agent.execution.progress',
    data: { page: 1 },
  });
  assert.equal(
    await writeAgentExecutionCheckpoint(pool, {
      workspaceId: workspaceA,
      dispatchId: dispatchInput.dispatchId,
      stepKey: 'discover',
      checkpointKey: 'agent.execution.progress',
      data: { page: 2 },
    }),
    checkpointId,
  );

  const usageEvent = {
    eventId: 'discover-usage-1',
    workspaceId: workspaceA,
    dispatchId: dispatchInput.dispatchId,
    stepKey: 'discover',
    usage: { tokens: 50, searches: 0, apiCalls: 1, credits: 0, currencyMicros: 500, runtimeMs: 250 },
    metadata: { phase: 'fixture' },
    occurredAt: new Date('2026-09-01T01:03:00.000Z'),
  };
  assert.equal(await recordAgentExecutionBudgetUsage(pool, usageEvent), true);
  assert.equal(await recordAgentExecutionBudgetUsage(pool, usageEvent), false);
  await assert.rejects(
    () => recordAgentExecutionBudgetUsage(pool, { ...usageEvent, usage: { ...usageEvent.usage, tokens: 51 } }),
    (error) =>
      error instanceof AgentPersistenceConflictError &&
      error.code === 'AGENT_EXECUTION_BUDGET_EVENT_ID_CONFLICT',
  );
  await assert.rejects(
    () =>
      recordAgentExecutionBudgetUsage(pool, {
        ...usageEvent,
        eventId: 'discover-usage-overflow',
        usage: { tokens: 51, searches: 0, apiCalls: 0, credits: 0, currencyMicros: 0, runtimeMs: 0 },
        occurredAt: new Date('2026-09-01T01:04:00.000Z'),
      }),
    expectDispatchCode('AGENT_DISPATCH_BUDGET_EXCEEDED'),
  );

  await completeWorkUnitWithEffect(pool, discoverWork.workUnitId, 'agent.execution.discover.complete', { ok: true });
  const afterDiscover = await reconcileAgentExecutionDispatch(pool, workspaceA, dispatchInput.dispatchId);
  assert.deepEqual(afterDiscover.newlyRunnableWorkUnitIds, [verifyWork.workUnitId]);
  assert.equal(afterDiscover.workUnits.find((work) => work.stepKey === 'verify')?.status, 'runnable');

  assert.ok(await claimWorkUnit(pool, enrichWork.workUnitId, 'dispatcher-ci-worker', 1, 30));
  await completeWorkUnitWithEffect(pool, enrichWork.workUnitId, 'agent.execution.enrich.complete', { ok: true });
  assert.ok(await claimWorkUnit(pool, verifyWork.workUnitId, 'dispatcher-ci-worker', 1, 30));
  await completeWorkUnitWithEffect(pool, verifyWork.workUnitId, 'agent.execution.verify.complete', { ok: true });
  const completed = await reconcileAgentExecutionDispatch(pool, workspaceA, dispatchInput.dispatchId);
  assert.equal(completed.jobRunStatus, 'succeeded');
  assert.ok(completed.workUnits.every((work) => work.status === 'succeeded'));
  assert.deepEqual(completed.workUnits.find((work) => work.stepKey === 'discover')?.consumed, {
    tokens: 50,
    searches: 0,
    apiCalls: 1,
    credits: 0,
    currencyMicros: 500,
    runtimeMs: 250,
  });

  const cancelFixture = await createPlanFixture({
    workspaceId: workspaceA,
    userId: ownerA.id,
    suffix: 'cancel',
    maxParallelism: 1,
  });
  const cancelDispatch = await dispatchAgentExecutionPlan(pool, {
    dispatchId: 'dispatch-cancel',
    workspaceId: workspaceA,
    planId: cancelFixture.planId,
    handlerRegistryVersion: '1.0.0',
    supportedAgentKeys: cancelFixture.supportedAgentKeys,
    createdAt: new Date('2026-09-01T02:02:00.000Z'),
  });
  assert.equal(cancelDispatch.newlyRunnableWorkUnitIds.length, 1);
  const cancelled = await cancelAgentExecutionDispatch(pool, workspaceA, 'dispatch-cancel');
  assert.equal(cancelled.jobRunStatus, 'cancelled');
  assert.ok(cancelled.workUnits.every((work) => work.status === 'cancelled'));

  const ownerBContext = await resolveWorkspaceAuthorization(pool, {
    workspaceId: workspaceB,
    userId: ownerB.id,
  });
  const authUser = await createIdentityUser(pool);
  const authMembership = await createWorkspaceMembership(pool, ownerBContext, authUser.id);
  const authFixture = await createPlanFixture({
    workspaceId: workspaceB,
    userId: authUser.id,
    suffix: 'auth',
    maxParallelism: 1,
  });
  await setWorkspaceMembershipStatus(pool, ownerBContext, {
    targetMembershipId: authMembership.membershipId,
    status: 'suspended',
  });
  await assert.rejects(
    () =>
      dispatchAgentExecutionPlan(pool, {
        dispatchId: 'dispatch-auth',
        workspaceId: workspaceB,
        planId: authFixture.planId,
        handlerRegistryVersion: '1.0.0',
        supportedAgentKeys: authFixture.supportedAgentKeys,
        createdAt: new Date('2026-09-01T03:02:00.000Z'),
      }),
    expectDispatchCode('AGENT_DISPATCH_AUTHORIZATION_REQUIRED'),
  );

  console.log('Brovexa M01A deterministic AgentExecutionPlan dispatcher verification passed.');
} finally {
  await resetDatabase();
  await pool.end();
}
