import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  ACQUISITION_PROGRESS_CHECKPOINT_KEY,
  createAcquisitionShard,
  createResearchJob,
  ResearchJobPersistenceError,
  saveAcquisitionProgress,
  type ResearchAcquisitionBudget,
} from './research-job-persistence';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const jobRunId = '22222222-2222-4222-8222-222222222222';
const workUnitId = '33333333-3333-4333-8333-333333333333';
const correlationId = '44444444-4444-4444-8444-444444444444';

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

function transactionPool(handler: (sql: string, values?: readonly unknown[]) => Promise<{ rows: unknown[] }>): Pool {
  const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
    return handler(sql, values);
  });
  const client = { query, release: vi.fn() } as unknown as PoolClient;
  return { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
}

describe('M02A research job persistence', () => {
  it('creates a research job only from an allowed preflight and binds it to canonical job_runs', async () => {
    const createdAt = new Date('2026-09-15T08:00:00.000Z');
    const pool = transactionPool(async (sql) => {
      if (sql.includes('SELECT decision FROM research_job_preflights')) return { rows: [{ decision: 'allow' }] };
      if (sql.includes('INSERT INTO job_runs')) return { rows: [{ id: jobRunId, correlation_id: correlationId }] };
      if (sql.includes('INSERT INTO research_jobs')) return { rows: [{ id: 'research-1' }] };
      if (sql.includes('FROM research_jobs rj')) {
        return {
          rows: [{
            id: 'research-1',
            workspace_id: workspaceId,
            preflight_id: 'preflight-1',
            job_run_id: jobRunId,
            correlation_id: correlationId,
            spec: { niche: 'dentists' },
            approved_source_keys: ['source.company_sites'],
            budget: budget(),
            created_at: createdAt,
          }],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const result = await createResearchJob(pool, {
      id: 'research-1',
      workspaceId,
      preflightId: 'preflight-1',
      idempotencyKey: 'research-1-v1',
      spec: { niche: 'dentists' },
      approvedSourceKeys: ['source.company_sites'],
      budget: budget(),
    });

    expect(result.created).toBe(true);
    expect(result.researchJob).toMatchObject({ id: 'research-1', jobRunId, correlationId });
  });

  it('fails closed before creating work when preflight requires review', async () => {
    const handler = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT decision FROM research_job_preflights')) return { rows: [{ decision: 'review_required' }] };
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const pool = transactionPool(handler);

    await expect(createResearchJob(pool, {
      id: 'research-1',
      workspaceId,
      preflightId: 'preflight-1',
      idempotencyKey: 'research-1-v1',
      spec: { niche: 'dentists' },
      approvedSourceKeys: ['source.company_sites'],
      budget: budget(),
    })).rejects.toMatchObject({ code: 'RESEARCH_JOB_PREFLIGHT_NOT_ALLOWED' });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('rejects an acquisition shard that expands beyond approved sources', async () => {
    const handler = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT rj.job_run_id')) {
        return {
          rows: [{
            job_run_id: jobRunId,
            correlation_id: correlationId,
            approved_source_keys: ['source.company_sites'],
          }],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const pool = transactionPool(handler);

    await expect(createAcquisitionShard(pool, {
      id: 'shard-1',
      workspaceId,
      researchJobId: 'research-1',
      shardKey: 'region-a',
      ordinal: 0,
      sourceKeys: ['source.company_sites', 'source.unapproved'],
      budget: budget(),
    })).rejects.toMatchObject({ code: 'ACQUISITION_SHARD_SOURCE_NOT_APPROVED' });
  });

  it('creates shards on canonical job_work_units without duplicating lifecycle state', async () => {
    const createdAt = new Date('2026-09-15T08:01:00.000Z');
    const pool = transactionPool(async (sql) => {
      if (sql.includes('SELECT rj.job_run_id')) {
        return {
          rows: [{
            job_run_id: jobRunId,
            correlation_id: correlationId,
            approved_source_keys: ['source.company_sites'],
          }],
        };
      }
      if (sql.includes('INSERT INTO job_work_units')) return { rows: [{ id: workUnitId }] };
      if (sql.includes('INSERT INTO acquisition_shards')) return { rows: [{ id: 'shard-1' }] };
      if (sql.includes('FROM acquisition_shards ash')) {
        return {
          rows: [{
            id: 'shard-1',
            workspace_id: workspaceId,
            research_job_id: 'research-1',
            job_run_id: jobRunId,
            work_unit_id: workUnitId,
            correlation_id: correlationId,
            shard_key: 'region-a',
            ordinal: 0,
            source_keys: ['source.company_sites'],
            budget: budget(),
            created_at: createdAt,
          }],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const result = await createAcquisitionShard(pool, {
      id: 'shard-1',
      workspaceId,
      researchJobId: 'research-1',
      shardKey: 'region-a',
      ordinal: 0,
      sourceKeys: ['source.company_sites'],
      budget: budget(),
    });

    expect(result.created).toBe(true);
    expect(result.shard).toMatchObject({ id: 'shard-1', workUnitId, jobRunId, shardKey: 'region-a' });
  });

  it('stores acquisition progress in the canonical job_checkpoints table with version 1', async () => {
    const observedAt = new Date('2026-09-15T08:02:00.000Z');
    const pool = transactionPool(async (sql, values) => {
      if (sql.includes('SELECT work_unit_id FROM acquisition_shards')) return { rows: [{ work_unit_id: workUnitId }] };
      if (sql.includes('INSERT INTO job_checkpoints')) {
        expect(values?.[1]).toBe(ACQUISITION_PROGRESS_CHECKPOINT_KEY);
        return {
          rows: [{
            data: {
              version: 1,
              completedUnits: 0,
              failedUnits: 0,
              returnedRecords: 0,
              requests: 0,
              pages: 0,
              bytes: 0,
              currencyMicros: 0,
              runtimeMs: 0,
              terminal: false,
              observedAt: observedAt.toISOString(),
            },
          }],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const result = await saveAcquisitionProgress(pool, {
      workspaceId,
      shardId: 'shard-1',
      expectedVersion: null,
      counters: {
        completedUnits: 0,
        failedUnits: 0,
        returnedRecords: 0,
        requests: 0,
        pages: 0,
        bytes: 0,
        currencyMicros: 0,
        runtimeMs: 0,
      },
      terminal: false,
      observedAt,
    });

    expect(result.version).toBe(1);
    expect(result.terminal).toBe(false);
  });

  it('rejects malformed budgets before opening a database transaction', async () => {
    const pool = { connect: vi.fn() } as unknown as Pool;
    const invalidBudget = { ...budget(), maxConcurrency: 0 };

    await expect(createResearchJob(pool, {
      id: 'research-1',
      workspaceId,
      preflightId: 'preflight-1',
      idempotencyKey: 'research-1-v1',
      spec: {},
      approvedSourceKeys: ['source.company_sites'],
      budget: invalidBudget,
    })).rejects.toBeInstanceOf(ResearchJobPersistenceError);
    expect(pool.connect).not.toHaveBeenCalled();
  });
});

describe('0012 acquisition migration contract', () => {
  it('reuses canonical work/checkpoint tables and does not duplicate source discovery state', async () => {
    const migrationPath = fileURLToPath(new URL('../migrations/0012_research_job_acquisition_persistence.up.sql', import.meta.url));
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE research_jobs');
    expect(migration).toContain('CREATE TABLE acquisition_shards');
    expect(migration).toContain('REFERENCES job_runs (id, workspace_id)');
    expect(migration).toContain('REFERENCES job_work_units (id, workspace_id, job_run_id)');
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON job_checkpoints');
    expect(migration).not.toContain('CREATE TABLE source_tasks');
    expect(migration).not.toContain('CREATE TABLE source_discovery_checkpoints');
    expect(migration).not.toContain('CREATE TABLE acquisition_checkpoints');
  });
});
