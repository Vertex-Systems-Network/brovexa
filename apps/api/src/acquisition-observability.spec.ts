import type {
  AcquisitionProgressCheckpoint,
  PersistedAcquisitionShard,
  PersistedResearchJob,
  PersistedResearchJobControl,
  ResearchAcquisitionBudget,
} from '@brovexa/db';
import { describe, expect, it } from 'vitest';
import {
  AcquisitionObservabilityError,
  readAcquisitionObservation,
  type AcquisitionObservabilityPersistence,
} from './acquisition-observability';

const workspaceId = '00000000-0000-0000-0000-000000000001';
const researchJobId = 'research-job-1';
const jobRunId = '00000000-0000-0000-0000-000000000002';
const correlationId = '00000000-0000-0000-0000-000000000003';

const budget: ResearchAcquisitionBudget = {
  maxBusinesses: 100,
  maxRequests: 40,
  maxPages: 20,
  maxBytes: 100_000,
  maxCurrencyMicros: 10_000,
  maxRuntimeMs: 60_000,
  maxConcurrency: 4,
};

const job: PersistedResearchJob = {
  id: researchJobId,
  workspaceId,
  preflightId: 'preflight-1',
  jobRunId,
  correlationId,
  spec: { geography: ['TR'], hiddenSensitiveTerm: 'must-not-leak' },
  approvedSourceKeys: ['source.alpha', 'source.beta'],
  budget,
  createdAt: new Date('2026-09-15T12:00:00.000Z'),
};

function control(
  state: PersistedResearchJobControl['state'] = 'active',
): PersistedResearchJobControl {
  return {
    researchJobId,
    workspaceId,
    version: 3,
    state,
    reasonCode: state === 'active' ? null : 'operator_control',
    changedAt: new Date('2026-09-15T12:30:00.000Z'),
    createdAt: new Date('2026-09-15T12:00:00.000Z'),
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
    workUnitId: `work-${ordinal}`,
    correlationId: `correlation-${ordinal}`,
    shardKey: `geo-${ordinal}`,
    ordinal,
    sourceKeys: [ordinal === 0 ? 'source.alpha' : 'source.beta'],
    budget: { ...budget },
    createdAt: new Date('2026-09-15T12:00:00.000Z'),
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
    returnedRecords: 10,
    requests: 4,
    pages: 2,
    bytes: 1_000,
    currencyMicros: 100,
    runtimeMs: 2_000,
    terminal: false,
    observedAt: '2026-09-15T12:45:00.000Z',
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
    'shard-1': shard('shard-1', 0),
    'shard-2': shard('shard-2', 1),
  };
  const checkpoints = options.checkpoints ?? {
    'shard-1': checkpoint(),
    'shard-2': checkpoint({
      version: 2,
      completedUnits: 2,
      failedUnits: 1,
      returnedRecords: 15,
      requests: 6,
      pages: 3,
      bytes: 2_000,
      currencyMicros: 200,
      runtimeMs: 3_000,
      terminal: true,
      observedAt: '2026-09-15T12:50:00.000Z',
    }),
  };

  return {
    getJob: async () => options.persistedJob === undefined ? job : options.persistedJob,
    getControl: async () => options.persistedControl === undefined ? control() : options.persistedControl,
    getShard: async (_workspace, shardId) => shards[shardId] ?? null,
    getProgress: async (_workspace, shardId) => checkpoints[shardId] ?? null,
  };
}

async function expectCode(
  promise: Promise<unknown>,
  code: AcquisitionObservabilityError['code'],
): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

describe('acquisition observability', () => {
  it('returns exact aggregate progress and deterministic canonical budget state', async () => {
    const observation = await readAcquisitionObservation(
      { workspaceId, researchJobId, shardIds: ['shard-1', 'shard-2'] },
      persistence(),
    );

    expect(observation.controlState).toBe('active');
    expect(observation.progress).toEqual({
      shardsObserved: 2,
      shardsCheckpointed: 2,
      shardsTerminal: 1,
      completedUnits: 3,
      failedUnits: 1,
      returnedRecords: 25,
      requests: 10,
      pages: 5,
      bytes: 3_000,
      currencyMicros: 300,
      runtimeMs: 5_000,
    });
    expect(observation.budget).toEqual({
      limits: {
        businesses: 100,
        requests: 40,
        pages: 20,
        bytes: 100_000,
        currencyMicros: 10_000,
        runtimeMs: 60_000,
        maxConcurrency: 4,
      },
      used: {
        businesses: 25,
        requests: 10,
        pages: 5,
        bytes: 3_000,
        currencyMicros: 300,
        runtimeMs: 5_000,
      },
      remaining: {
        businesses: 75,
        requests: 30,
        pages: 15,
        bytes: 97_000,
        currencyMicros: 9_700,
        runtimeMs: 55_000,
      },
      exhausted: {
        businesses: false,
        requests: false,
        pages: false,
        bytes: false,
        currencyMicros: false,
        runtimeMs: false,
      },
    });
  });

  it('emits only bounded redacted telemetry dimensions', async () => {
    const observation = await readAcquisitionObservation(
      { workspaceId, researchJobId, shardIds: ['shard-1', 'shard-2'] },
      persistence({ persistedControl: control('paused') }),
    );

    expect(observation.telemetry).toEqual({
      controlState: 'paused',
      shardCountBucket: '2_4',
      checkpointCoverage: 'all',
      terminalCoverage: 'partial',
      hasFailures: true,
      utilization: {
        businesses: '25_49',
        requests: '25_49',
        pages: '25_49',
        bytes: 'lt25',
        currencyMicros: 'lt25',
        runtimeMs: 'lt25',
      },
    });

    const serialized = JSON.stringify(observation.telemetry);
    for (const forbidden of [
      workspaceId,
      researchJobId,
      'shard-1',
      'shard-2',
      'source.alpha',
      'source.beta',
      'must-not-leak',
      'preflight-1',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(Object.keys(observation.telemetry).sort()).toEqual(
      ['controlState', 'shardCountBucket', 'checkpointCoverage', 'terminalCoverage', 'hasFailures', 'utilization'].sort(),
    );
  });

  it('represents missing checkpoints without inventing progress', async () => {
    const observation = await readAcquisitionObservation(
      { workspaceId, researchJobId, shardIds: ['shard-1', 'shard-2'] },
      persistence({ checkpoints: { 'shard-1': checkpoint(), 'shard-2': null } }),
    );

    expect(observation.progress.shardsObserved).toBe(2);
    expect(observation.progress.shardsCheckpointed).toBe(1);
    expect(observation.progress.shardsTerminal).toBe(0);
    expect(observation.progress.returnedRecords).toBe(10);
    expect(observation.telemetry.checkpointCoverage).toBe('partial');
    expect(observation.telemetry.terminalCoverage).toBe('none');
  });

  it('reports exact exhaustion when usage reaches a persisted limit', async () => {
    const exactBudget: ResearchAcquisitionBudget = {
      ...budget,
      maxBusinesses: 25,
      maxRequests: 10,
      maxPages: 5,
      maxBytes: 3_000,
      maxCurrencyMicros: 300,
      maxRuntimeMs: 5_000,
    };
    const observation = await readAcquisitionObservation(
      { workspaceId, researchJobId, shardIds: ['shard-1', 'shard-2'] },
      persistence({ persistedJob: { ...job, budget: exactBudget } }),
    );

    expect(Object.values(observation.budget.remaining).every((value) => value === 0)).toBe(true);
    expect(Object.values(observation.budget.exhausted).every(Boolean)).toBe(true);
    expect(Object.values(observation.telemetry.utilization).every((value) => value === '100')).toBe(true);
  });

  it('fails closed when control identity does not match the research job', async () => {
    await expectCode(
      readAcquisitionObservation(
        { workspaceId, researchJobId, shardIds: [] },
        persistence({ persistedControl: { ...control(), researchJobId: 'research-job-other' } }),
      ),
      'ACQUISITION_OBSERVABILITY_CONTROL_IDENTITY_MISMATCH',
    );
  });

  it('fails closed when a shard is outside the requested research job', async () => {
    await expectCode(
      readAcquisitionObservation(
        { workspaceId, researchJobId, shardIds: ['shard-1'] },
        persistence({
          shards: {
            'shard-1': shard('shard-1', 0, { researchJobId: 'research-job-other' }),
          },
        }),
      ),
      'ACQUISITION_OBSERVABILITY_SHARD_IDENTITY_MISMATCH',
    );
  });

  it('rejects a checkpoint that exceeds its persisted shard budget', async () => {
    await expectCode(
      readAcquisitionObservation(
        { workspaceId, researchJobId, shardIds: ['shard-1'] },
        persistence({
          shards: {
            'shard-1': shard('shard-1', 0, {
              budget: { ...budget, maxRequests: 2 },
            }),
          },
          checkpoints: { 'shard-1': checkpoint({ requests: 3 }) },
        }),
      ),
      'ACQUISITION_OBSERVABILITY_BUDGET_CORRUPT',
    );
  });

  it('rejects aggregate usage that exceeds the canonical research-job budget', async () => {
    await expectCode(
      readAcquisitionObservation(
        { workspaceId, researchJobId, shardIds: ['shard-1', 'shard-2'] },
        persistence({ persistedJob: { ...job, budget: { ...budget, maxRequests: 9 } } }),
      ),
      'ACQUISITION_OBSERVABILITY_BUDGET_CORRUPT',
    );
  });

  it('rejects corrupt progress metadata and unsafe aggregate overflow', async () => {
    await expectCode(
      readAcquisitionObservation(
        { workspaceId, researchJobId, shardIds: ['shard-1'] },
        persistence({ checkpoints: { 'shard-1': checkpoint({ version: 0 }) } }),
      ),
      'ACQUISITION_OBSERVABILITY_PROGRESS_CORRUPT',
    );

    const huge = Number.MAX_SAFE_INTEGER;
    await expectCode(
      readAcquisitionObservation(
        { workspaceId, researchJobId, shardIds: ['shard-1', 'shard-2'] },
        persistence({
          persistedJob: {
            ...job,
            budget: {
              ...budget,
              maxBusinesses: huge,
              maxRequests: huge,
              maxPages: huge,
              maxBytes: huge,
              maxCurrencyMicros: huge,
              maxRuntimeMs: huge,
            },
          },
          shards: {
            'shard-1': shard('shard-1', 0, {
              budget: {
                ...budget,
                maxBusinesses: huge,
                maxRequests: huge,
                maxPages: huge,
                maxBytes: huge,
                maxCurrencyMicros: huge,
                maxRuntimeMs: huge,
              },
            }),
            'shard-2': shard('shard-2', 1, {
              budget: {
                ...budget,
                maxBusinesses: huge,
                maxRequests: huge,
                maxPages: huge,
                maxBytes: huge,
                maxCurrencyMicros: huge,
                maxRuntimeMs: huge,
              },
            }),
          },
          checkpoints: {
            'shard-1': checkpoint({ returnedRecords: huge }),
            'shard-2': checkpoint({ returnedRecords: 1 }),
          },
        }),
      ),
      'ACQUISITION_OBSERVABILITY_OVERFLOW',
    );
  });

  it('rejects duplicate shard identities before persistence reads can double-count them', async () => {
    await expectCode(
      readAcquisitionObservation(
        { workspaceId, researchJobId, shardIds: ['shard-1', 'shard-1'] },
        persistence(),
      ),
      'ACQUISITION_OBSERVABILITY_INPUT_INVALID',
    );
  });
});
