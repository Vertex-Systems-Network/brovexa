import { describe, expect, it, vi } from 'vitest';
import {
  WebsiteInspectionRequestSchema,
  WebsiteInspectionResultSchema,
} from '@brovexa/contracts';
import {
  createWebsiteInspectionFixtureWorkerHandlers,
} from './website-inspection-worker-registration';
import { M04_WEBSITE_INSPECTION_WORK_TYPE } from './website-inspection-worker';

const WORKSPACE = '550e8400-e29b-41d4-a716-446655440000';
function deps() {
  return {
    contracts: {
      parseRequest: (value: unknown) => WebsiteInspectionRequestSchema.parse(value),
      parseResult: (value: unknown) => WebsiteInspectionResultSchema.parse(value),
    },
    loadRequest: vi.fn(async () => null),
    lookup: vi.fn(async () => null),
    exchange: vi.fn(async () => { throw new Error('Network/fixtures not called by registration'); }),
    storage: {
      policyForWorkspace: vi.fn(async (workspaceId: string) => ({
        workspaceId, retentionTtlSeconds: 86400, deletionRequired: true as const,
      })),
      persist: vi.fn(async () => ({ inspectionId: 'inspection.001', replayed: false })),
    },
  };
}

describe('M04 WEB-025 explicit worker-registration factory (staged)', () => {
  it('only constructs a frozen work-type map without opening any transport or DB', () => {
    const config = deps();
    const handlers = createWebsiteInspectionFixtureWorkerHandlers(config);
    expect(Object.isFrozen(handlers)).toBe(true);
    expect(Object.keys(handlers)).toEqual([M04_WEBSITE_INSPECTION_WORK_TYPE]);
    expect(config.loadRequest).not.toHaveBeenCalled();
    expect(config.lookup).not.toHaveBeenCalled();
    expect(config.exchange).not.toHaveBeenCalled();
    expect(config.storage.persist).not.toHaveBeenCalled();
  });

  it('keeps trusted request lookup required before any fixture transport', async () => {
    const config = deps();
    const handlers = createWebsiteInspectionFixtureWorkerHandlers(config);
    await expect(handlers[M04_WEBSITE_INSPECTION_WORK_TYPE]({
      workType: M04_WEBSITE_INSPECTION_WORK_TYPE,
      workVersion: 1,
      workUnitId: 'work.001', jobRunId: 'job.001', workspaceId: WORKSPACE,
      correlationId: 'trace.001', attempt: 1,
      payload: { kind: 'website_inspection_fixture', inspectionId: 'inspection.001' },
      isCancellationRequested: async () => false,
    })).rejects.toMatchObject({ code: 'M04_WORK_REQUEST_MISSING' });
    expect(config.loadRequest).toHaveBeenCalledTimes(1);
    expect(config.exchange).not.toHaveBeenCalled();
    expect(config.storage.persist).not.toHaveBeenCalled();
  });
});