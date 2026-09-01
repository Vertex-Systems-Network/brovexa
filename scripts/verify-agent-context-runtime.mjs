import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  AgentContextRuntimeError,
  AgentPersistenceConflictError,
  applyPendingMigrations,
  bootstrapWorkspaceOwner,
  buildAndPersistAgentContext,
  createIdentityUser,
  createPgPool,
  getContextReceiptEnvelope,
  persistAgentDefinition,
  persistAgentRun,
  persistContextReceipt,
  persistMemoryRecord,
  probeDatabase,
  resolveApprovedAgentDefinition,
} from '../packages/db/dist/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for agent context runtime verification.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for destructive context runtime verification.');
}

const migrationsDir = resolve('packages/db/migrations');
const pool = createPgPool({ connectionString, max: 6 });

async function resetDatabase() {
  await pool.query('DROP TABLE IF EXISTS connector_health_snapshots CASCADE');
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
    [slug, `Context Runtime ${slug}`],
  );
  const id = result.rows[0]?.id;
  assert.ok(id);
  return id;
}

function createDefinition(key, version, status = 'approved', overrides = {}) {
  return {
    key,
    version,
    status,
    purpose: 'Build minimum-necessary governed context deterministically.',
    nonGoals: ['Do not invoke models, providers or external tools.'],
    triggerTypes: ['agent_run'],
    inputSchemaId: 'context.request.v1',
    outputSchemaId: 'context.receipt.v1',
    allowedTools: ['context.read'],
    allowedCommands: [],
    memory: {
      read: ['system/procedural/*', 'workspace/*', 'user/*/workspace/*', 'run/*'],
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
      maxTokens: 4_000,
      maxSearches: 0,
      maxApiCalls: 20,
      maxCredits: 0,
      maxCurrencyMicros: 100_000,
      maxRuntimeMs: 30_000,
      maxConcurrency: 1,
    },
    deterministicValidators: ['tenant_scope', 'memory_scope', 'budget_scope'],
    evidenceRequired: false,
    minimumConfidence: 0.8,
    reviewBelowConfidence: 0.9,
    evalSuiteId: 'AI-CONTEXT-RUNTIME-001',
    evalThreshold: 0.99,
    dataClassifications: ['BUSINESS_DATA', 'WORKSPACE_CONFIDENTIAL'],
    telemetryRedactionPolicyId: 'telemetry.default',
    owner: 'platform-ai',
    changeReason: 'Deterministic context runtime verification.',
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

async function persistMemory({
  id,
  workspaceId,
  namespace,
  authority,
  confidence = 1,
  status = 'active',
  dataClassification = 'BUSINESS_DATA',
  userId,
  runId,
  entityId,
  leadId,
  subtype = 'context_fact',
  readCapabilities = ['workspace.read'],
  expiresAt,
  content = { value: id },
  updatedAt = '2026-09-01T00:00:00.000Z',
}) {
  const envelope = {
    id,
    version: '1.0.0',
    namespace,
    workspaceId,
    ...(userId ? { userId } : {}),
    ...(runId ? { runId } : {}),
    ...(entityId ? { entityId } : {}),
    ...(leadId ? { leadId } : {}),
    type: 'semantic',
    subtype,
    subjectRefs: [entityId ?? leadId ?? id],
    contentSchemaId: 'memory.context-fixture.v1',
    contentSchemaVersion: '1.0.0',
    content,
    provenance: [{ kind: 'fact', refId: `fact-${id}` }],
    writer: 'curator',
    aiDerived: false,
    confidence,
    authority,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt,
    ...(expiresAt ? { expiresAt } : {}),
    status,
    retentionPolicyId: 'retention.context.v1',
    readCapabilities,
    writeCapabilities: [],
    dataClassification,
    sourcePolicyRefs: ['policy.source.v1'],
    jurisdictionRefs: [],
  };

  await persistMemoryRecord(pool, {
    id,
    version: envelope.version,
    namespace,
    workspaceId,
    userId,
    runId,
    entityId,
    leadId,
    memoryType: envelope.type,
    subtype,
    writer: envelope.writer,
    aiDerived: envelope.aiDerived,
    confidence,
    authority,
    status,
    retentionPolicyId: envelope.retentionPolicyId,
    dataClassification,
    envelope,
    createdAt: new Date(envelope.createdAt),
    updatedAt: new Date(updatedAt),
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
  });

  return envelope;
}

function expectContextError(code) {
  return (error) => error instanceof AgentContextRuntimeError && error.code === code;
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
    '0009_connector_execution_safety',
  ]);
  assert.equal((await probeDatabase(pool)).schemaReady, true);

  const workspaceA = await createWorkspace('agent-context-a');
  const workspaceB = await createWorkspace('agent-context-b');
  const ownerA = await createIdentityUser(pool);
  const ownerB = await createIdentityUser(pool);
  const otherUser = await createIdentityUser(pool);
  await bootstrapWorkspaceOwner(pool, { workspaceId: workspaceA, userId: ownerA.id });
  await bootstrapWorkspaceOwner(pool, { workspaceId: workspaceB, userId: ownerB.id });

  const approvedDefinition = createDefinition('agent.control.context', '1.0.0');
  const approvedDefinitionId = await persistDefinition(approvedDefinition);
  const resolved = await resolveApprovedAgentDefinition(pool, {
    agentKey: approvedDefinition.key,
    version: approvedDefinition.version,
  });
  assert.equal(resolved.id, approvedDefinitionId);
  assert.equal(resolved.maxTokens, approvedDefinition.budget.maxTokens);
  assert.deepEqual(resolved.memoryReadScopes, approvedDefinition.memory.read);

  const draftDefinition = createDefinition('agent.control.context-draft', '1.0.0', 'draft');
  await persistDefinition(draftDefinition);
  await assert.rejects(
    () =>
      resolveApprovedAgentDefinition(pool, {
        agentKey: draftDefinition.key,
        version: draftDefinition.version,
      }),
    expectContextError('AGENT_DEFINITION_NOT_APPROVED'),
  );
  await assert.rejects(
    () =>
      resolveApprovedAgentDefinition(pool, {
        agentKey: approvedDefinition.key,
        version: '9.9.9',
      }),
    expectContextError('AGENT_DEFINITION_NOT_FOUND'),
  );

  const invalidDefinition = createDefinition('agent.control.context-invalid', '1.0.0', 'approved', {
    dataClassifications: ['NOT_A_REAL_CLASSIFICATION'],
  });
  await persistDefinition(invalidDefinition);
  await assert.rejects(
    () =>
      resolveApprovedAgentDefinition(pool, {
        agentKey: invalidDefinition.key,
        version: invalidDefinition.version,
      }),
    expectContextError('AGENT_DEFINITION_SPEC_INVALID'),
  );

  await persistMemory({
    id: 'memory-explicit-config',
    workspaceId: workspaceA,
    namespace: `workspace/${workspaceA}/preference/icp`,
    authority: 'explicit_configuration',
    confidence: 0.75,
    subtype: 'workspace_preference',
    updatedAt: '2026-09-01T00:01:00.000Z',
  });
  await persistMemory({
    id: 'memory-verified-target',
    workspaceId: workspaceA,
    namespace: `workspace/${workspaceA}/business/company-target`,
    authority: 'verified_fact',
    confidence: 0.8,
    entityId: 'company-target',
    subtype: 'business_profile',
    updatedAt: '2026-09-01T00:02:00.000Z',
  });
  await persistMemory({
    id: 'memory-verified-other',
    workspaceId: workspaceA,
    namespace: `workspace/${workspaceA}/business/company-other`,
    authority: 'verified_fact',
    confidence: 0.8,
    entityId: 'company-other',
    subtype: 'business_profile',
    updatedAt: '2026-09-01T00:02:00.000Z',
  });
  await persistMemory({
    id: 'memory-agent-high-confidence',
    workspaceId: workspaceA,
    namespace: `workspace/${workspaceA}/analysis/high-confidence`,
    authority: 'agent_inference',
    confidence: 1,
    subtype: 'agent_summary',
    updatedAt: '2026-09-01T00:03:00.000Z',
  });
  await persistMemory({
    id: 'memory-user-current',
    workspaceId: workspaceA,
    userId: ownerA.id,
    namespace: `user/${ownerA.id}/workspace/${workspaceA}/preference/voice`,
    authority: 'reviewed_human_decision',
    confidence: 1,
    subtype: 'user_preference',
  });
  await persistMemory({
    id: 'memory-user-other',
    workspaceId: workspaceA,
    userId: otherUser.id,
    namespace: `user/${otherUser.id}/workspace/${workspaceA}/preference/voice`,
    authority: 'platform_policy',
    subtype: 'other_user_preference',
  });
  await persistMemory({
    id: 'memory-unreadable',
    workspaceId: workspaceA,
    namespace: `workspace/${workspaceA}/secret/unreadable`,
    authority: 'platform_policy',
    subtype: 'secret_context',
    readCapabilities: ['memory.secret.read'],
  });
  await persistMemory({
    id: 'memory-disallowed-classification',
    workspaceId: workspaceA,
    namespace: `workspace/${workspaceA}/secret/classification`,
    authority: 'platform_policy',
    subtype: 'security_sensitive',
    dataClassification: 'SECURITY_SENSITIVE',
  });
  await persistMemory({
    id: 'memory-expired',
    workspaceId: workspaceA,
    namespace: `workspace/${workspaceA}/research/expired`,
    authority: 'platform_policy',
    subtype: 'research_summary',
    expiresAt: '2026-08-31T23:59:59.000Z',
  });
  await persistMemory({
    id: 'memory-stale',
    workspaceId: workspaceA,
    namespace: `workspace/${workspaceA}/research/stale`,
    authority: 'platform_policy',
    subtype: 'research_summary',
    status: 'stale',
  });
  await persistMemory({
    id: 'memory-duplicate-lower',
    workspaceId: workspaceA,
    namespace: `workspace/${workspaceA}/business/company-target`,
    authority: 'agent_inference',
    confidence: 1,
    entityId: 'company-target',
    subtype: 'business_profile',
    updatedAt: '2026-09-01T00:04:00.000Z',
  });
  await persistMemory({
    id: 'memory-cross-tenant',
    workspaceId: workspaceB,
    namespace: `workspace/${workspaceB}/business/company-target`,
    authority: 'platform_policy',
    entityId: 'company-target',
    subtype: 'business_profile',
  });
  await persistMemory({
    id: 'memory-huge-low-authority',
    workspaceId: workspaceA,
    namespace: `workspace/${workspaceA}/research/huge`,
    authority: 'historical_context',
    subtype: 'large_history',
    content: { text: 'x'.repeat(12_000) },
  });

  const buildInput = {
    receiptId: 'ctx-runtime-1',
    taskId: 'task-runtime-1',
    workspaceId: workspaceA,
    userId: ownerA.id,
    agentKey: approvedDefinition.key,
    agentVersion: approvedDefinition.version,
    policyRefs: ['policy.context.v1'],
    canonicalRefs: ['business:company-target'],
    targetEntityIds: ['company-target'],
    tokenBudget: 2_000,
    maxCurrencyMicros: 50_000,
    maxMemoryRefs: 5,
    createdAt: new Date('2026-09-01T01:00:00.000Z'),
  };

  const built = await buildAndPersistAgentContext(pool, buildInput);
  const selectedIds = built.selectedMemory.map((memory) => memory.id);
  assert.deepEqual(selectedIds, [
    'memory-explicit-config',
    'memory-verified-target',
    'memory-verified-other',
    'memory-user-current',
    'memory-agent-high-confidence',
  ]);
  assert.ok(built.estimatedMemoryTokens <= buildInput.tokenBudget);
  assert.equal(selectedIds.includes('memory-duplicate-lower'), false);
  assert.equal(selectedIds.includes('memory-unreadable'), false);
  assert.equal(selectedIds.includes('memory-disallowed-classification'), false);
  assert.equal(selectedIds.includes('memory-expired'), false);
  assert.equal(selectedIds.includes('memory-stale'), false);
  assert.equal(selectedIds.includes('memory-cross-tenant'), false);
  assert.equal(selectedIds.includes('memory-user-other'), false);
  assert.equal(selectedIds.includes('memory-huge-low-authority'), false);

  assert.deepEqual(await getContextReceiptEnvelope(pool, workspaceA, buildInput.receiptId), built.receipt);
  assert.equal(await getContextReceiptEnvelope(pool, workspaceB, buildInput.receiptId), null);

  const replay = await buildAndPersistAgentContext(pool, buildInput);
  assert.deepEqual(replay.receipt, built.receipt);
  await assert.rejects(
    () =>
      buildAndPersistAgentContext(pool, {
        ...buildInput,
        canonicalRefs: ['business:changed'],
      }),
    (error) =>
      error instanceof AgentPersistenceConflictError && error.code === 'CONTEXT_RECEIPT_ID_CONFLICT',
  );

  const capped = await buildAndPersistAgentContext(pool, {
    ...buildInput,
    receiptId: 'ctx-runtime-capped',
    maxMemoryRefs: 2,
  });
  assert.deepEqual(
    capped.selectedMemory.map((memory) => memory.id),
    ['memory-explicit-config', 'memory-verified-target'],
  );

  await assert.rejects(
    () =>
      buildAndPersistAgentContext(pool, {
        ...buildInput,
        receiptId: 'ctx-runtime-over-budget',
        tokenBudget: approvedDefinition.budget.maxTokens + 1,
      }),
    expectContextError('CONTEXT_BUDGET_EXCEEDS_AGENT_LIMIT'),
  );
  await assert.rejects(
    () =>
      buildAndPersistAgentContext(pool, {
        ...buildInput,
        receiptId: 'ctx-runtime-no-policy',
        policyRefs: [],
      }),
    expectContextError('CONTEXT_POLICY_REQUIRED'),
  );
  await assert.rejects(
    () =>
      buildAndPersistAgentContext(pool, {
        ...buildInput,
        receiptId: 'ctx-runtime-cross-tenant-user',
        userId: ownerB.id,
      }),
    (error) => error?.code === 'WORKSPACE_MEMBERSHIP_REQUIRED',
  );

  const seedReceipt = {
    id: 'ctx-run-seed',
    taskId: 'task-run-seed',
    workspaceId: workspaceA,
    userId: ownerA.id,
    agentKey: approvedDefinition.key,
    agentVersion: approvedDefinition.version,
    policyRefs: ['policy.context.v1'],
    canonicalRefs: [],
    memoryRefs: [],
    tokenBudget: 0,
    maxCurrencyMicros: 0,
    createdAt: '2026-09-01T00:10:00.000Z',
  };
  await persistContextReceipt(pool, {
    id: seedReceipt.id,
    workspaceId: workspaceA,
    userId: ownerA.id,
    agentDefinitionId: approvedDefinitionId,
    agentKey: approvedDefinition.key,
    agentVersion: approvedDefinition.version,
    receipt: seedReceipt,
    tokenBudget: 0,
    maxCurrencyMicros: 0,
    createdAt: new Date(seedReceipt.createdAt),
  });

  const runId = 'context_runtime_run_1';
  await persistAgentRun(pool, {
    id: runId,
    workspaceId: workspaceA,
    agentDefinitionId: approvedDefinitionId,
    agentKey: approvedDefinition.key,
    agentVersion: approvedDefinition.version,
    contextReceiptId: seedReceipt.id,
    executionMode: 'deterministic',
    status: 'queued',
    envelope: {
      id: runId,
      workspaceId: workspaceA,
      agentKey: approvedDefinition.key,
      agentVersion: approvedDefinition.version,
      executionMode: 'deterministic',
      promptVersion: approvedDefinition.promptVersion,
      skillVersions: {},
      contextReceiptId: seedReceipt.id,
      status: 'queued',
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
        apiCalls: 0,
        credits: 0,
        currencyMicros: 0,
      },
      validationState: 'pending',
      evaluatorState: 'not_required',
      proposedActions: [],
    },
  });
  await persistMemory({
    id: 'memory-run-scoped',
    workspaceId: workspaceA,
    runId,
    namespace: `run/${runId}/working`,
    authority: 'reviewed_human_decision',
    subtype: 'run_working_state',
  });

  const runScoped = await buildAndPersistAgentContext(pool, {
    ...buildInput,
    receiptId: 'ctx-runtime-run-scoped',
    taskId: 'task-runtime-run-scoped',
    runId,
    maxMemoryRefs: 8,
  });
  assert.equal(
    runScoped.selectedMemory.some((memory) => memory.id === 'memory-run-scoped'),
    true,
  );

  const noRunScope = await buildAndPersistAgentContext(pool, {
    ...buildInput,
    receiptId: 'ctx-runtime-no-run-scope',
  });
  assert.equal(
    noRunScope.selectedMemory.some((memory) => memory.id === 'memory-run-scoped'),
    false,
  );

  console.log('Brovexa M01A deterministic Agent Registry + Context Builder verification passed.');
} finally {
  await resetDatabase();
  await pool.end();
}
