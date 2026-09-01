import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  AgentExecutionPlanError,
  AgentPersistenceConflictError,
  applyPendingMigrations,
  bootstrapWorkspaceOwner,
  buildAndPersistAgentContext,
  createIdentityUser,
  createPgPool,
  getAgentExecutionPlanEnvelope,
  getAgentRunEnvelope,
  persistAgentDefinition,
  persistAgentExecutionPlan,
  persistMemoryRecord,
  probeDatabase,
  transitionAgentRun,
} from '../packages/db/dist/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for agent execution plan verification.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for destructive execution plan verification.');
}

const migrationsDir = resolve('packages/db/migrations');
const pool = createPgPool({ connectionString, max: 6 });

async function resetDatabase() {
  await pool.query('DROP TABLE IF EXISTS source_task_usage_events CASCADE');
  await pool.query('DROP TABLE IF EXISTS source_tasks CASCADE');
  await pool.query('DROP TABLE IF EXISTS research_job_preflights CASCADE');
  await pool.query('DROP TABLE IF EXISTS source_admission_snapshots CASCADE');
  await pool.query('DROP TABLE IF EXISTS connector_definitions CASCADE');
  await pool.query('DROP TABLE IF EXISTS connector_policies CASCADE');
  await pool.query('DROP TABLE IF EXISTS source_capabilities CASCADE');
  await pool.query('DROP TABLE IF EXISTS agent_execution_plans CASCADE');
  await pool.query('DROP TABLE IF EXISTS memory_record_lifecycle_events CASCADE');
  await pool.query('DROP TABLE IF EXISTS agent_run_transitions CASCADE');
  await pool.query('DROP TABLE IF EXISTS agent_eval_results CASCADE');
  await pool.query('DROP TABLE IF EXISTS memory_records CASCADE');
  await pool.query('DROP TABLE IF EXISTS agent_runs CASCADE');
  await pool.query('DROP TABLE IF EXISTS agent_context_receipts CASCADE');
  await pool.query('DROP TABLE IF EXISTS agent_definitions CASCADE');
  await pool.query('DROP TABLE IF EXISTS authorization_audit_events CASCADE');
  await pool.query('DROP TABLE IF EXISTS workspace_membership_roles CASCADE');
  await pool.query('DROP TABLE IF EXISTS workspace_role_permissions CASCADE');
  await pool.query('DROP TABLE IF EXISTS workspace_roles CASCADE');
  await pool.query('DROP TABLE IF EXISTS permissions CASCADE');
  await pool.query('DROP TABLE IF EXISTS workspace_memberships CASCADE');
  await pool.query('DROP TABLE IF EXISTS users CASCADE');
  await pool.query('DROP TABLE IF EXISTS job_effects CASCADE');
  await pool.query('DROP TABLE IF EXISTS job_checkpoints CASCADE');
  await pool.query('DROP TABLE IF EXISTS job_work_units CASCADE');
  await pool.query('DROP TABLE IF EXISTS job_runs CASCADE');
  await pool.query('DROP TABLE IF EXISTS workspace_preferences CASCADE');
  await pool.query('DROP TABLE IF EXISTS workspaces CASCADE');
  await pool.query('DROP SCHEMA IF EXISTS brovexa_internal CASCADE');
}

async function createWorkspace(slug) {
  const result = await pool.query(
    'INSERT INTO workspaces (slug, display_name) VALUES ($1, $2) RETURNING id',
    [slug, `Execution Plan ${slug}`],
  );
  const id = result.rows[0]?.id;
  assert.ok(id);
  return id;
}

function createDefinition(key, overrides = {}) {
  return {
    key,
    version: '1.0.0',
    status: 'approved',
    purpose: `Bounded execution fixture for ${key}.`,
    nonGoals: ['Do not invoke production providers.'],
    triggerTypes: ['agent_run'],
    inputSchemaId: 'agent.execution.input.v1',
    outputSchemaId: 'agent.execution.output.v1',
    allowedTools: [],
    allowedCommands: [],
    memory: {
      read: ['workspace/*'],
      propose: [],
      commit: [],
      supersede: [],
    },
    autonomyTier: key === 'agent.control.orchestrator' ? 'T2' : 'T1',
    humanInterrupts: ['scope_conflict', 'budget_exhausted'],
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
      maxTokens: 5_000,
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
    evalSuiteId: 'AI-EXECUTION-PLAN-001',
    evalThreshold: 0.99,
    dataClassifications: ['BUSINESS_DATA'],
    telemetryRedactionPolicyId: 'telemetry.default',
    owner: 'platform-ai',
    changeReason: 'Execution plan verification fixture.',
    ...overrides,
  };
}

async function persistDefinition(definition) {
  return persistAgentDefinition(pool, {
    agentKey: definition.key,
    version: definition.version,
    status: definition.status,
    autonomyTier: definition.autonomyTier,
    requiresHumanApproval: definition.requiresHumanApproval,
    specification: definition,
  });
}

async function persistMemory(workspaceId) {
  const id = 'execution-memory-1';
  const namespace = `workspace/${workspaceId}/business/company-1`;
  const envelope = {
    id,
    version: '1.0.0',
    namespace,
    workspaceId,
    entityId: 'company-1',
    type: 'semantic',
    subtype: 'business_profile',
    subjectRefs: ['company-1'],
    contentSchemaId: 'memory.business-profile.v1',
    contentSchemaVersion: '1.0.0',
    content: { legalName: 'Execution Fixture Ltd.' },
    provenance: [{ kind: 'fact', refId: 'fact-execution-1' }],
    writer: 'curator',
    aiDerived: false,
    confidence: 1,
    authority: 'verified_fact',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    status: 'active',
    retentionPolicyId: 'retention.execution.v1',
    readCapabilities: ['workspace.read'],
    writeCapabilities: [],
    dataClassification: 'BUSINESS_DATA',
    sourcePolicyRefs: ['policy.source.v1'],
    jurisdictionRefs: [],
  };

  await persistMemoryRecord(pool, {
    id,
    version: envelope.version,
    namespace,
    workspaceId,
    entityId: envelope.entityId,
    memoryType: envelope.type,
    subtype: envelope.subtype,
    writer: envelope.writer,
    aiDerived: envelope.aiDerived,
    confidence: envelope.confidence,
    authority: envelope.authority,
    status: envelope.status,
    retentionPolicyId: envelope.retentionPolicyId,
    dataClassification: envelope.dataClassification,
    envelope,
    createdAt: new Date(envelope.createdAt),
    updatedAt: new Date(envelope.updatedAt),
  });
  return id;
}

function step(overrides = {}) {
  return {
    key: 'discover',
    agentKey: 'agent.research.discovery',
    agentVersion: '1.0.0',
    dependencies: [],
    toolKeys: ['source.search'],
    commandKeys: ['candidate.write'],
    policyRefs: ['policy.execution.v1'],
    canonicalRefs: ['business:company-1'],
    memoryRefs: ['execution-memory-1'],
    budget: {
      maxTokens: 1_000,
      maxSearches: 2,
      maxApiCalls: 3,
      maxCredits: 10,
      maxCurrencyMicros: 10_000,
      maxRuntimeMs: 10_000,
      maxConcurrency: 1,
    },
    ...overrides,
  };
}

function verifyStep(overrides = {}) {
  return {
    key: 'verify',
    agentKey: 'agent.control.evidence_verifier',
    agentVersion: '1.0.0',
    dependencies: ['discover'],
    toolKeys: ['evidence.read'],
    commandKeys: [],
    policyRefs: ['policy.execution.v1'],
    canonicalRefs: ['business:company-1'],
    memoryRefs: ['execution-memory-1'],
    budget: {
      maxTokens: 500,
      maxSearches: 0,
      maxApiCalls: 2,
      maxCredits: 0,
      maxCurrencyMicros: 5_000,
      maxRuntimeMs: 5_000,
      maxConcurrency: 1,
    },
    ...overrides,
  };
}

function expectExecutionError(code) {
  return (error) => error instanceof AgentExecutionPlanError && error.code === code;
}

function expectConflict(code) {
  return (error) => error instanceof AgentPersistenceConflictError && error.code === code;
}

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
    assert.ok(postgresError, `Expected nested PostgreSQL error ${expectedCode}.`);
    assert.equal(postgresError.code, expectedCode);
    assert.equal(postgresError.constraint, expectedConstraint);
    return true;
  };
}

try {
  const identity = await pool.query('SELECT current_database() AS name');
  const databaseName = identity.rows[0]?.name;
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
  assert.equal((await probeDatabase(pool)).schemaReady, true);

  const workspaceA = await createWorkspace('agent-execution-a');
  const workspaceB = await createWorkspace('agent-execution-b');
  const ownerA = await createIdentityUser(pool);
  const ownerB = await createIdentityUser(pool);
  await bootstrapWorkspaceOwner(pool, { workspaceId: workspaceA, userId: ownerA.id });
  await bootstrapWorkspaceOwner(pool, { workspaceId: workspaceB, userId: ownerB.id });

  const orchestrator = createDefinition('agent.control.orchestrator');
  await persistDefinition(orchestrator);
  await persistDefinition(
    createDefinition('agent.research.discovery', {
      allowedTools: ['source.search'],
      allowedCommands: ['candidate.write'],
      memory: { read: ['workspace/*'], propose: [], commit: [], supersede: [] },
    }),
  );
  await persistDefinition(
    createDefinition('agent.control.evidence_verifier', {
      allowedTools: ['evidence.read'],
      memory: { read: ['workspace/*'], propose: [], commit: [], supersede: [] },
    }),
  );
  await persistDefinition(
    createDefinition('agent.research.no-memory', {
      allowedTools: ['source.search'],
      allowedCommands: ['candidate.write'],
      memory: { read: ['system/procedural/*'], propose: [], commit: [], supersede: [] },
    }),
  );
  await persistDefinition(
    createDefinition('agent.research.draft', {
      status: 'draft',
      allowedTools: ['source.search'],
      allowedCommands: ['candidate.write'],
    }),
  );
  await persistDefinition(
    createDefinition('agent.research.review-only', {
      autonomyTier: 'T4',
      requiresHumanApproval: true,
      allowedTools: ['source.search'],
      allowedCommands: ['candidate.write'],
    }),
  );

  await persistMemory(workspaceA);

  const runId = 'orchestrator-run-1';
  const context = await buildAndPersistAgentContext(pool, {
    receiptId: 'orchestrator-context-1',
    taskId: 'orchestrator-task-1',
    workspaceId: workspaceA,
    userId: ownerA.id,
    runId,
    agentKey: orchestrator.key,
    agentVersion: orchestrator.version,
    policyRefs: ['policy.execution.v1'],
    canonicalRefs: ['business:company-1'],
    targetEntityIds: ['company-1'],
    tokenBudget: 1_000,
    maxCurrencyMicros: 10_000,
    maxMemoryRefs: 8,
    createdAt: new Date('2026-09-01T01:00:00.000Z'),
  });
  assert.deepEqual(context.selectedMemory.map((memory) => memory.id), ['execution-memory-1']);

  const planInput = {
    id: 'execution-plan-1',
    workspaceId: workspaceA,
    userId: ownerA.id,
    runId,
    contextReceiptId: 'orchestrator-context-1',
    orchestratorKey: orchestrator.key,
    orchestratorVersion: orchestrator.version,
    planVersion: 1,
    maxParallelism: 2,
    steps: [step(), verifyStep()],
    createdAt: new Date('2026-09-01T01:00:01.000Z'),
  };

  const created = await persistAgentExecutionPlan(pool, planInput);
  assert.equal(created.created, true);
  assert.equal(created.planId, planInput.id);
  assert.equal(created.runEnvelope.status, 'queued');
  assert.equal(created.runEnvelope.executionMode, 'deterministic');
  assert.deepEqual(await getAgentExecutionPlanEnvelope(pool, workspaceA, planInput.id), created.planEnvelope);
  assert.deepEqual(await getAgentRunEnvelope(pool, workspaceA, runId), created.runEnvelope);
  assert.equal(await getAgentExecutionPlanEnvelope(pool, workspaceB, planInput.id), null);
  assert.equal(await getAgentRunEnvelope(pool, workspaceB, runId), null);

  const replay = await persistAgentExecutionPlan(pool, planInput);
  assert.equal(replay.created, false);
  assert.deepEqual(replay.planEnvelope, created.planEnvelope);

  await assert.rejects(
    () => persistAgentExecutionPlan(pool, { ...planInput, maxParallelism: 1 }),
    expectConflict('AGENT_EXECUTION_PLAN_ID_CONFLICT'),
  );
  await assert.rejects(
    () => persistAgentExecutionPlan(pool, { ...planInput, id: 'execution-plan-run-conflict' }),
    expectConflict('AGENT_EXECUTION_RUN_ALREADY_PLANNED'),
  );

  const invalidBase = {
    ...planInput,
    id: 'execution-plan-invalid',
    runId: 'orchestrator-run-invalid',
    contextReceiptId: 'orchestrator-context-invalid',
  };
  await buildAndPersistAgentContext(pool, {
    receiptId: invalidBase.contextReceiptId,
    taskId: 'orchestrator-task-invalid',
    workspaceId: workspaceA,
    userId: ownerA.id,
    runId: invalidBase.runId,
    agentKey: orchestrator.key,
    agentVersion: orchestrator.version,
    policyRefs: ['policy.execution.v1'],
    canonicalRefs: ['business:company-1'],
    tokenBudget: 1_000,
    maxCurrencyMicros: 10_000,
    maxMemoryRefs: 8,
    createdAt: new Date('2026-09-01T01:01:00.000Z'),
  });

  await assert.rejects(
    () =>
      persistAgentExecutionPlan(pool, {
        ...invalidBase,
        steps: [step({ toolKeys: ['source.unapproved'] })],
        maxParallelism: 1,
        createdAt: new Date('2026-09-01T01:01:01.000Z'),
      }),
    expectExecutionError('AGENT_EXECUTION_TOOL_NOT_ALLOWED'),
  );
  await assert.rejects(
    () =>
      persistAgentExecutionPlan(pool, {
        ...invalidBase,
        steps: [step({ commandKeys: ['candidate.delete'] })],
        maxParallelism: 1,
        createdAt: new Date('2026-09-01T01:01:02.000Z'),
      }),
    expectExecutionError('AGENT_EXECUTION_COMMAND_NOT_ALLOWED'),
  );
  await assert.rejects(
    () =>
      persistAgentExecutionPlan(pool, {
        ...invalidBase,
        steps: [step({ policyRefs: ['policy.outside.v1'] })],
        maxParallelism: 1,
        createdAt: new Date('2026-09-01T01:01:03.000Z'),
      }),
    expectExecutionError('AGENT_EXECUTION_SCOPE_BROADENED'),
  );
  await assert.rejects(
    () =>
      persistAgentExecutionPlan(pool, {
        ...invalidBase,
        steps: [step({ canonicalRefs: ['business:outside'] })],
        maxParallelism: 1,
        createdAt: new Date('2026-09-01T01:01:04.000Z'),
      }),
    expectExecutionError('AGENT_EXECUTION_SCOPE_BROADENED'),
  );
  await assert.rejects(
    () =>
      persistAgentExecutionPlan(pool, {
        ...invalidBase,
        steps: [step({ memoryRefs: ['memory-outside-context'] })],
        maxParallelism: 1,
        createdAt: new Date('2026-09-01T01:01:05.000Z'),
      }),
    expectExecutionError('AGENT_EXECUTION_SCOPE_BROADENED'),
  );
  await assert.rejects(
    () =>
      persistAgentExecutionPlan(pool, {
        ...invalidBase,
        steps: [step({ agentKey: 'agent.research.no-memory' })],
        maxParallelism: 1,
        createdAt: new Date('2026-09-01T01:01:06.000Z'),
      }),
    expectExecutionError('AGENT_EXECUTION_MEMORY_SCOPE_NOT_ALLOWED'),
  );
  await assert.rejects(
    () =>
      persistAgentExecutionPlan(pool, {
        ...invalidBase,
        steps: [step({ budget: { ...step().budget, maxTokens: 6_000 } })],
        maxParallelism: 1,
        createdAt: new Date('2026-09-01T01:01:07.000Z'),
      }),
    expectExecutionError('AGENT_EXECUTION_BUDGET_EXCEEDED'),
  );
  await assert.rejects(
    () =>
      persistAgentExecutionPlan(pool, {
        ...invalidBase,
        steps: [step({ agentKey: 'agent.research.draft' })],
        maxParallelism: 1,
        createdAt: new Date('2026-09-01T01:01:08.000Z'),
      }),
    expectExecutionError('AGENT_EXECUTION_DEFINITION_NOT_APPROVED'),
  );
  await assert.rejects(
    () =>
      persistAgentExecutionPlan(pool, {
        ...invalidBase,
        steps: [step({ agentKey: 'agent.research.review-only' })],
        maxParallelism: 1,
        createdAt: new Date('2026-09-01T01:01:09.000Z'),
      }),
    expectExecutionError('AGENT_EXECUTION_REVIEW_REQUIRED'),
  );
  await assert.rejects(
    () =>
      persistAgentExecutionPlan(pool, {
        ...invalidBase,
        steps: [step({ budget: { ...step().budget, maxTokens: 3_000 } }), verifyStep({ budget: { ...verifyStep().budget, maxTokens: 3_000 } })],
        maxParallelism: 2,
        createdAt: new Date('2026-09-01T01:01:10.000Z'),
      }),
    expectExecutionError('AGENT_EXECUTION_BUDGET_EXCEEDED'),
  );

  await assert.rejects(
    () =>
      persistAgentExecutionPlan(pool, {
        ...invalidBase,
        id: 'execution-plan-cross-tenant-user',
        userId: ownerB.id,
        createdAt: new Date('2026-09-01T01:01:11.000Z'),
      }),
    expectExecutionError('AGENT_EXECUTION_AUTHORIZATION_REQUIRED'),
  );

  await assert.rejects(
    () => pool.query(`UPDATE agent_execution_plans SET plan_version = 2 WHERE id = $1`, [planInput.id]),
    expectPostgresConstraint('23514', 'agent_execution_plans_append_only'),
  );
  await assert.rejects(
    () => pool.query(`DELETE FROM agent_execution_plans WHERE id = $1`, [planInput.id]),
    expectPostgresConstraint('23514', 'agent_execution_plans_append_only'),
  );

  await transitionAgentRun(pool, {
    transitionId: 'orchestrator-run-1-start',
    workspaceId: workspaceA,
    runId,
    fromStatus: 'queued',
    toStatus: 'running',
    reasonCode: 'execution.started',
    actorType: 'worker',
    actorId: 'execution-worker-1',
    occurredAt: new Date('2026-09-01T01:00:02.000Z'),
  });
  const replayAfterTransition = await persistAgentExecutionPlan(pool, planInput);
  assert.equal(replayAfterTransition.created, false);
  assert.equal(replayAfterTransition.runEnvelope.status, 'running');

  console.log('Brovexa bounded agent execution plan verification passed.');
} finally {
  await resetDatabase();
  await pool.end();
}
