import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWebsiteFixturePipeline } from '../apps/worker/src/website-inspection-pipeline.ts';

const W='550e8400-e29b-41d4-a716-446655440000';
const W2='550e8400-e29b-41d4-a716-446655440001';
const HTML='<meta name="viewport" content="width=device-width"><form><input type="email"><textarea></textarea></form><a href="https://www.linkedin.com/company/acme">social</a>';
const B=new TextEncoder().encode(HTML);
const H=createHash('sha256').update(B).digest('hex');
const clock='2026-10-16T00:00:00.000Z';
const request=()=>({
  version:'1.0.0', inspectionId:'inspect.pipeline', workspaceId:W,
  canonicalBusinessId:'business.pipeline', verifiedDomain:'example.com',
  domainVerification:{ verificationId:'verify.pipeline', decision:'verified', evidenceIds:['evidence.verified'] },
  targetUrl:'https://example.com/', sourceKey:'source.testfixture',
  sourceAdmissionDecisionRef:'decision.pipeline',sourceAdmissionDecision:'allow',
  sourcePolicySnapshot:{policyId:'source.policy',policyVersion:'1.0.0'},
  transportPolicyId:'transport.policy',transportPolicyVersion:'1.0.0',
  limits:{maxPages:1,maxResponseBytes:4096,timeoutMs:1500},
  executionMode:'test_only',networkRequested:false,credentialedFetchRequested:false,
  rawPayloadRequested:false,outreachRequested:false,requestedAt:'2026-10-15T23:00:00.000Z',
});
const approval=(r=request())=>({
  inspectionId:r.inspectionId,workspaceId:r.workspaceId,canonicalBusinessId:r.canonicalBusinessId,
  verifiedDomain:r.verifiedDomain,verificationId:r.domainVerification.verificationId,
  domainEvidenceIds:[...r.domainVerification.evidenceIds],decision:'allow',transportKind:'test',
  sourceKey:r.sourceKey,sourceAdmissionDecisionRef:r.sourceAdmissionDecisionRef,
  sourcePolicyId:r.sourcePolicySnapshot.policyId,sourcePolicyVersion:r.sourcePolicySnapshot.policyVersion,
  transportPolicyId:r.transportPolicyId,transportPolicyVersion:r.transportPolicyVersion,
  canonicalUrl:r.targetUrl,receiptId:'receipt.pipeline',fixtureBodySha256:H,
  fixtureByteLength:B.length,fixtureStatus:200,fixtureContentType:'text/html',
  maxResponseBytes:r.limits.maxResponseBytes,timeoutMs:r.limits.timeoutMs,
  expiresAt:'2026-10-16T01:00:00.000Z',
});
function make(overrides={}){
  const calls={lookup:[],exchange:[],policy:[],persist:[],result:null};
  const config={
    contracts:{parseRequest:x=>x,parseResult:x=>x}, now:()=>new Date(clock),
    async lookup(key){calls.lookup.push(key);return approval();},
    async exchange(x){calls.exchange.push(x);return{status:200,finalUrl:x.url,contentType:'text/html',body:Uint8Array.from(B),elapsedMs:2};},
    storage:{
      async policyForWorkspace(w){calls.policy.push(w);return{workspaceId:W,retentionTtlSeconds:86400,deletionRequired:true};},
      async persist(payload){calls.persist.push(payload);return{inspectionId:payload.request.inspectionId,replayed:false};},
    },...overrides,
  };
  return {run:createWebsiteFixturePipeline(config),calls};
}

test('full fixture-only pipeline: exact policy, digest, extraction, allow-listed tenant persistence', async()=>{
  const {run,calls}=make();
  const result=await run(request());
  assert.equal(result.status,'review_required');
  assert.equal(result.coverage,'partial');
  assert.equal(result.observations.length,8);
  for(const name of ['contact_form','mobile_viewport','social_link','https'])
    assert.equal(result.observations.find(o=>o.capability===name).observation,'observed_present');
  for(const name of ['booking','commerce','business_contact','structured_data'])
    assert.equal(result.observations.find(o=>o.capability===name).observation,'unknown');
  assert.deepEqual(calls.lookup[0],{workspaceId:W,inspectionId:'inspect.pipeline'});
  assert.deepEqual(calls.policy,[W]);
  assert.equal(calls.persist.length,1);
  const saved=calls.persist[0];
  assert.equal(saved.request.workspaceId,W);
  assert.equal(saved.request.domainVerification.verificationId,'verify.pipeline');
  assert.equal(saved.request.limits,undefined);
  assert.equal(saved.request.inspectionId,'inspect.pipeline');
  assert.equal(saved.deletionRequired,true);
  assert.equal(saved.retentionTtlSeconds,86400);
  assert.equal(saved.bodyIncluded,false);
  assert.equal(JSON.stringify(saved).includes(HTML),false);
  assert.equal(JSON.stringify(saved).includes('authorizationBearer'),false);
  assert.ok(saved.observations.filter(o=>o.observation==='observed_present').every(o=>o.transportReceiptIds[0]==='receipt.pipeline'));
});

test('pipeline blocks all database writes if read-only authorization is forged or missing',async t=>{
  const bad=[null,{...approval(),workspaceId:W2},{...approval(),inspectionId:'inspect.other'},
    {...approval(),canonicalUrl:'https://evil.example/'},{...approval(),sourceKey:'source.forged'},
    {...approval(),decision:'blocked'},{...approval(),fixtureBodySha256:'0'.repeat(64)},
  ];
  for(const value of bad)await t.test(value===null?'missing':JSON.stringify(value).slice(0,50),async()=>{
    const {run,calls}=make({lookup:async key=>{calls.lookup.push(key);return value;}});
    await assert.rejects(run(request()));
    assert.equal(calls.persist.length,0);
    assert.equal(calls.policy.length,0);
  });
});

test('wrong tenant storage retention scope rejects after extraction and before writes',async()=>{
  const {run,calls}=make({storage:{
    async policyForWorkspace(w){calls.policy.push(w);return{workspaceId:W2,retentionTtlSeconds:100,deletionRequired:true};},
    async persist(p){calls.persist.push(p);return{inspectionId:p.request.inspectionId,replayed:false};},
  }});
  await assert.rejects(run(request()),{code:'M04_PERSISTENCE_WORKSPACE_INVALID'});
  assert.equal(calls.persist.length,0);
});

test('unapproved fixture bytes are stopped before extractor and persistence',async()=>{
  const {run,calls}=make({exchange:async x=>{calls.exchange.push(x);return{
    status:200,finalUrl:x.url,contentType:'text/html',body:new TextEncoder().encode('<a href="https://instagram.com/forged">evil</a>'),elapsedMs:1,
  };}});
  await assert.rejects(run(request()),{code:'M04_FIXTURE_ATTESTATION_MISMATCH'});
  assert.equal(calls.persist.length,0);
  assert.equal(calls.policy.length,0);
});

test('storage acknowledgement mismatch is explicit, never silently successful',async()=>{
  const {run,calls}=make({storage:{
    async policyForWorkspace(w){calls.policy.push(w);return{workspaceId:W,retentionTtlSeconds:86400,deletionRequired:true};},
    async persist(p){calls.persist.push(p);return{inspectionId:'inspect.other',replayed:false};},
  }});
  await assert.rejects(run(request()),{code:'M04_PERSISTENCE_ACK_MISMATCH'});
  assert.equal(calls.persist.length,1);
});

test('fixture pipeline cannot process a request from another tenant using original authorization',async()=>{
  const {run,calls}=make();
  await assert.rejects(run({...request(),workspaceId:W2}));
  assert.equal(calls.persist.length,0);
});