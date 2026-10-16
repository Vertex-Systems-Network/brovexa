import { describe, expect, it, vi } from 'vitest';
import { persistWebsiteLiveInspectionResult } from '@brovexa/db';
import { createM04LiveWorkerHandlers, M04_LIVE_WORK_TYPE } from './website-live-worker';
import { evaluateM04LiveM02HopContext } from './website-live-m02-admission';
import type { M04LiveM02HopInput, M04LiveReadRequest } from './website-live-acquisition';
import type { WorkHandlerContext } from './runtime';

// Real worker, M02 Zod + evaluator, DNS fence, extractor and v2 handoff.
// DNS/HTTPS/PG are the only injected I/O. No live network access.
vi.mock('@brovexa/db',()=>({
 WebsiteLivePersistenceError:class WebsiteLivePersistenceError extends Error {
  constructor(readonly code:string,message:string){super(message);}
 },
 persistWebsiteLiveInspectionResult:vi.fn(async(_pool:unknown,raw:{request:{inspectionId:string}})=>({
  inspectionId:raw.request.inspectionId,replayed:false,
 })),
 deleteWebsiteLiveInspectionEvidence:vi.fn(async()=>true),
}));
const now='2026-10-17T02:00:00.000Z',expiry='2026-10-17T02:04:00.000Z';
const workspaceId='550e8400-e29b-41d4-a716-446655440000',inspectionId='inspect.e2e';
const request:M04LiveReadRequest={
 version:'2.0.0',executionMode:'live',networkRequested:true,
 credentialedFetchRequested:false,rawPayloadRequested:false,outreachRequested:false,
 workspaceId,inspectionId,canonicalBusinessId:'business.e2e',
 domainVerificationId:'verification.e2e',verifiedDomain:'example.com',
 sourceKey:'source.qa_web',sourceAdmissionDecisionRef:'admission.e2e',
 sourcePolicyId:'policy.qa_web',sourcePolicyVersion:'1.0.0',
 transportPolicyId:'transport.qa_web',transportPolicyVersion:'1.0.0',
 targetUrl:'https://example.com/',maxResponseBytes:1024,timeoutMs:1000,
};
const html='<html><head><meta name="viewport" content="width=device-width"></head><body><form><input type="email"></form></body></html>';
function admission(hop:Readonly<M04LiveM02HopInput>,networkMode:'provider_network'|'disabled'='provider_network'){
 const sourceRequest={
  version:'1.0.0',requestId:'request.e2e',workspaceId,sourceTaskId:'task.e2e',
  connectorKey:'connector.qa_web',connectorVersion:'1.0.0',sourceKey:request.sourceKey,
  operation:'fetch',executionIntent:'execute',purpose:'website_inspection',
  intendedUse:'capability_assessment',requestedFields:['website'],
  requestedDataClassifications:['PUBLIC_BUSINESS'],
  geography:{countryCodes:[],areaRefs:[]},storageClass:'EVIDENCE_MINIMAL',
  exportRequested:false,rawPayloadRequested:false,robotsDecision:'allowed',
  targetUrl:request.targetUrl,query:{categories:[],externalRefs:[],filters:{}},
  pagination:{},budget:{maxRequests:1,maxPages:1,maxBytes:1024,maxCurrencyMicros:0,
   maxRuntimeMs:1000,maxConcurrency:1},
  policySnapshot:{policyId:hop.sourcePolicyId,policyVersion:hop.sourcePolicyVersion},
  requestedAt:now,
 };
 const transportRequestId='transport.request.e2e';
 return {
  workspaceId:hop.workspaceId,inspectionId:hop.inspectionId,expiresAt:expiry,
  admissionInput:{
   policy:{
    version:'1.0.0',transportPolicyId:hop.transportPolicyId,
    transportPolicyVersion:hop.transportPolicyVersion,
    connectorKey:sourceRequest.connectorKey,connectorVersion:sourceRequest.connectorVersion,
    sourcePolicySnapshot:sourceRequest.policySnapshot,
    networkMode,allowedSchemes:['https'],allowCleartextHttp:false,
    allowedMethods:['GET'],allowedPorts:[443],allowIpLiteralHosts:false,
    hostPolicy:{mode:'allowlist',exactHosts:['example.com'],domainSuffixes:[],deniedHosts:[]},
    redirects:{maxHops:0,revalidateEachHop:true},
    dns:{requireFreshResolutionEachHop:true,blockNonPublicAddressClasses:true,maxResolutionAgeSeconds:30},
    limits:{maxResponseBytes:1024,maxTimeoutMs:1000},allowedContentTypes:['text/html'],
    security:{ambientCredentialsProhibited:true,urlCredentialsProhibited:true,
     proxyAuthFromEnvironmentProhibited:true},
   },
   sourceRequest,
   request:{version:'1.0.0',transportRequestId,sourceRequestId:sourceRequest.requestId,
    sourceTaskId:sourceRequest.sourceTaskId,connectorKey:sourceRequest.connectorKey,
    connectorVersion:sourceRequest.connectorVersion,url:hop.canonicalUrl,
    method:'GET',transportKind:'network',redirectHop:0,maxResponseBytes:hop.maxResponseBytes,
    timeoutMs:hop.timeoutMs,acceptedContentTypes:['text/html'],requestedAt:now},
   resolution:{transportRequestId,url:hop.canonicalUrl,hostname:'example.com',resolvedAt:now,
    addresses:[{address:hop.resolvedIpv4,family:4,classification:'public'}]},
   evaluatedAt:now,
  },
 };
}
function ctx():WorkHandlerContext{
 return {workType:M04_LIVE_WORK_TYPE,workVersion:2,workspaceId,
  workUnitId:'work.e2e',jobRunId:'run.e2e',correlationId:'correlation.e2e',
  payload:{kind:'website_live_v2',inspectionId},attempt:1,
  isCancellationRequested:async()=>false};
}
function harness(networkMode:'provider_network'|'disabled'='provider_network'){
 const permit={...request,decision:'allow' as const,permission:'live_root_read' as const,
  networkApproved:true as const,credentialsApproved:false as const,
  outreachApproved:false as const,rawBodyRetentionApproved:false as const,expiresAt:expiry};
 const loadRequest=vi.fn(async()=>request);
 const loadPermit=vi.fn(async()=>permit);
 const resolveAddresses=vi.fn(async()=>['8.8.8.8']);
 const transport=vi.fn(async()=>({
  status:200,contentType:'text/html',contentEncoding:'identity',
  body:new TextEncoder().encode(html),
 }));
 const admitM02Hop=vi.fn(async(hop:Readonly<M04LiveM02HopInput>)=>
  evaluateM04LiveM02HopContext(hop,admission(hop,networkMode),new Date(now)));
 const getStoragePolicy=vi.fn(async()=>({
  workspaceId,inspectionId,retentionTtlSeconds:3600,deletionRequired:true as const,
 }));
 const deps={enabled:true as const,pool:{connect:vi.fn()},
  loadRequest,loadPermit,resolveAddresses,transport,admitM02Hop,getStoragePolicy,
  authorizeDeletion:vi.fn(async()=>false),now:()=>new Date(now),cancellationPollMs:100};
 const handler=createM04LiveWorkerHandlers(deps as never)[M04_LIVE_WORK_TYPE];
 return {deps,loadRequest,loadPermit,resolveAddresses,transport,admitM02Hop,
  getStoragePolicy,handler};
}
describe('WEB-048 QA-07/08 full worker acquisition (mock I/O, real M02 evaluator)',()=>{
 it('passes owner permit, public DNS, real M02 admission, transient HTML and v2-only persistence',async()=>{
  vi.mocked(persistWebsiteLiveInspectionResult).mockClear();
  const h=harness();
  const done=await h.handler(ctx());
  expect(done.effectKey).toMatch(/^m04\.website_live\.[0-9a-f]{64}$/);
  expect(done.effectData).toMatchObject({inspectionId,replayed:false,
   version:'2.0.0',bodyIncluded:false,executionMode:'live'});
  expect(h.loadRequest).toHaveBeenCalledWith({workspaceId,inspectionId});
  expect(h.loadPermit).toHaveBeenCalledWith({workspaceId,inspectionId});
  expect(h.resolveAddresses).toHaveBeenCalledWith('example.com');
  expect(h.admitM02Hop).toHaveBeenCalledOnce();
  expect(h.transport).toHaveBeenCalledOnce();
  expect(h.getStoragePolicy).toHaveBeenCalledWith({workspaceId,inspectionId});
  expect(persistWebsiteLiveInspectionResult).toHaveBeenCalledOnce();
  const payload=vi.mocked(persistWebsiteLiveInspectionResult).mock.calls[0]?.[1];
  expect(payload?.version).toBe('2.0.0');
  expect(payload?.status).toBe('review_required');
  expect(payload?.coverage).toBe('partial');
  expect(payload?.bodyIncluded).toBe(false);
  expect(payload?.receipt.bodySha256).toMatch(/^[0-9a-f]{64}$/);
  expect(payload?.observations.some(x=>x.observation==='observed_present')).toBe(true);
  expect(JSON.stringify(payload)).not.toContain(html);
 });
 it('denies disabled transport policy before DNS-approved HTTPS transport or persistence',async()=>{
  vi.mocked(persistWebsiteLiveInspectionResult).mockClear();
  const h=harness('disabled');
  await expect(h.handler(ctx())).rejects.toMatchObject({
   name:'PermanentWorkError',code:'M04_LIVE_M02_ADMISSION_DENIED'});
  expect(h.transport).not.toHaveBeenCalled();
  expect(persistWebsiteLiveInspectionResult).not.toHaveBeenCalled();
 });
 it('rejects workspace-forged permission before DNS, transport or DB effects',async()=>{
  vi.mocked(persistWebsiteLiveInspectionResult).mockClear();
  const h=harness();
  h.deps.loadPermit.mockResolvedValueOnce({
   ...request,decision:'allow' as const,permission:'live_root_read' as const,
   networkApproved:true as const,credentialsApproved:false as const,
   outreachApproved:false as const,rawBodyRetentionApproved:false as const,
   expiresAt:expiry,workspaceId:'550e8400-e29b-41d4-a716-446655440001'});
  await expect(h.handler(ctx())).rejects.toMatchObject({
   name:'PermanentWorkError',code:'M04_LIVE_PERMIT_INVALID'});
  expect(h.resolveAddresses).not.toHaveBeenCalled();
  expect(h.transport).not.toHaveBeenCalled();
  expect(persistWebsiteLiveInspectionResult).not.toHaveBeenCalled();
 });
});
