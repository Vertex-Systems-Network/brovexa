import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  AgentPersistenceConflictError,
  applyPendingMigrations,
  createPgPool,
  deleteMemoryRecord,
  getAgentRunEnvelope,
  getAgentRunTransitionHistory,
  getMemoryLifecycleHistory,
  getMemoryRecordEnvelope,
  persistAgentDefinition,
  persistAgentRun,
  persistContextReceipt,
  persistMemoryRecord,
  probeDatabase,
  supersedeMemoryRecord,
  transitionAgentRun,
} from '../packages/db/dist/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for lifecycle verification.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for destructive lifecycle verification.');
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

function expectPersistenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof AgentPersistenceConflictError, `Expected ${expectedCode}.`);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

function later(date, milliseconds) {
  return new Date(date.getTime() + milliseconds);
}

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
    [slug, `Lifecycle ${slug}`],
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
    '0006_agent_execution_plan',
    '0007_source_registry_foundation',
    '0008_source_task_preflight',
  ]);
  assert.equal((await probeDatabase(pool)).schemaReady, true);

  const workspaceA = await createWorkspace('lifecycle-a');
  const workspaceB = await createWorkspace('lifecycle-b');

  const definitionId = await persistAgentDefinition(pool, {
    agentKey: 'agent.control.lifecycle',
    version: '1.0.0',
    status: 'approved',
    autonomyTier: 'T0',
    requiresHumanApproval: false,
    specification: { test: 'lifecycle-verification' },
  });

  await persistContextReceipt(pool, {
    id: 'ctx_lifecycle_a',
    workspaceId: workspaceA,
    agentDefinitionId: definitionId,
    agentKey: 'agent.control.lifecycle',
    agentVersion: '1.0.0',
    receipt: { id: 'ctx_lifecycle_a', workspaceId: workspaceA },
    tokenBudget: 0,
    maxCurrencyMicros: 0,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
  });

  await persistAgentRun(pool, {
    id: 'lifecycle_run_1',
    workspaceId: workspaceA,
    agentDefinitionId: definitionId,
    agentKey: 'agent.control.lifecycle',
    agentVersion: '1.0.0',
    contextReceiptId: 'ctx_lifecycle_a',
    executionMode: 'deterministic',
    status: 'queued',
    envelope: { id: 'lifecycle_run_1', workspaceId: workspaceA, status: 'queued' },
  });

  const initialRunProjection = await pool.query(
    `SELECT updated_at FROM agent_runs WHERE workspace_id = $1 AND id = 'lifecycle_run_1'`,
    [workspaceA],
  );
  const initialRunUpdatedAt = initialRunProjection.rows[0]?.updated_at;
  assert.ok(initialRunUpdatedAt instanceof Date);
  const startAt = later(initialRunUpdatedAt, 1);
  const staleReplayAt = later(startAt, 1);
  const finishAt = later(startAt, 2);
  const terminalEscapeAt = later(finishAt, 1);

  await assert.rejects(
    () =>
      pool.query(
        `UPDATE agent_runs
         SET status = 'running',
             envelope = jsonb_set(envelope, '{status}', '"running"'::jsonb),
             started_at = $2,
             updated_at = $2
         WHERE workspace_id = $1 AND id = 'lifecycle_run_1'`,
        [workspaceA, startAt],
      ),
    expectPostgresConstraint('23514', 'agent_runs_lifecycle_projection_guard'),
  );

  const startTransition = {
    transitionId: 'transition_run_started',
    workspaceId: workspaceA,
    runId: 'lifecycle_run_1',
    fromStatus: 'queued',
    toStatus: 'running',
    reasonCode: 'worker_claimed',
    actorType: 'worker',
    actorId: 'ci-worker',
    metadata: { queue: 'verification' },
    occurredAt: startAt,
  };

  assert.equal(await transitionAgentRun(pool, startTransition), startTransition.transitionId);
  assert.equal(await transitionAgentRun(pool, startTransition), startTransition.transitionId);
  const runningEnvelope = await getAgentRunEnvelope(pool, workspaceA, 'lifecycle_run_1');
  assert.equal(runningEnvelope?.status, 'running');
  assert.equal(runningEnvelope?.startedAt, startAt.toISOString());
  assert.equal((await getAgentRunTransitionHistory(pool, workspaceA, 'lifecycle_run_1')).length, 1);
  assert.deepEqual(await getAgentRunTransitionHistory(pool, workspaceB, 'lifecycle_run_1'), []);

  await assert.rejects(
    () => transitionAgentRun(pool, { ...startTransition, toStatus: 'blocked' }),
    expectPersistenceCode('AGENT_RUN_TRANSITION_ID_CONFLICT'),
  );
  await assert.rejects(
    () =>
      transitionAgentRun(pool, {
        ...startTransition,
        transitionId: 'transition_stale_replay',
        occurredAt: staleReplayAt,
      }),
    expectPersistenceCode('AGENT_RUN_STATUS_CONFLICT'),
  );

  const finishTransition = {
    transitionId: 'transition_run_succeeded',
    workspaceId: workspaceA,
    runId: 'lifecycle_run_1',
    fromStatus: 'running',
    toStatus: 'succeeded',
    reasonCode: 'deterministic_validation_passed',
    actorType: 'system',
    metadata: { validator: 'lifecycle-ci' },
    occurredAt: finishAt,
  };
  assert.equal(await transitionAgentRun(pool, finishTransition), finishTransition.transitionId);
  const succeededEnvelope = await getAgentRunEnvelope(pool, workspaceA, 'lifecycle_run_1');
  assert.equal(succeededEnvelope?.status, 'succeeded');
  assert.equal(succeededEnvelope?.completedAt, finishAt.toISOString());
  assert.equal((await getAgentRunTransitionHistory(pool, workspaceA, 'lifecycle_run_1')).length, 2);

  await assert.rejects(
    () =>
      transitionAgentRun(pool, {
        ...finishTransition,
        transitionId: 'transition_terminal_escape',
        fromStatus: 'succeeded',
        toStatus: 'running',
        occurredAt: terminalEscapeAt,
      }),
    expectPersistenceCode('AGENT_RUN_TERMINAL'),
  );

  await assert.rejects(
    () =>
      pool.query(
        `UPDATE agent_run_transitions
         SET reason_code = 'tampered'
         WHERE id = $1`,
        [startTransition.transitionId],
      ),
    expectPostgresConstraint('23514', 'agent_run_transitions_append_only'),
  );

  const parentMemory = {
    id: 'memory_lifecycle_parent',
    version: '1.0.0',
    namespace: `workspace/${workspaceA}/business/company-1`,
    workspaceId: workspaceA,
    entityId: 'company-1',
    memoryType: 'semantic',
    subtype: 'business_profile',
    writer: 'curator',
    aiDerived: false,
    confidence: 1,
    authority: 'verified_fact',
    status: 'active',
    retentionPolicyId: 'retention.business.v1',
    dataClassification: 'BUSINESS_DATA',
    envelope: {
      id: 'memory_lifecycle_parent',
      version: '1.0.0',
      workspaceId: workspaceA,
      status: 'active',
      content: { legalName: 'Lifecycle Company' },
      updatedAt: '2026-09-01T00:30:00.000Z',
    },
    createdAt: new Date('2026-09-01T00:30:00.000Z'),
    updatedAt: new Date('2026-09-01T00:30:00.000Z'),
  };
  await persistMemoryRecord(pool, parentMemory);

  const successor = {
    ...parentMemory,
    id: 'memory_lifecycle_successor',
    version: '1.1.0',
    revisionParentId: parentMemory.id,
    envelope: {
      ...parentMemory.envelope,
      id: 'memory_lifecycle_successor',
      version: '1.1.0',
      revisionParentId: parentMemory.id,
      status: 'active',
      content: { legalName: 'Lifecycle Company Ltd.' },
      updatedAt: '2026-09-01T01:10:00.000Z',
    },
    createdAt: new Date('2026-09-01T01:10:00.000Z'),
    updatedAt: new Date('2026-09-01T01:10:00.000Z'),
  };

  const supersession = {
    eventId: 'memory_event_superseded',
    workspaceId: workspaceA,
    memoryId: parentMemory.id,
    successor,
    reason: 'verified_profile_revision',
    actorType: 'curator',
    actorId: 'ci-curator',
    metadata: { verification: true },
    occurredAt: new Date('2026-09-01T01:10:00.000Z'),
  };

  assert.equal(await supersedeMemoryRecord(pool, supersession), successor.id);
  assert.equal(await supersedeMemoryRecord(pool, supersession), successor.id);
  assert.equal((await getMemoryRecordEnvelope(pool, workspaceA, parentMemory.id))?.status, 'superseded');
  assert.equal((await getMemoryRecordEnvelope(pool, workspaceA, successor.id))?.status, 'active');
  assert.equal((await getMemoryLifecycleHistory(pool, workspaceA, parentMemory.id)).length, 1);
  assert.deepEqual(await getMemoryLifecycleHistory(pool, workspaceB, parentMemory.id), []);

  await assert.rejects(
    () => supersedeMemoryRecord(pool, { ...supersession, reason: 'changed-replay' }),
    expectPersistenceCode('MEMORY_LIFECYCLE_EVENT_ID_CONFLICT'),
  );
  await assert.rejects(
    () =>
      supersedeMemoryRecord(pool, {
        ...supersession,
        eventId: 'memory_cross_workspace_successor',
        successor: {
          ...successor,
          id: 'memory_cross_workspace_successor_record',
          workspaceId: workspaceB,
          namespace: `workspace/${workspaceB}/business/company-1`,
        },
      }),
    expectPersistenceCode('MEMORY_SUCCESSOR_WORKSPACE_CONFLICT'),
  );

  await assert.rejects(
    () =>
      pool.query(
        `UPDATE memory_records
         SET status = 'deleted',
             deletion_reason = 'tampered',
             envelope = jsonb_set(jsonb_set(envelope, '{status}', '"deleted"'::jsonb), '{deletionReason}', '"tampered"'::jsonb),
             updated_at = '2026-09-01T01:11:00.000Z'
         WHERE workspace_id = $1 AND id = $2`,
        [workspaceA, successor.id],
      ),
    expectPostgresConstraint('23514', 'memory_records_lifecycle_projection_guard'),
  );

  const deletion = {
    eventId: 'memory_event_deleted',
    workspaceId: workspaceA,
    memoryId: successor.id,
    reason: 'retention_policy_expired',
    actorType: 'system',
    metadata: { policy: 'retention.business.v1' },
    occurredAt: new Date('2026-09-01T01:20:00.000Z'),
  };
  assert.equal(await deleteMemoryRecord(pool, deletion), successor.id);
  assert.equal(await deleteMemoryRecord(pool, deletion), successor.id);
  const deletedEnvelope = await getMemoryRecordEnvelope(pool, workspaceA, successor.id);
  assert.equal(deletedEnvelope?.status, 'deleted');
  assert.equal(deletedEnvelope?.deletionReason, deletion.reason);
  assert.equal((await getMemoryLifecycleHistory(pool, workspaceA, successor.id)).length, 1);

  await assert.rejects(
    () => deleteMemoryRecord(pool, { ...deletion, eventId: 'memory_event_delete_again' }),
    expectPersistenceCode('MEMORY_TERMINAL'),
  );
  await assert.rejects(
    () => deleteMemoryRecord(pool, { ...deletion, eventId: 'delete_superseded_parent', memoryId: parentMemory.id }),
    expectPersistenceCode('MEMORY_TERMINAL'),
  );

  await assert.rejects(
    () =>
      pool.query(
        `DELETE FROM memory_record_lifecycle_events
         WHERE id = $1`,
        [deletion.eventId],
      ),
    expectPostgresConstraint('23514', 'memory_record_lifecycle_events_append_only'),
  );

  console.log('Brovexa M01A AgentRun transition + memory lifecycle verification passed.');
} finally {
  await resetDatabase();
  await pool.end();
}
