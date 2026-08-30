import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import { withPgTransaction } from './client';

const migrationPattern = /^(\d{4}_[a-z0-9_]+)\.up\.sql$/;
const advisoryLockSql = 'SELECT pg_advisory_xact_lock(23082601::bigint)';

interface Migration {
  id: string;
  checksum: string;
  upSql: string;
  downSql: string;
}

async function executeStatements(client: PoolClient, source: string): Promise<void> {
  const statements = source
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) await client.query(statement);
}

async function discoverMigrations(migrationsDir: string): Promise<Migration[]> {
  const filenames = (await readdir(migrationsDir)).filter((name) => migrationPattern.test(name)).sort();
  const migrations: Migration[] = [];

  for (const filename of filenames) {
    const match = migrationPattern.exec(filename);
    if (!match?.[1]) throw new Error(`Invalid migration filename: ${filename}`);

    const id = match[1];
    const upSql = await readFile(join(migrationsDir, filename), 'utf8');
    const downSql = await readFile(join(migrationsDir, 'down', `${id}.down.sql`), 'utf8');
    const checksum = createHash('sha256').update(upSql).digest('hex');
    migrations.push({ id, checksum, upSql, downSql });
  }

  return migrations;
}

async function ensureMigrationJournal(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS brovexa_internal;
    CREATE TABLE IF NOT EXISTS brovexa_internal.schema_migrations (
      id text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

export async function applyPendingMigrations(
  pool: Pool,
  migrationsDir: string,
): Promise<string[]> {
  await ensureMigrationJournal(pool);
  const migrations = await discoverMigrations(migrationsDir);
  const applied: string[] = [];

  for (const migration of migrations) {
    await withPgTransaction(pool, async (client) => {
      await client.query(advisoryLockSql);
      const existing = await client.query<{ checksum: string }>(
        'SELECT checksum FROM brovexa_internal.schema_migrations WHERE id = $1',
        [migration.id],
      );

      const row = existing.rows[0];
      if (row) {
        if (row.checksum !== migration.checksum) {
          throw new Error(`Applied migration checksum mismatch: ${migration.id}`);
        }
        return;
      }

      await executeStatements(client, migration.upSql);
      await client.query(
        'INSERT INTO brovexa_internal.schema_migrations (id, checksum) VALUES ($1, $2)',
        [migration.id, migration.checksum],
      );
      applied.push(migration.id);
    });
  }

  return applied;
}

export async function rollbackLatestMigration(
  pool: Pool,
  migrationsDir: string,
): Promise<string | null> {
  await ensureMigrationJournal(pool);
  const migrations = await discoverMigrations(migrationsDir);
  const byId = new Map(migrations.map((migration) => [migration.id, migration]));
  let rolledBack: string | null = null;

  await withPgTransaction(pool, async (client) => {
    await client.query(advisoryLockSql);
    const latest = await client.query<{ id: string; checksum: string }>(
      `SELECT id, checksum
       FROM brovexa_internal.schema_migrations
       ORDER BY applied_at DESC, id DESC
       LIMIT 1`,
    );

    const row = latest.rows[0];
    if (!row) return;

    const migration = byId.get(row.id);
    if (!migration) throw new Error(`Rollback SQL missing for applied migration: ${row.id}`);
    if (migration.checksum !== row.checksum) {
      throw new Error(`Applied migration checksum mismatch: ${row.id}`);
    }

    await executeStatements(client, migration.downSql);
    await client.query('DELETE FROM brovexa_internal.schema_migrations WHERE id = $1', [row.id]);
    rolledBack = row.id;
  });

  return rolledBack;
}
