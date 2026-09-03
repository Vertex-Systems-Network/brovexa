import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  applyPendingMigrations,
  bootstrapWorkspaceOwner,
  createIdentityUser,
  createPgPool,
  dispatchAgentExecutionPlan,
  getAgentRunTransitionHistory,
  getAgentSpecialistRunsForWorkUnit,
  getWorkUnitStatus,
  persistAgentDefinition,
  persistAgentExecutionPlan,
  persistContextReceipt,
} from '../packages/db/dist/index.js';
import { createWorkQueue, parseQueueRedisUrl } from '../packages/queue/dist/index.js';
import { RetryableWorkError } from '../apps/worker/dist/errors.js';
import { createDeterministicSpecialistHandlers } from '../apps/worker/dist/agent-specialist-runtime.js';
import { createCanonicalWorkerRuntime } from '../apps/worker/dist/runtime.js';

const databaseUrl = process.env.DATABASE_URL;
const queueRedisUrl = process.env.QUEUE_REDIS_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for specialist queue verification.');
if (!queueRedisUrl) throw new Error('QUEUE_REDIS_URL is required for specialist queue verification.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for destructive specialist queue verification.');
}

const pool = createPgPool({ connectionString: databaseUrl, max: 6 });
const connection = parseQueueRedisUrl(queueRedisUrl);
const migrationsDir = resolve('packages/db/migrations');
const expectedMigrations = (await readdir(migrationsDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /^\d{4}_.+\.up\.sql$/.test(entry.name))
  .map((entry) => entry.name.slice(0, -'.up.sql'.length))
  .sort();

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

function definition(key, overrides = {}) {
  const base = {
    key,
    version: '1.0.0',
    status: 'approved',
    purpose: `Specialist queue verification for ${key}.`,
    nonGoals: ['Do not invoke providers, models or external tools.'],
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
    fallbackPolicyId: 'agent.fallback.review',
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
    evalSuiteId: 'AI-SPECIALIST-001',
    evalThreshold: 0.99,
    dataClassifications: ['WORKSPACE_CONFIDENTIAL'],
    telemetryRedactionPolicyId: 'telemetry.default',
    owner: 'platform-ai',
    changeReason: 'Deterministic specialist execution verification.',
  };
  return { ...base, ...overrides, budget: { ...base.budget, ...(overrides.budget ?? {}) } };
}

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

let runtime;
try {
  const databaseName = (await pool.query('SELECT current_database() AS name')).rows[0]?.name;
  assert.ok(databaseName?.endsWith('_test'), `Refusing destructive verification against database: ${databaseName}`);

  await resetDatabase();
  assert.deepEqual(await applyPendingMigrations(pool, migrationsDir), expectedMigrations);

  const workspace = await pool.query(
    `INSERT INTO workspaces (slug, display_name) VALUES ('specialist-queue', 'Specialist Queue') RETURNING id`,
  );
  const workspaceId = workspace.rows[0]?.id;
  assert.ok(workspaceId);
  const owner = await createIdentityUser(pool);
  await bootstrapWorkspaceOwner(pool, { workspaceId, userId: owner.id });

  const orchestrator = definition('agent.control.orchestrator', {
    autonomyTier: 'T2',
    retryLimit: 1,
    budget: {
      maxTokens: 2_000,
      maxApiCalls: 20,
      maxCurrencyMicros: 30_000,
      maxRuntimeMs: 60_000,
      maxConcurrency: 1,
    },
  });
  const specialist = definition('agent.research.specialist-ci');
  const orchestratorId = await persistDefinition(orchestrator);
  await persistDefinition(specialist);

  const parentContextId = 'ctx-specialist-queue-parent';
  const parentContext = {
    id: parentContextId,
    taskId: 'task-specialist-queue',
    workspaceId,
    userId: owner.id,
    agentKey: orchestrator.key,
    agentVersion: orchestrator.version,
    policyRefs: ['policy.specialist.v1'],
    canonicalRefs: ['business:target'],
    memoryRefs: [],
    tokenBudget: 2_000,
    maxCurrencyMicros: 30_000,
    createdAt: '2026-09-01T04:00:00.000Z',
  };
  await persistContextReceipt(pool, {
    id: parentContextId,
    workspaceId,
    userId: owner.id,
    agentDefinitionId: orchestratorId,
    agentKey: orchestrator.key,
    agentVersion: orchestrator.version,
    receipt: parentContext,
    tokenBudget: parentContext.tokenBudget,
    maxCurrencyMicros: parentContext.maxCurrencyMicros,
    createdAt: new Date(parentContext.createdAt),
  });

  const plan = await persistAgentExecutionPlan(pool, {
    id: 'plan-specialist-queue',
    workspaceId,
    userId: owner.id,
    runId: 'run-specialist-orchestrator',
    contextReceiptId: parentContextId,
    orchestratorKey: orchestrator.key,
    orchestratorVersion: orchestrator.version,
    planVersion: 1,
    maxParallelism: 1,
    steps: [
      {
        key: 'specialist',
        agentKey: specialist.key,
        agentVersion: specialist.version,
        dependencies: [],
        toolKeys: [],
        commandKeys: [],
        policyRefs: ['policy.specialist.v1'],
        canonicalRefs: ['business:target'],
        memoryRefs: [],
        budget: {
          maxTokens: 100,
          maxSearches: 0,
          maxApiCalls: 2,
          maxCredits: 0,
          maxCurrencyMicros: 1_000,
          maxRuntimeMs: 2_000,
          maxConcurrency: 1,
        },
      },
    ],
    createdAt: new Date('2026-09-01T04:01:00.000Z'),
  });
  assert.equal(plan.created, true);

  const dispatch = await dispatchAgentExecutionPlan(pool, {
    dispatchId: 'dispatch-specialist-queue',
    workspaceId,
    planId: 'plan-specialist-queue',
    handlerRegistryVersion: 'specialists.v1',
    supportedAgentKeys: [specialist.key],
    createdAt: new Date('2026-09-01T04:02:00.000Z'),
  });
  assert.equal(dispatch.created, true);
  assert.equal(dispatch.workUnits.length, 1);
  assert.equal(dispatch.newlyRunnableWorkUnitIds.length, 1);
  const workUnitId = dispatch.workUnits[0]?.workUnitId;
  assert.ok(workUnitId);

  const setupQueue = createWorkQueue(connection);
  await setupQueue.waitUntilReady();
  await setupQueue.obliterate({ force: true });
  await setupQueue.close();

  let executionCount = 0;
  const handlers = createDeterministicSpecialistHandlers({
    pool,
    registryVersion: 'specialists.v1',
    handlers: {
      [specialist.key]: {
        agentVersion: specialist.version,
        execute: async (context) => {
          executionCount += 1;
          assert.equal(context.payload.agentKey, specialist.key);
          assert.equal(context.payload.orchestratorRunId, 'run-specialist-orchestrator');
          assert.equal(context.payload.contextReceiptId, parentContextId);
          assert.ok(context.runId.startsWith('agent-specialist-'));
          assert.ok(context.contextReceiptId.startsWith('ctx-specialist-'));

          if (context.attempt === 1) {
            await context.checkpoint('agent.specialist.progress', { stage: 'first-attempt' });
            throw new RetryableWorkError('SPECIALIST_TEST_TRANSIENT');
          }

          assert.equal(
            await context.recordUsage(
              `specialist-budget-${context.runId}`,
              { tokens: 10, searches: 0, apiCalls: 1, credits: 0, currencyMicros: 100, runtimeMs: 50 },
              { verifier: 'queue' },
            ),
            true,
          );
          return {
            result: { ok: true, attempt: context.attempt },
            confidence: 0.99,
            validationState: 'passed',
            cost: {
              inputTokens: 6,
              outputTokens: 4,
              searches: 0,
              apiCalls: 1,
              credits: 0,
              currencyMicros: 100,
            },
          };
        },
      },
    },
  });

  runtime = await createCanonicalWorkerRuntime({
    pool,
    connection,
    handlers,
    workerId: 'specialist-ci-worker',
    leaseSeconds: 1,
    retryBaseDelayMs: 10,
    retryMaxDelayMs: 25,
  });

  await runtime.queue.waitUntilReady();
  assert.equal(await runtime.reconcile(), 1);

  await waitFor('specialist retry then success', async () =>
    (await getWorkUnitStatus(pool, workUnitId))?.status === 'succeeded',
  );
  const workStatus = await getWorkUnitStatus(pool, workUnitId);
  assert.equal(workStatus?.attemptCount, 2);
  assert.equal(executionCount, 2);

  const runs = await getAgentSpecialistRunsForWorkUnit(pool, workspaceId, workUnitId);
  assert.equal(runs.length, 2);
  assert.deepEqual(runs.map((run) => run.status), ['failed', 'succeeded']);
  assert.ok(runs.every((run) => run.parentRunId === 'run-specialist-orchestrator'));
  assert.notEqual(runs[0]?.contextReceiptId, runs[1]?.contextReceiptId);
  assert.deepEqual(runs[1]?.envelope.result, { ok: true, attempt: 2 });
  assert.equal(runs[1]?.envelope.confidence, 0.99);
  assert.equal(runs[1]?.envelope.executionMode, 'deterministic');
  assert.equal(runs[1]?.envelope.providerId, undefined);
  assert.equal(runs[1]?.envelope.modelId, undefined);

  const firstHistory = await getAgentRunTransitionHistory(pool, workspaceId, runs[0].runId);
  const secondHistory = await getAgentRunTransitionHistory(pool, workspaceId, runs[1].runId);
  assert.deepEqual(firstHistory.map((event) => [event.fromStatus, event.toStatus]), [
    ['queued', 'running'],
    ['running', 'failed'],
  ]);
  assert.deepEqual(secondHistory.map((event) => [event.fromStatus, event.toStatus]), [
    ['queued', 'running'],
    ['running', 'succeeded'],
  ]);

  const childContexts = await pool.query(
    `SELECT id, agent_key, agent_version, run_scope_id, receipt
     FROM agent_context_receipts
     WHERE workspace_id = $1
       AND agent_key = $2
       AND id LIKE 'ctx-specialist-%'
     ORDER BY id`,
    [workspaceId, specialist.key],
  );
  assert.equal(childContexts.rows.length, 2);
  assert.ok(childContexts.rows.every((row) => row.agent_key === specialist.key));
  assert.ok(childContexts.rows.every((row) => row.agent_version === specialist.version));
  assert.ok(childContexts.rows.every((row) => row.run_scope_id === 'run-specialist-orchestrator'));
  assert.ok(childContexts.rows.every((row) => row.receipt.canonicalRefs.length === 1));

  const resultEffects = await pool.query(
    `SELECT data
     FROM job_effects
     WHERE work_unit_id = $1 AND effect_key = 'agent.execution.specialist.result'`,
    [workUnitId],
  );
  assert.equal(resultEffects.rows.length, 1);
  assert.equal(resultEffects.rows[0]?.data?.kind, 'agent_specialist_execution_result');
  assert.equal(resultEffects.rows[0]?.data?.attempt, 2);

  const job = await pool.query('SELECT status FROM job_runs WHERE id = $1', [dispatch.jobRunId]);
  assert.equal(job.rows[0]?.status, 'succeeded');

  console.log('Brovexa deterministic specialist execution bridge + canonical worker/Valkey verification passed.');
} finally {
  await runtime?.close();
  await resetDatabase();
  await pool.end();
}
