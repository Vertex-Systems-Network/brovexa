import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  aggregateAgentExecutionPlan,
  applyPendingMigrations,
  bootstrapWorkspaceOwner,
  claimWorkUnit,
  completeAgentSpecialistAttempt,
  completeWorkUnitWithEffect,
  createAgentSpecialistTransitionId,
  createIdentityUser,
  createPgPool,
  dispatchAgentExecutionPlan,
  getAgentExecutionAggregationState,
  getAgentRunTransitionHistory,
  persistAgentDefinition,
  persistAgentExecutionPlan,
  persistContextReceipt,
  prepareAgentSpecialistAttempt,
  recordAgentExecutionBudgetUsage,
  transitionAgentRun,
} from '../packages/db/dist/index.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for execution aggregation verification.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for destructive aggregation verification.');
}

const pool = createPgPool({ connectionString: databaseUrl, max: 6 });
const migrationsDir = resolve('packages/db/migrations');

async function resetDatabase() {
  for (const table of [
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

function definition(key, version, overrides = {}) {
  const base = {
    key,
    version,
    status: 'approved',
    purpose: `Execution aggregation verification for ${key}.`,
    nonGoals: ['Do not invoke external providers in this verification.'],
    triggerTypes: ['agent_run'],
    inputSchemaId: 'agent.execution.input.v1',
    outputSchemaId: 'agent.execution.output.v1',
    allowedTools: [],
    allowedCommands: [],
    memory: { read: ['workspace/*', 'run/*'], propose: [], commit: [], supersede: [] },
    autonomyTier: key === 'agent.control.orchestrator' ? 'T2' : 'T1',
    humanInterrupts: ['scope_conflict', 'budget_exhausted', 'evaluation_required'],
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
    retryLimit: 1,
    budget: {
      maxTokens: key === 'agent.control.orchestrator' ? 5_000 : 500,
      maxSearches: 10,
      maxApiCalls: 20,
      maxCredits: 100,
      maxCurrencyMicros: 100_000,
      maxRuntimeMs: 60_000,
      maxConcurrency: key === 'agent.control.orchestrator' ? 2 : 1,
    },
    deterministicValidators: ['tenant_scope', 'policy_scope', 'budget_scope'],
    evidenceRequired: false,
    minimumConfidence: 0.8,
    reviewBelowConfidence: 0.9,
    evalSuiteId: 'AI-AGGREGATION-001',
    evalThreshold: 0.99,
    dataClassifications: ['BUSINESS_DATA'],
    telemetryRedactionPolicyId: 'telemetry.default',
    owner: 'platform-ai',
    changeReason: 'Execution aggregation verification fixture.',
  };
  return {
    ...base,
    ...overrides,
    modelPolicy: { ...base.modelPolicy, ...(overrides.modelPolicy ?? {}) },
    budget: { ...base.budget, ...(overrides.budget ?? {}) },
  };
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

function later(date, milliseconds) {
  return new Date(date.getTime() + milliseconds);
}

async function createFixture({ workspaceId, userId, orchestrator, orchestratorId, specialist, suffix, baseTime }) {
  const contextId = `ctx-aggregation-${suffix}`;
  const context = {
    id: contextId,
    taskId: `task-aggregation-${suffix}`,
    workspaceId,
    userId,
    agentKey: orchestrator.key,
    agentVersion: orchestrator.version,
    policyRefs: ['policy.aggregation.v1'],
    canonicalRefs: [`business:${suffix}`],
    memoryRefs: [],
    tokenBudget: 2_000,
    maxCurrencyMicros: 30_000,
    createdAt: baseTime.toISOString(),
  };
  await persistContextReceipt(pool, {
    id: contextId,
    workspaceId,
    userId,
    agentDefinitionId: orchestratorId,
    agentKey: orchestrator.key,
    agentVersion: orchestrator.version,
    receipt: context,
    tokenBudget: context.tokenBudget,
    maxCurrencyMicros: context.maxCurrencyMicros,
    createdAt: baseTime,
  });

  const planId = `plan-aggregation-${suffix}`;
  const orchestratorRunId = `run-aggregation-${suffix}`;
  await persistAgentExecutionPlan(pool, {
    id: planId,
    workspaceId,
    userId,
    runId: orchestratorRunId,
    contextReceiptId: contextId,
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
        policyRefs: ['policy.aggregation.v1'],
        canonicalRefs: [`business:${suffix}`],
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
    createdAt: later(baseTime, 100),
  });

  const dispatchId = `dispatch-aggregation-${suffix}`;
  const dispatch = await dispatchAgentExecutionPlan(pool, {
    dispatchId,
    workspaceId,
    planId,
    handlerRegistryVersion: 'specialists.v1',
    supportedAgentKeys: [specialist.key],
    createdAt: later(baseTime, 200),
  });
  assert.equal(dispatch.created, true);
  assert.equal(dispatch.newlyRunnableWorkUnitIds.length, 1);
  const work = dispatch.workUnits[0];
  assert.ok(work);

  const claimed = await claimWorkUnit(pool, work.workUnitId, `aggregation-worker-${suffix}`, 1, 30);
  assert.ok(claimed);
  const prepared = await prepareAgentSpecialistAttempt(pool, {
    workspaceId,
    jobRunId: claimed.jobRunId,
    workUnitId: claimed.id,
    correlationId: claimed.correlationId,
    attempt: claimed.attemptCount,
    workType: claimed.workType,
    workVersion: claimed.workVersion,
    payload: claimed.payload,
  });
  assert.equal(prepared.runStatus, 'queued');

  const startedAt = new Date(Math.max(Date.now(), prepared.runUpdatedAt.getTime() + 1));
  await transitionAgentRun(pool, {
    transitionId: createAgentSpecialistTransitionId(prepared.runId, 'start'),
    workspaceId,
    runId: prepared.runId,
    fromStatus: 'queued',
    toStatus: 'running',
    reasonCode: 'aggregation_verifier_specialist_started',
    actorType: 'worker',
    metadata: { workUnitId: claimed.id },
    occurredAt: startedAt,
  });

  await recordAgentExecutionBudgetUsage(pool, {
    eventId: `aggregation-budget-${suffix}`,
    workspaceId,
    dispatchId,
    stepKey: 'specialist',
    usage: { tokens: 10, searches: 0, apiCalls: 1, credits: 0, currencyMicros: 100, runtimeMs: 50 },
    metadata: { verifier: 'aggregation' },
    occurredAt: later(startedAt, 1),
  });

  const specialistResult = {
    result: { ok: true, fixture: suffix },
    confidence: 0.99,
    uncertainty: [],
    evidenceIds: [`evidence-${suffix}`],
    factIds: [`fact-${suffix}`],
    sourceIds: [`source-${suffix}`],
    assumptions: [],
    conflicts: [],
    toolSummary: [],
    cost: {
      inputTokens: 6,
      outputTokens: 4,
      searches: 0,
      apiCalls: 1,
      credits: 0,
      currencyMicros: 100,
    },
    validationState: 'passed',
    proposedActions: [],
  };
  const completed = await completeAgentSpecialistAttempt(pool, {
    workspaceId,
    jobRunId: claimed.jobRunId,
    workUnitId: claimed.id,
    correlationId: claimed.correlationId,
    attempt: claimed.attemptCount,
    workType: claimed.workType,
    workVersion: claimed.workVersion,
    payload: claimed.payload,
    runId: prepared.runId,
    result: specialistResult,
    occurredAt: later(startedAt, 2),
  });
  assert.equal(completed.result.confidence, 0.99);

  await completeWorkUnitWithEffect(pool, claimed.id, 'agent.execution.specialist.result', {
    kind: 'agent_specialist_execution_result',
    runId: prepared.runId,
    contextReceiptId: prepared.contextReceiptId,
    dispatchId,
    planId,
    stepKey: 'specialist',
    agentKey: specialist.key,
    agentVersion: specialist.version,
    attempt: claimed.attemptCount,
    result: completed.result,
  });

  const job = await pool.query('SELECT status FROM job_runs WHERE id = $1', [dispatch.jobRunId]);
  assert.equal(job.rows[0]?.status, 'succeeded');

  return {
    contextId,
    planId,
    dispatchId,
    orchestratorRunId,
    jobRunId: dispatch.jobRunId,
    workUnitId: claimed.id,
    specialistRunId: prepared.runId,
  };
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
    '0007_source_registry_foundation',
  ]);

  const workspace = await pool.query(
    `INSERT INTO workspaces (slug, display_name) VALUES ('aggregation-verification', 'Aggregation Verification') RETURNING id`,
  );
  const workspaceId = workspace.rows[0]?.id;
  assert.ok(workspaceId);
  const owner = await createIdentityUser(pool);
  await bootstrapWorkspaceOwner(pool, { workspaceId, userId: owner.id });

  const specialist = definition('agent.research.aggregation-specialist', '1.0.0');
  await persistDefinition(specialist);

  const plainOrchestrator = definition('agent.control.orchestrator', '1.0.0');
  const plainOrchestratorId = await persistDefinition(plainOrchestrator);
  const evaluatorOrchestrator = definition('agent.control.orchestrator', '2.0.0', {
    independentEvaluatorKey: 'agent.control.independent-evaluator',
  });
  const evaluatorOrchestratorId = await persistDefinition(evaluatorOrchestrator);
  const reviewOrchestrator = definition('agent.control.orchestrator', '3.0.0', {
    reviewBelowConfidence: 0.995,
  });
  const reviewOrchestratorId = await persistDefinition(reviewOrchestrator);

  const deterministicEvaluator = definition('agent.control.independent-evaluator', '1.0.0', {
    autonomyTier: 'T1',
    deterministicValidators: ['tenant_scope', 'policy_scope', 'budget_scope'],
    evalSuiteId: 'AI-INDEPENDENT-EVALUATOR-001',
  });
  await persistDefinition(deterministicEvaluator);
  const modelEvaluator = definition('agent.control.independent-evaluator', '2.0.0', {
    autonomyTier: 'T1',
    modelPolicy: {
      routingMode: 'approved_models',
      allowedProviderIds: ['provider.test'],
      allowedModelIds: ['model.test'],
      fallbackModelIds: [],
    },
  });
  await persistDefinition(modelEvaluator);

  const now = new Date();
  const plainFixture = await createFixture({
    workspaceId,
    userId: owner.id,
    orchestrator: plainOrchestrator,
    orchestratorId: plainOrchestratorId,
    specialist,
    suffix: 'plain',
    baseTime: later(now, 1_000),
  });
  const plainAggregation = await aggregateAgentExecutionPlan(pool, {
    workspaceId,
    dispatchId: plainFixture.dispatchId,
    occurredAt: later(now, 5_000),
  });
  assert.equal(plainAggregation.state, 'succeeded');
  assert.equal(plainAggregation.orchestratorStatus, 'succeeded');
  assert.equal(plainAggregation.evaluatorHandoff, null);
  assert.equal(plainAggregation.issues.length, 0);
  assert.equal(plainAggregation.aggregate?.confidence, 0.99);
  assert.equal(plainAggregation.aggregate?.steps?.length, 1);

  const plainHistory = await getAgentRunTransitionHistory(pool, workspaceId, plainFixture.orchestratorRunId);
  assert.deepEqual(plainHistory.map((event) => [event.fromStatus, event.toStatus]), [
    ['queued', 'running'],
    ['running', 'succeeded'],
  ]);
  const plainReplay = await aggregateAgentExecutionPlan(pool, {
    workspaceId,
    dispatchId: plainFixture.dispatchId,
    occurredAt: later(now, 6_000),
  });
  assert.deepEqual(plainReplay, plainAggregation);
  assert.deepEqual(await getAgentExecutionAggregationState(pool, workspaceId, plainFixture.dispatchId), plainAggregation);

  const evaluatorFixture = await createFixture({
    workspaceId,
    userId: owner.id,
    orchestrator: evaluatorOrchestrator,
    orchestratorId: evaluatorOrchestratorId,
    specialist,
    suffix: 'evaluator',
    baseTime: later(now, 10_000),
  });
  await assert.rejects(
    () =>
      aggregateAgentExecutionPlan(pool, {
        workspaceId,
        dispatchId: evaluatorFixture.dispatchId,
        evaluatorAgentVersion: '2.0.0',
        occurredAt: later(now, 14_000),
      }),
    (error) => error?.code === 'AGENT_AGGREGATION_EVALUATOR_ROUTE_UNAVAILABLE',
  );
  const afterRejectedRoute = await pool.query('SELECT status, envelope FROM agent_runs WHERE id = $1', [
    evaluatorFixture.orchestratorRunId,
  ]);
  assert.equal(afterRejectedRoute.rows[0]?.status, 'queued');
  assert.equal(afterRejectedRoute.rows[0]?.envelope?.executionAggregation, undefined);

  const evaluatorAggregation = await aggregateAgentExecutionPlan(pool, {
    workspaceId,
    dispatchId: evaluatorFixture.dispatchId,
    evaluatorAgentVersion: '1.0.0',
    occurredAt: later(now, 15_000),
  });
  assert.equal(evaluatorAggregation.state, 'evaluation_pending');
  assert.equal(evaluatorAggregation.orchestratorStatus, 'running');
  assert.equal(evaluatorAggregation.issues.length, 0);
  assert.ok(evaluatorAggregation.evaluatorHandoff);
  assert.equal(evaluatorAggregation.evaluatorHandoff.agentKey, 'agent.control.independent-evaluator');
  assert.equal(evaluatorAggregation.evaluatorHandoff.agentVersion, '1.0.0');
  assert.equal(evaluatorAggregation.evaluatorHandoff.subjectRunId, evaluatorFixture.orchestratorRunId);

  const evaluatorRun = await pool.query(
    `SELECT status, execution_mode, provider_id, model_id, parent_run_id, handoff_id, context_receipt_id, envelope
     FROM agent_runs WHERE id = $1 AND workspace_id = $2`,
    [evaluatorAggregation.evaluatorHandoff.evaluatorRunId, workspaceId],
  );
  assert.equal(evaluatorRun.rows[0]?.status, 'queued');
  assert.equal(evaluatorRun.rows[0]?.execution_mode, 'deterministic');
  assert.equal(evaluatorRun.rows[0]?.provider_id, null);
  assert.equal(evaluatorRun.rows[0]?.model_id, null);
  assert.equal(evaluatorRun.rows[0]?.parent_run_id, evaluatorFixture.orchestratorRunId);
  assert.equal(evaluatorRun.rows[0]?.handoff_id, evaluatorAggregation.evaluatorHandoff.handoffId);
  assert.equal(evaluatorRun.rows[0]?.envelope?.evaluationSubject?.dispatchId, evaluatorFixture.dispatchId);

  const evaluatorContext = await pool.query(
    `SELECT token_budget, max_currency_micros, run_scope_id, agent_key, agent_version, receipt
     FROM agent_context_receipts WHERE id = $1 AND workspace_id = $2`,
    [evaluatorAggregation.evaluatorHandoff.contextReceiptId, workspaceId],
  );
  assert.equal(Number(evaluatorContext.rows[0]?.token_budget), 0);
  assert.equal(Number(evaluatorContext.rows[0]?.max_currency_micros), 0);
  assert.equal(evaluatorContext.rows[0]?.run_scope_id, evaluatorAggregation.evaluatorHandoff.evaluatorRunId);
  assert.equal(evaluatorContext.rows[0]?.agent_key, 'agent.control.independent-evaluator');
  assert.equal(evaluatorContext.rows[0]?.agent_version, '1.0.0');
  assert.equal(evaluatorContext.rows[0]?.receipt?.memoryRefs?.length, 0);

  const evaluatorHistory = await getAgentRunTransitionHistory(pool, workspaceId, evaluatorFixture.orchestratorRunId);
  assert.deepEqual(evaluatorHistory.map((event) => [event.fromStatus, event.toStatus]), [['queued', 'running']]);
  const evaluatorReplay = await aggregateAgentExecutionPlan(pool, {
    workspaceId,
    dispatchId: evaluatorFixture.dispatchId,
    occurredAt: later(now, 16_000),
  });
  assert.deepEqual(evaluatorReplay, evaluatorAggregation);

  const reviewFixture = await createFixture({
    workspaceId,
    userId: owner.id,
    orchestrator: reviewOrchestrator,
    orchestratorId: reviewOrchestratorId,
    specialist,
    suffix: 'review',
    baseTime: later(now, 20_000),
  });
  const reviewAggregation = await aggregateAgentExecutionPlan(pool, {
    workspaceId,
    dispatchId: reviewFixture.dispatchId,
    occurredAt: later(now, 25_000),
  });
  assert.equal(reviewAggregation.state, 'review_required');
  assert.equal(reviewAggregation.orchestratorStatus, 'review_required');
  assert.ok(reviewAggregation.issues.includes('orchestrator_confidence_review'));
  assert.equal(reviewAggregation.evaluatorHandoff, null);

  const reviewHistory = await getAgentRunTransitionHistory(pool, workspaceId, reviewFixture.orchestratorRunId);
  assert.deepEqual(reviewHistory.map((event) => [event.fromStatus, event.toStatus]), [['queued', 'review_required']]);

  console.log('Brovexa deterministic execution aggregation + evaluator handoff verification passed.');
} finally {
  await resetDatabase();
  await pool.end();
}
