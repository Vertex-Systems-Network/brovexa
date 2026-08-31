import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import {
  AgentMemoryError,
  appendAgentCheckpoint,
  applyPendingMigrations,
  bootstrapWorkspaceOwner,
  createAgentRun,
  createIdentityUser,
  createPgPool,
  listActiveMemoryForContext,
  persistContextReceipt,
  probeDatabase,
  proposeMemoryRecord,
  rollbackLatestMigration,
  transitionAgentRunStatus,
} from '../packages/db/dist/index.js';
import {
  AgentRegistry,
  buildContextSelection,
  hashAgentDefinition,
} from '../packages/contracts/dist/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for agent memory verification.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for destructive agent memory verification.');
}

const migrationsDir = resolve('packages/db/migrations');
const pool = createPgPool({ connectionString, max: 8 });

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

function expectAgentMemoryCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof AgentMemoryError, `Expected AgentMemoryError(${expectedCode}).`);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function resetTestDatabase() {
  for (const table of [
    'context_receipts',
    'memory_conflicts',
    'memory_records',
    'agent_checkpoints',
    'agent_runs',
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

async function createWorkspace(slug, displayName) {
  const result = await pool.query(
    'INSERT INTO workspaces (slug, display_name) VALUES ($1, $2) RETURNING id',
    [slug, displayName],
  );
  const id = result.rows[0]?.id;
  assert.ok(id);
  return id;
}

async function activateMemory(id) {
  await pool.query(`UPDATE memory_records SET status = 'active', updated_at = now() WHERE id = $1`, [id]);
}

const contextDefinition = {
  key: 'agent.control.context',
  version: 1,
  status: 'active',
  purpose: 'Build minimum necessary context from canonical references and approved memory.',
  nonGoals: ['Execute external actions', 'Mutate durable memory'],
  autonomyTier: 'T0',
  inputSchemaVersion: 1,
  outputSchemaVersion: 1,
  promptVersion: 1,
  skillVersion: 1,
  contextVersion: 1,
  tools: [{ key: 'context.read', access: 'internal.read' }],
  canonicalCommands: [],
  memoryCapabilities: [
    { scope: 'workspace', actions: ['read'], memoryTypes: ['semantic', 'episodic', 'research'] },
  ],
  allowedDataClassifications: ['public', 'internal', 'confidential'],
  budgets: {
    maxRuntimeMs: 30_000,
    maxConcurrency: 1,
    maxToolCalls: 8,
    maxContextTokens: 8_000,
    maxMemoryRecords: 128,
  },
  evaluatorKey: null,
  requiresIndependentEvaluation: false,
};

const curatorDefinition = {
  key: 'agent.control.memory_curator',
  version: 1,
  status: 'active',
  purpose: 'Propose and curate low-risk workspace memory under deterministic policy.',
  nonGoals: ['Mutate system procedural policy', 'Execute external actions'],
  autonomyTier: 'T2',
  inputSchemaVersion: 1,
  outputSchemaVersion: 1,
  promptVersion: 1,
  skillVersion: 1,
  contextVersion: 1,
  tools: [
    { key: 'memory.read', access: 'internal.read' },
    { key: 'memory.proposal.write', access: 'internal.write' },
  ],
  canonicalCommands: ['memory.propose'],
  memoryCapabilities: [
    {
      scope: 'workspace',
      actions: ['read', 'propose', 'commit', 'supersede'],
      memoryTypes: ['semantic', 'episodic', 'research'],
    },
    { scope: 'system.procedural', actions: ['read'], memoryTypes: ['procedural'] },
  ],
  allowedDataClassifications: ['public', 'internal', 'confidential'],
  budgets: {
    maxRuntimeMs: 30_000,
    maxConcurrency: 1,
    maxToolCalls: 16,
    maxContextTokens: 8_000,
    maxMemoryRecords: 128,
  },
  evaluatorKey: null,
  requiresIndependentEvaluation: false,
};

function curatorMemoryInput({ workspaceId, runId, namespace, subtype, content, expiresAt = null }) {
  return {
    workspaceId,
    userId: null,
    agentRunId: runId,
    revisionParentId: null,
    namespace,
    memoryType: 'research',
    subtype,
    authorityClass: 5,
    content,
    provenance: { runIds: [runId] },
    writerKind: 'curator',
    writerAgentKey: curatorDefinition.key,
    writerAgentVersion: curatorDefinition.version,
    confidenceBps: 9000,
    dataClassification: 'internal',
    observedAt: new Date('2026-08-31T15:00:00.000Z'),
    refreshAfter: null,
    expiresAt,
  };
}

try {
  const databaseIdentity = await pool.query('SELECT current_database() AS name');
  const databaseName = databaseIdentity.rows[0]?.name;
  assert.ok(databaseName?.endsWith('_test'), `Refusing destructive verification against database: ${databaseName}`);

  await resetTestDatabase();
  assert.deepEqual(await applyPendingMigrations(pool, migrationsDir), [
    '0000_workspace_foundation',
    '0001_job_execution_foundation',
    '0002_identity_authorization_foundation',
    '0003_agent_memory_foundation',
  ]);
  assert.equal((await probeDatabase(pool)).schemaReady, true);

  const registry = new AgentRegistry([contextDefinition, curatorDefinition]);
  assert.equal(
    registry.canAccessMemory('agent.control.memory_curator', 1, 'workspace', 'commit', 'research'),
    true,
  );
  assert.equal(
    registry.canAccessMemory('agent.control.context', 1, 'workspace', 'commit', 'research'),
    false,
  );

  const workspaceA = await createWorkspace('agent-memory-a', 'Agent Memory A');
  const workspaceB = await createWorkspace('agent-memory-b', 'Agent Memory B');
  const ownerA = await createIdentityUser(pool);
  const ownerB = await createIdentityUser(pool);
  const bootstrapA = await bootstrapWorkspaceOwner(pool, { workspaceId: workspaceA, userId: ownerA.id });
  const bootstrapB = await bootstrapWorkspaceOwner(pool, { workspaceId: workspaceB, userId: ownerB.id });

  const curatorRunA = await createAgentRun(pool, {
    workspaceId: workspaceA,
    requestedByMembershipId: bootstrapA.membershipId,
    parentRunId: null,
    agentKey: curatorDefinition.key,
    agentVersion: curatorDefinition.version,
    definitionHash: hashAgentDefinition(curatorDefinition),
    input: { objective: 'curate-memory-foundation' },
  });

  await assert.rejects(
    createAgentRun(pool, {
      workspaceId: workspaceA,
      requestedByMembershipId: bootstrapB.membershipId,
      parentRunId: null,
      agentKey: curatorDefinition.key,
      agentVersion: curatorDefinition.version,
      definitionHash: hashAgentDefinition(curatorDefinition),
      input: {},
    }),
    expectAgentMemoryCode('REQUESTER_NOT_ACTIVE'),
  );

  const contextRunB = await createAgentRun(pool, {
    workspaceId: workspaceB,
    requestedByMembershipId: bootstrapB.membershipId,
    parentRunId: null,
    agentKey: contextDefinition.key,
    agentVersion: contextDefinition.version,
    definitionHash: hashAgentDefinition(contextDefinition),
    input: {},
  });

  await assert.rejects(
    pool.query(
      `INSERT INTO agent_runs (workspace_id, parent_run_id, agent_key, agent_version, definition_hash, input)
       VALUES ($1, $2, $3, 1, $4, '{}'::jsonb)`,
      [workspaceA, contextRunB.id, contextDefinition.key, hashAgentDefinition(contextDefinition)],
    ),
    expectPostgresConstraint('23503', 'agent_runs_parent_workspace_fk'),
  );

  assert.equal(
    await transitionAgentRunStatus(pool, {
      workspaceId: workspaceA,
      agentRunId: curatorRunA.id,
      nextStatus: 'running',
    }),
    'running',
  );
  await assert.rejects(
    transitionAgentRunStatus(pool, {
      workspaceId: workspaceA,
      agentRunId: curatorRunA.id,
      nextStatus: 'pending',
    }),
    expectAgentMemoryCode('INVALID_RUN_TRANSITION'),
  );

  const checkpointA = await appendAgentCheckpoint(pool, {
    workspaceId: workspaceA,
    agentRunId: curatorRunA.id,
    checkpointKey: 'memory.scan',
    state: { completed: 1, pending: 2 },
  });
  const checkpointReplay = await appendAgentCheckpoint(pool, {
    workspaceId: workspaceA,
    agentRunId: curatorRunA.id,
    checkpointKey: 'memory.scan',
    state: { pending: 2, completed: 1 },
  });
  assert.equal(checkpointReplay.id, checkpointA.id);
  assert.equal(checkpointReplay.sequence, 1);
  assert.equal(
    (
      await appendAgentCheckpoint(pool, {
        workspaceId: workspaceA,
        agentRunId: curatorRunA.id,
        checkpointKey: 'memory.scan',
        state: { completed: 2, pending: 1 },
      })
    ).sequence,
    2,
  );

  const conflictedLeft = await proposeMemoryRecord(
    pool,
    curatorMemoryInput({
      workspaceId: workspaceA,
      runId: curatorRunA.id,
      namespace: `workspace/${workspaceA}/research/source-yield`,
      subtype: 'source.yield',
      content: { yieldBps: 7200 },
    }),
  );
  await activateMemory(conflictedLeft.id);

  await assert.rejects(
    proposeMemoryRecord(pool, {
      ...curatorMemoryInput({
        workspaceId: workspaceA,
        runId: curatorRunA.id,
        namespace: `workspace/${workspaceA}/research/forged-writer`,
        subtype: 'writer.forgery',
        content: { attempted: true },
      }),
      writerAgentKey: contextDefinition.key,
      writerAgentVersion: contextDefinition.version,
    }),
    expectPostgresConstraint('23503', 'memory_records_writer_run_identity_fk'),
  );

  await assert.rejects(
    proposeMemoryRecord(
      pool,
      curatorMemoryInput({
        workspaceId: workspaceA,
        runId: curatorRunA.id,
        namespace: `workspace/${workspaceB}/research/cross-tenant`,
        subtype: 'tenant.attack',
        content: { attempted: true },
      }),
    ),
    expectPostgresConstraint('23514', 'memory_records_namespace_scope_check'),
  );

  await assert.rejects(
    proposeMemoryRecord(pool, {
      workspaceId: workspaceA,
      userId: ownerB.id,
      agentRunId: null,
      revisionParentId: null,
      namespace: `user/${ownerB.id}/workspace/${workspaceA}/preference/tone`,
      memoryType: 'workspace_user',
      subtype: 'preference.tone',
      authorityClass: 2,
      content: { tone: 'concise' },
      provenance: { userDecisionIds: [randomUUID()] },
      writerKind: 'user',
      writerAgentKey: null,
      writerAgentVersion: null,
      confidenceBps: 10000,
      dataClassification: 'internal',
      observedAt: null,
      refreshAfter: null,
      expiresAt: null,
    }),
    expectPostgresConstraint('23503', 'memory_records_user_workspace_fk'),
  );

  await assert.rejects(
    pool.query(`UPDATE memory_records SET content = '{"tampered":true}'::jsonb WHERE id = $1`, [
      conflictedLeft.id,
    ]),
    expectPostgresConstraint('23514', 'memory_record_content_immutable'),
  );

  const conflictedRight = await proposeMemoryRecord(
    pool,
    curatorMemoryInput({
      workspaceId: workspaceA,
      runId: curatorRunA.id,
      namespace: `workspace/${workspaceA}/research/source-yield`,
      subtype: 'source.yield.alternate',
      content: { yieldBps: 3100 },
    }),
  );
  await activateMemory(conflictedRight.id);
  await pool.query(
    `INSERT INTO memory_conflicts (workspace_id, left_memory_id, right_memory_id, conflict_type)
     VALUES ($1, $2, $3, 'factual.contradiction')`,
    [workspaceA, conflictedLeft.id, conflictedRight.id],
  );

  const cleanMemory = await proposeMemoryRecord(
    pool,
    curatorMemoryInput({
      workspaceId: workspaceA,
      runId: curatorRunA.id,
      namespace: `workspace/${workspaceA}/research/query-pattern`,
      subtype: 'query.pattern',
      content: { pattern: 'industry + locality' },
      expiresAt: new Date('2026-09-30T00:00:00.000Z'),
    }),
  );
  await activateMemory(cleanMemory.id);

  const expiredMemory = await proposeMemoryRecord(
    pool,
    curatorMemoryInput({
      workspaceId: workspaceA,
      runId: curatorRunA.id,
      namespace: `workspace/${workspaceA}/research/expired`,
      subtype: 'expired.sample',
      content: { expired: true },
      expiresAt: new Date('2026-08-31T15:59:59.000Z'),
    }),
  );
  await activateMemory(expiredMemory.id);

  const activeMemory = await listActiveMemoryForContext(pool, {
    workspaceId: workspaceA,
    userId: ownerA.id,
    namespacePrefixes: [`workspace/${workspaceA}/research/`],
    memoryTypes: ['research'],
    limit: 32,
    now: new Date('2026-08-31T16:00:00.000Z'),
  });
  assert.deepEqual(activeMemory.map((memory) => memory.id), [cleanMemory.id]);

  assert.deepEqual(
    await listActiveMemoryForContext(pool, {
      workspaceId: workspaceB,
      userId: ownerB.id,
      namespacePrefixes: [],
      memoryTypes: ['research'],
      now: new Date('2026-08-31T16:00:00.000Z'),
    }),
    [],
  );

  await assert.rejects(
    listActiveMemoryForContext(pool, {
      workspaceId: workspaceA,
      userId: ownerA.id,
      namespacePrefixes: ['workspace/../unsafe'],
      memoryTypes: ['research'],
    }),
    expectAgentMemoryCode('INVALID_NAMESPACE_PREFIX'),
  );

  const contextRunA = await createAgentRun(pool, {
    workspaceId: workspaceA,
    requestedByMembershipId: bootstrapA.membershipId,
    parentRunId: curatorRunA.id,
    agentKey: contextDefinition.key,
    agentVersion: contextDefinition.version,
    definitionHash: hashAgentDefinition(contextDefinition),
    input: { objective: 'build-context' },
  });
  const memoryCandidate = activeMemory[0];
  assert.ok(memoryCandidate);

  const selection = buildContextSelection({
    definition: contextDefinition,
    workspaceId: workspaceA,
    userId: ownerA.id,
    tokenBudget: 500,
    now: new Date('2026-08-31T16:00:00.000Z'),
    candidates: [
      {
        sourceKind: 'policy',
        referenceType: 'policy.snapshot',
        referenceId: 'policy-v1',
        workspaceId: null,
        userId: null,
        required: true,
        authorityClass: 1,
        relevanceBps: 10000,
        confidenceBps: 10000,
        tokenCost: 100,
      },
      {
        sourceKind: 'memory',
        referenceType: 'memory.record',
        referenceId: memoryCandidate.id,
        workspaceId: workspaceA,
        userId: null,
        required: false,
        authorityClass: memoryCandidate.authorityClass,
        relevanceBps: 9000,
        confidenceBps: memoryCandidate.confidenceBps,
        tokenCost: 120,
        memoryStatus: 'active',
        conflicted: false,
        observedAt: memoryCandidate.observedAt?.toISOString() ?? null,
        expiresAt: memoryCandidate.expiresAt?.toISOString() ?? null,
      },
    ],
  });
  assert.deepEqual(selection.selectedItems.map((item) => item.referenceId), ['policy-v1', cleanMemory.id]);

  await assert.rejects(
    persistContextReceipt(pool, {
      workspaceId: workspaceA,
      agentRunId: contextRunA.id,
      agentKey: curatorDefinition.key,
      agentVersion: curatorDefinition.version,
      contextVersion: contextDefinition.contextVersion,
      tokenBudget: 500,
      selectedTokenCost: selection.selectedTokenCost,
      selectedItems: selection.selectedItems,
      selectionDigest: selection.selectionDigest,
    }),
    expectPostgresConstraint('23503', 'context_receipts_run_definition_workspace_fk'),
  );

  const receiptId = await persistContextReceipt(pool, {
    workspaceId: workspaceA,
    agentRunId: contextRunA.id,
    agentKey: contextDefinition.key,
    agentVersion: contextDefinition.version,
    contextVersion: contextDefinition.contextVersion,
    tokenBudget: 500,
    selectedTokenCost: selection.selectedTokenCost,
    selectedItems: selection.selectedItems,
    selectionDigest: selection.selectionDigest,
  });
  assert.ok(receiptId);

  await assert.rejects(
    pool.query(`UPDATE context_receipts SET token_budget = token_budget + 1 WHERE id = $1`, [receiptId]),
    expectPostgresConstraint('23514', 'context_receipt_immutable'),
  );

  await pool.query(`UPDATE memory_records SET status = 'rejected', updated_at = now() WHERE id = $1`, [
    cleanMemory.id,
  ]);
  await assert.rejects(
    pool.query(`UPDATE memory_records SET status = 'active', updated_at = now() WHERE id = $1`, [
      cleanMemory.id,
    ]),
    expectPostgresConstraint('23514', 'memory_record_terminal_state_immutable'),
  );

  assert.equal(await rollbackLatestMigration(pool, migrationsDir), '0003_agent_memory_foundation');
  assert.equal((await probeDatabase(pool)).schemaReady, false);
  const rollbackState = await pool.query(`
    SELECT
      to_regclass('public.agent_runs')::text AS agent_runs,
      to_regclass('public.memory_records')::text AS memory_records,
      to_regclass('public.context_receipts')::text AS context_receipts,
      to_regclass('public.workspace_memberships')::text AS workspace_memberships
  `);
  assert.equal(rollbackState.rows[0]?.agent_runs, null);
  assert.equal(rollbackState.rows[0]?.memory_records, null);
  assert.equal(rollbackState.rows[0]?.context_receipts, null);
  assert.equal(rollbackState.rows[0]?.workspace_memberships, 'workspace_memberships');

  assert.deepEqual(await applyPendingMigrations(pool, migrationsDir), ['0003_agent_memory_foundation']);
  assert.equal((await probeDatabase(pool)).schemaReady, true);

  console.log('Brovexa M01A agent registry / durable memory integration verification passed.');
} finally {
  await resetTestDatabase();
  await pool.end();
}
