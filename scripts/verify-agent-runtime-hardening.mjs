import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  AgentRuntimeHardeningError,
  AuthorizationError,
  applyPendingMigrations,
  bootstrapWorkspaceOwner,
  claimWorkUnit,
  completeWorkUnitWithEffect,
  createIdentityUser,
  createPgPool,
  createWorkspaceMembership,
  dispatchAgentExecutionPlan,
  getPrivilegedAgentExecutionTrace,
  persistAgentDefinition,
  persistAgentExecutionPlan,
  persistContextReceipt,
  recordAgentExecutionBudgetUsage,
  resolveAgentExecutionRoute,
  resolveWorkspaceAuthorization,
  transitionAgentRun,
  writeAgentExecutionCheckpoint,
} from '../packages/db/dist/index.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for runtime hardening verification.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for destructive runtime hardening verification.');
}

const migrationsDir = resolve('packages/db/migrations');
const pool = createPgPool({ connectionString: databaseUrl, max: 6 });

function expectHardeningCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof AgentRuntimeHardeningError, `Expected ${expectedCode}.`);
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
    [slug, `Runtime hardening ${slug}`],
  );
  const id = result.rows[0]?.id;
  assert.ok(id);
  return id;
}

function definition(key, version, overrides = {}) {
  const base = {
    key,
    version,
    status: 'approved',
    purpose: `Runtime hardening verification for ${key}.`,
    nonGoals: ['Do not invoke providers, models or external tools in this verifier.'],
    triggerTypes: ['agent_run'],
    inputSchemaId: 'agent.runtime.input.v1',
    outputSchemaId: 'agent.runtime.output.v1',
    allowedTools: [],
    allowedCommands: [],
    memory: { read: ['workspace/*', 'run/*'], propose: [], commit: [], supersede: [] },
    autonomyTier: 'T1',
    humanInterrupts: ['review_required'],
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
      maxTokens: 500,
      maxSearches: 0,
      maxApiCalls: 4,
      maxCredits: 0,
      maxCurrencyMicros: 10_000,
      maxRuntimeMs: 10_000,
      maxConcurrency: 1,
    },
    deterministicValidators: ['tenant_scope', 'policy_scope', 'budget_scope'],
    evidenceRequired: false,
    minimumConfidence: 0.8,
    reviewBelowConfidence: 0.9,
    evalSuiteId: 'AI-RUNTIME-HARDENING-001',
    evalThreshold: 0.99,
    dataClassifications: ['WORKSPACE_CONFIDENTIAL'],
    telemetryRedactionPolicyId: 'telemetry.default',
    owner: 'platform-ai',
    changeReason: 'Runtime trace and route hardening verification fixture.',
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
    '0008_source_task_preflight',
  ]);

  const deterministic = definition('agent.control.route-deterministic', '1.0.0');
  const modelRouted = definition('agent.control.route-model', '1.0.0', {
    modelPolicy: {
      routingMode: 'approved_models',
      allowedProviderIds: ['provider.alpha'],
      allowedModelIds: ['model.primary'],
      fallbackModelIds: ['model.fallback'],
    },
  });
  await persistDefinition(deterministic);
  await persistDefinition(modelRouted);

  const deterministicRoute = await resolveAgentExecutionRoute(pool, {
    agentKey: deterministic.key,
    agentVersion: deterministic.version,
  });
  assert.equal(deterministicRoute.executionMode, 'deterministic');
  assert.equal(deterministicRoute.providerId, null);
  assert.equal(deterministicRoute.modelId, null);

  await assert.rejects(
    () =>
      resolveAgentExecutionRoute(pool, {
        agentKey: deterministic.key,
        agentVersion: deterministic.version,
        providerId: 'provider.alpha',
        modelId: 'model.primary',
      }),
    expectHardeningCode('AGENT_ROUTE_DETERMINISTIC_PROVIDER_FORBIDDEN'),
  );
  await assert.rejects(
    () => resolveAgentExecutionRoute(pool, { agentKey: modelRouted.key, agentVersion: modelRouted.version }),
    expectHardeningCode('AGENT_ROUTE_SELECTION_REQUIRED'),
  );
  await assert.rejects(
    () =>
      resolveAgentExecutionRoute(pool, {
        agentKey: modelRouted.key,
        agentVersion: modelRouted.version,
        providerId: 'provider.unapproved',
        modelId: 'model.primary',
      }),
    expectHardeningCode('AGENT_ROUTE_PROVIDER_NOT_APPROVED'),
  );
  await assert.rejects(
    () =>
      resolveAgentExecutionRoute(pool, {
        agentKey: modelRouted.key,
        agentVersion: modelRouted.version,
        providerId: 'provider.alpha',
        modelId: 'model.unapproved',
      }),
    expectHardeningCode('AGENT_ROUTE_MODEL_NOT_APPROVED'),
  );
  await assert.rejects(
    () =>
      resolveAgentExecutionRoute(pool, {
        agentKey: modelRouted.key,
        agentVersion: modelRouted.version,
        providerId: 'provider.alpha',
        modelId: 'model.fallback',
      }),
    expectHardeningCode('AGENT_ROUTE_FALLBACK_NOT_ENABLED'),
  );

  const primaryRoute = await resolveAgentExecutionRoute(pool, {
    agentKey: modelRouted.key,
    agentVersion: modelRouted.version,
    providerId: 'provider.alpha',
    modelId: 'model.primary',
  });
  assert.equal(primaryRoute.executionMode, 'model');
  assert.equal(primaryRoute.fallbackUsed, false);
  const fallbackRoute = await resolveAgentExecutionRoute(pool, {
    agentKey: modelRouted.key,
    agentVersion: modelRouted.version,
    providerId: 'provider.alpha',
    modelId: 'model.fallback',
    allowFallback: true,
  });
  assert.equal(fallbackRoute.executionMode, 'model');
  assert.equal(fallbackRoute.fallbackUsed, true);

  const workspaceA = await createWorkspace('runtime-hardening-a');
  const workspaceB = await createWorkspace('runtime-hardening-b');
  const ownerA = await createIdentityUser(pool);
  const ownerB = await createIdentityUser(pool);
  await bootstrapWorkspaceOwner(pool, { workspaceId: workspaceA, userId: ownerA.id });
  await bootstrapWorkspaceOwner(pool, { workspaceId: workspaceB, userId: ownerB.id });

  const member = await createIdentityUser(pool);
  const ownerAuthorization = await resolveWorkspaceAuthorization(pool, {
    workspaceId: workspaceA,
    userId: ownerA.id,
  });
  await createWorkspaceMembership(pool, ownerAuthorization, member.id);

  const orchestrator = definition('agent.control.orchestrator', '11.0.0', {
    autonomyTier: 'T2',
    budget: { maxTokens: 2_000, maxApiCalls: 20, maxConcurrency: 1 },
  });
  const specialist = definition('agent.research.trace-specialist', '1.0.0');
  const orchestratorId = await persistDefinition(orchestrator);
  await persistDefinition(specialist);

  const now = new Date();
  const receiptId = 'ctx-runtime-hardening';
  const receipt = {
    id: receiptId,
    taskId: 'task-runtime-hardening',
    workspaceId: workspaceA,
    userId: ownerA.id,
    agentKey: orchestrator.key,
    agentVersion: orchestrator.version,
    policyRefs: ['policy.runtime.trace.v1'],
    canonicalRefs: ['business:runtime-trace'],
    memoryRefs: [],
    tokenBudget: 1_000,
    maxCurrencyMicros: 10_000,
    createdAt: now.toISOString(),
  };
  await persistContextReceipt(pool, {
    id: receiptId,
    workspaceId: workspaceA,
    userId: ownerA.id,
    agentDefinitionId: orchestratorId,
    agentKey: orchestrator.key,
    agentVersion: orchestrator.version,
    receipt,
    tokenBudget: receipt.tokenBudget,
    maxCurrencyMicros: receipt.maxCurrencyMicros,
    createdAt: now,
  });

  const planId = 'plan-runtime-hardening';
  const orchestratorRunId = 'run-runtime-hardening';
  await persistAgentExecutionPlan(pool, {
    id: planId,
    workspaceId: workspaceA,
    userId: ownerA.id,
    runId: orchestratorRunId,
    contextReceiptId: receiptId,
    orchestratorKey: orchestrator.key,
    orchestratorVersion: orchestrator.version,
    planVersion: 1,
    maxParallelism: 1,
    steps: [
      {
        key: 'trace-specialist',
        agentKey: specialist.key,
        agentVersion: specialist.version,
        dependencies: [],
        toolKeys: [],
        commandKeys: [],
        policyRefs: ['policy.runtime.trace.v1'],
        canonicalRefs: ['business:runtime-trace'],
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
    createdAt: new Date(now.getTime() + 100),
  });

  const dispatchId = 'dispatch-runtime-hardening';
  const dispatch = await dispatchAgentExecutionPlan(pool, {
    dispatchId,
    workspaceId: workspaceA,
    planId,
    handlerRegistryVersion: 'specialists.v1',
    supportedAgentKeys: [specialist.key],
    createdAt: new Date(now.getTime() + 200),
  });
  assert.equal(dispatch.created, true);
  const work = dispatch.workUnits[0];
  assert.ok(work);

  assert.ok(await claimWorkUnit(pool, work.workUnitId, 'runtime-hardening-worker', 1, 30));
  await writeAgentExecutionCheckpoint(pool, {
    workspaceId: workspaceA,
    dispatchId,
    stepKey: 'trace-specialist',
    checkpointKey: 'agent.execution.progress',
    data: { stage: 'verified' },
  });
  await recordAgentExecutionBudgetUsage(pool, {
    eventId: 'runtime-hardening-budget-1',
    workspaceId: workspaceA,
    dispatchId,
    stepKey: 'trace-specialist',
    usage: { tokens: 10, searches: 0, apiCalls: 1, credits: 0, currencyMicros: 100, runtimeMs: 50 },
    metadata: { verifier: 'runtime-hardening' },
    occurredAt: new Date(now.getTime() + 300),
  });
  await completeWorkUnitWithEffect(pool, work.workUnitId, 'agent.execution.trace.complete', {
    ok: true,
    dispatchId,
  });

  const runTimestamp = await pool.query('SELECT updated_at FROM agent_runs WHERE id = $1 AND workspace_id = $2', [
    orchestratorRunId,
    workspaceA,
  ]);
  const updatedAt = runTimestamp.rows[0]?.updated_at;
  assert.ok(updatedAt instanceof Date);
  await transitionAgentRun(pool, {
    transitionId: 'runtime-hardening-orchestrator-start',
    workspaceId: workspaceA,
    runId: orchestratorRunId,
    fromStatus: 'queued',
    toStatus: 'running',
    reasonCode: 'runtime_hardening_trace_started',
    actorType: 'system',
    metadata: { dispatchId },
    occurredAt: new Date(Math.max(Date.now(), updatedAt.getTime() + 1)),
  });

  const trace = await getPrivilegedAgentExecutionTrace(pool, {
    workspaceId: workspaceA,
    userId: ownerA.id,
    dispatchId,
  });
  assert.ok(trace);
  assert.equal(trace.workspaceId, workspaceA);
  assert.equal(trace.dispatchId, dispatchId);
  assert.equal(trace.authorization.isOwner, true);
  assert.ok(trace.authorization.permissions.includes('workspace.audit.read'));
  assert.equal(trace.plan.id, planId);
  assert.equal(trace.plan.runId, orchestratorRunId);
  assert.equal(trace.jobRun.id, dispatch.jobRunId);
  assert.equal(trace.workUnits.length, 1);
  assert.equal(trace.workUnits[0]?.status, 'succeeded');
  assert.ok(trace.workUnits[0]?.effects.some((effect) => effect.effectKey === 'agent.execution.trace.complete'));
  assert.ok(trace.workUnits[0]?.effects.some((effect) => effect.data?.kind === 'agent_execution_budget_usage'));
  assert.ok(trace.workUnits[0]?.checkpoints.some((checkpoint) => checkpoint.checkpointKey === 'agent.execution.progress'));
  assert.equal(trace.agentRuns.length, 1);
  assert.equal(trace.agentRuns[0]?.id, orchestratorRunId);
  assert.deepEqual(trace.transitions.map((transition) => [transition.fromStatus, transition.toStatus]), [
    ['queued', 'running'],
  ]);
  assert.equal(trace.evaluations.length, 0);

  await assert.rejects(
    () =>
      getPrivilegedAgentExecutionTrace(pool, {
        workspaceId: workspaceA,
        userId: member.id,
        dispatchId,
      }),
    (error) => error instanceof AuthorizationError && error.code === 'FORBIDDEN',
  );

  const crossTenantTrace = await getPrivilegedAgentExecutionTrace(pool, {
    workspaceId: workspaceB,
    userId: ownerB.id,
    dispatchId,
  });
  assert.equal(crossTenantTrace, null);

  console.log('Brovexa M01A runtime trace + provider-neutral route hardening verification passed.');
} finally {
  await resetDatabase();
  await pool.end();
}
