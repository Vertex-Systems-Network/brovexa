"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyPendingMigrations = applyPendingMigrations;
exports.rollbackLatestMigration = rollbackLatestMigration;
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const client_1 = require("./client");
const migrationPattern = /^(\d{4}_[a-z0-9_]+)\.up\.sql$/;
const advisoryLockSql = 'SELECT pg_advisory_xact_lock(23082601::bigint)';
async function executeStatements(client, source) {
    const statements = source
        .split('--> statement-breakpoint')
        .map((statement) => statement.trim())
        .filter(Boolean);
    for (const statement of statements)
        await client.query(statement);
}
async function discoverMigrations(migrationsDir) {
    const filenames = (await (0, promises_1.readdir)(migrationsDir)).filter((name) => migrationPattern.test(name)).sort();
    const migrations = [];
    for (const filename of filenames) {
        const match = migrationPattern.exec(filename);
        if (!match?.[1])
            throw new Error(`Invalid migration filename: ${filename}`);
        const id = match[1];
        const upSql = await (0, promises_1.readFile)((0, node_path_1.join)(migrationsDir, filename), 'utf8');
        const downSql = await (0, promises_1.readFile)((0, node_path_1.join)(migrationsDir, 'down', `${id}.down.sql`), 'utf8');
        const checksum = (0, node_crypto_1.createHash)('sha256').update(upSql).digest('hex');
        migrations.push({ id, checksum, upSql, downSql });
    }
    return migrations;
}
async function ensureMigrationJournal(pool) {
    await pool.query(`
    CREATE SCHEMA IF NOT EXISTS brovexa_internal;
    CREATE TABLE IF NOT EXISTS brovexa_internal.schema_migrations (
      id text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}
async function applyPendingMigrations(pool, migrationsDir) {
    await ensureMigrationJournal(pool);
    const migrations = await discoverMigrations(migrationsDir);
    const applied = [];
    for (const migration of migrations) {
        const didApply = await (0, client_1.withPgTransaction)(pool, async (client) => {
            await client.query(advisoryLockSql);
            const existing = await client.query('SELECT checksum FROM brovexa_internal.schema_migrations WHERE id = $1', [migration.id]);
            const row = existing.rows[0];
            if (row) {
                if (row.checksum !== migration.checksum) {
                    throw new Error(`Applied migration checksum mismatch: ${migration.id}`);
                }
                return false;
            }
            await executeStatements(client, migration.upSql);
            await client.query('INSERT INTO brovexa_internal.schema_migrations (id, checksum) VALUES ($1, $2)', [migration.id, migration.checksum]);
            return true;
        });
        if (didApply)
            applied.push(migration.id);
    }
    return applied;
}
async function rollbackLatestMigration(pool, migrationsDir) {
    await ensureMigrationJournal(pool);
    const migrations = await discoverMigrations(migrationsDir);
    const byId = new Map(migrations.map((migration) => [migration.id, migration]));
    return (0, client_1.withPgTransaction)(pool, async (client) => {
        await client.query(advisoryLockSql);
        const latest = await client.query(`SELECT id, checksum
       FROM brovexa_internal.schema_migrations
       ORDER BY applied_at DESC, id DESC
       LIMIT 1`);
        const row = latest.rows[0];
        if (!row)
            return null;
        const migration = byId.get(row.id);
        if (!migration)
            throw new Error(`Rollback SQL missing for applied migration: ${row.id}`);
        if (migration.checksum !== row.checksum) {
            throw new Error(`Applied migration checksum mismatch: ${row.id}`);
        }
        await executeStatements(client, migration.downSql);
        await client.query('DELETE FROM brovexa_internal.schema_migrations WHERE id = $1', [row.id]);
        return row.id;
    });
}
//# sourceMappingURL=migrations.js.map