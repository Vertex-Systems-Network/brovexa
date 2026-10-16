import test from 'node:test';
import assert from 'node:assert/strict';
import { toWebsiteInspectionPersistencePayload, WebsiteInspectionBridgeError } from '../apps/worker/src/website-inspection-db-bridge.ts';

const WORKSPACE='550e8400-e29b-41d4-a716-446655440000';
const policy=() => ({ workspaceId:WORKSPACE, deletionRequired:true, retentionTtlSeconds:86400 });
function evidence() { return {
  version:'1.0.0', status:'assessed', coverage:'bounded',
  completedAt:'2026-10-16T00:00:00.000Z', bodyIncluded:false,
  transportReceiptIds:['receipt.1'], reasonCodes:[],
  observations:[{ capability:'contact_form', observation:'observed_present', reason:'detected',
    confidence:0.9, evidenceReferenceIds:['ref.1'], transportReceiptIds:['receipt.1'] }],
  request:{ version:'1.0.0', inspectionId:'inspect.1', workspaceId:WORKSPACE,
    canonicalBusinessId:'business.1', verifiedDomain:'example.com',
    domainVerification: { verificationId:'verify.1', decision:'verified', evidenceIds:['domain.1'] },
    targetUrl:'https://example.com/', sourceKey:'source.approved',
    sourceAdmissionDecisionRef:'admit.1', sourceAdmissionDecision:'allow',
    sourcePolicySnapshot:{policyId:'policy.1', policyVersion:'1.0.0'},
    transportPolicyId:'transport.1', transportPolicyVersion:'1.0.0',
    limits:{maxPages:1, maxResponseBytes:1024, timeoutMs:1000},
    executionMode:'test_only', networkRequested:false, credentialedFetchRequested:false,
    rawPayloadRequested:false, outreachRequested:false, requestedAt:'2026-10-15T23:00:00.000Z',
  },
}; }

test('bridge maps validated contract to WEB-002 payload, scoped and deleting by policy', () => {
  const record=toWebsiteInspectionPersistencePayload(evidence(), policy());
  assert.equal(record.deletionRequired,true);
  assert.equal(record.retentionTtlSeconds,86400);
  assert.equal('limits' in record.request,false);
  assert.equal(record.request.workspaceId,WORKSPACE);
  assert.deepEqual(record.observations[0].transportReceiptIds,['receipt.1']);
});

test('bridge cannot persist cross-tenant data or untyped tenant identifier', () => {
  for (const modified of [
    {...policy(), workspaceId:'550e8400-e29b-41d4-a716-446655440001'},
    {...policy(), workspaceId:'workspace.string'},
  ]) assert.throws(() => toWebsiteInspectionPersistencePayload(evidence(),modified), e =>
    e instanceof WebsiteInspectionBridgeError && e.code==='M04_PERSISTENCE_WORKSPACE_INVALID');
});

test('bridge enforces explicit deletion and bounded retention', () => {
  for(const modification of [
    {deletionRequired:false}, {retentionTtlSeconds:0}, {retentionTtlSeconds:null},
    {retentionTtlSeconds:Infinity}, {retentionTtlSeconds:31_536_001},
  ]) assert.throws(() => toWebsiteInspectionPersistencePayload(evidence(),{...policy(),...modification}),e =>
    e instanceof WebsiteInspectionBridgeError && e.code==='M04_PERSISTENCE_RETENTION_INVALID');
});

test('bridge guards chronological evidence and no-body invariant', () => {
  for(const modification of [
    {bodyIncluded:true}, {completedAt:'2026-10-14T00:00:00.000Z'},
    {completedAt:'malformed'},
  ]) assert.throws(() => toWebsiteInspectionPersistencePayload({...evidence(),...modification},policy()), e =>
    e instanceof WebsiteInspectionBridgeError && e.code==='M04_PERSISTENCE_RESULT_INVALID');
});

test('bridge deep copies scoped evidence to prevent post-assembly mutation', () => {
  const original=evidence();
  const projected=toWebsiteInspectionPersistencePayload(original,policy());
  original.transportReceiptIds.push('receipt.forged');
  original.observations[0].evidenceReferenceIds.push('evidence.forged');
  original.request.domainVerification.evidenceIds.push('domain.forged');
  assert.deepEqual(projected.transportReceiptIds,['receipt.1']);
  assert.deepEqual(projected.observations[0].evidenceReferenceIds,['ref.1']);
  assert.deepEqual(projected.request.domainVerification.evidenceIds,['domain.1']);
});

test('explicit allowlist strips runtime-injected request, domain and observation extras', () => {
  const raw = evidence();
  raw.request.rawHtml = '<body>secret-personal-data</body>';
  raw.request.domainVerification.credential = 'private-token';
  raw.request.sourcePolicySnapshot.secret = 'private-token';
  raw.observations[0].rawHtml = '<p>confidential</p>';
  const projected = toWebsiteInspectionPersistencePayload(raw,policy());
  const serialized = JSON.stringify(projected);
  assert.equal(serialized.includes('rawHtml'),false);
  assert.equal(serialized.includes('\"credential\"'),false);
  assert.equal(serialized.includes('private-token'),false);
  assert.equal(serialized.includes('secret-personal-data'),false);
});

test('strict-schema handoff validates before any policy lookup or DB operation', async () => {
  const calls = [];
  const { createWebsiteInspectionPersistenceHandoff } = await import('../apps/worker/src/website-inspection-db-bridge.ts');
  const handoff = createWebsiteInspectionPersistenceHandoff({
    parseResult(raw) { calls.push('schema'); if (raw?.request?.rawHtml) throw Error('SCHEMA_REJECTED'); return raw; },
    async policyForWorkspace() { calls.push('policy'); return policy(); },
    async persist() { calls.push('persist'); return {inspectionId:'inspect.1',replayed:false}; },
  });
  await assert.rejects(handoff({...evidence(), request:{...evidence().request,rawHtml:'<p>unsafe</p>'}}),/SCHEMA_REJECTED/);
  assert.deepEqual(calls,['schema']);
});

test('handoff rejects tenant-crossing policy before database mutation', async () => {
  const { createWebsiteInspectionPersistenceHandoff } = await import('../apps/worker/src/website-inspection-db-bridge.ts');
  let inserts=0;
  const handoff = createWebsiteInspectionPersistenceHandoff({
    parseResult: raw => raw,
    async policyForWorkspace() { return {...policy(), workspaceId:'550e8400-e29b-41d4-a716-446655440001'}; },
    async persist() { inserts++; return {inspectionId:'inspect.1',replayed:false}; },
  });
  await assert.rejects(handoff(evidence()), err => err instanceof WebsiteInspectionBridgeError && err.code==='M04_PERSISTENCE_WORKSPACE_INVALID');
  assert.equal(inserts,0);
});

test('handoff snapshots schema output before awaited policy can mutate external input', async () => {
  const { createWebsiteInspectionPersistenceHandoff } = await import('../apps/worker/src/website-inspection-db-bridge.ts');
  const mutable=evidence();
  let stored;
  const handoff = createWebsiteInspectionPersistenceHandoff({
    parseResult: raw => raw,
    async policyForWorkspace() {
      mutable.request.targetUrl='https://attacker.invalid/';
      mutable.request.domainVerification.evidenceIds[0]='forged';
      mutable.observations[0].evidenceReferenceIds[0]='forged';
      return policy();
    },
    async persist(payload) { stored=payload; return {inspectionId:'inspect.1',replayed:false}; },
  });
  await handoff(mutable);
  assert.equal(stored.request.targetUrl,'https://example.com/');
  assert.deepEqual(stored.request.domainVerification.evidenceIds,['domain.1']);
  assert.deepEqual(stored.observations[0].evidenceReferenceIds,['ref.1']);
});

test('handoff requires exact inspection ID and replay ack; mismatch is not reported successful', async t => {
  const { createWebsiteInspectionPersistenceHandoff } = await import('../apps/worker/src/website-inspection-db-bridge.ts');
  for (const badAck of [null,{inspectionId:'foreign.1',replayed:false},{inspectionId:'inspect.1',replayed:'yes'}]) {
    await t.test(JSON.stringify(badAck),async()=> {
      const handoff=createWebsiteInspectionPersistenceHandoff({
        parseResult: raw=>raw,
        async policyForWorkspace(){return policy();},
        async persist(){return badAck;},
      });
      await assert.rejects(handoff(evidence()),err=>err instanceof WebsiteInspectionBridgeError && err.code==='M04_PERSISTENCE_ACK_MISMATCH');
    });
  }
});

test('handoff returns actual idempotency status without extra DB operations', async () => {
  const { createWebsiteInspectionPersistenceHandoff } = await import('../apps/worker/src/website-inspection-db-bridge.ts');
  let calls=0;
  const handoff=createWebsiteInspectionPersistenceHandoff({
    parseResult: raw => raw,
    async policyForWorkspace(){return policy();},
    async persist(payload){calls++;assert.equal(payload.request.inspectionId,'inspect.1');return {inspectionId:'inspect.1',replayed:true};},
  });
  assert.deepEqual(await handoff(evidence()),{inspectionId:'inspect.1',replayed:true});
  assert.equal(calls,1);
});