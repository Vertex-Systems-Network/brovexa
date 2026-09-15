import type { Pool, PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  getResearchJobControl,
  transitionResearchJobControl,
} from './research-job-control-persistence';

const workspaceId = '11111111-1111-4111-8111-111111111301';
const researchJobId = 'research-control-adversarial';
const createdAt = new Date('2026-09-16T00:00:00.000Z');
const changedAt = new Date('2026-09-16T00:01:00.000Z');

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
    workspace_id: string;
    research_job_id: string;
    version: number;
    state: 'active' | 'paused' | 'cancelled' | 'killed';
    reason_code: string | null;
    changed_at: Date;
  }> = {},
) {
  return {
    research_job_id: overrides.research_job_id ?? researchJobId,
    workspace_id: overrides.workspace_id ?? workspaceId,
    version: overrides.version ?? 1,
    state: overrides.state ?? 'active',
    reason_code: overrides.reason_code ?? null,
    changed_at: overrides.changed_at ?? createdAt,
    created_at: createdAt,
  };
}

describe('M02A adversarial research job control verification', () => {
  it('reads control state only through the requested workspace boundary', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;

    await getResearchJobControl(pool, workspaceId, researchJobId);

    const [sql, values] = query.mock.calls[0] ?? [];
    expect(String(sql)).toContain('workspace_id = $1::uuid');
    expect(values).toEqual([workspaceId, researchJobId]);
  });

  it('cannot transition a control that is absent from the requested workspace', async () => {
    const handler = vi.fn(async (sql: string, values?: readonly unknown[]) => {
      if (sql.includes('FROM research_job_controls') && sql.includes('FOR UPDATE')) {
        expect(values).toEqual([workspaceId, researchJobId]);
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const pool = transactionPool(handler);

    await expect(
      transitionResearchJobControl(pool, {
        workspaceId,
        researchJobId,
        expectedVersion: 1,
        targetState: 'paused',
        changedAt,
      }),
    ).rejects.toMatchObject({ code: 'RESEARCH_JOB_CONTROL_NOT_FOUND' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('keeps cancelled and killed controls terminal against resume or state rewriting', async () => {
    for (const state of ['cancelled', 'killed'] as const) {
      const handler = vi.fn(async (sql: string) => {
        if (sql.includes('FROM research_job_controls') && sql.includes('FOR UPDATE')) {
          return { rows: [controlRow({ version: 4, state })] };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      });
      const pool = transactionPool(handler);

      await expect(
        transitionResearchJobControl(pool, {
          workspaceId,
          researchJobId,
          expectedVersion: 4,
          targetState: 'active',
          reasonCode: 'operator.resume',
          changedAt,
        }),
      ).rejects.toMatchObject({ code: 'RESEARCH_JOB_CONTROL_INVALID_TRANSITION' });
      expect(handler).toHaveBeenCalledTimes(1);
    }
  });

  it('fails closed if the optimistic update loses a race after the locked read', async () => {
    let updateSeen = false;
    const pool = transactionPool(async (sql) => {
      if (sql.includes('FROM research_job_controls') && sql.includes('FOR UPDATE')) {
        return { rows: [controlRow({ version: 7, state: 'active' })] };
      }
      if (sql.includes('UPDATE research_job_controls')) {
        updateSeen = true;
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    await expect(
      transitionResearchJobControl(pool, {
        workspaceId,
        researchJobId,
        expectedVersion: 7,
        targetState: 'paused',
        reasonCode: 'operator.pause',
        changedAt,
      }),
    ).rejects.toMatchObject({ code: 'RESEARCH_JOB_CONTROL_VERSION_CONFLICT' });
    expect(updateSeen).toBe(true);
  });

  it('rejects timestamp regression before any control mutation', async () => {
    let updateSeen = false;
    const pool = transactionPool(async (sql) => {
      if (sql.includes('FROM research_job_controls') && sql.includes('FOR UPDATE')) {
        return {
          rows: [
            controlRow({
              version: 2,
              state: 'paused',
              changed_at: new Date('2026-09-16T00:05:00.000Z'),
            }),
          ],
        };
      }
      if (sql.includes('UPDATE research_job_controls')) {
        updateSeen = true;
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    await expect(
      transitionResearchJobControl(pool, {
        workspaceId,
        researchJobId,
        expectedVersion: 2,
        targetState: 'active',
        changedAt: new Date('2026-09-16T00:04:59.999Z'),
      }),
    ).rejects.toMatchObject({ code: 'RESEARCH_JOB_CONTROL_TIME_REGRESSION' });
    expect(updateSeen).toBe(false);
  });

  it('rejects malformed reason codes before opening a transaction', async () => {
    const pool = { connect: vi.fn() } as unknown as Pool;

    await expect(
      transitionResearchJobControl(pool, {
        workspaceId,
        researchJobId,
        expectedVersion: 1,
        targetState: 'paused',
        reasonCode: 'operator pause with spaces',
        changedAt,
      }),
    ).rejects.toMatchObject({ code: 'RESEARCH_JOB_CONTROL_INPUT_INVALID' });
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
