import { describe,it,expect,vi } from 'vitest';
import { getWebsiteLiveGrant } from '@brovexa/db';
import { createM04DbLiveWorkerHandlers } from './website-live-db-worker-registration';
import { M04_LIVE_WORK_TYPE } from './website-live-worker';

vi.mock('@brovexa/db',()=>({getWebsiteLiveGrant:vi.fn(async()=>null)}));
const workspaceId='550e8400-e29b-41d4-a716-446655440000';
const scope={workspaceId,inspectionId:'inspection.1'};
function options(){return {
 enabled:true as const,pool:{query:vi.fn(),connect:vi.fn()},
 authorizeDeletion:vi.fn(async()=>false),requestLoadTimeoutMs:100,
};}
describe('WEB-035 DB-backed live handler composition',()=>{
 it('does not query DB or launch the worker until a work unit actually starts',()=>{
  const registered=createM04DbLiveWorkerHandlers(options() as never);
  expect(Object.keys(registered)).toEqual([M04_LIVE_WORK_TYPE]);
  expect(getWebsiteLiveGrant).not.toHaveBeenCalled();
 });
 it('never accepts a domain URL or approval supplied by an untrusted queue payload',async()=>{
  const registered=createM04DbLiveWorkerHandlers(options() as never);
  await expect(registered[M04_LIVE_WORK_TYPE]!({
   workType:M04_LIVE_WORK_TYPE,workVersion:2,workspaceId,
   workUnitId:'work.1',jobRunId:'run.1',correlationId:'cor.1',attempt:1,
   payload:{kind:'website_live_v2',inspectionId:scope.inspectionId,verifiedDomain:'untrusted.example'},
   isCancellationRequested:async()=>false,
  })).rejects.toMatchObject({code:'M04_LIVE_WORK_PAYLOAD_INVALID'});
  expect(getWebsiteLiveGrant).not.toHaveBeenCalled();
 });
 it('fails closed if no active, tenant-scoped, owner-approved grant exists',async()=>{
  const registered=createM04DbLiveWorkerHandlers(options() as never);
  await expect(registered[M04_LIVE_WORK_TYPE]!({
   workType:M04_LIVE_WORK_TYPE,workVersion:2,workspaceId,
   workUnitId:'work.2',jobRunId:'run.1',correlationId:'cor.2',attempt:1,
   payload:{kind:'website_live_v2',inspectionId:scope.inspectionId},
   isCancellationRequested:async()=>false,
  })).rejects.toMatchObject({code:'M04_LIVE_WORK_REQUEST_MISSING'});
  expect(getWebsiteLiveGrant).toHaveBeenCalledWith(expect.anything(),scope);
 });
});