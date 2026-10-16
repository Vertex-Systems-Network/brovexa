import {describe,it,expect,vi} from 'vitest';
import { M04LiveAsyncBoundaryError } from './website-live-async-boundary';
import { M04LiveAcquisitionError } from './website-live-acquisition';
import {createM04LiveWorkerHandlers,M04_LIVE_WORK_TYPE} from './website-live-worker';
import type {WorkHandlerContext} from './runtime';
vi.mock('./website-live-native-integration',()=>({
  inspectAndPersistM04LiveRoot:vi.fn(async(req:{inspectionId:string})=>({inspectionId:req.inspectionId,replayed:false})),
}));
const workspaceId='550e8400-e29b-41d4-a716-446655440000';
const request=()=>({
 version:'2.0.0',executionMode:'live',networkRequested:true,credentialedFetchRequested:false,
 rawPayloadRequested:false,outreachRequested:false,workspaceId,inspectionId:'inspect.live1',
 canonicalBusinessId:'business.1',domainVerificationId:'verify.1',verifiedDomain:'example.com',
 sourceKey:'source.approved_web',sourceAdmissionDecisionRef:'admission.1',
 sourcePolicyId:'policy.1',sourcePolicyVersion:'1.0.0',transportPolicyId:'transport.1',
 transportPolicyVersion:'1.0.0',targetUrl:'https://example.com/',maxResponseBytes:1024,timeoutMs:1000,
});
const ctx=(payload:unknown={kind:'website_live_v2',inspectionId:'inspect.live1'}):WorkHandlerContext=>({
 workType:M04_LIVE_WORK_TYPE,workVersion:2,workspaceId,workUnitId:'work.1',jobRunId:'job.1',
 correlationId:'correlation.1',payload:payload as Record<string,unknown>,attempt:1,
 isCancellationRequested:async()=>false,
});
function deps(loadRequest=vi.fn(async()=>request())){
 return {enabled:true as const,loadRequest,loadPermit:vi.fn(),admitM02Hop:vi.fn(),
  getStoragePolicy:vi.fn(),authorizeDeletion:vi.fn(),pool:{connect:vi.fn()},cancellationPollMs:100};
}
describe('M04 live worker registration',()=>{
 it('constructs only an opt-in handler; no callback is invoked by registration',()=>{
  const d=deps();const handlers=createM04LiveWorkerHandlers(d as never);
  expect(Object.keys(handlers)).toEqual([M04_LIVE_WORK_TYPE]);
  expect(d.loadRequest).not.toHaveBeenCalled();
 });
 it('rejects queue-provided domain and permission fields before trusted read',async()=>{
  const d=deps(),handler=createM04LiveWorkerHandlers(d as never)[M04_LIVE_WORK_TYPE];
  await expect(handler(ctx({kind:'website_live_v2',inspectionId:'inspect.live1',targetUrl:'https://evil.com/'})))
   .rejects.toMatchObject({code:'M04_LIVE_WORK_PAYLOAD_INVALID'});
  expect(d.loadRequest).not.toHaveBeenCalled();
 });
 it('fetches request through tenant-scoped trusted identity and emits only safe metadata',async()=>{
  const d=deps(),handler=createM04LiveWorkerHandlers(d as never)[M04_LIVE_WORK_TYPE];
  const result=await handler(ctx());
  expect(d.loadRequest).toHaveBeenCalledWith({workspaceId,inspectionId:'inspect.live1'});
  expect(result.effectData).toEqual({inspectionId:'inspect.live1',replayed:false,
   version:'2.0.0',bodyIncluded:false,executionMode:'live'});
 });
 it('classifies a timed-out trusted asynchronous stage as retryable',async()=>{
  const integration=await import('./website-live-native-integration');
  vi.mocked(integration.inspectAndPersistM04LiveRoot).mockRejectedValueOnce(
    new M04LiveAsyncBoundaryError('M04_LIVE_TIMEOUT'),
  );
  const d=deps(),handler=createM04LiveWorkerHandlers(d as never)[M04_LIVE_WORK_TYPE];
  await expect(handler(ctx())).rejects.toMatchObject({
    name:'RetryableWorkError',code:'M04_LIVE_STAGE_TIMEOUT',
  });
 });
 it('retries transport timeout but never retries a forbidden DNS destination',async()=>{
  const integration=await import('./website-live-native-integration');
  const d=deps(),handler=createM04LiveWorkerHandlers(d as never)[M04_LIVE_WORK_TYPE];
  vi.mocked(integration.inspectAndPersistM04LiveRoot).mockRejectedValueOnce(
    new M04LiveAcquisitionError('M04_LIVE_TRANSPORT_FAILED'),
  );
  await expect(handler(ctx())).rejects.toMatchObject({
    name:'RetryableWorkError',code:'M04_LIVE_TRANSPORT_FAILED',
  });
  vi.mocked(integration.inspectAndPersistM04LiveRoot).mockRejectedValueOnce(
    new M04LiveAcquisitionError('M04_LIVE_DNS_NONPUBLIC'),
  );
  await expect(handler(ctx())).rejects.toMatchObject({
    name:'PermanentWorkError',code:'M04_LIVE_DNS_NONPUBLIC',
  });
 });
 it('treats transient PostgreSQL failures as retryable with a non-sensitive code',async()=>{
  const integration=await import('./website-live-native-integration');
  const d=deps(),handler=createM04LiveWorkerHandlers(d as never)[M04_LIVE_WORK_TYPE];
  vi.mocked(integration.inspectAndPersistM04LiveRoot).mockRejectedValueOnce(
    Object.assign(new Error('connection secrets must not leak'),{code:'08006'}),
  );
  await expect(handler(ctx())).rejects.toMatchObject({
    name:'RetryableWorkError',code:'M04_LIVE_TRANSIENT_DEPENDENCY',
  });
 });
 it('cancels before any request on worker cancellation',async()=>{
  const d=deps(),handler=createM04LiveWorkerHandlers(d as never)[M04_LIVE_WORK_TYPE];
  await expect(handler({...ctx(),isCancellationRequested:async()=>true}))
   .rejects.toMatchObject({code:'M04_LIVE_WORK_CANCELLED'});
  expect(d.loadRequest).not.toHaveBeenCalled();
 });
});

describe('WEB-032 bounded live worker cancellation-store polling',()=>{
 it('fails retryably before tenant request lookup if the first cancellation-store read never returns',async()=>{
  const d=deps(),handlers=createM04LiveWorkerHandlers({...d,cancellationCheckTimeoutMs:100} as never);
  await expect(handlers[M04_LIVE_WORK_TYPE]({
    ...ctx(),isCancellationRequested:()=>new Promise<boolean>(()=>{}),
  })).rejects.toMatchObject({name:'RetryableWorkError',code:'M04_LIVE_CANCELLATION_CHECK_FAILED'});
  expect(d.loadRequest).not.toHaveBeenCalled();
 });
 it('rejects cancellation polling timeout settings outside the safe range',()=>{
  expect(()=>createM04LiveWorkerHandlers({...deps(),cancellationCheckTimeoutMs:30001} as never)).toThrow(RangeError);
 });
 it('interrupts a hung request lookup when later canonical cancellation is observed',async()=>{
  const d=deps(vi.fn(()=>new Promise<ReturnType<typeof request>>(()=>{})));
  const handler=createM04LiveWorkerHandlers({...d,cancellationPollMs:100,cancellationCheckTimeoutMs:100} as never)[M04_LIVE_WORK_TYPE];
  let checks=0;
  await expect(handler({
   ...ctx(),isCancellationRequested:async()=>++checks>1,
  })).rejects.toMatchObject({name:'CancelledWorkError',code:'M04_LIVE_WORK_CANCELLED'});
  expect(d.loadRequest).toHaveBeenCalledOnce();
 });
});


describe('WEB-034 bounded trusted live request lookup',()=>{
 it('fails retryably when tenant request store hangs while cancellation stays false',async()=>{
  const d=deps(vi.fn(()=>new Promise<ReturnType<typeof request>>(()=>{})));
  const handler=createM04LiveWorkerHandlers({...d,requestLoadTimeoutMs:100} as never)[M04_LIVE_WORK_TYPE];
  await expect(handler(ctx())).rejects.toMatchObject({
   name:'RetryableWorkError',code:'M04_LIVE_STAGE_TIMEOUT',
  });
  expect(d.loadRequest).toHaveBeenCalledOnce();
 });
 it('rejects request lookup timeouts outside bounded contract before any I/O',()=>{
  const d=deps();
  expect(()=>createM04LiveWorkerHandlers({...d,requestLoadTimeoutMs:0} as never)).toThrow(RangeError);
  expect(()=>createM04LiveWorkerHandlers({...d,requestLoadTimeoutMs:30_001} as never)).toThrow(RangeError);
  expect(d.loadRequest).not.toHaveBeenCalled();
 });
});