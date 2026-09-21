import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  createPgPool,
  rollbackLatestMigration,
} from '../packages/db/dist/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for identity verification preflight.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for identity verification preflight.');
}

const targetMigration = '0014_canonical_entity_resolution_persistence';
const migrationsDir = resolve('packages/db/migrations');
const pool = createPgPool({ connectionString, max: 2 });

try {
  const identity = await pool.query('SELECT current_database() AS name');
  const databaseName = identity.rows[0]?.name;
  assert.ok(databaseName?.endsWith('_test'), `Refusing identity preflight against database: ${databaseName}`);

  const journal = await pool.query(
    `SELECT to_regclass('brovexa_internal.schema_migrations')::text AS relation`,
  );
  if (journal.rows[0]?.relation) {
    const applied = await pool.query(
      `SELECT id
       FROM brovexa_internal.schema_migrations
       ORDER BY applied_at DESC, id DESC`,
    );
    const appliedIds = applied.rows.map((row) => row.id);
    if (appliedIds.includes(targetMigration)) {
      const rolledBack = [];
      while (true) {
        const migrationId = await rollbackLatestMigration(pool, migrationsDir);
        if (migrationId === null) {
          throw new Error(`Migration journal lost ${targetMigration} before rollback reached it.`);
        }
        rolledBack.push(migrationId);
        if (migrationId === targetMigration) break;
      }
      console.log(
        `Brovexa identity verification preflight rolled back migration tail: ${rolledBack.join(', ')}`,
      );
    }
  }
} finally {
  await pool.end();
}

await import('./verify-identity.mjs');
