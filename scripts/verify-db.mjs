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
  assert.deepEqual(applied, ['0000_workspace_foundation', '0001_job_execution_foundation']);

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

  assert.equal(await rollbackLatestMigration(pool, migrationsDir), '0001_job_execution_foundation');
  assert.equal((await probeDatabase(pool)).schemaReady, false);
  assert.equal((await applyPendingMigrations(pool, migrationsDir))[0], '0001_job_execution_foundation');
  assert.equal((await probeDatabase(pool)).schemaReady, true);

  assert.equal(await rollbackLatestMigration(pool, migrationsDir), '0001_job_execution_foundation');
  assert.equal(await rollbackLatestMigration(pool, migrationsDir), '0000_workspace_foundation');

  const afterRollback = await pool.query(`
    SELECT
      to_regclass('public.workspaces')::text AS workspaces,
      to_regclass('public.job_runs')::text AS job_runs,
      to_regclass('public.job_work_units')::text AS job_work_units
  `);
  assert.equal(afterRollback.rows[0]?.workspaces, null);
  assert.equal(afterRollback.rows[0]?.job_runs, null);
  assert.equal(afterRollback.rows[0]?.job_work_units, null);

  const reapplied = await applyPendingMigrations(pool, migrationsDir);
  assert.deepEqual(reapplied, ['0000_workspace_foundation', '0001_job_execution_foundation']);
  assert.equal((await probeDatabase(pool)).schemaReady, true);

  console.log('Brovexa PostgreSQL 18 migration/data-layer integration verification passed.');
} finally {
  await resetTestDatabase();
  await pool.end();
}
