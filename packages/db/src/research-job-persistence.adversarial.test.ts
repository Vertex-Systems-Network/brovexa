import type { Pool, PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  ACQUISITION_PROGRESS_CHECKPOINT_KEY,
  createAcquisitionShard,
  createResearchJob,
  getAcquisitionProgress,
  getAcquisitionShard,
  getResearchJob,
  saveAcquisitionProgress,
  type ResearchAcquisitionBudget,
} from './research-job-persistence';

const workspaceId = '11111111-1111-4111-8111-111111111201';
const researchJobId = 'research-adversarial';
const jobRunId = '22222222-2222-4222-8222-222222222201';
const workUnitId = '33333333-3333-4333-8333-333333333201';
const correlationId = '44444444-4444-4444-8444-444444444201';

function budget(): ResearchAcquisitionBudget {
  return {
    maxBusinesses: 100,
    maxRequests: 50,
    maxPages: 50,
    maxBytes: 5_000_000,
    maxCurrencyMicros: 2_000_000,
    maxRuntimeMs: 120_000,
    maxConcurrency: 4,
  };
}

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

describe('M02A adversarial research job persistence verification', () => {
  it('keeps job, shard and progress reads workspace-scoped', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;

    await getResearchJob(pool, workspaceId, researchJobId);
    await getAcquisitionShard(pool, workspaceId, 'shard-adversarial');
    await getAcquisitionProgress(pool, workspaceId, 'shard-adversarial');

    const [jobSql, jobValues] = query.mock.calls[0] ?? [];
    const [shardSql, shardValues] = query.mock.calls[1] ?? [];
    const [progressSql, progressValues] = query.mock.calls[2] ?? [];

    expect(String(jobSql)).toContain('rj.workspace_id = $1');
    expect(jobValues).toEqual([workspaceId, researchJobId]);
    expect(String(shardSql)).toContain('ash.workspace_id = $1');
    expect(shardValues).toEqual([workspaceId, 'shard-adversarial']);
    expect(String(progressSql)).toContain('ash.workspace_id = $1::uuid');
    expect(progressValues).toEqual([
      workspaceId,
      'shard-adversarial',
      ACQUISITION_PROGRESS_CHECKPOINT_KEY,
    ]);
  });

  it('cannot reuse an allowed preflight from another workspace or research-job identity', async () => {
    const handler = vi.fn(async (sql: string, values?: readonly unknown[]) => {
      if (sql.includes('SELECT decision FROM research_job_preflights')) {
        expect(values).toEqual(['preflight-adversarial', workspaceId, researchJobId]);
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const pool = transactionPool(handler);

    await expect(
      createResearchJob(pool, {
        id: researchJobId,
        workspaceId,
        preflightId: 'preflight-adversarial',
        idempotencyKey: 'research-adversarial-v1',
        spec: { niche: 'adversarial' },
        approvedSourceKeys: ['source.alpha'],
        budget: budget(),
      }),
    ).rejects.toMatchObject({ code: 'RESEARCH_JOB_PREFLIGHT_NOT_FOUND' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('blocks source-policy expansion before a canonical work unit can be created', async () => {
    const observedSql: string[] = [];
    const pool = transactionPool(async (sql) => {
      observedSql.push(sql);
      if (sql.includes('SELECT rj.job_run_id')) {
        return {
          rows: [
            {
              job_run_id: jobRunId,
              correlation_id: correlationId,
              approved_source_keys: ['source.alpha'],
            },
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    await expect(
      createAcquisitionShard(pool, {
        id: 'shard-adversarial',
        workspaceId,
        researchJobId,
        shardKey: 'region-adversarial',
        ordinal: 0,
        sourceKeys: ['source.alpha', 'source.unapproved'],
        budget: budget(),
      }),
    ).rejects.toMatchObject({ code: 'ACQUISITION_SHARD_SOURCE_NOT_APPROVED' });

    expect(observedSql.some((sql) => sql.includes('INSERT INTO job_work_units'))).toBe(false);
  });

  it('fails closed on stale, terminal or time-regressive progress updates', async () => {
    let updateSql = '';
    let updateValues: readonly unknown[] | undefined;
    const pool = transactionPool(async (sql, values) => {
      if (sql.includes('SELECT work_unit_id FROM acquisition_shards')) {
        expect(values).toEqual([workspaceId, 'shard-adversarial']);
        return { rows: [{ work_unit_id: workUnitId }] };
      }
      if (sql.includes('UPDATE job_checkpoints')) {
        updateSql = sql;
        updateValues = values;
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    await expect(
      saveAcquisitionProgress(pool, {
        workspaceId,
        shardId: 'shard-adversarial',
        expectedVersion: 7,
        counters: {
          completedUnits: 5,
          failedUnits: 0,
          returnedRecords: 10,
          requests: 4,
          pages: 2,
          bytes: 1_000,
          currencyMicros: 0,
          runtimeMs: 2_000,
        },
        terminal: false,
        observedAt: new Date('2026-09-16T00:10:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'ACQUISITION_PROGRESS_CONFLICT' });

    expect(updateSql).toContain("(data->>'version')::bigint = $4");
    expect(updateSql).toContain("COALESCE((data->>'terminal')::boolean, false) = false");
    expect(updateSql).toContain("(data->>'observedAt')::timestamptz <= $5::timestamptz");
    expect(updateValues?.[3]).toBe(7);
  });

  it('rejects unsafe budget counters before opening a database transaction', async () => {
    const pool = { connect: vi.fn() } as unknown as Pool;

    await expect(
      createResearchJob(pool, {
        id: researchJobId,
        workspaceId,
        preflightId: 'preflight-adversarial',
        idempotencyKey: 'research-adversarial-v1',
        spec: {},
        approvedSourceKeys: ['source.alpha'],
        budget: {
          ...budget(),
          maxBytes: Number.MAX_SAFE_INTEGER + 1,
        },
      }),
    ).rejects.toMatchObject({ code: 'RESEARCH_JOB_INPUT_INVALID' });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('rejects an idempotent research-job replay that changes immutable budget content', async () => {
    const createdAt = new Date('2026-09-16T00:00:00.000Z');
    const pool = transactionPool(async (sql) => {
      if (sql.includes('SELECT decision FROM research_job_preflights')) {
        return { rows: [{ decision: 'allow' }] };
      }
      if (sql.includes('INSERT INTO job_runs')) return { rows: [] };
      if (sql.includes('SELECT id FROM job_runs')) return { rows: [{ id: jobRunId }] };
      if (sql.includes('FROM research_jobs rj')) {
        return {
          rows: [
            {
              id: researchJobId,
              workspace_id: workspaceId,
              preflight_id: 'preflight-adversarial',
              job_run_id: jobRunId,
              correlation_id: correlationId,
              spec: {},
              approved_source_keys: ['source.alpha'],
              budget: { ...budget(), maxRequests: 49 },
              created_at: createdAt,
            },
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    await expect(
      createResearchJob(pool, {
        id: researchJobId,
        workspaceId,
        preflightId: 'preflight-adversarial',
        idempotencyKey: 'research-adversarial-v1',
        spec: {},
        approvedSourceKeys: ['source.alpha'],
        budget: budget(),
      }),
    ).rejects.toMatchObject({ code: 'RESEARCH_JOB_IDEMPOTENCY_CONFLICT' });
  });
});
