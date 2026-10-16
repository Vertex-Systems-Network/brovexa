import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acquireAuthorizedM04LiveRoot, isPublicM04Ipv4,
  fetchPinnedLiveWebsite, M04LiveAcquisitionError,
} from '../apps/worker/src/website-live-acquisition.ts';
const NOW='2026-10-16T11:00:00.000Z';
const request=()=>({
  version:'2.0.0',executionMode:'live',networkRequested:true,
  credentialedFetchRequested:false,rawPayloadRequested:false,outreachRequested:false,
  workspaceId:'550e8400-e29b-41d4-a716-446655440000',inspectionId:'inspection.42',
  canonicalBusinessId:'business.42',domainVerificationId:'verification.42',verifiedDomain:'example.com',
  sourceKey:'source.approved_web',sourceAdmissionDecisionRef:'admission.42',
  sourcePolicyId:'policy.web',sourcePolicyVersion:'1.0.0',
  transportPolicyId:'transport.web',transportPolicyVersion:'1.0.0',
  targetUrl:'https://example.com/',maxResponseBytes:2000,timeoutMs:1000,
});
const permit=(r=request())=>({
  workspaceId:r.workspaceId, inspectionId:r.inspectionId,canonicalBusinessId:r.canonicalBusinessId,
  domainVerificationId:r.domainVerificationId,verifiedDomain:r.verifiedDomain,
  sourceKey:r.sourceKey,sourceAdmissionDecisionRef:r.sourceAdmissionDecisionRef,
  sourcePolicyId:r.sourcePolicyId,sourcePolicyVersion:r.sourcePolicyVersion,
  transportPolicyId:r.transportPolicyId,transportPolicyVersion:r.transportPolicyVersion,
  decision:'allow',permission:'live_root_read',networkApproved:true,
  credentialsApproved:false,outreachApproved:false,rawBodyRetentionApproved:false,
  maxResponseBytes:3000,timeoutMs:2000,expiresAt:'2026-10-16T12:00:00.000Z',
});
const html=Uint8Array.from(new TextEncoder().encode('<!doctype html><html><body>safe site</body></html>'));
const good=()=>({status:200,contentType:'text/html;charset=utf-8',contentEncoding:'identity',body:html});
const fixture=(overrides={})=>{
  const state={load:0,dns:0,transport:0};
  const deps={
    enabled:true, now:()=>new Date(NOW),
    async admitM02Hop(hop){return {...hop,decision:'allow',transportKind:'network',expiresAt:'2026-10-16T11:02:00.000Z'};},
    async loadPermit(key){state.load++;assert.deepEqual(key,{workspaceId:request().workspaceId,inspectionId:request().inspectionId});return permit();},
    async resolveAddresses(host){state.dns++;assert.equal(host,'example.com');return ['8.8.8.8'];},
    async transport(input){state.transport++;assert.equal(input.ipv4,'8.8.8.8');assert.equal(input.url,'https://example.com/');return good();},
    ...overrides,
  };
  return {deps,state};
};
const code=async (promise,expected)=>assert.rejects(promise,e=>e instanceof M04LiveAcquisitionError && e.code===expected);

test('live explicit permit and pinned public A allow transient HTTPS body and evidence-only receipt',async()=>{
  const {deps,state}=fixture();const out=await acquireAuthorizedM04LiveRoot(request(),deps);
  assert.deepEqual(state,{load:1,dns:1,transport:1});
  assert.equal(out.receipt.executionMode,'live');assert.equal(out.receipt.networkRequested,true);
  assert.equal(out.receipt.rawBodyRetained,false);assert.equal(out.receipt.remoteIpv4,'8.8.8.8');
  assert.equal(out.receipt.bodyLength,html.length);assert.equal(out.receipt.bodySha256.length,64);
  assert.equal(JSON.stringify(out.receipt).includes('safe site'),false);
});

test('no explicit opt-in never calls grant/DNS/transport',async()=>{
 const {deps,state}=fixture({enabled:false});await code(acquireAuthorizedM04LiveRoot(request(),deps),'M04_LIVE_DISABLED');
 assert.deepEqual(state,{load:0,dns:0,transport:0});
});

test('live intent cannot request credentials, outreach, body retention, or fake target',async t=>{
 for(const [key,value,expected] of [
  ['credentialedFetchRequested',true,'M04_LIVE_INTENT_INVALID'],
  ['rawPayloadRequested',true,'M04_LIVE_INTENT_INVALID'],
  ['outreachRequested',true,'M04_LIVE_INTENT_INVALID'],
  ['version','1.0.0','M04_LIVE_INTENT_INVALID'],
  ['executionMode','test_only','M04_LIVE_INTENT_INVALID'],
  ['networkRequested',false,'M04_LIVE_INTENT_INVALID'],
  ['targetUrl','https://example.com/?token=x','M04_LIVE_TARGET_INVALID'],
  ['targetUrl','https://example.com.attacker.test/','M04_LIVE_TARGET_INVALID'],
  ['targetUrl','http://example.com/','M04_LIVE_TARGET_INVALID'],
 ])await t.test(key,async()=>{const {deps,state}=fixture();await code(acquireAuthorizedM04LiveRoot({...request(),[key]:value},deps),expected);assert.equal(state.load,0);});
});

test('invalid policy/tenant/scope, reserved suffix, or unsafe budget rejected pre-admission',async t=>{
 for(const patch of [
  {workspaceId:'bad uuid'}, {verifiedDomain:'admin.internal',targetUrl:'https://admin.internal/'},
  {verifiedDomain:'127.0.0.1',targetUrl:'https://127.0.0.1/'},
  {maxResponseBytes:1000001}, {timeoutMs:20}, {sourceKey:'provider.raw'},
 ])await t.test(JSON.stringify(patch),async()=>{const {deps,state}=fixture();await assert.rejects(acquireAuthorizedM04LiveRoot({...request(),...patch},deps),M04LiveAcquisitionError);assert.equal(state.load,0);});
});

test('independent permission must bind every claimed identity field',async t=>{
 for(const key of [
  'workspaceId','inspectionId','canonicalBusinessId','domainVerificationId','verifiedDomain',
  'sourceKey','sourceAdmissionDecisionRef','sourcePolicyId','sourcePolicyVersion',
  'transportPolicyId','transportPolicyVersion',
 ])await t.test(key,async()=>{const {deps,state}=fixture({loadPermit:async()=>({...permit(),[key]:'forged'})});await code(acquireAuthorizedM04LiveRoot(request(),deps),'M04_LIVE_PERMIT_INVALID');assert.equal(state.dns,0);});
});

test('no grant, expired grant, denied network, enlarged budgets fail before DNS',async t=>{
 for(const override of [
  null, {...permit(),decision:'blocked'}, {...permit(),networkApproved:false},
  {...permit(),credentialsApproved:true},{...permit(),outreachApproved:true},
  {...permit(),rawBodyRetentionApproved:true},{...permit(),expiresAt:'2026-10-16T10:00:00.000Z'},
  {...permit(),expiresAt:'2026-12-01T10:00:00.000Z'},
  {...permit(),maxResponseBytes:100}, {...permit(),timeoutMs:100},
 ])await t.test(String(override?.decision??'null')+JSON.stringify(override).slice(-45),async()=>{
  const {deps,state}=fixture({loadPermit:async()=>override});
  await assert.rejects(acquireAuthorizedM04LiveRoot(request(),deps),M04LiveAcquisitionError);
  assert.equal(state.dns,0);
 });
});

test('getter-backed permit rejected without evaluating getter',async()=>{
 let calls=0; const p=permit();Object.defineProperty(p,'decision',{get(){calls++;throw new Error('GOTCHA');}});
 const {deps}=fixture({loadPermit:async()=>p});await code(acquireAuthorizedM04LiveRoot(request(),deps),'M04_LIVE_OBJECT_INVALID');assert.equal(calls,0);
});

test('all DNS answers must be public, invalid or mixed record denies dial',async t=>{
 for(const addresses of [['127.0.0.1'],['8.8.8.8','10.0.0.2'],[],['169.254.169.254'],
    ['192.168.1.1'],['198.51.100.2'],['203.0.113.1'],['::1'],['8.8.8.8','::ffff:127.0.0.1']]){
  await t.test(addresses.join(','),async()=>{
   const {deps,state}=fixture({resolveAddresses:async()=>addresses});
   await code(acquireAuthorizedM04LiveRoot(request(),deps),'M04_LIVE_DNS_NONPUBLIC');assert.equal(state.transport,0);
  });
 }
});

test('public IPv4 gate excludes common special-use ranges and accepts routable examples',()=>{
 for(const addr of ['0.0.0.0','10.1.1.1','100.64.0.1','100.127.255.255','127.0.0.1',
  '169.254.169.254','172.16.0.1','172.31.255.255','192.0.0.9','192.0.2.3',
  '192.88.99.1','192.168.0.1','198.18.0.1','198.19.0.1','198.51.100.1',
  '203.0.113.2','224.0.0.1','240.0.0.1','255.255.255.255','::1','1.2.3.999']){
  assert.equal(isPublicM04Ipv4(addr),false,addr);
 }
 for(const addr of ['8.8.8.8','1.1.1.1','9.9.9.9'])assert.equal(isPublicM04Ipv4(addr),true,addr);
});

test('native HTTPS adapter rejects private dial address without opening a socket',async()=>{
 await code(fetchPinnedLiveWebsite({url:'https://example.com/',ipv4:'127.0.0.1',maxResponseBytes:1000,
  timeoutMs:1000,signal:new AbortController().signal}),'M04_LIVE_DIAL_INVALID');
});

test('response status, encoding, content type and size restrictions',async t=>{
 for(const [field,value] of [['status',301],['status',404],['contentEncoding','gzip'],
  ['contentType','application/json'],['body',new Uint8Array(2001)]]){
  await t.test(field+':'+(typeof value==='string'?value:String(value)),async()=>{
   const {deps}=fixture({transport:async()=>({...good(),[field]:value})});
   await code(acquireAuthorizedM04LiveRoot(request(),deps),'M04_LIVE_RESPONSE_INVALID');
  });
 }
});

test('getter-backed transport body rejected without invoking getter',async()=>{
 let count=0;const response=good();Object.defineProperty(response,'body',{get(){count++;throw Error('Getter');}});
 const {deps}=fixture({transport:async()=>response});await code(acquireAuthorizedM04LiveRoot(request(),deps),'M04_LIVE_OBJECT_INVALID');assert.equal(count,0);
});

test('cancellation blocks permit and transport side effects',async()=>{
 const controller=new AbortController();controller.abort();const {deps,state}=fixture({signal:controller.signal});
 await code(acquireAuthorizedM04LiveRoot(request(),deps),'M04_LIVE_CANCELLED');
 assert.deepEqual(state,{load:0,dns:0,transport:0});
});

test('deadline cuts off stalled injected transport and prevents late evidence',async()=>{
 const {deps}=fixture({transport:async()=>new Promise(()=>{})});
 const start=Date.now();
 await code(acquireAuthorizedM04LiveRoot({...request(),timeoutMs:100},deps),'M04_LIVE_TIMEOUT');
 assert.ok(Date.now()-start<600,'injected hang bounded by deadline');
});

test('permit expiry is checked again after asynchronous dial',async()=>{
 let clock=NOW;const {deps}=fixture({now:()=>new Date(clock),transport:async()=>{clock='2026-10-16T12:00:01.000Z';return good();}});
 await code(acquireAuthorizedM04LiveRoot(request(),deps),'M04_LIVE_PERMIT_EXPIRED');
});

test('independent M02 transport hop approval is mandatory and exact-pin bound',async t=>{
 for (const patch of [
  {decision:'blocked'},{transportKind:'test'}, {resolvedIpv4:'127.0.0.1'},
  {canonicalUrl:'https://other.example/'},{workspaceId:'cross.tenant'},
  {maxResponseBytes:99999}, {timeoutMs:8000}, {transportPolicyId:'wrong'},
  {expiresAt:'2026-10-16T10:59:00.000Z'},
 ]) await t.test(JSON.stringify(patch),async()=>{
   const {deps,state}=fixture({admitM02Hop:async hop=>({...hop,decision:'allow',transportKind:'network',
     expiresAt:'2026-10-16T11:02:00.000Z',...patch})});
   await code(acquireAuthorizedM04LiveRoot(request(),deps),'M04_LIVE_M02_HOP_BLOCKED');
   assert.equal(state.transport,0);
 });
});

test('without M02 admission adapter network is disabled before even loading permit',async()=>{
 const {deps,state}=fixture({admitM02Hop:undefined});
 await code(acquireAuthorizedM04LiveRoot(request(),deps),'M04_LIVE_DISABLED');
 assert.equal(state.load,0);
});