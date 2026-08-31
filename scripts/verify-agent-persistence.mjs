import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  AgentPersistenceConflictError,
  applyPendingMigrations,
  createPgPool,
  getAgentRunEnvelope,
  persistAgentDefinition,
  persistAgentRun,
  persistContextReceipt,
  probeDatabase,
} from '../packages/db/dist/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for agent persistence verification.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for destructive agent persistence verification.');
}

const migrationsDir = resolve('packages/db/migrations');
const pool = createPgPool({ connectionString, max: 4 });

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

async function resetDatabase() {
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
    [slug, `Agent Persistence ${slug}`],
  );
  const id = result.rows[0]?.id;
  assert.ok(id);
  return id;
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
  ]);
  assert.equal((await probeDatabase(pool)).schemaReady, true);

  const workspaceA = await createWorkspace('agent-persistence-a');
  const workspaceB = await createWorkspace('agent-persistence-b');

  const definition = {
    key: 'agent.control.context',
    version: '1.0.0',
    status: 'approved',
    purpose: 'Build minimum-necessary governed context.',
    nonGoals: ['Do not mutate canonical business state.'],
    triggerTypes: ['agent_run'],
    inputSchemaId: 'context.request.v1',
    outputSchemaId: 'context.receipt.v1',
    allowedTools: ['context.read'],
    allowedCommands: [],
    memory: {
      read: ['workspace/*', 'run/*', 'system/procedural/*'],
      propose: [],
      commit: [],
      supersede: [],
    },
    autonomyTier: 'T0',
    humanInterrupts: ['scope_conflict'],
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
      maxTokens: 0,
      maxSearches: 0,
      maxApiCalls: 8,
      maxCredits: 0,
      maxCurrencyMicros: 0,
      maxRuntimeMs: 30_000,
      maxConcurrency: 1,
    },
    deterministicValidators: ['tenant_scope', 'policy_scope'],
    evidenceRequired: false,
    minimumConfidence: 0.8,
    reviewBelowConfidence: 0.9,
    evalSuiteId: 'AI-CONTEXT-001',
    evalThreshold: 0.99,
    dataClassifications: ['WORKSPACE_CONFIDENTIAL'],
    telemetryRedactionPolicyId: 'telemetry.default',
    owner: 'platform-ai',
    changeReason: 'Initial persisted definition verification.',
  };

  const definitionId = await persistAgentDefinition(pool, {
    agentKey: definition.key,
    version: definition.version,
    status: definition.status,
    autonomyTier: definition.autonomyTier,
    requiresHumanApproval: definition.requiresHumanApproval,
    specification: definition,
  });
  assert.equal(
    await persistAgentDefinition(pool, {
      agentKey: definition.key,
      version: definition.version,
      status: definition.status,
      autonomyTier: definition.autonomyTier,
      requiresHumanApproval: definition.requiresHumanApproval,
      specification: definition,
    }),
    definitionId,
  );

  await assert.rejects(
    () =>
      persistAgentDefinition(pool, {
        agentKey: definition.key,
        version: definition.version,
        status: definition.status,
        autonomyTier: definition.autonomyTier,
        requiresHumanApproval: definition.requiresHumanApproval,
        specification: { ...definition, changeReason: 'Conflicting same-version content.' },
      }),
    (error) =>
      error instanceof AgentPersistenceConflictError &&
      error.code === 'AGENT_DEFINITION_VERSION_CONFLICT',
  );

  await assert.rejects(
    () =>
      persistAgentDefinition(pool, {
        agentKey: 'agent.control.t4-invalid',
        version: '1.0.0',
        status: 'draft',
        autonomyTier: 'T4',
        requiresHumanApproval: false,
        specification: { invalid: true },
      }),
    expectPostgresConstraint('23514', 'agent_definitions_t4_human_approval_check'),
  );

  const receiptA = {
    id: 'ctx_a_1',
    taskId: 'task_a_1',
    workspaceId: workspaceA,
    runId: 'research_run_a',
    agentKey: definition.key,
    agentVersion: definition.version,
    policyRefs: ['policy.source.v1'],
    canonicalRefs: ['business_1'],
    memoryRefs: [],
    tokenBudget: 4_000,
    maxCurrencyMicros: 50_000,
    createdAt: '2026-09-01T00:00:00.000Z',
  };

  assert.equal(
    await persistContextReceipt(pool, {
      id: receiptA.id,
      workspaceId: receiptA.workspaceId,
      runScopeId: receiptA.runId,
      agentDefinitionId: definitionId,
      agentKey: receiptA.agentKey,
      agentVersion: receiptA.agentVersion,
      receipt: receiptA,
      tokenBudget: receiptA.tokenBudget,
      maxCurrencyMicros: receiptA.maxCurrencyMicros,
      createdAt: new Date(receiptA.createdAt),
    }),
    receiptA.id,
  );

  await assert.rejects(
    () =>
      persistContextReceipt(pool, {
        id: 'ctx_bad_definition',
        workspaceId: workspaceA,
        agentDefinitionId: definitionId,
        agentKey: 'agent.control.wrong',
        agentVersion: definition.version,
        receipt: { invalid: true },
        tokenBudget: 0,
        maxCurrencyMicros: 0,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
      }),
    expectPostgresConstraint('23503', 'agent_context_receipts_definition_identity_fk'),
  );

  const runA = {
    id: 'agent_run_a_1',
    workspaceId: workspaceA,
    agentKey: definition.key,
    agentVersion: definition.version,
    executionMode: 'deterministic',
    promptVersion: definition.promptVersion,
    skillVersions: {},
    contextReceiptId: receiptA.id,
    status: 'succeeded',
    result: { contextReceiptId: receiptA.id },
    confidence: 1,
    uncertainty: [],
    evidenceIds: [],
    factIds: [],
    sourceIds: [],
    assumptions: [],
    conflicts: [],
    toolSummary: [],
    cost: {
      inputTokens: 0,
      outputTokens: 0,
      searches: 0,
      apiCalls: 2,
      credits: 0,
      currencyMicros: 0,
    },
    validationState: 'passed',
    evaluatorState: 'not_required',
    proposedActions: [],
    startedAt: '2026-09-01T00:00:00.000Z',
    completedAt: '2026-09-01T00:00:01.000Z',
  };

  assert.equal(
    await persistAgentRun(pool, {
      id: runA.id,
      workspaceId: runA.workspaceId,
      agentDefinitionId: definitionId,
      agentKey: runA.agentKey,
      agentVersion: runA.agentVersion,
      contextReceiptId: runA.contextReceiptId,
      executionMode: runA.executionMode,
      status: runA.status,
      envelope: runA,
      startedAt: new Date(runA.startedAt),
      completedAt: new Date(runA.completedAt),
    }),
    runA.id,
  );

  assert.deepEqual(await getAgentRunEnvelope(pool, workspaceA, runA.id), runA);
  assert.equal(await getAgentRunEnvelope(pool, workspaceB, runA.id), null);

  await assert.rejects(
    () =>
      persistAgentRun(pool, {
        id: 'agent_run_cross_tenant',
        workspaceId: workspaceB,
        agentDefinitionId: definitionId,
        agentKey: runA.agentKey,
        agentVersion: runA.agentVersion,
        contextReceiptId: receiptA.id,
        executionMode: 'deterministic',
        status: 'queued',
        envelope: { test: 'cross-tenant context' },
      }),
    expectPostgresConstraint('23503', 'agent_runs_context_workspace_definition_fk'),
  );

  await assert.rejects(
    () =>
      persistAgentRun(pool, {
        id: 'agent_run_invalid_route',
        workspaceId: workspaceA,
        agentDefinitionId: definitionId,
        agentKey: runA.agentKey,
        agentVersion: runA.agentVersion,
        contextReceiptId: receiptA.id,
        executionMode: 'deterministic',
        providerId: 'provider-x',
        modelId: 'model-x',
        status: 'queued',
        envelope: { test: 'invalid deterministic route' },
      }),
    expectPostgresConstraint('23514', 'agent_runs_execution_route_check'),
  );

  console.log('Brovexa M01A agent definition/context/run persistence verification passed.');
} finally {
  await resetDatabase();
  await pool.end();
}
