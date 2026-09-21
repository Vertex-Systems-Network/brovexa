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

const workspaceId = '00000000-0000-0000-0000-000000000001';
const researchJobId = 'research-job-1';
const shardId = 'shard-1';
const workUnitId = '00000000-0000-0000-0000-000000000002';
const jobRunId = '00000000-0000-0000-0000-000000000003';
const correlationId = '00000000-0000-0000-0000-000000000004';

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
  shardKey: 'geo-a',
  ordinal: 0,
  sourceKeys: ['source.test'],
  budget,
  createdAt: new Date('2026-09-15T12:00:00.000Z'),
};

function control(state: PersistedResearchJobControl['state']): PersistedResearchJobControl {
  return {
    researchJobId,
    workspaceId,
    version: 1,
    state,
    reasonCode: null,
    changedAt: new Date('2026-09-15T12:00:00.000Z'),
    createdAt: new Date('2026-09-15T12:00:00.000Z'),
  };
}

function workContext(
  overrides: Partial<WorkHandlerContext> = {},
): WorkHandlerContext {
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

function persistence(states: PersistedResearchJobControl['state'][]): AcquisitionShardRuntimePersistence {
  let controlRead = 0;
  return {
    getShard: async () => shard,
    getControl: async () => {
      const state = states[Math.min(controlRead, states.length - 1)] ?? 'active';
      controlRead += 1;
      return control(state);
    },
  };
}

describe('acquisition shard runtime', () => {
  it('executes an active shard and seals canonical orchestration identity into the effect', async () => {
    let executed = 0;
    const executor: AcquisitionShardExecutorRegistration = {
      networkAccess: 'none',
      execute: async (context) => {
        executed += 1;
        await context.assertMayDispatch();
        return { effectData: { dispatchedUnits: 2, shardId: 'cannot-override' } };
      },
    };
    const handler = createAcquisitionShardHandler({ persistence: persistence(['active']), executor });

    const result = await handler(workContext());

    expect(executed).toBe(1);
    expect(result.effectKey).toBe(ACQUISITION_SHARD_ORCHESTRATED_EFFECT);
    expect(result.effectData).toMatchObject({
      kind: 'research_acquisition_shard_orchestrated',
      researchJobId,
      shardId,
      shardKey: 'geo-a',
      ordinal: 0,
      dispatchedUnits: 2,
    });
  });

  it('fails closed before executor dispatch while the research job is paused', async () => {
    let executed = false;
    const handler = createAcquisitionShardHandler({
      persistence: persistence(['paused']),
      executor: {
        networkAccess: 'none',
        execute: async () => {
          executed = true;
          return {};
        },
      },
    });

    await expect(handler(workContext())).rejects.toMatchObject({ code: 'ACQUISITION_CONTROL_PAUSED' });
    expect(executed).toBe(false);
  });

  it('observes a pause that happens after claim but before child dispatch', async () => {
    let dispatched = false;
    const handler = createAcquisitionShardHandler({
      persistence: persistence(['active', 'paused']),
      executor: {
        networkAccess: 'none',
        execute: async (context) => {
          await context.assertMayDispatch();
          dispatched = true;
          return {};
        },
      },
    });

    await expect(handler(workContext())).rejects.toMatchObject({ code: 'ACQUISITION_CONTROL_PAUSED' });
    expect(dispatched).toBe(false);
  });

  it('treats terminal cancel and kill controls as cancellation boundaries', async () => {
    for (const [state, code] of [
      ['cancelled', 'ACQUISITION_CONTROL_CANCELLED'],
      ['killed', 'ACQUISITION_CONTROL_KILLED'],
    ] as const) {
      const handler = createAcquisitionShardHandler({
        persistence: persistence([state]),
        executor: { networkAccess: 'none', execute: async () => ({}) },
      });
      await expect(handler(workContext())).rejects.toMatchObject({ code });
    }
  });

  it('honors canonical work cancellation before any executor work', async () => {
    let executed = false;
    const handler = createAcquisitionShardHandler({
      persistence: persistence(['active']),
      executor: {
        networkAccess: 'none',
        execute: async () => {
          executed = true;
          return {};
        },
      },
    });

    await expect(
      handler(workContext({ isCancellationRequested: async () => true })),
    ).rejects.toMatchObject({ code: 'WORK_CANCELLED' });
    expect(executed).toBe(false);
  });

  it('rejects persisted shard identity drift before execution', async () => {
    const handler = createAcquisitionShardHandler({
      persistence: {
        getShard: async () => ({ ...shard, shardKey: 'different-shard' }),
        getControl: async () => control('active'),
      },
      executor: { networkAccess: 'none', execute: async () => ({}) },
    });

    await expect(handler(workContext())).rejects.toMatchObject({
      code: 'ACQUISITION_SHARD_BINDING_MISMATCH',
    });
  });

  it('rejects malformed acquisition work before persistence lookup', async () => {
    let lookedUp = false;
    const handler = createAcquisitionShardHandler({
      persistence: {
        getShard: async () => {
          lookedUp = true;
          return shard;
        },
        getControl: async () => control('active'),
      },
      executor: { networkAccess: 'none', execute: async () => ({}) },
    });

    await expect(
      handler(workContext({ workType: 'foundation.noop' })),
    ).rejects.toMatchObject({ code: 'ACQUISITION_SHARD_PAYLOAD_INVALID' });
    expect(lookedUp).toBe(false);
  });
});
