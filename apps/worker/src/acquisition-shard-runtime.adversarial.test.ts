import type {
  PersistedAcquisitionShard,
  PersistedResearchJobControl,
} from '@brovexa/db';
import { describe, expect, it } from 'vitest';
import {
  ACQUISITION_SHARD_ORCHESTRATED_EFFECT,
  createAcquisitionShardHandler,
  type AcquisitionShardExecutorRegistration,
  type AcquisitionShardRuntimePersistence,
} from './acquisition-shard-runtime';
import type { WorkHandlerContext } from './runtime';

const workspaceId = '00000000-0000-0000-0000-000000000101';
const otherWorkspaceId = '00000000-0000-0000-0000-000000000102';
const researchJobId = 'research-job-adversarial';
const shardId = 'shard-adversarial';
const workUnitId = '00000000-0000-0000-0000-000000000103';
const jobRunId = '00000000-0000-0000-0000-000000000104';
const correlationId = '00000000-0000-0000-0000-000000000105';

const budget = {
  maxBusinesses: 100,
  maxRequests: 20,
  maxPages: 20,
  maxBytes: 100_000,
  maxCurrencyMicros: 0,
  maxRuntimeMs: 30_000,
  maxConcurrency: 2,
};

const shard: PersistedAcquisitionShard = {
  id: shardId,
  workspaceId,
  researchJobId,
  jobRunId,
  workUnitId,
  correlationId,
  shardKey: 'geo-adversarial',
  ordinal: 0,
  sourceKeys: ['source.test'],
  budget,
  createdAt: new Date('2026-09-16T00:00:00.000Z'),
};

function control(
  state: PersistedResearchJobControl['state'],
  overrides: Partial<PersistedResearchJobControl> = {},
): PersistedResearchJobControl {
  return {
    researchJobId,
    workspaceId,
    version: 1,
    state,
    reasonCode: null,
    changedAt: new Date('2026-09-16T00:00:00.000Z'),
    createdAt: new Date('2026-09-16T00:00:00.000Z'),
    ...overrides,
  };
}

function workContext(overrides: Partial<WorkHandlerContext> = {}): WorkHandlerContext {
  return {
    workUnitId,
    jobRunId,
    workspaceId,
    workType: 'research.acquire.shard',
    workVersion: 1,
    correlationId,
    payload: {
      researchJobId,
      shardId,
      shardKey: shard.shardKey,
      ordinal: shard.ordinal,
      sourceKeys: [...shard.sourceKeys],
      budget: { ...budget },
    },
    attempt: 1,
    isCancellationRequested: async () => false,
    ...overrides,
  };
}

function persistence(
  getControl: AcquisitionShardRuntimePersistence['getControl'],
  persistedShard: PersistedAcquisitionShard = shard,
): AcquisitionShardRuntimePersistence {
  return {
    getShard: async () => persistedShard,
    getControl,
  };
}

describe('M02A adversarial acquisition shard runtime verification', () => {
  it('recovers from pause only on a fresh attempt after canonical control resumes', async () => {
    let state: PersistedResearchJobControl['state'] = 'paused';
    let executions = 0;
    const handler = createAcquisitionShardHandler({
      persistence: persistence(async () => control(state)),
      executor: {
        networkAccess: 'none',
        execute: async () => {
          executions += 1;
          return {};
        },
      },
    });

    await expect(handler(workContext())).rejects.toMatchObject({
      code: 'ACQUISITION_CONTROL_PAUSED',
    });
    expect(executions).toBe(0);

    state = 'active';
    const result = await handler(workContext({ attempt: 2 }));

    expect(executions).toBe(1);
    expect(result.effectKey).toBe(ACQUISITION_SHARD_ORCHESTRATED_EFFECT);
  });

  it('fails closed when control disappears between claim and child dispatch', async () => {
    let reads = 0;
    let dispatched = false;
    const handler = createAcquisitionShardHandler({
      persistence: persistence(async () => {
        reads += 1;
        return reads === 1 ? control('active') : null;
      }),
      executor: {
        networkAccess: 'none',
        execute: async (context) => {
          await context.assertMayDispatch();
          dispatched = true;
          return {};
        },
      },
    });

    await expect(handler(workContext())).rejects.toMatchObject({
      code: 'ACQUISITION_CONTROL_NOT_FOUND',
    });
    expect(dispatched).toBe(false);
  });

  it('fails closed when a cross-tenant control is returned during dispatch revalidation', async () => {
    let reads = 0;
    let dispatched = false;
    const handler = createAcquisitionShardHandler({
      persistence: persistence(async () => {
        reads += 1;
        return reads === 1
          ? control('active')
          : control('active', { workspaceId: otherWorkspaceId });
      }),
      executor: {
        networkAccess: 'none',
        execute: async (context) => {
          await context.assertMayDispatch();
          dispatched = true;
          return {};
        },
      },
    });

    await expect(handler(workContext())).rejects.toMatchObject({
      code: 'ACQUISITION_CONTROL_IDENTITY_MISMATCH',
    });
    expect(dispatched).toBe(false);
  });

  it('rejects persisted shard budget widening before executor activation', async () => {
    let executed = false;
    const handler = createAcquisitionShardHandler({
      persistence: persistence(
        async () => control('active'),
        {
          ...shard,
          budget: { ...budget, maxRequests: budget.maxRequests + 1 },
        },
      ),
      executor: {
        networkAccess: 'none',
        execute: async () => {
          executed = true;
          return {};
        },
      },
    });

    await expect(handler(workContext())).rejects.toMatchObject({
      code: 'ACQUISITION_SHARD_BINDING_MISMATCH',
    });
    expect(executed).toBe(false);
  });

  it('honors cancellation that arrives after control validation but before executor dispatch', async () => {
    let checks = 0;
    let executed = false;
    const handler = createAcquisitionShardHandler({
      persistence: persistence(async () => control('active')),
      executor: {
        networkAccess: 'none',
        execute: async () => {
          executed = true;
          return {};
        },
      },
    });

    await expect(
      handler(
        workContext({
          isCancellationRequested: async () => {
            checks += 1;
            return checks >= 2;
          },
        }),
      ),
    ).rejects.toMatchObject({ code: 'WORK_CANCELLED' });
    expect(executed).toBe(false);
  });

  it('rejects any executor registration that attempts to widen network access', () => {
    const widenedExecutor = {
      networkAccess: 'network',
      execute: async () => ({}),
    } as unknown as AcquisitionShardExecutorRegistration;

    expect(() =>
      createAcquisitionShardHandler({
        persistence: persistence(async () => control('active')),
        executor: widenedExecutor,
      }),
    ).toThrow(RangeError);
  });
});
