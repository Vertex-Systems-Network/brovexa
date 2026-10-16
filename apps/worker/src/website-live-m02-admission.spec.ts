import {describe,it,expect,vi} from 'vitest';
import {createM04LiveM02HopAdmission} from './website-live-m02-admission';
import {evaluateSourceTransportAdmission} from '@brovexa/contracts';
vi.mock('@brovexa/contracts',()=>({
 SourceTransportAdmissionInputSchema:{parse:(x:unknown)=>x},
 evaluateSourceTransportAdmission:vi.fn((input:{request:{url:string;maxResponseBytes:number;timeoutMs:number}})=>({
  decision:'allow',canonicalUrl:input.request.url,
  transportPolicyId:'transport.web',transportPolicyVersion:'1.0.0',
  maxResponseBytes:input.request.maxResponseBytes,timeoutMs:input.request.timeoutMs,port:443,
 })),
}));
const now='2026-10-16T11:00:00.000Z';
const hop=()=>({workspaceId:'550e8400-e29b-41d4-a716-446655440000',inspectionId:'inspect.1',
 canonicalUrl:'https://example.com/',resolvedIpv4:'8.8.8.8',maxResponseBytes:2000,timeoutMs:1000,
 transportPolicyId:'transport.web',transportPolicyVersion:'1.0.0',
 sourceKey:'source.approved_web',sourcePolicyId:'policy.web',sourcePolicyVersion:'1.0.0'});
const ctx=(h=hop())=>({workspaceId:h.workspaceId,inspectionId:h.inspectionId,
 expiresAt:'2026-10-16T11:02:00.000Z',
 admissionInput:{policy:{transportPolicyId:h.transportPolicyId,transportPolicyVersion:h.transportPolicyVersion,
  networkMode:'provider_network'},
  sourceRequest:{workspaceId:h.workspaceId,sourceKey:h.sourceKey,executionIntent:'execute',operation:'fetch',
   rawPayloadRequested:false,exportRequested:false,robotsDecision:'allowed',targetUrl:h.canonicalUrl,
   policySnapshot:{policyId:h.sourcePolicyId,policyVersion:h.sourcePolicyVersion}},
  request:{url:h.canonicalUrl,method:'GET',redirectHop:0,transportKind:'network',
   maxResponseBytes:h.maxResponseBytes,timeoutMs:h.timeoutMs,acceptedContentTypes:['text/html']},
  resolution:{url:h.canonicalUrl,hostname:'example.com',addresses:[{family:4,address:h.resolvedIpv4,classification:'public'}]},
  evaluatedAt:now,
 }});
describe('M04 real M02 adapter boundary',()=>{
 it('permits only a fresh and fully pinned evaluator allow decision',async()=>{
  const loadContext=vi.fn(async()=>ctx());
  const fn=createM04LiveM02HopAdmission({loadContext,now:()=>new Date(now)});
  await expect(fn(hop())).resolves.toMatchObject({decision:'allow',transportKind:'network',resolvedIpv4:'8.8.8.8'});
  expect(loadContext).toHaveBeenCalledWith({workspaceId:hop().workspaceId,inspectionId:hop().inspectionId});
 });
 it('denies stale approvals, private injected resolutions and changed origin',async()=>{
  for(const altered of [
   {...ctx(),expiresAt:'2026-10-16T10:59:00.000Z'},
   {...ctx(),admissionInput:{...ctx().admissionInput,resolution:{
    ...ctx().admissionInput.resolution,addresses:[{family:4,address:'127.0.0.1',classification:'public'}]}}},
   {...ctx(),admissionInput:{...ctx().admissionInput,request:{...ctx().admissionInput.request,url:'https://evil.com/'}}},
  ]) {
   const fn=createM04LiveM02HopAdmission({loadContext:async()=>altered,now:()=>new Date(now)});
   await expect(fn(hop())).rejects.toMatchObject({code:expect.stringMatching(/^M04_M02_/)});
  }
 });
 it('denies a real M02 evaluator blocked response',async()=>{
  vi.mocked(evaluateSourceTransportAdmission).mockReturnValueOnce({decision:'blocked',canonicalUrl:hop().canonicalUrl,
   transportPolicyId:'transport.web',transportPolicyVersion:'1.0.0',maxResponseBytes:2000,timeoutMs:1000,port:443} as never);
  const fn=createM04LiveM02HopAdmission({loadContext:async()=>ctx(),now:()=>new Date(now)});
  await expect(fn(hop())).rejects.toMatchObject({code:'M04_M02_ADMISSION_DENIED'});
 });
});