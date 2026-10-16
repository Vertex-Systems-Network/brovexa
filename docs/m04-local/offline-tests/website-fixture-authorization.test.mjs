import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWebsiteStoredFixtureAuthorizer, WebsiteFixtureAuthorizationError } from '../apps/worker/src/website-fixture-authorization.ts';
import { executeWebsiteInspectionFixture } from '../apps/worker/src/website-inspection-runtime.ts';

const body = new TextEncoder().encode('<html><body><p>fixture</p></body></html>');
const sha = createHash('sha256').update(body).digest('hex');
const request = () => ({
  version: '1.0.0', inspectionId: 'inspection.005', workspaceId: 'workspace.005',
  canonicalBusinessId: 'business.005', verifiedDomain: 'example.com',
  domainVerification: { verificationId: 'verify.005', decision: 'verified', evidenceIds: ['domain.evidence.005'] },
  targetUrl: 'https://example.com/', sourceKey: 'source.test', sourceAdmissionDecisionRef: 'admission.005',
  sourceAdmissionDecision: 'allow', sourcePolicySnapshot: { policyId: 'source.policy', policyVersion: '1.0.0' },
  transportPolicyId: 'transport.policy', transportPolicyVersion: '1.0.0',
  limits: { maxPages: 1, maxResponseBytes: 2000, timeoutMs: 5000 },
  executionMode: 'test_only', networkRequested: false, credentialedFetchRequested: false,
  rawPayloadRequested: false, outreachRequested: false,
  requestedAt: '2026-10-15T23:00:00.000Z',
});
const decision = (r = request()) => ({
  decision: 'allow', inspectionId: r.inspectionId, workspaceId: r.workspaceId, transportKind: 'test',
  canonicalBusinessId: r.canonicalBusinessId, verifiedDomain: r.verifiedDomain,
  verificationId: r.domainVerification.verificationId, domainEvidenceIds: [...r.domainVerification.evidenceIds],
  sourceKey: r.sourceKey, sourceAdmissionDecisionRef: r.sourceAdmissionDecisionRef,
  sourcePolicyId: r.sourcePolicySnapshot.policyId, sourcePolicyVersion: r.sourcePolicySnapshot.policyVersion,
  transportPolicyId: r.transportPolicyId, transportPolicyVersion: r.transportPolicyVersion,
  canonicalUrl: r.targetUrl, receiptId: 'receipt.005',
  fixtureBodySha256: sha, fixtureStatus: 200, fixtureContentType: 'text/html', fixtureByteLength: body.length,
  maxResponseBytes: 2000, timeoutMs: 5000, expiresAt: '2026-10-16T01:00:00.000Z',
});
const code = async (task, expected) => assert.rejects(task, e =>
  e instanceof WebsiteFixtureAuthorizationError && e.code === expected);

test('trusted lookup only receives frozen workspace and inspection key; no untrusted full request', async () => {
  let looked = 0;
  const authorize = createWebsiteStoredFixtureAuthorizer(async key => {
    looked++;
    assert.deepEqual(key, {workspaceId:'workspace.005',inspectionId:'inspection.005'});
    assert.equal(Object.isFrozen(key), true);
    assert.equal('sourceKey' in key, false);
    return decision();
  });
  const result = await authorize(request());
  assert.equal(looked, 1);
  assert.equal(result.decision, 'allow');
  assert.equal(result.fixtureBodySha256, sha);
  assert.equal(result.inspectionId, 'inspection.005');
});

test('missing record fails closed', async () => {
  await code(createWebsiteStoredFixtureAuthorizer(async () => null)(request()),'M04_FIXTURE_RECORD_NOT_FOUND');
});

test('unsafe or production source intent never invokes trusted lookup', async t => {
  const mutations = [
    ['inspectionId','../../forged'], ['workspaceId','bad id'], ['executionMode','production'],
    ['networkRequested',true], ['credentialedFetchRequested',true], ['rawPayloadRequested',true],
    ['outreachRequested',true], ['sourceAdmissionDecision','blocked'],
  ];
  for (const [name,value] of mutations) await t.test(name,async()=>{
    let calls=0;
    const authorize=createWebsiteStoredFixtureAuthorizer(async()=>{calls++;return decision();});
    await code(authorize({...request(),[name]:value}),'M04_FIXTURE_LOOKUP_SCOPE_INVALID');
    assert.equal(calls,0);
  });
});

test('cross-tenant or forged stored proof cannot become authorized receipt', async t => {
  const mutations = [
    ['inspectionId', 'inspection.other'], ['workspaceId','workspace.other'],
    ['decision','blocked'], ['transportKind','network'],
    ['canonicalBusinessId','business.other'], ['verifiedDomain','other.example.com'],
    ['verificationId','verify.other'], ['domainEvidenceIds',['domain.other']],
    ['sourceKey','source.other'], ['sourceAdmissionDecisionRef','admission.other'],
    ['sourcePolicyId','policy.other'], ['sourcePolicyVersion','9.9.9'],
    ['transportPolicyId','transport.other'], ['transportPolicyVersion','9.9.9'],
    ['canonicalUrl','https://other.example.com/'],
  ];
  for (const [name,value] of mutations) await t.test(name,async()=>{
    const authorize=createWebsiteStoredFixtureAuthorizer(async()=>({...decision(),[name]:value}));
    await code(authorize(request()),'M04_FIXTURE_RECORD_INVALID');
  });
});

test('stored source extras and raw page bytes cannot leak into authorization output', async () => {
  const record=decision();
  record.html='<p>private page content</p>';
  record.authorizationBearer='SECRET';
  const a=await createWebsiteStoredFixtureAuthorizer(async()=>record)(request());
  assert.equal(JSON.stringify(a).includes('private page'),false);
  assert.equal(JSON.stringify(a).includes('SECRET'),false);
});

test('stored decision list snapshot is independent of mutable lookup buffer', async () => {
  const record=decision();
  const a=await createWebsiteStoredFixtureAuthorizer(async()=>record)(request());
  record.domainEvidenceIds[0]='domain.evidence.other';
  assert.deepEqual(a.domainEvidenceIds,['domain.evidence.005']);
});

test('end-to-end approved stored fixture executes with no live transport and no leaked HTML', async()=>{
  const record=decision();
  let calls=0;
  let persisted=null;
  const deps={
    contracts:{parseRequest:x=>x,parseResult:x=>x},
    now:()=>new Date('2026-10-16T00:00:00.000Z'),
    authorize:createWebsiteStoredFixtureAuthorizer(async key=>{calls++;return record;}),
    async exchange(x) { assert.equal(x.transportKind,'test'); return {status:200,finalUrl:x.url,
      contentType:'text/html; charset=utf-8',body:Uint8Array.from(body),elapsedMs:1}; },
    async extract(){return {coverage:'partial',findings:[{
      capability:'https',observation:'observed_present',reason:'detected',
      confidence:0.8,evidenceReferenceIds:['evidence.005'],
    }],reasonCodes:['website.single_page_only']};},
    async persist(x){persisted=x;},
  };
  const result=await executeWebsiteInspectionFixture(request(),deps);
  assert.equal(calls,1);assert.equal(result.status,'review_required');
  assert.deepEqual(result.transportReceiptIds,['receipt.005']);
  assert.equal(persisted.status,'review_required');
  assert.equal(JSON.stringify(persisted).includes('fixture</p>'),false);
});

test('async policy lookup cannot approve request identifiers changed mid-await', async()=>{
  const mutable=request();
  const authorize=createWebsiteStoredFixtureAuthorizer(async()=>{
    mutable.canonicalBusinessId='business.attacker';
    mutable.sourcePolicySnapshot.policyId='policy.attacker';
    mutable.domainVerification.evidenceIds[0]='domain.attacker';
    return decision(mutable);
  });
  await code(authorize(mutable),'M04_FIXTURE_RECORD_INVALID');
});