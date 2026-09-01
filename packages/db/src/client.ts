import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient, type PoolConfig } from 'pg';
import * as agentSchema from './agent-schema';
import * as connectorHealthSchema from './connector-health-schema';
import * as coreSchema from './schema';
import * as sourceSchema from './source-schema';
import * as sourceTaskSchema from './source-task-schema';

const schema = { ...coreSchema, ...agentSchema, ...sourceSchema, ...sourceTaskSchema, ...connectorHealthSchema };

export type BrovexaDatabase = NodePgDatabase<typeof schema>;

export interface DatabaseProbe {
  serverVersion: string;
  serverMajor: number;
  schemaReady: boolean;
}

export function createPgPool(config: PoolConfig & { connectionString: string }): Pool {
  return new Pool({
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ...config,
  });
}

export function createDatabase(pool: Pool): BrovexaDatabase {
  return drizzle(pool, { schema });
}

export async function withPgTransaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function probeDatabase(pool: Pool): Promise<DatabaseProbe> {
  const result = await pool.query<{
    server_version: string;
    server_version_num: string;
    schema_ready: boolean;
  }>(`
    SELECT
      current_setting('server_version') AS server_version,
      current_setting('server_version_num') AS server_version_num,
      to_regclass('public.workspaces') IS NOT NULL
        AND to_regclass('public.users') IS NOT NULL
        AND to_regclass('public.workspace_memberships') IS NOT NULL
        AND to_regclass('public.permissions') IS NOT NULL
        AND to_regclass('public.workspace_roles') IS NOT NULL
        AND to_regclass('public.workspace_membership_roles') IS NOT NULL
        AND to_regclass('public.workspace_role_permissions') IS NOT NULL
        AND to_regclass('public.authorization_audit_events') IS NOT NULL
        AND to_regclass('public.job_runs') IS NOT NULL
        AND to_regclass('public.job_work_units') IS NOT NULL
        AND to_regclass('public.job_effects') IS NOT NULL
        AND to_regclass('public.agent_definitions') IS NOT NULL
        AND to_regclass('public.agent_context_receipts') IS NOT NULL
        AND to_regclass('public.agent_runs') IS NOT NULL
        AND to_regclass('public.agent_run_transitions') IS NOT NULL
        AND to_regclass('public.memory_records') IS NOT NULL
        AND to_regclass('public.memory_record_lifecycle_events') IS NOT NULL
        AND to_regclass('public.agent_eval_results') IS NOT NULL
        AND to_regclass('public.agent_execution_plans') IS NOT NULL
        AND to_regclass('public.source_capabilities') IS NOT NULL
        AND to_regclass('public.connector_policies') IS NOT NULL
        AND to_regclass('public.connector_definitions') IS NOT NULL
        AND to_regclass('public.source_admission_snapshots') IS NOT NULL
        AND to_regclass('public.research_job_preflights') IS NOT NULL
        AND to_regclass('public.source_tasks') IS NOT NULL
        AND to_regclass('public.source_task_usage_events') IS NOT NULL
        AND to_regclass('public.connector_health_snapshots') IS NOT NULL
        AS schema_ready
  `);

  const row = result.rows[0];
  if (!row) throw new Error('Database probe returned no rows.');

  return {
    serverVersion: row.server_version,
    serverMajor: Math.floor(Number(row.server_version_num) / 10_000),
    schemaReady: row.schema_ready,
  };
}
