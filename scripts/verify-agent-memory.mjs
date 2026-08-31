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
} from '../packages/agents/dist/index.js';

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
  await pool.query('DROP TABLE IF EXISTS context_receipts CASCADE');
  await pool.query('DROP TABLE IF EXISTS memory_conflicts CASCADE');
  await pool.query('DROP TABLE IF EXISTS memory_records CASCADE');
  await pool.query('DROP TABLE IF EXISTS agent_checkpoints CASCADE');
  await pool.query('DROP TABLE IF EXISTS agent_runs CASCADE');
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

async function createWorkspace(slug, displayName) {
  const result = await pool.query(
    'INSERT INTO workspaces (slug, display_name) VALUES ($1, $2) RETURNING id',
    [slug, displayName],
  );
  const id = result.rows[0]?.id;
  assert.ok(id);
  return id;
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
    {
      scope: 'workspace',
      actions: ['read'],
      memoryTypes: ['semantic', 'episodic', 'research'],
    },
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
    {
      scope: 'system.procedural',
      actions: ['read'],
      memoryTypes: ['procedural'],
    },
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

try {
  const identity = await pool.query('SELECT current_database() AS name');
  const databaseName = identity.rows[0]?.name;
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
  assert.equal(registry.canAccessMemory('agent.control.memory_curator', 1, 'workspace', 'commit', 'research'), true);
  assert.equal(registry.canAccessMemory('agent.control.context', 1, 'workspace', 'commit', 'research'), false);

  const workspaceA = await createWorkspace('agent-memory-a', 'Agent Memory A');
  const workspaceB = await createWorkspace('agent-memory-b', 'Agent Memory B');
  const ownerA = await createIdentityUser(pool);
  const ownerB = await createIdentityUser(pool);
  const ownerBootstrapA = await bootstrapWorkspaceOwner(pool, workspaceA, ownerA);
  const ownerBootstrapB = await bootstrapWorkspaceOwner(pool, workspaceB, ownerB);

  const curatorRunA = await createAgentRun(pool, {
    workspaceId: workspaceA,
    requestedByMembershipId: ownerBootstrapA.membershipId,
    parentRunId: null,
    agentKey: curatorDefinition.key,
    agentVersion: curatorDefinition.version,
    definitionHash: hashAgentDefinition(curatorDefinition),
    input: { objective: 'curate-memory-foundation' },
  });
  assert.equal(curatorRunA.status, 'pending');

  await assert.rejects(
    createAgentRun(pool, {
      workspaceId: workspaceA,
      requestedByMembershipId: ownerBootstrapB.membershipId,
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
    requestedByMembershipId: ownerBootstrapB.membershipId,
    parentRunId: null,
    agentKey: contextDefinition.key,
    agentVersion: contextDefinition.version,
    definitionHash: hashAgentDefinition(contextDefinition),
    input: {},
  });

  await assert.rejects(
    pool.query(
      `INSERT INTO agent_runs (
         workspace_id, parent_run_id, agent_key, agent_version, definition_hash, input
       ) VALUES ($1, $2, $3, 1, $4, '{}'::jsonb)`,
      [workspaceA, contextRunB.id, contextDefinition.key, hashAgentDefinition(contextDefinition)],
    ),
    expectPostgresConstraint('23503', 'agent_runs_parent_workspace_fk'),
  );

  assert.equal(await transitionAgentRunStatus(pool, {
    workspaceId: workspaceA,
    agentRunId: curatorRunA.id,
    nextStatus: 'running',
  }), 'running');
  await assert.rejects(
    transitionAgentRunStatus(pool, {
      workspaceId: workspaceA,
      agentRunId: curatorRunA.id,
      nextStatus: 'pending',
    }),
    expectAgentMemoryCode('INVALID_RUN_TRANSITION'),
  );

  const firstCheckpoint = await appendAgentCheckpoint(pool, {
    workspaceId: workspaceA,
    agentRunId: curatorRunA.id,
    checkpointKey: 'memory.scan',
    state: { completed: 1, pending: 2 },
  });
  const replayCheckpoint = await appendAgentCheckpoint(pool, {
    workspaceId: workspaceA,
    agentRunId: curatorRunA.id,
    checkpointKey: 'memory.scan',
    state: { pending: 2, completed: 1 },
  });
  assert.equal(replayCheckpoint.id, firstCheckpoint.id);
  assert.equal(replayCheckpoint.sequence, 1);
  const secondCheckpoint = await appendAgentCheckpoint(pool, {
    workspaceId: workspaceA,
    agentRunId: curatorRunA.id,
    checkpointKey: 'memory.scan',
    state: { completed: 2, pending: 1 },
  });
  assert.equal(secondCheckpoint.sequence, 2);

  const firstMemory = await proposeMemoryRecord(pool, {
    workspaceId: workspaceA,
    userId: null,
    agentRunId: curatorRunA.id,
    revisionParentId: null,
    namespace: `workspace/${workspaceA}/research/source-yield`,
    memoryType: 'research',
    subtype: 'source.yield',
    authorityClass: 6,
    content: { sourceClass: 'registry', yieldBps: 7200 },
    provenance: { runIds: [curatorRunA.id] },
    writerKind: 'curator',
    writerAgentKey: curatorDefinition.key,
    writerAgentVersion: curatorDefinition.version,
    confidenceBps: 8500,
    dataClassification: 'internal',
    observedAt: new Date('2026-08-31T15:00:00.000Z'),
    refreshAfter: new Date('2026-09-01T15:00:00.000Z'),
    expiresAt: new Date('2026-09-30T00:00:00.000Z'),
  });
  assert.equal(firstMemory.status, 'proposed');
  await pool.query(`UPDATE memory_records SET status = 'active', updated_at = now() WHERE id = $1`, [firstMemory.id]);

  await assert.rejects(
    proposeMemoryRecord(pool, {
      workspaceId: workspaceA,
      userId: null,
      agentRunId: curatorRunA.id,
      revisionParentId: null,
      namespace: `workspace/${workspaceB}/research/cross-tenant`,
      memoryType: 'research',
      subtype: 'tenant.attack',
      authorityClass: 7,
      content: { attempted: true },
      provenance: { runIds: [curatorRunA.id] },
      writerKind: 'curator',
      writerAgentKey: curatorDefinition.key,
      writerAgentVersion: curatorDefinition.version,
      confidenceBps: 1000,
      dataClassification: 'internal',
      observedAt: null,
      refreshAfter: null,
      expiresAt: null,
    }),
    expectPostgresConstraint('23514', 'memory_records_namespace_scope_check'),
  );

  await assert.rejects(
    proposeMemoryRecord(pool, {
      workspaceId: workspaceA,
      userId: ownerB,
      agentRunId: null,
      revisionParentId: null,
      namespace: `user/${ownerB}/workspace/${workspaceA}/preference/tone`,
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
    pool.query(`UPDATE memory_records SET content = '{"tampered":true}'::jsonb WHERE id = $1`, [firstMemory.id]),
    expectPostgresConstraint('23514', 'memory_record_content_immutable'),
  );

  const conflictMemory = await proposeMemoryRecord(pool, {
    workspaceId: workspaceA,
    userId: null,
    agentRunId: curatorRunA.id,
    revisionParentId: null,
    namespace: `workspace/${workspaceA}/research/source-yield`,
    memoryType: 'research',
    subtype: 'source.yield.alternate',
    authorityClass: 6,
    content: { sourceClass: 'registry', yieldBps: 3100 },
    provenance: { runIds: [curatorRunA.id] },
    writerKind: 'curator',
    writerAgentKey: curatorDefinition.key,
    writerAgentVersion: curatorDefinition.version,
    confidenceBps: 8000,
    dataClassification: 'internal',
    observedAt: new Date('2026-08-31T15:05:00.000Z'),
    refreshAfter: null,
    expiresAt: new Date('2026-09-30T00:00:00.000Z'),
  });
  await pool.query(`UPDATE memory_records SET status = 'active', updated_at = now() WHERE id = $1`, [conflictMemory.id]);
  await pool.query(
    `INSERT INTO memory_conflicts (
       workspace_id, left_memory_id, right_memory_id, conflict_type
     ) VALUES ($1, $2, $3, 'factual.contradiction')`,
    [workspaceA, firstMemory.id, conflictMemory.id],
  );

  const cleanMemory = await proposeMemoryRecord(pool, {
    workspaceId: workspaceA,
    userId: null,
    agentRunId: curatorRunA.id,
    revisionParentId: null,
    namespace: `workspace/${workspaceA}/research/query-pattern`,
    memoryType: 'research',
    subtype: 'query.pattern',
    authorityClass: 6,
    content: { pattern: 'industry + locality' },
    provenance: { runIds: [curatorRunA.id] },
    writerKind: 'curator',
    writerAgentKey: curatorDefinition.key,
    writerAgentVersion: curatorDefinition.version,
    confidenceBps: 9000,
    dataClassification: 'internal',
    observedAt: new Date('2026-08-31T15:10:00.000Z'),
    refreshAfter: null,
    expiresAt: new Date('2026-09-30T00:00:00.000Z'),
  });
  await pool.query(`UPDATE memory_records SET status = 'active', updated_at = now() WHERE id = $1`, [cleanMemory.id]);

  const expiredMemory = await proposeMemoryRecord(pool, {
    workspaceId: workspaceA,
    userId: null,
    agentRunId: curatorRunA.id,
    revisionParentId: null,
    namespace: `workspace/${workspaceA}/research/expired`,
    memoryType: 'research',
    subtype: 'query.expired',
    authorityClass: 7,
    content: { expired: true },
    provenance: { runIds: [curatorRunA.id] },
    writerKind: 'curator',
    writerAgentKey: curatorDefinition.key,
    writerAgentVersion: curatorDefinition.version,
    confidenceBps: 9000,
    dataClassification: 'internal',
    observedAt: null,
    refreshAfter: null,
    expiresAt: new Date('2026-08-31T15:59:59.000Z'),
  });
  await pool.query(`UPDATE memory_records SET status = 'active', updated_at = now() WHERE id = $1`, [expiredMemory.id]);

  const userMemory = await proposeMemoryRecord(pool, {
    workspaceId: workspaceA,
    userId: ownerA,
    agentRunId: null,
    revisionParentId: null,
    namespace: `user/${ownerA}/workspace/${workspaceA}/preference/response`,
    memoryType: 'workspace_user',
    subtype: 'preference.response',
    authorityClass: 2,
    content: { density: 'compact' },
    provenance: { userDecisionIds: [randomUUID()] },
    writerKind: 'user',
    writerAgentKey: null,
    writerAgentVersion: null,
    confidenceBps: 10000,
    dataClassification: 'internal',
    observedAt: null,
    refreshAfter: null,
    expiresAt: null,
  });
  await pool.query(`UPDATE memory_records SET status = 'active', updated_at = now() WHERE id = $1`, [userMemory.id]);

  const anonymousContext = await listActiveMemoryForContext(pool, {
    workspaceId: workspaceA,
    userId: null,
    namespacePrefixes: [`workspace/${workspaceA}/`, `user/${ownerA}/workspace/${workspaceA}/`],
    memoryTypes: ['research', 'workspace_user'],
    now: new Date('2026-08-31T16:00:00.000Z'),
  });
  assert.deepEqual(anonymousContext.map((row) => row.id), [cleanMemory.id]);

  const ownerContext = await listActiveMemoryForContext(pool, {
    workspaceId: workspaceA,
    userId: ownerA,
    namespacePrefixes: [`workspace/${workspaceA}/`, `user/${ownerA}/workspace/${workspaceA}/`],
    memoryTypes: ['research', 'workspace_user'],
    now: new Date('2026-08-31T16:00:00.000Z'),
  });
  assert.deepEqual(new Set(ownerContext.map((row) => row.id)), new Set([userMemory.id, cleanMemory.id]));

  const contextRunA = await createAgentRun(pool, {
    workspaceId: workspaceA,
    requestedByMembershipId: ownerBootstrapA.membershipId,
    parentRunId: curatorRunA.id,
    agentKey: contextDefinition.key,
    agentVersion: contextDefinition.version,
    definitionHash: hashAgentDefinition(contextDefinition),
    input: { target: 'context-receipt' },
  });

  const selection = buildContextSelection({
    definition: contextDefinition,
    workspaceId: workspaceA,
    userId: ownerA,
    tokenBudget: 500,
    now: new Date('2026-08-31T16:00:00.000Z'),
    candidates: [
      {
        sourceKind: 'policy',
        referenceType: 'policy.runtime',
        referenceId: 'agent-foundation-v1',
        workspaceId: null,
        userId: null,
        required: true,
        authorityClass: 1,
        relevanceBps: 10000,
        confidenceBps: 10000,
        tokenCost: 100,
      },
      ...ownerContext.map((row) => ({
        sourceKind: 'memory',
        referenceType: 'memory.record',
        referenceId: row.id,
        workspaceId: workspaceA,
        userId: row.id === userMemory.id ? ownerA : null,
        required: false,
        authorityClass: row.authorityClass,
        relevanceBps: 9000,
        confidenceBps: row.confidenceBps,
        tokenCost: 100,
        memoryStatus: 'active',
        conflicted: false,
        observedAt: row.observedAt?.toISOString() ?? null,
        expiresAt: row.expiresAt?.toISOString() ?? null,
      })),
    ],
  });
  assert.equal(selection.selectedItems[0]?.referenceId, 'agent-foundation-v1');
  assert.match(selection.selectionDigest, /^[0-9a-f]{64}$/);

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
    persistContextReceipt(pool, {
      workspaceId: workspaceB,
      agentRunId: contextRunA.id,
      agentKey: contextDefinition.key,
      agentVersion: contextDefinition.version,
      contextVersion: 2,
      tokenBudget: 500,
      selectedTokenCost: 0,
      selectedItems: [],
      selectionDigest: 'a'.repeat(64),
    }),
    expectPostgresConstraint('23503', 'context_receipts_run_definition_workspace_fk'),
  );

  await assert.rejects(
    pool.query(`UPDATE context_receipts SET token_budget = token_budget + 1 WHERE id = $1`, [receiptId]),
    expectPostgresConstraint('23514', 'context_receipt_immutable'),
  );

  await pool.query(`UPDATE memory_records SET status = 'superseded', updated_at = now() WHERE id = $1`, [cleanMemory.id]);
  await assert.rejects(
    pool.query(`UPDATE memory_records SET status = 'active', updated_at = now() WHERE id = $1`, [cleanMemory.id]),
    expectPostgresConstraint('23514', 'memory_record_terminal_state_immutable'),
  );

  assert.equal(await rollbackLatestMigration(pool, migrationsDir), '0003_agent_memory_foundation');
  assert.equal((await probeDatabase(pool)).schemaReady, false);
  assert.deepEqual(await applyPendingMigrations(pool, migrationsDir), ['0003_agent_memory_foundation']);
  assert.equal((await probeDatabase(pool)).schemaReady, true);

  console.log('Brovexa M01A agent registry/memory PostgreSQL integration verification passed.');
} finally {
  await resetTestDatabase();
  await pool.end();
}
