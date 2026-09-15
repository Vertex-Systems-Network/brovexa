import type {
  AcquisitionProgressCheckpoint,
  PersistedAcquisitionShard,
  PersistedResearchJob,
  PersistedResearchJobControl,
  ResearchAcquisitionBudget,
} from '@brovexa/db';
import { describe, expect, it, vi } from 'vitest';
import {
  readAcquisitionObservation,
  type AcquisitionObservabilityPersistence,
} from './acquisition-observability';

const workspaceId = '00000000-0000-0000-0000-000000000201';
const otherWorkspaceId = '00000000-0000-0000-0000-000000000202';
const researchJobId = 'research-job-observe-adversarial';
const jobRunId = '00000000-0000-0000-0000-000000000203';

const budget: ResearchAcquisitionBudget = {
  maxBusinesses: 20,
  maxRequests: 10,
  maxPages: 10,
  maxBytes: 10_000,
  maxCurrencyMicros: 1_000,
  maxRuntimeMs: 20_000,
  maxConcurrency: 2,
};

const job: PersistedResearchJob = {
  id: researchJobId,
  workspaceId,
  preflightId: 'preflight-adversarial',
  jobRunId,
  correlationId: '00000000-0000-0000-0000-000000000204',
  spec: {
    url: 'https://private.example.test/secret',
    credential: 'must-never-leak',
    freeFormSensitive: 'customer-secret',
  },
  approvedSourceKeys: ['source.alpha', 'source.beta'],
  budget,
  createdAt: new Date('2026-09-16T00:00:00.000Z'),
};

function control(
  overrides: Partial<PersistedResearchJobControl> = {},
): PersistedResearchJobControl {
  return {
    researchJobId,
    workspaceId,
    version: 2,
    state: 'active',
    reasonCode: 'operator.secret.reason',
    changedAt: new Date('2026-09-16T00:01:00.000Z'),
    createdAt: new Date('2026-09-16T00:00:00.000Z'),
    ...overrides,
  };
}

function shard(
  id: string,
  ordinal: number,
  overrides: Partial<PersistedAcquisitionShard> = {},
): PersistedAcquisitionShard {
  return {
    id,
    workspaceId,
    researchJobId,
    jobRunId,
    workUnitId: `work-unit-${ordinal}`,
    correlationId: `correlation-${ordinal}`,
    shardKey: `shard-key-${ordinal}`,
    ordinal,
    sourceKeys: [ordinal === 0 ? 'source.alpha' : 'source.beta'],
    budget: { ...budget },
    createdAt: new Date('2026-09-16T00:00:00.000Z'),
    ...overrides,
  };
}

function checkpoint(
  overrides: Partial<AcquisitionProgressCheckpoint> = {},
): AcquisitionProgressCheckpoint {
  return {
    version: 1,
    completedUnits: 1,
    failedUnits: 0,
    returnedRecords: 5,
    requests: 2,
    pages: 1,
    bytes: 500,
    currencyMicros: 50,
    runtimeMs: 1_000,
    terminal: false,
    observedAt: '2026-09-16T00:02:00.000Z',
    ...overrides,
  };
}

function persistence(options: {
  persistedJob?: PersistedResearchJob | null;
  persistedControl?: PersistedResearchJobControl | null;
  shards?: Record<string, PersistedAcquisitionShard | null>;
  checkpoints?: Record<string, AcquisitionProgressCheckpoint | null>;
} = {}): AcquisitionObservabilityPersistence {
  const shards = options.shards ?? {
    'shard-a': shard('shard-a', 0),
    'shard-b': shard('shard-b', 1),
  };
  const checkpoints = options.checkpoints ?? {
    'shard-a': checkpoint(),
    'shard-b': checkpoint(),
  };

  return {
    getJob: async () => options.persistedJob === undefined ? job : options.persistedJob,
    getControl: async () => options.persistedControl === undefined ? control() : options.persistedControl,
    getShard: async (_workspaceId, shardId) => shards[shardId] ?? null,
    getProgress: async (_workspaceId, shardId) => checkpoints[shardId] ?? null,
  };
}

describe('M02A adversarial acquisition observability verification', () => {
  it('fails before downstream reads when a cross-tenant job is returned', async () => {
    const getControl = vi.fn(async () => control());
    const store: AcquisitionObservabilityPersistence = {
      ...persistence({ persistedJob: { ...job, workspaceId: otherWorkspaceId } }),
      getControl,
    };

    await expect(
      readAcquisitionObservation(
        { workspaceId, researchJobId, shardIds: [] },
        store,
      ),
    ).rejects.toMatchObject({ code: 'ACQUISITION_OBSERVABILITY_JOB_NOT_FOUND' });
    expect(getControl).not.toHaveBeenCalled();
  });

  it('fails closed when a shard crosses workspace or job-run identity boundaries', async () => {
    for (const overrides of [
      { workspaceId: otherWorkspaceId },
      { jobRunId: '00000000-0000-0000-0000-000000000299' },
      { researchJobId: 'research-job-other' },
    ]) {
      await expect(
        readAcquisitionObservation(
          { workspaceId, researchJobId, shardIds: ['shard-a'] },
          persistence({
            shards: { 'shard-a': shard('shard-a', 0, overrides) },
            checkpoints: { 'shard-a': checkpoint() },
          }),
        ),
      ).rejects.toMatchObject({
        code: 'ACQUISITION_OBSERVABILITY_SHARD_IDENTITY_MISMATCH',
      });
    }
  });

  it('rejects aggregate budget bypass even when every shard is individually within budget', async () => {
    const narrowJobBudget: ResearchAcquisitionBudget = {
      ...budget,
      maxRequests: 3,
    };

    await expect(
      readAcquisitionObservation(
        { workspaceId, researchJobId, shardIds: ['shard-a', 'shard-b'] },
        persistence({ persistedJob: { ...job, budget: narrowJobBudget } }),
      ),
    ).rejects.toMatchObject({ code: 'ACQUISITION_OBSERVABILITY_BUDGET_CORRUPT' });
  });

  it('rejects malformed canonical budgets before reporting utilization', async () => {
    await expect(
      readAcquisitionObservation(
        { workspaceId, researchJobId, shardIds: [] },
        persistence({
          persistedJob: {
            ...job,
            budget: { ...budget, maxConcurrency: 0 },
          },
        }),
      ),
    ).rejects.toMatchObject({ code: 'ACQUISITION_OBSERVABILITY_BUDGET_CORRUPT' });
  });

  it('rejects corrupt negative progress instead of normalizing it', async () => {
    await expect(
      readAcquisitionObservation(
        { workspaceId, researchJobId, shardIds: ['shard-a'] },
        persistence({ checkpoints: { 'shard-a': checkpoint({ requests: -1 }) } }),
      ),
    ).rejects.toMatchObject({ code: 'ACQUISITION_OBSERVABILITY_PROGRESS_CORRUPT' });
  });

  it('rejects oversized shard enumeration before persistence can be amplified', async () => {
    const getJob = vi.fn(async () => job);
    const store: AcquisitionObservabilityPersistence = {
      ...persistence(),
      getJob,
    };
    const shardIds = Array.from({ length: 513 }, (_, index) => `shard-${index}`);

    await expect(
      readAcquisitionObservation({ workspaceId, researchJobId, shardIds }, store),
    ).rejects.toMatchObject({ code: 'ACQUISITION_OBSERVABILITY_INPUT_INVALID' });
    expect(getJob).not.toHaveBeenCalled();
  });

  it('keeps URLs, credentials, reason codes and canonical identities out of telemetry', async () => {
    const observation = await readAcquisitionObservation(
      { workspaceId, researchJobId, shardIds: ['shard-a'] },
      persistence(),
    );
    const serialized = JSON.stringify(observation.telemetry);

    for (const forbidden of [
      workspaceId,
      researchJobId,
      jobRunId,
      'shard-a',
      'source.alpha',
      'https://private.example.test/secret',
      'must-never-leak',
      'customer-secret',
      'operator.secret.reason',
      'preflight-adversarial',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
