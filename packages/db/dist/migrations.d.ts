import type { Pool } from 'pg';
export declare function applyPendingMigrations(pool: Pool, migrationsDir: string): Promise<string[]>;
export declare function rollbackLatestMigration(pool: Pool, migrationsDir: string): Promise<string | null>;
