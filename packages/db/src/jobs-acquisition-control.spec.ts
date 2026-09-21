import type { Pool, PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { claimWorkUnit, listRecoverableWorkUnits } from './jobs';

const workUnitId = '33333333-3333-4333-8333-333333333333';

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

describe('M02A acquisition execution guards', () => {
  it('requires an active durable control before claiming an acquisition shard', async () => {
    const handler = vi.fn(async (sql: string) => {
      expect(sql).toContain('FROM acquisition_shards ash');
      expect(sql).toContain('JOIN research_job_controls rjc');
      expect(sql).toContain("rjc.state = 'active'");
      return { rows: [] };
    });
    const pool = transactionPool(handler);

    const result = await claimWorkUnit(pool, workUnitId, 'worker-1', 1);

    expect(result).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('filters paused, cancelled, killed, and missing-control shards from recovery', async () => {
    const query = vi.fn(async (sql: string) => {
      expect(sql).toContain('FROM acquisition_shards ash');
      expect(sql).toContain('JOIN research_job_controls rjc');
      expect(sql).toContain("rjc.state = 'active'");
      return { rows: [] };
    });
    const pool = { query } as unknown as Pool;

    const result = await listRecoverableWorkUnits(pool);

    expect(result).toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
