import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { executeWebsiteInspectionFixture } from '../apps/worker/src/website-inspection-runtime.ts';
import { extractWebsiteCapabilitiesFromFixture } from '../apps/worker/src/website-fixture-extractor.ts';
import { createWebsiteStoredFixtureAuthorizer } from '../apps/worker/src/website-fixture-authorization.ts';
import { createWebsiteInspectionPersistenceHandoff } from '../apps/worker/src/website-inspection-db-bridge.ts';

const WORKSPACE='550e8400-e29b-41d4-a716-446655440000';
const sampleHtml='<meta name="viewport" content="width=device-width"><form><input type="email"><textarea></textarea></form><a href="https://instagram.com/store">Social</a>';
const sampleBody=new TextEncoder().encode(sampleHtml);
const digest=createHash('sha256').update(sampleBody).digest('hex');
const request=()=>({
 version:'1.0.0',inspectionId:'inspect.pipeline.1',workspaceId:WORKSPACE,
 canonicalBusinessId:'business.1',verifiedDomain:'example.com',
 domainVerification:{verificationId:'verify.1',decision:'verified',evidenceIds:['domain.1']},
 targetUrl:'https://example.com/',sourceKey:'source.test',sourceAdmissionDecisionRef:'approval.1',
 sourceAdmissionDecision:'allow',sourcePolicySnapshot:{policyId:'policy.test',policyVersion:'1.0.0'},
 transportPolicyId:'transport.test',transportPolicyVersion:'1.0.0',
 limits:{maxPages:1,maxResponseBytes:10000,timeoutMs:5000},
 executionMode:'test_only',networkRequested:false,credentialedFetchRequested:false,
 rawPayloadRequested:false,outreachRequested:false,requestedAt:'2026-10-15T23:00:00.000Z',
});
const record=(r=request())=>({
 inspectionId:r.inspectionId,workspaceId:r.workspaceId,decision:'allow',transportKind:'test',
 canonicalBusinessId:r.canonicalBusinessId,verifiedDomain:r.verifiedDomain,
 verificationId:r.domainVerification.verificationId,domainEvidenceIds:[...r.domainVerification.evidenceIds],
 sourceKey:r.sourceKey,sourceAdmissionDecisionRef:r.sourceAdmissionDecisionRef,
 sourcePolicyId:r.sourcePolicySnapshot.policyId,sourcePolicyVersion:r.sourcePolicySnapshot.policyVersion,
 transportPolicyId:r.transportPolicyId,transportPolicyVersion:r.transportPolicyVersion,
 canonicalUrl:r.targetUrl,receiptId:'receipt.pipeline.1',fixtureBodySha256:digest,
 fixtureStatus:200,fixtureContentType:'text/html',fixtureByteLength:sampleBody.byteLength,
 maxResponseBytes:r.limits.maxResponseBytes,timeoutMs:r.limits.timeoutMs,
 expiresAt:'2026-10-16T01:00:00.000Z',
});

const pipeline=({store=record(),html=sampleBody,policyWorkspace=WORKSPACE}={})=>{
 const calls=[];
 let captured=null;
 const handoff=createWebsiteInspectionPersistenceHandoff({
   parseResult(raw){calls.push('parseResult');return raw;}, // Native Zod required at integration.
   async policyForWorkspace(workspaceId){calls.push('policy');assert.equal(workspaceId,WORKSPACE);return {workspaceId:policyWorkspace,retentionTtlSeconds:7200,deletionRequired:true};},
   async persist(payload){calls.push('persist');captured=payload;return {inspectionId:payload.request.inspectionId,replayed:false};},
 });
 const deps={
   contracts:{parseRequest(raw){return raw;},parseResult(raw){return raw;}},
   now:()=>new Date('2026-10-16T00:00:00.000Z'),
   authorize:createWebsiteStoredFixtureAuthorizer(async key=>{calls.push('lookup');assert.equal(key.workspaceId,WORKSPACE);return store;}),
   async exchange(x){calls.push('exchange');assert.equal(x.transportKind,'test');return {status:200,finalUrl:x.url,contentType:'text/html',body:Uint8Array.from(html),elapsedMs:2};},
   extract: async x=>{calls.push('extract');return extractWebsiteCapabilitiesFromFixture(x);},
   persist: async x=>{calls.push('handoff');await handoff(x);},
 };
 return {deps,calls,getCaptured:()=>captured};
};

test('complete fixture-only pipeline binds verified-domain record, authorized bytes, conservative signals and scoped persisted record', async()=>{
 const {deps,calls,getCaptured}=pipeline();
 const result=await executeWebsiteInspectionFixture(request(),deps);
 const stored=getCaptured();
 assert.equal(result.status,'review_required');
 assert.equal(result.coverage,'partial');
 assert.deepEqual(result.reasonCodes,['website.single_page_only']);
 for(const kind of ['contact_form','mobile_viewport','social_link','https']){
   const entry=result.observations.find(x=>x.capability===kind);
   assert.equal(entry.observation,'observed_present');
   assert.deepEqual(entry.transportReceiptIds,['receipt.pipeline.1']);
 }
 assert.equal(result.observations.find(x=>x.capability==='commerce').observation,'unknown');
 assert.deepEqual(calls,['lookup','exchange','extract','handoff','parseResult','policy','persist']);
 assert.equal(stored.request.workspaceId,WORKSPACE);
 assert.equal(stored.request.inspectionId,'inspect.pipeline.1');
 assert.equal(stored.deletionRequired,true);
 assert.equal(stored.retentionTtlSeconds,7200);
 assert.equal('limits' in stored.request,false);
 assert.equal(JSON.stringify(stored).includes(sampleHtml),false);
 assert.equal(JSON.stringify(stored).includes('Social</a>'),false);
});

test('tampered transport body fails before extraction, policy lookup or persistence', async()=>{
 const {deps,calls,getCaptured}=pipeline({html: new TextEncoder().encode('<p>different fixture</p>')});
 await assert.rejects(executeWebsiteInspectionFixture(request(),deps),{code:'M04_FIXTURE_ATTESTATION_MISMATCH'});
 assert.deepEqual(calls,['lookup','exchange']);
 assert.equal(getCaptured(),null);
});

test('cross-workspace policy fails after extraction but before any DB write', async()=>{
 const {deps,calls,getCaptured}=pipeline({policyWorkspace:'550e8400-e29b-41d4-a716-446655440001'});
 await assert.rejects(executeWebsiteInspectionFixture(request(),deps),{code:'M04_PERSISTENCE_WORKSPACE_INVALID'});
 assert.equal(calls.includes('persist'),false);
 assert.equal(getCaptured(),null);
});

test('forged domain in independent record fails before fixture transport and DB policy', async()=>{
 const {deps,calls}=pipeline({store:{...record(),verifiedDomain:'imposter.example.com'}});
 await assert.rejects(executeWebsiteInspectionFixture(request(),deps),{code:'M04_FIXTURE_RECORD_INVALID'});
 assert.deepEqual(calls,['lookup']);
});