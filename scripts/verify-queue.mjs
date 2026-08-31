import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  applyPendingMigrations,
  claimWorkUnit,
  countWorkEffects,
  createCanonicalWork,
  createPgPool,
  getWorkUnitStatus,
  requestWorkCancellation,
} from '../packages/db/dist/index.js';
import {
  BROVEXA_WORK_QUEUE,
  createWorkQueue,
  ensureWorkDelivery,
  parseQueueRedisUrl,
} from '../packages/queue/dist/index.js';
import {
  CancelledWorkError,
  PermanentWorkError,
  RetryableWorkError,
} from '../apps/worker/dist/errors.js';
import { createCanonicalWorkerRuntime } from '../apps/worker/dist/runtime.js';

const databaseUrl = process.env.DATABASE_URL;
const queueRedisUrl = process.env.QUEUE_REDIS_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for queue integration verification.');
if (!queueRedisUrl) throw new Error('QUEUE_REDIS_URL is required for queue integration verification.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for destructive queue verification.');
}

const pool = createPgPool({ connectionString: databaseUrl, max: 6 });
const connection = parseQueueRedisUrl(queueRedisUrl);
const migrationsDir = resolve('packages/db/migrations');
const correlationIdsSeen = new Set();

async function waitFor(label, predicate, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  throw new Error(`Timed out waiting for ${label}.`);
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

let runtime;
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

  const workspace = await pool.query(
    `INSERT INTO workspaces (slug, display_name) VALUES ('queue-verification', 'Queue Verification') RETURNING id`,
  );
  const workspaceId = workspace.rows[0]?.id;
  assert.ok(workspaceId);

  const setupQueue = createWorkQueue(connection);
  await setupQueue.waitUntilReady();
  await setupQueue.obliterate({ force: true });
  await setupQueue.close();

  const handlers = {
    'foundation.retry-once': async (context) => {
      correlationIdsSeen.add(context.correlationId);
      if (context.attempt === 1) throw new RetryableWorkError('TEST_TRANSIENT');
      return { effectKey: 'retry-once.effect', effectData: { attempt: context.attempt } };
    },
    'foundation.recover': async (context) => {
      correlationIdsSeen.add(context.correlationId);
      return {
        effectKey: 'recovery.effect',
        effectData: { attempt: context.attempt },
      };
    },
    'foundation.permanent': async () => {
      throw new PermanentWorkError('TEST_PERMANENT');
    },
    'foundation.retry-exhaust': async () => {
      throw new RetryableWorkError('TEST_ALWAYS_RETRY');
    },
    'foundation.cancelled': async () => {
      throw new CancelledWorkError();
    },
  };

  runtime = await createCanonicalWorkerRuntime({
    pool,
    connection,
    handlers,
    workerId: 'ci-worker-1',
    leaseSeconds: 1,
    retryBaseDelayMs: 10,
    retryMaxDelayMs: 25,
  });

  const retryWork = await createCanonicalWork(pool, {
    workspaceId,
    jobType: 'foundation.retry-once',
    workType: 'foundation.retry-once',
    idempotencyKey: 'retry-once-1',
    queueName: BROVEXA_WORK_QUEUE,
    maxAttempts: 3,
  });
  const duplicateRetryWork = await createCanonicalWork(pool, {
    workspaceId,
    jobType: 'foundation.retry-once',
    workType: 'foundation.retry-once',
    idempotencyKey: 'retry-once-1',
    queueName: BROVEXA_WORK_QUEUE,
    maxAttempts: 3,
  });
  assert.equal(duplicateRetryWork.created, false);
  assert.equal(duplicateRetryWork.jobRunId, retryWork.jobRunId);
  assert.equal(duplicateRetryWork.workUnitId, retryWork.workUnitId);

  await ensureWorkDelivery(runtime.queue, {
    workUnitId: retryWork.workUnitId,
    correlationId: retryWork.correlationId,
    deliveryAttempt: 1,
  });

  await waitFor('idempotent retry success', async () =>
    (await getWorkUnitStatus(pool, retryWork.workUnitId))?.status === 'succeeded',
  );
  assert.equal((await getWorkUnitStatus(pool, retryWork.workUnitId))?.attemptCount, 2);
  assert.equal(await countWorkEffects(pool, retryWork.workUnitId), 1);
  assert.equal(
    correlationIdsSeen.has(retryWork.correlationId),
    true,
    'Canonical PostgreSQL correlation ID must survive queue delivery and reach the worker handler.',
  );

  await ensureWorkDelivery(runtime.queue, {
    workUnitId: retryWork.workUnitId,
    correlationId: retryWork.correlationId,
    deliveryAttempt: 3,
  });
  await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  assert.equal(await countWorkEffects(pool, retryWork.workUnitId), 1);

  const recoveryWork = await createCanonicalWork(pool, {
    workspaceId,
    jobType: 'foundation.recover',
    workType: 'foundation.recover',
    idempotencyKey: 'recovery-1',
    queueName: BROVEXA_WORK_QUEUE,
  });
  assert.ok(await claimWorkUnit(pool, recoveryWork.workUnitId, 'crashed-worker', 1, 1));
  await pool.query(
    `UPDATE job_work_units SET lease_expires_at = now() - interval '1 second' WHERE id = $1`,
    [recoveryWork.workUnitId],
  );
  assert.equal(await runtime.reconcile(), 1);
  await waitFor('PostgreSQL restart recovery', async () =>
    (await getWorkUnitStatus(pool, recoveryWork.workUnitId))?.status === 'succeeded',
  );
  assert.equal((await getWorkUnitStatus(pool, recoveryWork.workUnitId))?.attemptCount, 2);
  assert.equal(await countWorkEffects(pool, recoveryWork.workUnitId), 1);
  assert.equal(
    correlationIdsSeen.has(recoveryWork.correlationId),
    true,
    'Recovered work must preserve its canonical correlation ID through redelivery.',
  );

  const cancelledWork = await createCanonicalWork(pool, {
    workspaceId,
    jobType: 'foundation.cancelled',
    workType: 'foundation.cancelled',
    idempotencyKey: 'cancelled-1',
    queueName: BROVEXA_WORK_QUEUE,
  });
  assert.equal(await requestWorkCancellation(pool, cancelledWork.workUnitId), 'cancelled');
  assert.equal(await runtime.reconcile(), 0);
  assert.equal((await getWorkUnitStatus(pool, cancelledWork.workUnitId))?.status, 'cancelled');
  assert.equal(await countWorkEffects(pool, cancelledWork.workUnitId), 0);

  const permanentWork = await createCanonicalWork(pool, {
    workspaceId,
    jobType: 'foundation.permanent',
    workType: 'foundation.permanent',
    idempotencyKey: 'permanent-1',
    queueName: BROVEXA_WORK_QUEUE,
  });
  await ensureWorkDelivery(runtime.queue, {
    workUnitId: permanentWork.workUnitId,
    correlationId: permanentWork.correlationId,
    deliveryAttempt: 1,
  });
  await waitFor('permanent failure review state', async () =>
    (await getWorkUnitStatus(pool, permanentWork.workUnitId))?.status === 'review',
  );

  const exhaustedWork = await createCanonicalWork(pool, {
    workspaceId,
    jobType: 'foundation.retry-exhaust',
    workType: 'foundation.retry-exhaust',
    idempotencyKey: 'retry-exhaust-1',
    queueName: BROVEXA_WORK_QUEUE,
    maxAttempts: 2,
  });
  await ensureWorkDelivery(runtime.queue, {
    workUnitId: exhaustedWork.workUnitId,
    correlationId: exhaustedWork.correlationId,
    deliveryAttempt: 1,
  });
  await waitFor('dead-letter state after exhausted retries', async () =>
    (await getWorkUnitStatus(pool, exhaustedWork.workUnitId))?.status === 'dead_letter',
  );
  assert.equal((await getWorkUnitStatus(pool, exhaustedWork.workUnitId))?.attemptCount, 2);

  const readiness = await runtime.readiness();
  assert.equal(readiness.ready, true);
  assert.equal(readiness.database.serverMajor, 18);
  assert.equal(readiness.database.schemaReady, true);

  console.log('Brovexa canonical worker + BullMQ/Valkey integration verification passed.');
} finally {
  await runtime?.close();
  await resetDatabase();
  await pool.end();
}
