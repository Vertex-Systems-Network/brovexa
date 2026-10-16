import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectAuthorizedM04LiveRoot } from '../apps/worker/src/website-live-assessment.ts';
import { M04LiveAcquisitionError } from '../apps/worker/src/website-live-acquisition.ts';
const TIME = '2026-10-16T11:00:00.000Z';
const request = () => ({
  version:'2.0.0',executionMode:'live',networkRequested:true,credentialedFetchRequested:false,
  rawPayloadRequested:false,outreachRequested:false,
  workspaceId:'550e8400-e29b-41d4-a716-446655440000',inspectionId:'inspect.002',
  canonicalBusinessId:'business.002',domainVerificationId:'verify.002',verifiedDomain:'example.com',
  sourceKey:'source.approved_web',sourceAdmissionDecisionRef:'admission.002',
  sourcePolicyId:'policy.web',sourcePolicyVersion:'1.0.0',transportPolicyId:'transport.web',
  transportPolicyVersion:'1.0.0',targetUrl:'https://example.com/',maxResponseBytes:1000,timeoutMs:1000,
});
const permit = (r = request()) => ({
  workspaceId:r.workspaceId,inspectionId:r.inspectionId,canonicalBusinessId:r.canonicalBusinessId,
  domainVerificationId:r.domainVerificationId,verifiedDomain:r.verifiedDomain,sourceKey:r.sourceKey,
  sourceAdmissionDecisionRef:r.sourceAdmissionDecisionRef,sourcePolicyId:r.sourcePolicyId,
  sourcePolicyVersion:r.sourcePolicyVersion,transportPolicyId:r.transportPolicyId,
  transportPolicyVersion:r.transportPolicyVersion,decision:'allow',permission:'live_root_read',
  networkApproved:true,credentialsApproved:false,outreachApproved:false,
  rawBodyRetentionApproved:false,maxResponseBytes:1000,timeoutMs:1000,
  expiresAt:'2026-10-16T12:00:00.000Z',
});
const deps = html => ({
  enabled:true,now:()=>new Date(TIME),loadPermit:async()=>permit(),
  admitM02Hop:async hop=>({...hop,decision:'allow',transportKind:'network',expiresAt:'2026-10-16T11:02:00.000Z'}),
  resolveAddresses:async()=>['8.8.8.8'],
  transport:async()=>({status:200,contentType:'text/html',contentEncoding:'identity',
    body:new TextEncoder().encode(html)}),
});

test('live assessment uses v2 provenance, observed contact form and partial uncertainty',async()=>{
 const report=await inspectAuthorizedM04LiveRoot(request(),deps('<form><input type="email"><textarea></textarea></form>'));
 assert.equal(report.version,'2.0.0');assert.equal(report.request.networkRequested,true);
 assert.equal(report.receipt.executionMode,'live');assert.equal(report.receipt.bodyLength>0,true);
 assert.equal(report.status,'review_required');assert.equal(report.coverage,'partial');
 assert.equal(report.bodyIncluded,false);assert.ok(report.reasonCodes.includes('website.single_page_only'));
 const form=report.observations.find(o=>o.capability==='contact_form');
 assert.equal(form.observation,'observed_present');assert.equal(form.transportReceiptIds.length,1);
 for(const finding of report.observations){if(finding.observation==='unknown'){
  assert.equal(finding.confidence,null);assert.deepEqual(finding.transportReceiptIds,[]);
  assert.deepEqual(finding.evidenceReferenceIds,[]);
 }}
 assert.equal(JSON.stringify(report).includes('<form'),false);
 assert.equal(JSON.stringify(report).includes('"body":'),false);
});

test('missing capabilities are unknown, never not_detected from one root page',async()=>{
 const report=await inspectAuthorizedM04LiveRoot(request(),deps('<!doctype html><html></html>'));
 assert.equal(report.observations.some(o=>o.observation==='not_detected'),false);
 assert.equal(report.status,'review_required');assert.equal(report.coverage,'partial');
});

test('script/comment template fake social links cannot create a positive live claim',async()=>{
 const report=await inspectAuthorizedM04LiveRoot(request(),deps('<!-- <a href="https://instagram.com/acme"> --> <script>"<a href=https://instagram.com/acme>"</script>'));
 assert.equal(report.observations.find(o=>o.capability==='social_link').observation,'unknown');
});

test('v1 fixture intent is rejected and no live acquisition occurs',async()=>{
 let count=0;const options={...deps('safe'),transport:async()=>{count++;throw Error('should not run');}};
 await assert.rejects(inspectAuthorizedM04LiveRoot({...request(),version:'1.0.0',executionMode:'test_only',networkRequested:false},options),e=>e instanceof M04LiveAcquisitionError);
 assert.equal(count,0);
});

test('live assessment request cannot be changed by caller during awaited admission',async()=>{
 const r=request();
 const trusted=deps('<html></html>');
 trusted.loadPermit=async()=>{r.verifiedDomain='malicious.example';r.targetUrl='https://malicious.example/';return permit();};
 const result=await inspectAuthorizedM04LiveRoot(r,trusted);
 assert.equal(result.request.verifiedDomain,'example.com');
 assert.equal(result.request.targetUrl,'https://example.com/');
 assert.equal(result.receipt.canonicalUrl,'https://example.com/');
});