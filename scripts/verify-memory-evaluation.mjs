import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  AgentPersistenceConflictError,
  applyPendingMigrations,
  createPgPool,
  getEvalResultEnvelope,
  getMemoryRecordEnvelope,
  persistAgentDefinition,
  persistAgentRun,
  persistContextReceipt,
  persistEvalResult,
  persistMemoryRecord,
  probeDatabase,
} from '../packages/db/dist/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for memory/evaluation verification.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for destructive memory/evaluation verification.');
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
    [slug, `Memory Eval ${slug}`],
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

  const workspaceA = await createWorkspace('memory-eval-a');
  const workspaceB = await createWorkspace('memory-eval-b');

  const definition = {
    key: 'agent.control.evaluator',
    version: '1.0.0',
    status: 'approved',
    purpose: 'Verify governed memory and evaluation persistence.',
    nonGoals: ['Do not invoke production providers.'],
    triggerTypes: ['agent_run'],
    inputSchemaId: 'evaluation.input.v1',
    outputSchemaId: 'evaluation.output.v1',
    allowedTools: [],
    allowedCommands: [],
    memory: {
      read: ['workspace/*', 'run/*'],
      propose: ['workspace/*', 'run/*'],
      commit: ['workspace/*', 'run/*'],
      supersede: ['workspace/*', 'run/*'],
    },
    autonomyTier: 'T0',
    humanInterrupts: ['evidence_conflict'],
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
      maxApiCalls: 4,
      maxCredits: 0,
      maxCurrencyMicros: 0,
      maxRuntimeMs: 30_000,
      maxConcurrency: 1,
    },
    deterministicValidators: ['tenant_scope', 'evidence_scope'],
    evidenceRequired: true,
    minimumConfidence: 0.8,
    reviewBelowConfidence: 0.9,
    evalSuiteId: 'AI-EVAL-001',
    evalThreshold: 0.95,
    dataClassifications: ['AI_DERIVED'],
    telemetryRedactionPolicyId: 'telemetry.default',
    owner: 'platform-ai',
    changeReason: 'Memory/evaluation persistence verification.',
  };

  const definitionId = await persistAgentDefinition(pool, {
    agentKey: definition.key,
    version: definition.version,
    status: definition.status,
    autonomyTier: definition.autonomyTier,
    requiresHumanApproval: definition.requiresHumanApproval,
    specification: definition,
  });

  const receipt = {
    id: 'ctx_memory_eval_a',
    taskId: 'task_memory_eval_a',
    workspaceId: workspaceA,
    agentKey: definition.key,
    agentVersion: definition.version,
    policyRefs: ['policy.memory.v1'],
    canonicalRefs: ['business_1'],
    memoryRefs: [],
    tokenBudget: 0,
    maxCurrencyMicros: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
  };

  await persistContextReceipt(pool, {
    id: receipt.id,
    workspaceId: receipt.workspaceId,
    agentDefinitionId: definitionId,
    agentKey: receipt.agentKey,
    agentVersion: receipt.agentVersion,
    receipt,
    tokenBudget: receipt.tokenBudget,
    maxCurrencyMicros: receipt.maxCurrencyMicros,
    createdAt: new Date(receipt.createdAt),
  });

  function buildRun(id, resultKey) {
    return {
      id,
      workspaceId: workspaceA,
      agentKey: definition.key,
      agentVersion: definition.version,
      executionMode: 'deterministic',
      promptVersion: definition.promptVersion,
      skillVersions: {},
      contextReceiptId: receipt.id,
      status: 'succeeded',
      result: { [resultKey]: true },
      confidence: 1,
      uncertainty: [],
      evidenceIds: ['evidence_1'],
      factIds: [],
      sourceIds: [],
      assumptions: [],
      conflicts: [],
      toolSummary: [],
      cost: {
        inputTokens: 0,
        outputTokens: 0,
        searches: 0,
        apiCalls: 0,
        credits: 0,
        currencyMicros: 0,
      },
      validationState: 'passed',
      evaluatorState: 'not_required',
      proposedActions: [],
      startedAt: '2026-09-01T00:00:00.000Z',
      completedAt: '2026-09-01T00:00:01.000Z',
    };
  }

  const subjectRun = buildRun('subject_run_1', 'subject');
  const evaluatorRun = buildRun('evaluator_run_1', 'evaluator');

  for (const run of [subjectRun, evaluatorRun]) {
    await persistAgentRun(pool, {
      id: run.id,
      workspaceId: run.workspaceId,
      agentDefinitionId: definitionId,
      agentKey: run.agentKey,
      agentVersion: run.agentVersion,
      contextReceiptId: run.contextReceiptId,
      executionMode: run.executionMode,
      status: run.status,
      envelope: run,
      startedAt: new Date(run.startedAt),
      completedAt: new Date(run.completedAt),
    });
  }

  const memory = {
    id: 'memory_parent_1',
    version: '1.0.0',
    namespace: `workspace/${workspaceA}/business/company-1`,
    workspaceId: workspaceA,
    entityId: 'company-1',
    type: 'semantic',
    subtype: 'business_profile',
    subjectRefs: ['company-1'],
    contentSchemaId: 'memory.business-profile',
    contentSchemaVersion: '1.0.0',
    content: { legalName: 'Example Business' },
    provenance: [{ kind: 'fact', refId: 'fact_1' }],
    writer: 'curator',
    aiDerived: false,
    confidence: 1,
    authority: 'verified_fact',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    status: 'active',
    retentionPolicyId: 'retention.business.v1',
    readCapabilities: ['workspace.read'],
    writeCapabilities: ['memory.curate'],
    dataClassification: 'BUSINESS_DATA',
    sourcePolicyRefs: ['policy.source.v1'],
    jurisdictionRefs: [],
  };

  const memoryInput = {
    id: memory.id,
    version: memory.version,
    namespace: memory.namespace,
    workspaceId: memory.workspaceId,
    entityId: memory.entityId,
    memoryType: memory.type,
    subtype: memory.subtype,
    writer: memory.writer,
    aiDerived: memory.aiDerived,
    confidence: memory.confidence,
    authority: memory.authority,
    status: memory.status,
    retentionPolicyId: memory.retentionPolicyId,
    dataClassification: memory.dataClassification,
    envelope: memory,
    createdAt: new Date(memory.createdAt),
    updatedAt: new Date(memory.updatedAt),
  };

  assert.equal(await persistMemoryRecord(pool, memoryInput), memory.id);
  assert.equal(await persistMemoryRecord(pool, memoryInput), memory.id);
  assert.deepEqual(await getMemoryRecordEnvelope(pool, workspaceA, memory.id), memory);
  assert.equal(await getMemoryRecordEnvelope(pool, workspaceB, memory.id), null);

  await assert.rejects(
    () => persistMemoryRecord(pool, { ...memoryInput, status: 'stale' }),
    (error) =>
      error instanceof AgentPersistenceConflictError && error.code === 'MEMORY_RECORD_ID_CONFLICT',
  );

  const childMemory = {
    ...memory,
    id: 'memory_child_1',
    version: '1.1.0',
    revisionParentId: memory.id,
    content: { legalName: 'Example Business Ltd.' },
    createdAt: '2026-09-01T00:01:00.000Z',
    updatedAt: '2026-09-01T00:01:00.000Z',
  };

  await persistMemoryRecord(pool, {
    id: childMemory.id,
    version: childMemory.version,
    revisionParentId: childMemory.revisionParentId,
    namespace: childMemory.namespace,
    workspaceId: childMemory.workspaceId,
    entityId: childMemory.entityId,
    memoryType: childMemory.type,
    subtype: childMemory.subtype,
    writer: childMemory.writer,
    aiDerived: childMemory.aiDerived,
    confidence: childMemory.confidence,
    authority: childMemory.authority,
    status: childMemory.status,
    retentionPolicyId: childMemory.retentionPolicyId,
    dataClassification: childMemory.dataClassification,
    envelope: childMemory,
    createdAt: new Date(childMemory.createdAt),
    updatedAt: new Date(childMemory.updatedAt),
  });

  await assert.rejects(
    () =>
      persistMemoryRecord(pool, {
        ...memoryInput,
        id: 'memory_cross_workspace_revision',
        revisionParentId: memory.id,
        workspaceId: workspaceB,
        namespace: `workspace/${workspaceB}/business/company-1`,
        envelope: { test: 'cross-workspace-revision' },
      }),
    expectPostgresConstraint('23503', 'memory_records_revision_workspace_fk'),
  );

  await assert.rejects(
    () =>
      persistMemoryRecord(pool, {
        ...memoryInput,
        id: 'memory_protected_procedural',
        namespace: 'system/procedural/runtime-policy',
        writer: 'agent',
        memoryType: 'procedural',
        envelope: { test: 'agent-procedural-write' },
      }),
    expectPostgresConstraint('23514', 'memory_records_protected_procedural_write_check'),
  );

  await assert.rejects(
    () =>
      persistMemoryRecord(pool, {
        ...memoryInput,
        id: 'memory_bad_namespace',
        namespace: `workspace/${workspaceB}/wrong-tenant`,
        envelope: { test: 'bad-namespace' },
      }),
    expectPostgresConstraint('23514', 'memory_records_namespace_scope_check'),
  );

  await assert.rejects(
    () =>
      persistMemoryRecord(pool, {
        ...memoryInput,
        id: 'memory_deleted_without_reason',
        status: 'deleted',
        envelope: { test: 'deleted-without-reason' },
      }),
    expectPostgresConstraint('23514', 'memory_records_deletion_reason_check'),
  );

  const runMemory = {
    id: 'memory_run_1',
    version: '1.0.0',
    namespace: `run/${subjectRun.id}/analysis`,
    workspaceId: workspaceA,
    runId: subjectRun.id,
    type: 'working',
    subtype: 'run_analysis',
    subjectRefs: [subjectRun.id],
    contentSchemaId: 'memory.run-analysis',
    contentSchemaVersion: '1.0.0',
    content: { accepted: true },
    provenance: [{ kind: 'run', refId: subjectRun.id }],
    writer: 'agent',
    aiDerived: true,
    derivation: {
      agentKey: definition.key,
      agentVersion: definition.version,
      modelId: 'deterministic-runtime',
      promptVersion: definition.promptVersion,
      toolVersions: {},
    },
    confidence: 0.99,
    authority: 'agent_inference',
    createdAt: '2026-09-01T00:02:00.000Z',
    updatedAt: '2026-09-01T00:02:00.000Z',
    status: 'active',
    retentionPolicyId: 'retention.run.v1',
    readCapabilities: ['workspace.read'],
    writeCapabilities: [],
    dataClassification: 'AI_DERIVED',
    sourcePolicyRefs: [],
    jurisdictionRefs: [],
  };

  await persistMemoryRecord(pool, {
    id: runMemory.id,
    version: runMemory.version,
    namespace: runMemory.namespace,
    workspaceId: runMemory.workspaceId,
    runId: runMemory.runId,
    memoryType: runMemory.type,
    subtype: runMemory.subtype,
    writer: runMemory.writer,
    aiDerived: runMemory.aiDerived,
    derivation: runMemory.derivation,
    confidence: runMemory.confidence,
    authority: runMemory.authority,
    status: runMemory.status,
    retentionPolicyId: runMemory.retentionPolicyId,
    dataClassification: runMemory.dataClassification,
    envelope: runMemory,
    createdAt: new Date(runMemory.createdAt),
    updatedAt: new Date(runMemory.updatedAt),
  });

  await assert.rejects(
    () =>
      persistMemoryRecord(pool, {
        ...memoryInput,
        id: 'memory_cross_workspace_run',
        workspaceId: workspaceB,
        runId: subjectRun.id,
        namespace: `run/${subjectRun.id}/cross-tenant`,
        envelope: { test: 'cross-workspace-run' },
      }),
    expectPostgresConstraint('23503', 'memory_records_run_workspace_fk'),
  );

  const evaluation = {
    id: 'eval_1',
    evaluatorRunId: evaluatorRun.id,
    subjectRunId: subjectRun.id,
    decision: 'accept',
    evidenceState: 'verified',
    reasonCodes: ['evidence_verified'],
    evidenceRefs: ['evidence_1'],
    policyRefs: ['policy.evaluation.v1'],
    confidence: 0.99,
    createdAt: '2026-09-01T00:03:00.000Z',
  };

  const evaluationInput = {
    id: evaluation.id,
    workspaceId: workspaceA,
    evaluatorRunId: evaluation.evaluatorRunId,
    subjectRunId: evaluation.subjectRunId,
    decision: evaluation.decision,
    evidenceState: evaluation.evidenceState,
    reasonCodes: evaluation.reasonCodes,
    evidenceRefs: evaluation.evidenceRefs,
    policyRefs: evaluation.policyRefs,
    confidence: evaluation.confidence,
    envelope: evaluation,
    createdAt: new Date(evaluation.createdAt),
  };

  assert.equal(await persistEvalResult(pool, evaluationInput), evaluation.id);
  assert.equal(await persistEvalResult(pool, evaluationInput), evaluation.id);
  assert.deepEqual(await getEvalResultEnvelope(pool, workspaceA, evaluation.id), evaluation);
  assert.equal(await getEvalResultEnvelope(pool, workspaceB, evaluation.id), null);

  await assert.rejects(
    () => persistEvalResult(pool, { ...evaluationInput, decision: 'review' }),
    (error) =>
      error instanceof AgentPersistenceConflictError && error.code === 'EVAL_RESULT_ID_CONFLICT',
  );

  await assert.rejects(
    () =>
      persistEvalResult(pool, {
        ...evaluationInput,
        id: 'eval_same_run',
        evaluatorRunId: subjectRun.id,
        subjectRunId: subjectRun.id,
        envelope: { test: 'same-run-evaluator' },
      }),
    expectPostgresConstraint('23514', 'agent_eval_results_independent_run_check'),
  );

  await assert.rejects(
    () =>
      persistEvalResult(pool, {
        ...evaluationInput,
        id: 'eval_unverified_accept',
        evidenceState: 'insufficient',
        envelope: { test: 'unverified-accept' },
      }),
    expectPostgresConstraint('23514', 'agent_eval_results_accept_verified_check'),
  );

  await assert.rejects(
    () =>
      persistEvalResult(pool, {
        ...evaluationInput,
        id: 'eval_cross_workspace',
        workspaceId: workspaceB,
        envelope: { test: 'cross-workspace-evaluation' },
      }),
    expectPostgresConstraint('23503', 'agent_eval_results_evaluator_workspace_fk'),
  );

  console.log('Brovexa M01A memory/evaluation persistence verification passed.');
} finally {
  await resetDatabase();
  await pool.end();
}