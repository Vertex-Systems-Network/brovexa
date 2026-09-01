import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import {
  applyPendingMigrations,
  createDatabase,
  createPgPool,
  probeDatabase,
  rollbackLatestMigration,
  withPgTransaction,
  workspacePreferences,
  workspaces,
} from '../packages/db/dist/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for database integration verification.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for destructive test reset.');
}

const migrationsDir = resolve('packages/db/migrations');
const pool = createPgPool({ connectionString, max: 4 });
const db = createDatabase(pool);

const expectedMigrations = [
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
];

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

async function resetTestDatabase() {
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

try {
  const identity = await pool.query('SELECT current_database() AS name');
  const databaseName = identity.rows[0]?.name;
  assert.ok(databaseName?.endsWith('_test'), `Refusing destructive verification against database: ${databaseName}`);

  await resetTestDatabase();

  const applied = await applyPendingMigrations(pool, migrationsDir);
  assert.deepEqual(applied, expectedMigrations);

  const probe = await probeDatabase(pool);
  assert.equal(probe.serverMajor, 18, `Expected PostgreSQL 18.x, received ${probe.serverVersion}`);
  assert.equal(probe.schemaReady, true);

  const inserted = await db
    .insert(workspaces)
    .values({ slug: 'm01-verification', displayName: 'M01 Verification' })
    .returning({ id: workspaces.id });
  const workspaceId = inserted[0]?.id;
  assert.ok(workspaceId);

  await db.insert(workspacePreferences).values({ workspaceId, timezone: 'UTC', locale: 'en' });

  await assert.rejects(
    async () => {
      await db.insert(workspaces).values({ slug: 'm01-verification', displayName: 'Duplicate' });
    },
    expectPostgresConstraint('23505', 'workspaces_slug_unique'),
  );

  await assert.rejects(
    async () => {
      await db.insert(workspacePreferences).values({
        workspaceId: randomUUID(),
        timezone: 'UTC',
        locale: 'en',
      });
    },
    expectPostgresConstraint('23503', 'workspace_preferences_workspace_id_workspaces_id_fk'),
  );

  await assert.rejects(
    withPgTransaction(pool, async (client) => {
      await client.query(
        `INSERT INTO workspaces (slug, display_name) VALUES ('rollback-verification', 'Rollback Verification')`,
      );
      throw new Error('rollback-sentinel');
    }),
    /rollback-sentinel/,
  );
  const rolledBackRecord = await pool.query(
    `SELECT count(*)::int AS count FROM workspaces WHERE slug = 'rollback-verification'`,
  );
  assert.equal(rolledBackRecord.rows[0]?.count, 0);

  await pool.query('DELETE FROM workspaces WHERE id = $1', [workspaceId]);
  const preferenceCount = await pool.query(
    'SELECT count(*)::int AS count FROM workspace_preferences WHERE workspace_id = $1',
    [workspaceId],
  );
  assert.equal(preferenceCount.rows[0]?.count, 0);

  assert.equal(await rollbackLatestMigration(pool, migrationsDir), '0009_connector_execution_safety');
  assert.equal((await probeDatabase(pool)).schemaReady, false);
  assert.deepEqual(await applyPendingMigrations(pool, migrationsDir), ['0009_connector_execution_safety']);
  assert.equal((await probeDatabase(pool)).schemaReady, true);

  assert.equal(await rollbackLatestMigration(pool, migrationsDir), '0009_connector_execution_safety');
  assert.equal(await rollbackLatestMigration(pool, migrationsDir), '0008_source_task_preflight');
  assert.equal(await rollbackLatestMigration(pool, migrationsDir), '0007_source_registry_foundation');
  assert.equal(await rollbackLatestMigration(pool, migrationsDir), '0006_agent_execution_plan');
  assert.equal(await rollbackLatestMigration(pool, migrationsDir), '0005_agent_memory_lifecycle');
  assert.equal(await rollbackLatestMigration(pool, migrationsDir), '0004_memory_evaluation_core');
  assert.equal(await rollbackLatestMigration(pool, migrationsDir), '0003_agent_runtime_core');
  assert.equal((await probeDatabase(pool)).schemaReady, false);
  assert.equal(await rollbackLatestMigration(pool, migrationsDir), '0002_identity_authorization_foundation');
  assert.equal(await rollbackLatestMigration(pool, migrationsDir), '0001_job_execution_foundation');
  assert.equal(await rollbackLatestMigration(pool, migrationsDir), '0000_workspace_foundation');

  const afterRollback = await pool.query(`
    SELECT
      to_regclass('public.workspaces')::text AS workspaces,
      to_regclass('public.users')::text AS users,
      to_regclass('public.job_runs')::text AS job_runs,
      to_regclass('public.job_work_units')::text AS job_work_units,
      to_regclass('public.agent_definitions')::text AS agent_definitions,
      to_regclass('public.agent_context_receipts')::text AS agent_context_receipts,
      to_regclass('public.agent_runs')::text AS agent_runs,
      to_regclass('public.agent_run_transitions')::text AS agent_run_transitions,
      to_regclass('public.memory_records')::text AS memory_records,
      to_regclass('public.memory_record_lifecycle_events')::text AS memory_record_lifecycle_events,
      to_regclass('public.agent_eval_results')::text AS agent_eval_results,
      to_regclass('public.agent_execution_plans')::text AS agent_execution_plans,
      to_regclass('public.source_capabilities')::text AS source_capabilities,
      to_regclass('public.connector_policies')::text AS connector_policies,
      to_regclass('public.connector_definitions')::text AS connector_definitions,
      to_regclass('public.source_admission_snapshots')::text AS source_admission_snapshots,
      to_regclass('public.research_job_preflights')::text AS research_job_preflights,
      to_regclass('public.source_tasks')::text AS source_tasks,
      to_regclass('public.source_task_usage_events')::text AS source_task_usage_events,
      to_regclass('public.connector_health_snapshots')::text AS connector_health_snapshots
  `);
  assert.equal(afterRollback.rows[0]?.workspaces, null);
  assert.equal(afterRollback.rows[0]?.users, null);
  assert.equal(afterRollback.rows[0]?.job_runs, null);
  assert.equal(afterRollback.rows[0]?.job_work_units, null);
  assert.equal(afterRollback.rows[0]?.agent_definitions, null);
  assert.equal(afterRollback.rows[0]?.agent_context_receipts, null);
  assert.equal(afterRollback.rows[0]?.agent_runs, null);
  assert.equal(afterRollback.rows[0]?.agent_run_transitions, null);
  assert.equal(afterRollback.rows[0]?.memory_records, null);
  assert.equal(afterRollback.rows[0]?.memory_record_lifecycle_events, null);
  assert.equal(afterRollback.rows[0]?.agent_eval_results, null);
  assert.equal(afterRollback.rows[0]?.agent_execution_plans, null);
  assert.equal(afterRollback.rows[0]?.source_capabilities, null);
  assert.equal(afterRollback.rows[0]?.connector_policies, null);
  assert.equal(afterRollback.rows[0]?.connector_definitions, null);
  assert.equal(afterRollback.rows[0]?.source_admission_snapshots, null);
  assert.equal(afterRollback.rows[0]?.research_job_preflights, null);
  assert.equal(afterRollback.rows[0]?.source_tasks, null);
  assert.equal(afterRollback.rows[0]?.source_task_usage_events, null);
  assert.equal(afterRollback.rows[0]?.connector_health_snapshots, null);

  const reapplied = await applyPendingMigrations(pool, migrationsDir);
  assert.deepEqual(reapplied, expectedMigrations);
  assert.equal((await probeDatabase(pool)).schemaReady, true);

  console.log('Brovexa PostgreSQL 18 migration/data-layer integration verification passed.');
} finally {
  await resetTestDatabase();
  await pool.end();
}

await import('./verify-agent-persistence.mjs');
await import('./verify-memory-evaluation.mjs');
await import('./verify-agent-memory-lifecycle.mjs');
await import('./verify-agent-context-runtime.mjs');
await import('./verify-agent-execution-plan.mjs');
await import('./verify-agent-plan-dispatcher.mjs');
await import('./verify-agent-execution-aggregation.mjs');
await import('./verify-agent-evaluator-decision.mjs');
await import('./verify-agent-runtime-hardening.mjs');
await import('./verify-source-registry.mjs');
await import('./verify-source-task-preflight.mjs');
await import('./verify-connector-execution-safety.mjs');
