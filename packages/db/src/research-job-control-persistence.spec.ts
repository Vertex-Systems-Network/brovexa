import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  getResearchJobControl,
  ResearchJobControlPersistenceError,
  transitionResearchJobControl,
} from './research-job-control-persistence';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const researchJobId = 'research-1';
const createdAt = new Date('2026-09-15T09:00:00.000Z');
const changedAt = new Date('2026-09-15T09:01:00.000Z');

function transactionPool(
  handler: (sql: string, values?: readonly unknown[]) => Promise<{ rows: unknown[] }>,
): Pool {
  const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
    return handler(sql, values);
  });
  const client = { query, release: vi.fn() } as unknown as PoolClient;
  return { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
}

function controlRow(
  overrides: Partial<{
    version: number;
    state: 'active' | 'paused' | 'cancelled' | 'killed';
    reason_code: string | null;
    changed_at: Date;
  }> = {},
) {
  return {
    research_job_id: researchJobId,
    workspace_id: workspaceId,
    version: overrides.version ?? 1,
    state: overrides.state ?? 'active',
    reason_code: overrides.reason_code ?? null,
    changed_at: overrides.changed_at ?? createdAt,
    created_at: createdAt,
  };
}

describe('M02A research job acquisition control persistence', () => {
  it('reads control state only through the workspace-scoped identity', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [controlRow()] });
    const pool = { query } as unknown as Pool;

    const result = await getResearchJobControl(pool, workspaceId, researchJobId);

    expect(result).toMatchObject({
      researchJobId,
      workspaceId,
      version: 1,
      state: 'active',
      reasonCode: null,
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('workspace_id = $1::uuid'), [
      workspaceId,
      researchJobId,
    ]);
  });

  it('pauses an active job with optimistic version advancement', async () => {
    const pool = transactionPool(async (sql, values) => {
      if (sql.includes('FROM research_job_controls') && sql.includes('FOR UPDATE')) {
        return { rows: [controlRow()] };
      }
      if (sql.includes('UPDATE research_job_controls')) {
        expect(values).toEqual([
          workspaceId,
          researchJobId,
          1,
          'paused',
          'operator.pause',
          changedAt,
        ]);
        return {
          rows: [
            controlRow({
              version: 2,
              state: 'paused',
              reason_code: 'operator.pause',
              changed_at: changedAt,
            }),
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const result = await transitionResearchJobControl(pool, {
      workspaceId,
      researchJobId,
      expectedVersion: 1,
      targetState: 'paused',
      reasonCode: 'operator.pause',
      changedAt,
    });

    expect(result).toMatchObject({ version: 2, state: 'paused', reasonCode: 'operator.pause' });
  });

  it('resumes a paused job without resetting durable identity', async () => {
    const pool = transactionPool(async (sql) => {
      if (sql.includes('FROM research_job_controls') && sql.includes('FOR UPDATE')) {
        return { rows: [controlRow({ version: 2, state: 'paused' })] };
      }
      if (sql.includes('UPDATE research_job_controls')) {
        return { rows: [controlRow({ version: 3, state: 'active', changed_at: changedAt })] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const result = await transitionResearchJobControl(pool, {
      workspaceId,
      researchJobId,
      expectedVersion: 2,
      targetState: 'active',
      changedAt,
    });

    expect(result).toMatchObject({ researchJobId, workspaceId, version: 3, state: 'active' });
  });

  it('rejects stale optimistic versions before mutation', async () => {
    const handler = vi.fn(async (sql: string) => {
      if (sql.includes('FROM research_job_controls') && sql.includes('FOR UPDATE')) {
        return { rows: [controlRow({ version: 3 })] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const pool = transactionPool(handler);

    await expect(
      transitionResearchJobControl(pool, {
        workspaceId,
        researchJobId,
        expectedVersion: 2,
        targetState: 'paused',
        changedAt,
      }),
    ).rejects.toMatchObject({ code: 'RESEARCH_JOB_CONTROL_VERSION_CONFLICT' });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('rejects terminal-state resume attempts before mutation', async () => {
    const handler = vi.fn(async (sql: string) => {
      if (sql.includes('FROM research_job_controls') && sql.includes('FOR UPDATE')) {
        return { rows: [controlRow({ version: 2, state: 'killed' })] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const pool = transactionPool(handler);

    await expect(
      transitionResearchJobControl(pool, {
        workspaceId,
        researchJobId,
        expectedVersion: 2,
        targetState: 'active',
        changedAt,
      }),
    ).rejects.toMatchObject({ code: 'RESEARCH_JOB_CONTROL_INVALID_TRANSITION' });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('rejects regressive control timestamps', async () => {
    const pool = transactionPool(async (sql) => {
      if (sql.includes('FROM research_job_controls') && sql.includes('FOR UPDATE')) {
        return { rows: [controlRow({ changed_at: changedAt })] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    await expect(
      transitionResearchJobControl(pool, {
        workspaceId,
        researchJobId,
        expectedVersion: 1,
        targetState: 'paused',
        changedAt: new Date('2026-09-15T08:59:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ResearchJobControlPersistenceError);
  });
});

describe('0013 acquisition control migration contract', () => {
  it('adds reversible control state without widening canonical work-unit statuses', async () => {
    const migrationPath = resolve(
      process.cwd(),
      'migrations/0013_acquisition_control_persistence.up.sql',
    );
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE research_job_controls');
    expect(migration).toContain("state text NOT NULL DEFAULT 'active'");
    expect(migration).toContain("state IN ('active', 'paused', 'cancelled', 'killed')");
    expect(migration).toContain('INSERT INTO research_job_controls');
    expect(migration).toContain('AFTER INSERT ON research_jobs');
    expect(migration).toContain('version must advance by exactly one');
    expect(migration).toContain('Terminal research job control state cannot transition');
    expect(migration).toContain('BEFORE INSERT ON acquisition_shards');
    expect(migration).toContain('BEFORE UPDATE OF status, attempt_count, worker_id, lease_expires_at');
    expect(migration).toContain('cancellation_requested_at');
    expect(migration).not.toContain("status IN ('runnable', 'running', 'retry_wait', 'paused'");
  });
});
