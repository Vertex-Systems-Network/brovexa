import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  aggregateAgentExecutionPlan,
  applyAgentEvaluatorDecision,
  applyPendingMigrations,
  bootstrapWorkspaceOwner,
  claimWorkUnit,
  completeAgentSpecialistAttempt,
  completeWorkUnitWithEffect,
  createAgentSpecialistTransitionId,
  createIdentityUser,
  createPgPool,
  dispatchAgentExecutionPlan,
  getAgentEvaluatorDecisionState,
  getAgentRunTransitionHistory,
  getEvalResultEnvelope,
  persistAgentDefinition,
  persistAgentExecutionPlan,
  persistContextReceipt,
  prepareAgentSpecialistAttempt,
  recordAgentExecutionBudgetUsage,
  resolveAgentExecutionReview,
  transitionAgentRun,
} from '../packages/db/dist/index.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for evaluator decision verification.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for destructive evaluator verification.');
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

function later(date, milliseconds) {
  return new Date(date.getTime() + milliseconds);
}

function definition(key, version, overrides = {}) {
  const base = {
    key,
    version,
    status: 'approved',
    purpose: `Evaluator decision verification for ${key}.`,
    nonGoals: ['Do not invoke model providers or external tools.'],
    triggerTypes: ['agent_run'],
    inputSchemaId: 'agent.execution.input.v1',
    outputSchemaId: 'agent.execution.output.v1',
    allowedTools: [],
    allowedCommands: [],
    memory: { read: ['workspace/*', 'run/*'], propose: [], commit: [], supersede: [] },
    autonomyTier: key === 'agent.control.orchestrator' ? 'T2' : 'T1',
    humanInterrupts: ['evaluation_required', 'manual_review'],
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
      maxConcurrency: 1,
    },
    deterministicValidators: ['tenant_scope', 'policy_scope', 'budget_scope'],
    evidenceRequired: false,
    minimumConfidence: 0.8,
    reviewBelowConfidence: 0.9,
    independentEvaluatorKey: key === 'agent.control.orchestrator' ? 'agent.control.independent-evaluator' : undefined,
    evalSuiteId: 'AI-EVALUATOR-DECISION-001',
    evalThreshold: 0.99,
    dataClassifications: ['BUSINESS_DATA'],
    telemetryRedactionPolicyId: 'telemetry.default',
    owner: 'platform-ai',
    changeReason: 'Evaluator decision verification fixture.',
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

async function createCompletedFixture({ workspaceId, userId, orchestrator, orchestratorId, specialist, suffix }) {
  const baseTime = new Date();
  const contextId = `ctx-eval-decision-${suffix}`;
  const context = {
    id: contextId,
    taskId: `task-eval-decision-${suffix}`,
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

  const planId = `plan-eval-decision-${suffix}`;
  const orchestratorRunId = `run-eval-decision-${suffix}`;
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
    createdAt: later(baseTime, 1),
  });

  const dispatchId = `dispatch-eval-decision-${suffix}`;
  const dispatch = await dispatchAgentExecutionPlan(pool, {
    dispatchId,
    workspaceId,
    planId,
    handlerRegistryVersion: 'specialists.v1',
    supportedAgentKeys: [specialist.key],
    createdAt: later(baseTime, 2),
  });
  assert.equal(dispatch.created, true);
  const work = dispatch.workUnits[0];
  assert.ok(work);

  const claimed = await claimWorkUnit(pool, work.workUnitId, `eval-worker-${suffix}`, 1, 30);
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
  const startedAt = new Date(Math.max(Date.now(), prepared.runUpdatedAt.getTime() + 1));
  await transitionAgentRun(pool, {
    transitionId: createAgentSpecialistTransitionId(prepared.runId, 'start'),
    workspaceId,
    runId: prepared.runId,
    fromStatus: 'queued',
    toStatus: 'running',
    reasonCode: 'evaluator_decision_verifier_specialist_started',
    actorType: 'worker',
    metadata: { workUnitId: claimed.id },
    occurredAt: startedAt,
  });
  await recordAgentExecutionBudgetUsage(pool, {
    eventId: `eval-budget-${suffix}`,
    workspaceId,
    dispatchId,
    stepKey: 'specialist',
    usage: { tokens: 10, searches: 0, apiCalls: 1, credits: 0, currencyMicros: 100, runtimeMs: 50 },
    metadata: { verifier: 'evaluator-decision' },
    occurredAt: later(startedAt, 1),
  });

  const specialistResult = {
    result: { ok: true, fixture: suffix },
    confidence: 0.995,
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
    planId,
    dispatchId,
    orchestratorRunId,
    readyAt: later(startedAt, 3),
  };
}

async function aggregateForEvaluation(fixture, workspaceId, evaluatorVersion = '1.0.0') {
  const result = await aggregateAgentExecutionPlan(pool, {
    workspaceId,
    dispatchId: fixture.dispatchId,
    evaluatorAgentVersion: evaluatorVersion,
    occurredAt: later(fixture.readyAt, 10),
  });
  assert.equal(result.state, 'evaluation_pending');
  assert.equal(result.orchestratorStatus, 'running');
  assert.ok(result.evaluatorHandoff);
  return result;
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
    `INSERT INTO workspaces (slug, display_name) VALUES ('evaluator-decision-verification', 'Evaluator Decision Verification') RETURNING id`,
  );
  const workspaceId = workspace.rows[0]?.id;
  assert.ok(workspaceId);
  const owner = await createIdentityUser(pool);
  const outsider = await createIdentityUser(pool);
  await bootstrapWorkspaceOwner(pool, { workspaceId, userId: owner.id });

  const specialist = definition('agent.research.evaluator-specialist', '1.0.0');
  await persistDefinition(specialist);
  const evaluator = definition('agent.control.independent-evaluator', '1.0.0');
  await persistDefinition(evaluator);
  const orchestrator = definition('agent.control.orchestrator', '1.0.0');
  const orchestratorId = await persistDefinition(orchestrator);

  const acceptFixture = await createCompletedFixture({
    workspaceId,
    userId: owner.id,
    orchestrator,
    orchestratorId,
    specialist,
    suffix: 'accept',
  });
  const acceptAggregation = await aggregateForEvaluation(acceptFixture, workspaceId);
  const acceptInput = {
    workspaceId,
    dispatchId: acceptFixture.dispatchId,
    evaluatorRunId: acceptAggregation.evaluatorHandoff.evaluatorRunId,
    evaluationId: 'evaluation-accept-1',
    decision: 'accept',
    evidenceState: 'verified',
    reasonCodes: ['aggregate_verified'],
    evidenceRefs: ['evidence-accept'],
    policyRefs: ['policy.aggregation.v1'],
    confidence: 0.995,
    occurredAt: later(acceptFixture.readyAt, 20),
  };
  const accepted = await applyAgentEvaluatorDecision(pool, acceptInput);
  assert.equal(accepted.requestedDecision, 'accept');
  assert.equal(accepted.decision, 'accept');
  assert.equal(accepted.state, 'accepted');
  assert.equal(accepted.subjectStatus, 'succeeded');
  assert.equal(accepted.evaluatorStatus, 'succeeded');
  assert.equal(accepted.issues.length, 0);
  assert.deepEqual(await applyAgentEvaluatorDecision(pool, acceptInput), accepted);
  assert.deepEqual(await getAgentEvaluatorDecisionState(pool, workspaceId, acceptFixture.dispatchId), accepted);
  const acceptedEval = await getEvalResultEnvelope(pool, workspaceId, acceptInput.evaluationId);
  assert.equal(acceptedEval?.decision, 'accept');
  assert.equal(acceptedEval?.subjectRunId, acceptFixture.orchestratorRunId);

  const evaluatorHistory = await getAgentRunTransitionHistory(pool, workspaceId, acceptInput.evaluatorRunId);
  assert.deepEqual(evaluatorHistory.map((event) => [event.fromStatus, event.toStatus]), [
    ['queued', 'running'],
    ['running', 'succeeded'],
  ]);
  const acceptedSubjectHistory = await getAgentRunTransitionHistory(pool, workspaceId, acceptFixture.orchestratorRunId);
  assert.deepEqual(acceptedSubjectHistory.map((event) => [event.fromStatus, event.toStatus]), [
    ['queued', 'running'],
    ['running', 'succeeded'],
  ]);

  const evidenceFixture = await createCompletedFixture({
    workspaceId,
    userId: owner.id,
    orchestrator,
    orchestratorId,
    specialist,
    suffix: 'scope',
  });
  const evidenceAggregation = await aggregateForEvaluation(evidenceFixture, workspaceId);
  await assert.rejects(
    () =>
      applyAgentEvaluatorDecision(pool, {
        workspaceId,
        dispatchId: evidenceFixture.dispatchId,
        evaluatorRunId: evidenceAggregation.evaluatorHandoff.evaluatorRunId,
        evaluationId: 'evaluation-scope-1',
        decision: 'accept',
        evidenceState: 'verified',
        reasonCodes: ['aggregate_verified'],
        evidenceRefs: ['evidence-outside-frozen-aggregate'],
        policyRefs: ['policy.aggregation.v1'],
        confidence: 0.995,
        occurredAt: later(evidenceFixture.readyAt, 20),
      }),
    (error) => error?.code === 'AGENT_EVALUATOR_EVIDENCE_SCOPE',
  );
  const untouchedScope = await pool.query('SELECT status FROM agent_runs WHERE id = $1', [
    evidenceAggregation.evaluatorHandoff.evaluatorRunId,
  ]);
  assert.equal(untouchedScope.rows[0]?.status, 'queued');

  const reviewFixture = await createCompletedFixture({
    workspaceId,
    userId: owner.id,
    orchestrator,
    orchestratorId,
    specialist,
    suffix: 'review',
  });
  const reviewAggregation = await aggregateForEvaluation(reviewFixture, workspaceId);
  const reviewDecision = await applyAgentEvaluatorDecision(pool, {
    workspaceId,
    dispatchId: reviewFixture.dispatchId,
    evaluatorRunId: reviewAggregation.evaluatorHandoff.evaluatorRunId,
    evaluationId: 'evaluation-review-1',
    decision: 'accept',
    evidenceState: 'insufficient',
    reasonCodes: ['needs_more_evidence'],
    evidenceRefs: [],
    policyRefs: ['policy.aggregation.v1'],
    confidence: 0.8,
    occurredAt: later(reviewFixture.readyAt, 20),
  });
  assert.equal(reviewDecision.requestedDecision, 'accept');
  assert.equal(reviewDecision.decision, 'review');
  assert.equal(reviewDecision.state, 'review_required');
  assert.equal(reviewDecision.subjectStatus, 'review_required');
  assert.ok(reviewDecision.issues.includes('evaluation_confidence_below_threshold'));
  assert.ok(reviewDecision.issues.includes('evaluation_accept_requires_verified_evidence'));

  const resolutionInput = {
    workspaceId,
    orchestratorRunId: reviewFixture.orchestratorRunId,
    resolutionId: 'review-resolution-approve-1',
    actorUserId: owner.id,
    decision: 'approve',
    reason: 'Owner reviewed the aggregate and approved the bounded result.',
    occurredAt: later(reviewFixture.readyAt, 30),
  };
  await assert.rejects(
    () => resolveAgentExecutionReview(pool, { ...resolutionInput, actorUserId: outsider.id }),
    (error) => error?.code === 'AGENT_REVIEW_OWNER_REQUIRED',
  );
  const approved = await resolveAgentExecutionReview(pool, resolutionInput);
  assert.equal(approved.status, 'succeeded');
  assert.equal(approved.decision, 'approve');
  assert.deepEqual(await resolveAgentExecutionReview(pool, resolutionInput), approved);
  const reviewHistory = await getAgentRunTransitionHistory(pool, workspaceId, reviewFixture.orchestratorRunId);
  assert.deepEqual(reviewHistory.map((event) => [event.fromStatus, event.toStatus]), [
    ['queued', 'running'],
    ['running', 'review_required'],
    ['review_required', 'running'],
    ['running', 'succeeded'],
  ]);
  assert.equal(reviewHistory[2]?.actorType, 'user');
  assert.equal(reviewHistory[2]?.actorId, owner.id);
  assert.equal(reviewHistory[3]?.actorType, 'user');
  assert.equal(reviewHistory[3]?.actorId, owner.id);

  const rejectFixture = await createCompletedFixture({
    workspaceId,
    userId: owner.id,
    orchestrator,
    orchestratorId,
    specialist,
    suffix: 'reject',
  });
  const rejectAggregation = await aggregateForEvaluation(rejectFixture, workspaceId);
  const rejected = await applyAgentEvaluatorDecision(pool, {
    workspaceId,
    dispatchId: rejectFixture.dispatchId,
    evaluatorRunId: rejectAggregation.evaluatorHandoff.evaluatorRunId,
    evaluationId: 'evaluation-reject-1',
    decision: 'reject',
    evidenceState: 'contradicted',
    reasonCodes: ['aggregate_contradicted'],
    evidenceRefs: ['evidence-reject'],
    policyRefs: ['policy.aggregation.v1'],
    confidence: 0.995,
    occurredAt: later(rejectFixture.readyAt, 20),
  });
  assert.equal(rejected.decision, 'reject');
  assert.equal(rejected.state, 'rejected');
  assert.equal(rejected.subjectStatus, 'failed');

  console.log('Brovexa deterministic evaluator decision + owner review resolution verification passed.');
} finally {
  await resetDatabase();
  await pool.end();
}
