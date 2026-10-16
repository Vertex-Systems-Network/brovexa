import { describe, expect, it, vi } from 'vitest';
import { purgeExpiredWebsiteLiveInspectionEvidence } from '@brovexa/db';
import { createM04LiveRetentionWorkerHandlers, M04_LIVE_RETENTION_WORK_TYPE } from './website-live-maintenance-worker';
import type { WorkHandlerContext } from './runtime';

vi.mock('@brovexa/db', () => ({
  purgeExpiredWebsiteLiveInspectionEvidence: vi.fn(async () => 3),
}));
const workspaceId='550e8400-e29b-41d4-a716-446655440000';
const context=():WorkHandlerContext=>({
  workType:M04_LIVE_RETENTION_WORK_TYPE,workVersion:2,
  workspaceId,workUnitId:'work.retention1',jobRunId:'job.1',correlationId:'cor.1',
  payload:{kind:'website_live_retention_v2'},attempt:1,
  isCancellationRequested:async()=>false,
});
function config(){return {
  enabled:true as const,pool:{connect:vi.fn()},maxRows:20,
  authorizeWorkspaceMaintenance:vi.fn(async()=>true),
};}

describe('M04 WEB-033 opt-in retention work unit',()=>{
  it('does not invoke maintenance hooks when the handler map is constructed',()=>{
    const d=config();
    const handlers=createM04LiveRetentionWorkerHandlers(d as never);
    expect(Object.keys(handlers)).toEqual([M04_LIVE_RETENTION_WORK_TYPE]);
    expect(d.authorizeWorkspaceMaintenance).not.toHaveBeenCalled();
    expect(purgeExpiredWebsiteLiveInspectionEvidence).not.toHaveBeenCalled();
  });
  it('rejects queue-supplied tenant IDs and extra parameters without accessing the DB',async()=>{
    const d=config();
    const handler=createM04LiveRetentionWorkerHandlers(d as never)[M04_LIVE_RETENTION_WORK_TYPE];
    await expect(handler({...context(),payload:{kind:'website_live_retention_v2',workspaceId:'different'}}))
      .rejects.toMatchObject({code:'M04_LIVE_RETENTION_WORK_INVALID'});
    expect(d.authorizeWorkspaceMaintenance).not.toHaveBeenCalled();
  });
  it('requires independent, tenant-scoped maintenance authorization',async()=>{
    const d=config();d.authorizeWorkspaceMaintenance.mockResolvedValueOnce(false);
    const handler=createM04LiveRetentionWorkerHandlers(d as never)[M04_LIVE_RETENTION_WORK_TYPE];
    await expect(handler(context())).rejects.toMatchObject({code:'M04_LIVE_RETENTION_UNAUTHORIZED'});
    expect(d.authorizeWorkspaceMaintenance).toHaveBeenCalledWith(workspaceId);
  });
  it('purges at most the configured cap and returns a stable work effect',async()=>{
    vi.mocked(purgeExpiredWebsiteLiveInspectionEvidence).mockResolvedValue(3);
    const handler=createM04LiveRetentionWorkerHandlers(config() as never)[M04_LIVE_RETENTION_WORK_TYPE];
    const result=await handler(context());
    expect(purgeExpiredWebsiteLiveInspectionEvidence).toHaveBeenCalledWith(expect.anything(),workspaceId,20);
    expect(result.effectKey).toMatch(/^m04\.website_live_retention\.[0-9a-f]{64}$/);
    expect(result.effectData).toEqual({workspaceId,deleted:3,maxRows:20,version:'2.0.0'});
  });
  it('fails before cleanup when the work unit was cancelled',async()=>{
    const handler=createM04LiveRetentionWorkerHandlers(config() as never)[M04_LIVE_RETENTION_WORK_TYPE];
    await expect(handler({...context(),isCancellationRequested:async()=>true}))
      .rejects.toMatchObject({code:'M04_LIVE_RETENTION_CANCELLED'});
  });
  it('retries temporary PostgreSQL failures without exposing details',async()=>{
    vi.mocked(purgeExpiredWebsiteLiveInspectionEvidence).mockRejectedValueOnce(
      Object.assign(new Error('internal DB connection secret'), {code:'08006'}),
    );
    const handler=createM04LiveRetentionWorkerHandlers(config() as never)[M04_LIVE_RETENTION_WORK_TYPE];
    await expect(handler(context())).rejects.toMatchObject({
      name:'RetryableWorkError',code:'M04_LIVE_RETENTION_TRANSIENT_DB',
    });
  });
  it('rejects an impossible database deletion acknowledgement',async()=>{
    vi.mocked(purgeExpiredWebsiteLiveInspectionEvidence).mockResolvedValueOnce(21);
    const handler=createM04LiveRetentionWorkerHandlers(config() as never)[M04_LIVE_RETENTION_WORK_TYPE];
    await expect(handler(context())).rejects.toMatchObject({code:'M04_LIVE_RETENTION_ACK_INVALID'});
  });
  it('classifies hung maintenance permission lookup as retryable',async()=>{
    const d={...config(),stageTimeoutMs:100,authorizeWorkspaceMaintenance:()=>new Promise<boolean>(()=>{})};
    const handler=createM04LiveRetentionWorkerHandlers(d as never)[M04_LIVE_RETENTION_WORK_TYPE];
    await expect(handler(context())).rejects.toMatchObject({code:'M04_LIVE_RETENTION_DEPENDENCY_TIMEOUT'});
  });
});