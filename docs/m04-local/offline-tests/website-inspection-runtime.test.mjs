import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const sha = body => createHash('sha256').update(body).digest('hex');
const defaultBody = new TextEncoder().encode('<form action="/contact"></form>');
import { executeWebsiteInspectionFixture, WebsiteInspectionRuntimeError } from '../apps/worker/src/website-inspection-runtime.ts';

const time = '2026-10-16T00:00:00.000Z';
const req = () => ({
  version: '1.0.0', inspectionId: 'inspect.fixture1', workspaceId: 'workspace.fixture',
  canonicalBusinessId: 'business.fixture', verifiedDomain: 'example.com',
  domainVerification: { verificationId: 'verify.fixture', decision: 'verified', evidenceIds: ['domain.evidence'] },
  targetUrl: 'https://example.com/', sourceKey: 'source.approved_web',
  sourceAdmissionDecisionRef: 'admit.fixture', sourceAdmissionDecision: 'allow',
  sourcePolicySnapshot: { policyId: 'source.policy', policyVersion: '1.0.0' },
  transportPolicyId: 'transport.policy', transportPolicyVersion: '1.0.0',
  limits: { maxPages: 1, maxResponseBytes: 1000, timeoutMs: 1000 },
  executionMode: 'test_only', networkRequested: false, credentialedFetchRequested: false,
  rawPayloadRequested: false, outreachRequested: false,
  requestedAt: '2026-10-15T23:00:00.000Z',
});

const approval = (r = req()) => ({
  decision: 'allow', transportKind: 'test', workspaceId: r.workspaceId, inspectionId: r.inspectionId,
  canonicalBusinessId: r.canonicalBusinessId, verifiedDomain: r.verifiedDomain,
  verificationId: r.domainVerification.verificationId,
  domainEvidenceIds: [...r.domainVerification.evidenceIds], sourceKey: r.sourceKey,
  sourceAdmissionDecisionRef: r.sourceAdmissionDecisionRef,
  sourcePolicyId: r.sourcePolicySnapshot.policyId,
  sourcePolicyVersion: r.sourcePolicySnapshot.policyVersion,
  transportPolicyId: r.transportPolicyId, transportPolicyVersion: r.transportPolicyVersion,
  canonicalUrl: r.targetUrl, receiptId: 'receipt.fixture1',
  fixtureStatus: 200, fixtureContentType: 'text/html',
  fixtureBodySha256: sha(defaultBody), fixtureByteLength: defaultBody.byteLength,
  maxResponseBytes: r.limits.maxResponseBytes, timeoutMs: r.limits.timeoutMs,
  expiresAt: '2026-10-17T00:00:00.000Z',
});

const finding = () => ({ capability: 'contact_form', observation: 'observed_present',
  reason: 'detected', confidence: 0.95, evidenceReferenceIds: ['evidence.form1'] });

const fixture = (overrides = {}) => {
  const calls = { authorize: 0, exchange: 0, extract: 0, persist: 0, exchangeInput: null, persisted: null, body: null };
  const deps = {
    contracts: {
      parseRequest(value) {
        assert.equal(value.version, '1.0.0');
        assert.ok(typeof value.requestedAt === 'string');
        assert.equal(value.executionMode, 'test_only');
        return value;
      },
      parseResult(value) {
        assert.equal(value.bodyIncluded, false);
        assert.equal(value.version, '1.0.0');
        assert.ok(value.completedAt >= value.request.requestedAt);
        assert.ok(value.observations.length <= 8);
        const receipts = new Set(value.transportReceiptIds);
        for (const f of value.observations) {
          assert.ok(f.transportReceiptIds.every(id => receipts.has(id)));
          if (f.observation === 'unknown') {
            assert.equal(f.confidence, null);
            assert.deepEqual(f.transportReceiptIds, []);
            assert.deepEqual(f.evidenceReferenceIds, []);
          }
          if (f.observation === 'not_detected') assert.equal(value.coverage, 'bounded');
        }
        if (value.status === 'assessed') {
          assert.equal(value.coverage, 'bounded');
          assert.ok(value.observations.length > 0);
          assert.equal(value.reasonCodes.length, 0);
          assert.ok(value.observations.every(x => x.observation !== 'unknown'));
        }
        if (value.status === 'unavailable') {
          assert.equal(value.coverage, 'none');
          assert.deepEqual(value.transportReceiptIds, []);
          assert.ok(value.reasonCodes.length > 0);
        }
        if (value.coverage === 'partial') assert.ok(value.transportReceiptIds.length > 0);
        return value;
      },
    },
    now: () => new Date(time),
    async authorize(request) { calls.authorize++; return approval(request); },
    async exchange(input) {
      calls.exchange++; calls.exchangeInput = input;
      return { status: 200, finalUrl: input.url, contentType: 'text/html; charset=utf-8',
        body: Uint8Array.from(defaultBody), elapsedMs: 12 };
    },
    async extract({ body }) {
      calls.extract++; calls.body = body;
      return { coverage: 'bounded', findings: [finding()], reasonCodes: [] };
    },
    async persist(value) { calls.persist++; calls.persisted = value; },
    ...overrides,
  };
  return { deps, calls };
};

async function rejectsCode(promise, code) {
  await assert.rejects(promise, e => e instanceof WebsiteInspectionRuntimeError && e.code === code);
}

test('valid test fixture retains partial review status; raw HTML never reaches persistence', async () => {
  const { deps, calls } = fixture();
  const result = await executeWebsiteInspectionFixture(req(), deps);
  assert.equal(result.status, 'review_required');
  assert.equal(result.observations[0].transportReceiptIds[0], 'receipt.fixture1');
  assert.equal(calls.persist, 1);
  assert.equal(calls.exchangeInput.transportKind, 'test');
  assert.equal(calls.exchangeInput.maxResponseBytes, 1000);
  assert.equal(calls.exchangeInput.timeoutMs, 1000);
  assert.equal(calls.exchangeInput.url, 'https://example.com/');
  assert.equal(JSON.stringify(calls.persisted).includes('<form'), false);
  assert.equal(JSON.stringify(calls.persisted).includes('\"body\":'), false); // bodyIncluded:false is allowed
  assert.equal(result.bodyIncluded, false);
});

test('scope/provenance mismatch rejects BEFORE fixture exchange or DB mutation', async t => {
  const bad = [
    ['workspaceId', 'workspace.other'], ['inspectionId', 'inspection.other'], ['canonicalBusinessId', 'business.other'],
    ['verifiedDomain', 'other.example.com'], ['verificationId', 'verify.unauthorized'], ['domainEvidenceIds', ['domain.forged']],
    ['sourceKey', 'source.unapproved'], ['sourceAdmissionDecisionRef', 'admit.forged'],
    ['sourcePolicyId', 'policy.forged'], ['sourcePolicyVersion', '2.0.0'],
    ['transportPolicyId', 'transport.forged'], ['transportPolicyVersion', '2.0.0'],
    ['canonicalUrl', 'https://example.com.attacker.test/'], ['receiptId', '../evil'],
    ['transportKind', 'network'], ['decision', 'blocked'],
    ['maxResponseBytes', 999], ['timeoutMs', 999],
    ['expiresAt', '2026-10-15T00:00:00.000Z'],
    ['expiresAt', '2026-10-30T00:00:00.000Z'],
    ['fixtureBodySha256', '0'.repeat(64).slice(0,63)],
    ['fixtureStatus', 302], ['fixtureContentType', 'application/json'],
    ['fixtureByteLength', 1001],
  ];
  for (const [k, v] of bad) await t.test(`rejected ${k}`, async () => {
    const { deps, calls } = fixture({ authorize: async r => ({ ...approval(r), [k]: v }) });
    await rejectsCode(executeWebsiteInspectionFixture(req(), deps), 'M04_FIXTURE_ADMISSION_INVALID');
    assert.equal(calls.exchange, 0); assert.equal(calls.persist, 0);
  });
});

test('production or forged request intent cannot execute (even if fixture parser is lax)', async t => {
  for (const [key, value] of [
    ['networkRequested', true], ['credentialedFetchRequested', true],
    ['rawPayloadRequested', true], ['outreachRequested', true],
    ['executionMode', 'production'], ['sourceAdmissionDecision', 'blocked'],
    ['targetUrl', 'https://example.com/?secret=1'],
  ]) await t.test(key, async () => {
    const { deps, calls } = fixture({ contracts: { parseRequest: x => x, parseResult: x => x } });
    await rejectsCode(executeWebsiteInspectionFixture({ ...req(), [key]: value }, deps), 'M04_PRODUCTION_NETWORK_FORBIDDEN');
    assert.equal(calls.authorize, 0); assert.equal(calls.exchange, 0);
  });
});

test('unsupported multi-page budget is fail closed rather than silently skipped', async () => {
  const { deps, calls } = fixture();
  await rejectsCode(executeWebsiteInspectionFixture({ ...req(), limits: { ...req().limits, maxPages: 5 } }, deps), 'M04_MULTIPAGE_UNSUPPORTED');
  assert.equal(calls.exchange, 0);
});

test('invalid or future-only clock rejects without exchange', async () => {
  const { deps } = fixture({ now: () => new Date('2026-10-15T00:00:00Z') });
  await rejectsCode(executeWebsiteInspectionFixture(req(), deps), 'M04_CLOCK_INVALID');
});

test('redirect, changed final origin, unsupported media, oversized payload and timeout are rejected', async t => {
  const cases = [
    [{ status: 302 }, 'M04_FIXTURE_REDIRECT_FORBIDDEN'],
    [{ finalUrl: 'https://attacker.example/' }, 'M04_FIXTURE_REDIRECT_FORBIDDEN'],
    [{ contentType: 'application/json' }, 'M04_FIXTURE_CONTENT_TYPE_INVALID'],
    [{ body: new Uint8Array(1001) }, 'M04_FIXTURE_BYTE_BUDGET'],
    [{ elapsedMs: 1001 }, 'M04_FIXTURE_TIMEOUT'],
    [{ status: 700 }, 'M04_FIXTURE_RESPONSE_INVALID'],
  ];
  for (const [patch, code] of cases) await t.test(code, async () => {
    const { deps, calls } = fixture({ exchange: async input => ({
      status: 200, finalUrl: input.url, contentType: 'text/html', body: new Uint8Array(5), elapsedMs: 5, ...patch,
    }) });
    await rejectsCode(executeWebsiteInspectionFixture(req(), deps), code);
    assert.equal(calls.persist, 0);
    assert.equal(calls.extract, 0);
  });
});

test('HTTP 403 means unavailable, no false gap detection or receipt claim', async () => {
  const { deps, calls } = fixture({ authorize: async r => ({ ...approval(r), fixtureStatus:403, fixtureByteLength:0, fixtureBodySha256:sha(new Uint8Array()) }),
    exchange: async input => ({ status: 403,
    finalUrl: input.url, contentType: 'text/html', body: new Uint8Array(), elapsedMs: 1 }) });
  const result = await executeWebsiteInspectionFixture(req(), deps);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.coverage, 'none');
  assert.deepEqual(result.observations, []);
  assert.deepEqual(result.transportReceiptIds, []);
  assert.deepEqual(result.reasonCodes, ['website.http_unavailable']);
  assert.equal(calls.extract, 0);
});

test('HTTP 206 partial-content never produces assessed conclusions', async () => {
  const { deps } = fixture({ authorize: async r => ({ ...approval(r), fixtureStatus:206, fixtureByteLength:1, fixtureBodySha256:sha(new Uint8Array([1])) }),
    exchange: async x => ({ status: 206, finalUrl: x.url,
    contentType: 'text/html', body: new Uint8Array([1]), elapsedMs: 1 }) });
  const result = await executeWebsiteInspectionFixture(req(), deps);
  assert.equal(result.status, 'unavailable');
  assert.deepEqual(result.observations, []);
});

test('extractor errors yield review_required with uncertainty (no fabricated detection)', async () => {
  const { deps } = fixture({ extract: async () => { throw new Error('parser corrupted'); } });
  const result = await executeWebsiteInspectionFixture(req(), deps);
  assert.equal(result.status, 'review_required');
  assert.equal(result.coverage, 'partial');
  assert.equal(result.observations.length, 0);
  assert.deepEqual(result.reasonCodes, ['website.analysis_failed', 'website.single_page_only']);
});

test('bounded extractor cannot upgrade empty homepage fixture beyond review_required', async () => {
  const { deps } = fixture({ extract: async () => ({ coverage: 'bounded', findings: [], reasonCodes: [] }) });
  const result = await executeWebsiteInspectionFixture(req(), deps);
  assert.equal(result.status, 'review_required');
  assert.deepEqual(result.reasonCodes, ['website.no_findings', 'website.single_page_only']);
});

test('unknown remains unknown and has no confidence or transport receipt', async () => {
  const { deps } = fixture({ extract: async () => ({ coverage: 'partial', findings: [{
    capability: 'commerce', observation: 'unknown', reason: 'insufficient_evidence',
    confidence: null, evidenceReferenceIds: [],
  }], reasonCodes: [] }) });
  const result = await executeWebsiteInspectionFixture(req(), deps);
  assert.equal(result.status, 'review_required');
  assert.equal(result.observations[0].observation, 'unknown');
  assert.deepEqual(result.observations[0].transportReceiptIds, []);
});

test('negative not_detected always rejected from a single-page fixture, even with bounded claim', async () => {
  const notDetected = { ...finding(), observation: 'not_detected', reason: 'not_detected_with_bounded_coverage' };
  const { deps, calls } = fixture({ extract: async () => ({ coverage: 'partial', findings: [notDetected], reasonCodes: [] }) });
  await rejectsCode(executeWebsiteInspectionFixture(req(), deps), 'M04_EXTRACTION_NEGATIVE_WITHOUT_COVERAGE');
  assert.equal(calls.persist, 0);
  const ok = fixture({ extract: async () => ({ coverage: 'bounded', findings: [notDetected], reasonCodes: [] }) });
  await rejectsCode(executeWebsiteInspectionFixture(req(), ok.deps), 'M04_FIXTURE_NEGATIVE_UNSUPPORTED');
  assert.equal(ok.calls.persist, 0);
});

test('evidence extractor cannot inject its own foreign receipt IDs', async () => {
  const { deps } = fixture({ extract: async () => ({ coverage: 'bounded', findings: [{ ...finding(), transportReceiptIds: ['receipt.forged'] }], reasonCodes: [] }) });
  const result = await executeWebsiteInspectionFixture(req(), deps);
  assert.deepEqual(result.observations[0].transportReceiptIds, ['receipt.fixture1']);
  assert.equal(result.coverage, 'partial');
  assert.equal(result.status, 'review_required');
});

test('duplicate capability, forged evidence, invalid unknown claims, and reasons reject without persistence', async t => {
  const cases = [
    [{ coverage: 'bounded', findings: [finding(), finding()], reasonCodes: [] }, 'M04_EXTRACTION_INVALID'],
    [{ coverage: 'bounded', findings: [{ ...finding(), evidenceReferenceIds: ['../../etc/passwd'] }], reasonCodes: [] }, 'M04_EXTRACTION_INVALID'],
    [{ coverage: 'bounded', findings: [{ ...finding(), evidenceReferenceIds: ['same', 'same'] }], reasonCodes: [] }, 'M04_EXTRACTION_INVALID'],
    [{ coverage: 'partial', findings: [{ ...finding(), observation: 'unknown', confidence: 0.1 }], reasonCodes: [] }, 'M04_EXTRACTION_UNKNOWN_CLAIM'],
    [{ coverage: 'bounded', findings: [{ ...finding(), confidence: Infinity }], reasonCodes: [] }, 'M04_EXTRACTION_UNSUPPORTED_CLAIM'],
    [{ coverage: 'bounded', findings: [finding()], reasonCodes: ['invalid space'] }, 'M04_EXTRACTION_REASON_INVALID'],
    [{ coverage: 'bounded', findings: [finding()], reasonCodes: ['reason.x', 'reason.x'] }, 'M04_EXTRACTION_REASON_INVALID'],
    [{ coverage: 'none', findings: [finding()], reasonCodes: [] }, 'M04_EXTRACTION_INVALID'],
  ];
  for (const [extraction, code] of cases) await t.test(code, async () => {
    const { deps, calls } = fixture({ extract: async () => extraction });
    await rejectsCode(executeWebsiteInspectionFixture(req(), deps), code);
    assert.equal(calls.persist, 0);
  });
});

test('fresh authorizer exception rejects without executing or persisting', async () => {
  const { deps, calls } = fixture({ authorize: async () => { throw new Error('DB unavailable'); } });
  await assert.rejects(executeWebsiteInspectionFixture(req(), deps), /DB unavailable/);
  assert.equal(calls.exchange, 0); assert.equal(calls.persist, 0);
});

test('request is frozen before untrusted async admission to defeat mutation TOCTOU', async () => {
  const attacker = req();
  const { deps, calls } = fixture({ authorize: async r => {
    try { r.targetUrl = 'https://attacker.example/'; } catch {}
    try { r.limits.maxResponseBytes = 1000000; } catch {}
    try { r.domainVerification.evidenceIds[0] = 'domain.forged'; } catch {}
    return approval(r);
  }});
  const result = await executeWebsiteInspectionFixture(attacker, deps);
  assert.equal(result.request.targetUrl, 'https://example.com/');
  assert.equal(result.request.limits.maxResponseBytes, 1000);
  assert.deepEqual(result.request.domainVerification.evidenceIds, ['domain.evidence']);
  assert.equal(calls.exchangeInput.url, 'https://example.com/');
});

test('receipt ID remains pinned when exchange callback mutates authorizer-owned object', async () => {
  let authorization;
  const { deps } = fixture({
    authorize: async r => { authorization = { ...approval(r), fixtureBodySha256:sha(new Uint8Array(1)), fixtureByteLength:1 }; return authorization; },
    exchange: async x => { authorization.receiptId = 'receipt.attacker'; return {
      status: 200, finalUrl: x.url, contentType: 'text/html', body: new Uint8Array(1), elapsedMs: 1 }; },
  });
  const result = await executeWebsiteInspectionFixture(req(), deps);
  assert.deepEqual(result.observations[0].transportReceiptIds, ['receipt.fixture1']);
});

test('receipt/evidence content immutable after extractor mutates its copy', async () => {
  const input = new Uint8Array([60, 97, 62]);
  const { deps } = fixture({
    authorize: async r => ({...approval(r), fixtureBodySha256:sha(input),fixtureByteLength:input.byteLength}),
    exchange: async x => ({ status: 200, finalUrl: x.url, contentType: 'text/html', body: input, elapsedMs: 1 }),
    extract: async ({ body }) => { body[0] = 0; return { coverage: 'bounded', findings: [finding()], reasonCodes: [] }; },
  });
  await executeWebsiteInspectionFixture(req(), deps);
  assert.equal(input[0], 60);
});

test('approved fixture receipt is cryptographically bound to exact response bytes, status, type and length', async t => {
  const modified = Uint8Array.from(defaultBody);
  modified[0] ^= 1; // Equal-size tampering must still be detected.
  const candidates = [
    ['same-length changed body', { body: modified }],
    ['shortened body', { body: defaultBody.slice(1) }],
    ['unexpected HTTP status', { status: 201 }],
    ['same body but unauthorized media parameters normalized', { contentType: 'text/htmlx' }],
  ];
  for (const [label, patch] of candidates) await t.test(label, async () => {
    const { deps, calls } = fixture({ exchange: async input => ({
      status: 200, finalUrl: input.url, contentType: 'text/html',
      body: Uint8Array.from(defaultBody), elapsedMs: 3, ...patch,
    }) });
    const expectedError = label.includes('media') ? 'M04_FIXTURE_CONTENT_TYPE_INVALID' : 'M04_FIXTURE_ATTESTATION_MISMATCH';
    await rejectsCode(executeWebsiteInspectionFixture(req(), deps), expectedError);
    assert.equal(calls.extract, 0);
    assert.equal(calls.persist, 0);
  });
});

test('validly shaped but unauthorized fixture digest cannot yield evidence', async () => {
  const { deps, calls } = fixture({ authorize: async r => ({ ...approval(r), fixtureBodySha256: 'f'.repeat(64) }) });
  await rejectsCode(executeWebsiteInspectionFixture(req(), deps), 'M04_FIXTURE_ATTESTATION_MISMATCH');
  assert.equal(calls.extract, 0);
  assert.equal(calls.persist, 0);
});

test('trusted approved manifest cannot be swapped after authorization by injected exchange callback', async () => {
  let scope;
  const { deps } = fixture({
    authorize: async r => { scope = approval(r); return scope; },
    exchange: async x => {
      scope.fixtureBodySha256 = '0'.repeat(64);
      scope.fixtureStatus = 500;
      scope.fixtureByteLength = 0;
      return { status:200, finalUrl:x.url, contentType:'text/html',
        body: Uint8Array.from(defaultBody), elapsedMs:2 };
    },
  });
  const result = await executeWebsiteInspectionFixture(req(), deps);
  assert.equal(result.status, 'review_required');
  assert.equal(result.observations[0].transportReceiptIds[0], 'receipt.fixture1');
});

test('authorization expiring while exchange or extraction awaits prevents evidence persistence', async t => {
  for (const failureStage of ['exchange', 'extraction']) await t.test(failureStage, async () => {
    let calls = 0;
    let extractCalled = 0;
    let persisted = 0;
    const end = '2026-10-17T00:00:01.000Z';
    const { deps } = fixture({
      now: () => new Date(calls++ === 0 ? time : end),
      extract: async () => { extractCalled++; return { coverage:'bounded', findings:[finding()], reasonCodes:[] }; },
      persist: async () => { persisted++; },
    });
    await rejectsCode(executeWebsiteInspectionFixture(req(), deps), 'M04_FIXTURE_ADMISSION_EXPIRED');
    assert.equal(extractCalled, 1);
    assert.equal(persisted, 0);
  });
});

test('post-transport backward and invalid clocks fail closed before database handoff', async t => {
  for (const end of ['2026-10-15T22:59:00.000Z', 'not-a-time']) await t.test(end, async () => {
    let calls = 0;
    const { deps } = fixture({ now: () => new Date(calls++ === 0 ? time : end) });
    await rejectsCode(executeWebsiteInspectionFixture(req(), deps), 'M04_CLOCK_INVALID');
  });
});

test('admitted text/html content-type charset is allowed without weakening manifest type check', async () => {
  const { deps } = fixture();
  const result = await executeWebsiteInspectionFixture(req(), deps);
  assert.equal(result.status, 'review_required');
});


test('attested receipt is bound to the exact inspection ID before any exchange', async () => {
  const { deps, calls } = fixture({ authorize: async r => ({ ...approval(r), inspectionId: 'inspect.another' }) });
  await rejectsCode(executeWebsiteInspectionFixture(req(), deps), 'M04_FIXTURE_ADMISSION_INVALID');
  assert.equal(calls.exchange, 0);
  assert.equal(calls.persist, 0);
});

test('fixture body getter cannot switch attested bytes before extraction', async () => {
  const modified = new TextEncoder().encode('<p>UNATTESTED_PAGE_CONTENT</p>');
  let reads = 0;
  const { deps, calls } = fixture({ exchange: async input => ({
    status: 200, finalUrl: input.url, contentType: 'text/html', elapsedMs: 1,
    get body() { reads++; return reads === 1 ? Uint8Array.from(defaultBody) : modified; },
  }) });
  const result = await executeWebsiteInspectionFixture(req(), deps);
  assert.equal(result.status, 'review_required');
  assert.equal(reads, 1);
  assert.deepEqual(calls.body, defaultBody);
  assert.equal(calls.persist, 1);
});

test('switching fixture body on initial read is blocked by original admission digest', async () => {
  const malicious = new TextEncoder().encode('<p>UNATTESTED_PAGE_CONTENT</p>');
  const { deps, calls } = fixture({ exchange: async input => ({
    status: 200, finalUrl: input.url, contentType: 'text/html', elapsedMs: 1,
    get body() { return malicious; },
  }) });
  await rejectsCode(executeWebsiteInspectionFixture(req(), deps), 'M04_FIXTURE_ATTESTATION_MISMATCH');
  assert.equal(calls.persist, 0);
  assert.equal(calls.extract, 0);
});


test('oversized response is rejected before attempting an attacker-controlled body copy', async () => {
  const oversized = new Uint8Array(1001);
  Object.defineProperty(oversized, Symbol.iterator, { value() {
    throw new Error('OVERSIZED_BUFFER_SHOULD_NOT_BE_COPIED');
  } });
  const { deps, calls } = fixture({ exchange: async input => ({
    status: 200, finalUrl: input.url, contentType: 'text/html', elapsedMs: 1,
    body: oversized,
  }) });
  await rejectsCode(executeWebsiteInspectionFixture(req(), deps), 'M04_FIXTURE_BYTE_BUDGET');
  assert.equal(calls.extract, 0);
  assert.equal(calls.persist, 0);
});

// WEB-008: the real acquisition unit is one homepage fixture. An injected
// extractor is not entitled to pronounce the entire website assessed.
test('WEB-008: even perfect bounded extractor findings remain partial and review_required', async () => {
  const { deps, calls } = fixture({extract: async () => ({
    coverage:'bounded',findings:[finding()],reasonCodes:[],
  })});
  const result = await executeWebsiteInspectionFixture(req(), deps);
  assert.equal(result.status,'review_required');
  assert.equal(result.coverage,'partial');
  assert.deepEqual(result.reasonCodes,['website.single_page_only']);
  assert.equal(result.observations[0].observation,'observed_present');
  assert.equal(calls.persist,1);
  assert.equal(calls.persisted.status,'review_required');
  assert.equal(calls.persisted.coverage,'partial');
});

test('WEB-008: existing single-page uncertainty reason is not duplicated', async () => {
  const {deps} = fixture({extract: async () => ({
    coverage:'partial',findings:[finding()],reasonCodes:['website.single_page_only'],
  })});
  const result = await executeWebsiteInspectionFixture(req(),deps);
  assert.deepEqual(result.reasonCodes,['website.single_page_only']);
});

test('WEB-008: extractor with no reason still cannot suppress coverage warning', async () => {
  const {deps} = fixture({extract: async () => ({
    coverage:'partial',findings:[finding()],reasonCodes:[],
  })});
  const result = await executeWebsiteInspectionFixture(req(),deps);
  assert.equal(result.status,'review_required');
  assert.deepEqual(result.reasonCodes,['website.single_page_only']);
});

test('WEB-008: injected bounded negative-absence claim rejects before persistence', async () => {
  const {deps,calls} = fixture({extract: async () => ({
    coverage:'bounded',findings:[{
      ...finding(),observation:'not_detected',reason:'not_detected_with_bounded_coverage',
    }],reasonCodes:[],
  })});
  await rejectsCode(executeWebsiteInspectionFixture(req(),deps),'M04_FIXTURE_NEGATIVE_UNSUPPORTED');
  assert.equal(calls.persist,0);
});

test('WEB-008: analysis-failed fixture never becomes assessed or omits uncertainty', async () => {
  const {deps,calls} = fixture({extract: async () => {throw new Error('corrupt fixture');}});
  const result = await executeWebsiteInspectionFixture(req(),deps);
  assert.equal(result.status,'review_required');
  assert.equal(result.coverage,'partial');
  assert.deepEqual(result.reasonCodes,['website.analysis_failed','website.single_page_only']);
  assert.equal(calls.persist,1);
});

// WEB-009: the untrusted extraction response is snapshotted before validation.
test('WEB-009: accessor changing observation after validation is rejected before DB', async () => {
  const hostile = finding();
  let reads = 0;
  Object.defineProperty(hostile, 'observation', {
    enumerable:true, get() { return reads++ === 0 ? 'observed_present' : 'not_detected'; },
  });
  const {deps,calls} = fixture({extract:async()=>({coverage:'bounded',findings:[hostile],reasonCodes:[]})});
  await rejectsCode(executeWebsiteInspectionFixture(req(),deps),'M04_EXTRACTION_INVALID');
  assert.equal(reads,0);
  assert.equal(calls.persist,0);
});

test('WEB-009: getter-based forged evidence ID rejected without accessing getter', async () => {
  const refs = ['legitimate.ref'];
  let reads = 0;
  Object.defineProperty(refs, '0', { configurable:true, enumerable:true,
    get() { reads++; return 'fabricated'; },
  });
  const {deps,calls} = fixture({extract:async()=>({coverage:'partial', findings:[{
    ...finding(), evidenceReferenceIds:refs,
  }], reasonCodes:[]})});
  await rejectsCode(executeWebsiteInspectionFixture(req(),deps),'M04_EXTRACTION_INVALID');
  assert.equal(reads,0);
  assert.equal(calls.persist,0);
});

test('WEB-009: extractor result top-level getters cannot fabricate bounded coverage', async () => {
  const raw={findings:[finding()],reasonCodes:[]};
  let reads=0;
  Object.defineProperty(raw, 'coverage',{get() {reads++;return 'bounded';}});
  const {deps,calls} = fixture({extract:async()=>raw});
  await rejectsCode(executeWebsiteInspectionFixture(req(),deps),'M04_EXTRACTION_INVALID');
  assert.equal(reads,0);
  assert.equal(calls.persist,0);
});

test('WEB-009: untrusted extra raw HTML and secret fields never enter persisted projection', async () => {
  const f={...finding(),rawHtml:'<secret>text</secret>',apiKey:'leak'};
  const {deps,calls}=fixture({extract:async()=>({
    coverage:'bounded',findings:[f],reasonCodes:[],rawHtml:'<html>secret</html>',
  })});
  const result=await executeWebsiteInspectionFixture(req(),deps);
  assert.equal(result.coverage,'partial');
  assert.equal(result.status,'review_required');
  assert.equal(JSON.stringify(calls.persisted).includes('<secret>'),false);
  assert.equal(JSON.stringify(calls.persisted).includes('leak'),false);
});

test('WEB-009: sparse findings arrays fail closed without implicit undefined entries', async () => {
  const sparse = new Array(1);
  const {deps,calls}=fixture({extract:async()=>({
    coverage:'partial',findings:sparse,reasonCodes:[],
  })});
  await rejectsCode(executeWebsiteInspectionFixture(req(),deps),'M04_EXTRACTION_INVALID');
  assert.equal(calls.persist,0);
});

// WEB-010: approvals returned from an async trust boundary must be immutable
// snapshots, not accessor-driven state re-read after validation.
test('WEB-010: receipt getter cannot swap verified provenance after admission', async () => {
  const source = approval();
  let reads = 0;
  Object.defineProperty(source, 'receiptId', { enumerable:true,
    get() { reads++; return reads === 1 ? 'receipt.fixture1' : 'receipt.forged'; },
  });
  const {deps,calls} = fixture({authorize:async()=>source});
  await rejectsCode(executeWebsiteInspectionFixture(req(),deps),'M04_FIXTURE_ADMISSION_INVALID');
  assert.equal(reads,0);
  assert.equal(calls.exchange,0);
  assert.equal(calls.persist,0);
});

test('WEB-010: changing digest getter is rejected before fixture exchange', async () => {
  const source=approval();
  let reads=0;
  Object.defineProperty(source, 'fixtureBodySha256', { enumerable:true,
    get() { reads++; return reads === 1 ? sha(defaultBody) : '0'.repeat(64); },
  });
  const {deps,calls}=fixture({authorize:async()=>source});
  await rejectsCode(executeWebsiteInspectionFixture(req(),deps),'M04_FIXTURE_ADMISSION_INVALID');
  assert.equal(reads,0);
  assert.equal(calls.exchange,0);
  assert.equal(calls.persist,0);
});

test('WEB-010: sparse verification evidence array fails without invoking getters', async () => {
  const source=approval();
  const ids=['domain.evidence'];
  let reads=0;
  Object.defineProperty(ids,'0',{configurable:true,get(){reads++;return 'domain.evidence';}});
  source.domainEvidenceIds=ids;
  const {deps,calls}=fixture({authorize:async()=>source});
  await rejectsCode(executeWebsiteInspectionFixture(req(),deps),'M04_FIXTURE_ADMISSION_INVALID');
  assert.equal(reads,0);
  assert.equal(calls.exchange,0);
  assert.equal(calls.persist,0);
});

test('WEB-010: mutate authorization while exchange is pending cannot swap evidence', async () => {
  const source=approval();
  const {deps,calls}=fixture({
    authorize:async()=>source,
    exchange:async input=>{
      source.receiptId='receipt.forged';
      source.fixtureBodySha256='f'.repeat(64);
      source.domainEvidenceIds=['forged.evidence'];
      return {status:200,finalUrl:input.url,contentType:'text/html',
        body:Uint8Array.from(defaultBody),elapsedMs:12};
    },
  });
  const result=await executeWebsiteInspectionFixture(req(),deps);
  assert.deepEqual(result.transportReceiptIds,['receipt.fixture1']);
  assert.equal(result.observations[0].transportReceiptIds[0],'receipt.fixture1');
  assert.equal(calls.persist,1);
});


test('WEB-011: mandatory single-page reason cannot overflow 16-code result contract', async () => {
  const codes=Array.from({length:16},(_,i)=>`reason.${i}`);
  const {deps,calls}=fixture({extract:async()=>({coverage:'partial',findings:[finding()],reasonCodes:codes})});
  await rejectsCode(executeWebsiteInspectionFixture(req(),deps),'M04_EXTRACTION_REASON_INVALID');
  assert.equal(calls.persist,0);
});

test('WEB-011: 15 extractor reasons plus mandatory uncertainty code fits contract', async () => {
  const codes=Array.from({length:15},(_,i)=>`reason.${i}`);
  const {deps,calls}=fixture({extract:async()=>({coverage:'partial',findings:[finding()],reasonCodes:codes})});
  const result=await executeWebsiteInspectionFixture(req(),deps);
  assert.equal(result.reasonCodes.length,16);
  assert.equal(result.reasonCodes[15],'website.single_page_only');
  assert.equal(calls.persist,1);
});