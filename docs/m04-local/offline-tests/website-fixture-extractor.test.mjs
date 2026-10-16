import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { extractWebsiteCapabilitiesFromFixture as extract, WebsiteFixtureExtractionError } from '../apps/worker/src/website-fixture-extractor.ts';
import { executeWebsiteInspectionFixture } from '../apps/worker/src/website-inspection-runtime.ts';

const request = () => ({
  version: '1.0.0', inspectionId: 'inspection.fixture', workspaceId: 'workspace.fixture',
  canonicalBusinessId: 'business.fixture', verifiedDomain: 'example.com',
  domainVerification: { verificationId: 'verified.fixture', decision: 'verified', evidenceIds: ['verified.evidence'] },
  targetUrl: 'https://example.com/', sourceKey: 'source.approved_fixture',
  sourceAdmissionDecisionRef: 'source.admission', sourceAdmissionDecision: 'allow',
  sourcePolicySnapshot: { policyId: 'policy.fixture', policyVersion: '1.0.0' },
  transportPolicyId: 'transport.fixture', transportPolicyVersion: '1.0.0',
  limits: { maxPages: 1, maxResponseBytes: 10000, timeoutMs: 1000 },
  executionMode: 'test_only', networkRequested: false, credentialedFetchRequested: false,
  rawPayloadRequested: false, outreachRequested: false,
  requestedAt: '2026-10-15T23:00:00.000Z',
});
const evidence = (html, options = {}) => ({
  body: new TextEncoder().encode(html), request: request(), receiptId: 'receipt.fixture', ...options,
});
const observation = (result, name) => result.findings.find(x => x.capability === name);
const positive = (result, name) => observation(result, name).observation === 'observed_present';

const expectedClaims = ['booking','commerce','contact_form','business_contact','mobile_viewport','structured_data','social_link','https'];

test('blank page cannot produce negative claims, even for absent features', async () => {
  const result = await extract(evidence('<!doctype html><html><body></body></html>'));
  assert.equal(result.coverage, 'partial');
  assert.deepEqual(result.reasonCodes, ['website.single_page_only']);
  assert.deepEqual(result.findings.map(x => x.capability), expectedClaims);
  assert.ok(result.findings.every(x => x.observation !== 'not_detected'));
  assert.equal(observation(result,'commerce').observation, 'unknown');
  assert.equal(observation(result,'commerce').confidence, null);
  assert.equal(observation(result,'commerce').evidenceReferenceIds.length, 0);
  assert.equal(positive(result,'https'), true);
});

test('evidenced form, responsive viewport and exact-host social link produce bounded positive fixture fingerprints', async () => {
  const html = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body><form id="contact"><input type="email" name="email" /><textarea name="message"></textarea></form>
    <a href="https://www.instagram.com/example/">Instagram</a></body></html>`;
  const result = await extract(evidence(html));
  for (const cap of ['contact_form','mobile_viewport','social_link','https']) {
    const f = observation(result,cap);
    assert.equal(f.observation,'observed_present');
    assert.equal(f.reason,'detected');
    assert.equal(f.confidence, 0.8);
    assert.match(f.evidenceReferenceIds[0], /^fixture\.[0-9a-f]{40}$/);
  }
  assert.equal(observation(result,'structured_data').observation, 'unknown');
  assert.doesNotMatch(JSON.stringify(result), /contact\"><input|<html|<textarea|Instagram</);
});

test('evidence IDs stable per receipt and layout, and scoped to receipt provenance', async () => {
  const a = await extract(evidence('<meta name="viewport" content="width=device-width">'));
  const b = await extract(evidence('<meta name="viewport" content="width=device-width">'));
  const c = await extract(evidence('<meta name="viewport" content="width=device-width">', { receiptId: 'receipt.changed' }));
  assert.equal(observation(a,'mobile_viewport').evidenceReferenceIds[0],observation(b,'mobile_viewport').evidenceReferenceIds[0]);
  assert.notEqual(observation(a,'mobile_viewport').evidenceReferenceIds[0],observation(c,'mobile_viewport').evidenceReferenceIds[0]);
});

test('simple search/newsletter form cannot masquerade as customer contact form', async t => {
  for (const html of [
    '<form><input name="q"></form>',
    '<form><input type="email"></form>',
    '<form><textarea name="message"></textarea></form>',
    '<form><input type="email"></form><textarea name="message"></textarea>',
    '<form><input type="email"><textarea name="message">',
  ]) await t.test(html, async () => {
    const result = await extract(evidence(html));
    assert.equal(observation(result,'contact_form').observation, 'unknown');
  });
});

test('HTML comments, script/style/textarea/template contents are not interpreted as real page tags', async t => {
  for (const html of [
    '<!-- <a href="https://instagram.com/ok"></a><meta name="viewport" content="width=device-width"> -->',
    '<script>const link = `<a href="https://instagram.com/ok">`; const vp=`<meta name="viewport" content="width=device-width">`;</script>',
    '<style> a:after {content: \'<a href="https://instagram.com/ok">\'} </style>',
    '<template><a href="https://instagram.com/ok"></a><meta name="viewport" content="width=device-width"></template>',
    '<textarea><a href="https://instagram.com/ok">dummy</a></textarea>',
  ]) await t.test(html.slice(0,45), async () => {
    const result = await extract(evidence(html));
    assert.equal(observation(result,'social_link').observation, 'unknown');
    assert.equal(observation(result,'mobile_viewport').observation, 'unknown');
  });
});

test('social host is exact and HTTPS-only, never substring or URL credentials', async t => {
  for (const href of [
    'https://instagram.com.evil.test/ok', 'https://instagram.com@evil.test/ok',
    'http://instagram.com/profile', 'https://admin:password@instagram.com/profile',
    '//instagram.com/profile', 'javascript:alert(1)', 'https://notinstagram.com/profile',
  ]) await t.test(href, async () => {
    const result = await extract(evidence(`<a href="${href}">External</a>`));
    assert.equal(observation(result,'social_link').observation, 'unknown');
  });
});

test('quoted > is not treated as a tag boundary, and uppercase tags work', async () => {
  const r = await extract(evidence('<META content="initial-scale=1, width=device-width" NAME="VIEWPORT" data-info="2 > 1"><A HREF="https://x.com/team">X</A>'));
  assert.equal(positive(r,'mobile_viewport'),true);
  assert.equal(positive(r,'social_link'),true);
});

test('mere ld+json script tag without validated JSON does not claim structured data', async () => {
  const r = await extract(evidence('<script type="application/ld+json">{ "@context": "https://schema.org" }</script>'));
  assert.equal(observation(r,'structured_data').observation, 'unknown');
});

test('HTML and JS never get executed by the extractor', async () => {
  globalThis.__m04HarnessFlag = 0;
  await extract(evidence('<script>globalThis.__m04HarnessFlag=99</script><img src=x onerror="globalThis.__m04HarnessFlag=42">'));
  assert.equal(globalThis.__m04HarnessFlag,0);
  delete globalThis.__m04HarnessFlag;
});

test('invalid utf8, overbudget payload and forged receipt fail closed', async t => {
  const cases = [
    [evidence('', {body: new Uint8Array([0xff])}), 'M04_FIXTURE_EXTRACT_ENCODING_INVALID'],
    [evidence('x'.repeat(10001)), 'M04_FIXTURE_EXTRACT_BYTE_BUDGET'],
    [evidence('x', {receiptId: '../../forged'}), 'M04_FIXTURE_EXTRACT_RECEIPT_INVALID'],
    [evidence('x', {body: null}), 'M04_FIXTURE_EXTRACT_BYTE_BUDGET'],
  ];
  for(const [fixture, code] of cases) await t.test(code, async () => {
    await assert.rejects(extract(fixture), err => err instanceof WebsiteFixtureExtractionError && err.code === code);
  });
});

test('end-to-end runtime with real built-in extractor keeps all missing signals unknown and persists no page text', async () => {
  const captured = [];
  const req = request();
  const html = '<form><input type="email"><textarea name="message"></textarea></form>';
  const deps = {
    contracts: { parseRequest: value => value, parseResult: value => value },
    now: () => new Date('2026-10-16T00:00:00.000Z'),
    async authorize(r) { return {
      decision:'allow', transportKind:'test', workspaceId:r.workspaceId, inspectionId:r.inspectionId,
      canonicalBusinessId:r.canonicalBusinessId, verifiedDomain:r.verifiedDomain,
      verificationId:r.domainVerification.verificationId, domainEvidenceIds:[...r.domainVerification.evidenceIds],
      sourceKey:r.sourceKey, sourceAdmissionDecisionRef:r.sourceAdmissionDecisionRef,
      sourcePolicyId:r.sourcePolicySnapshot.policyId,sourcePolicyVersion:r.sourcePolicySnapshot.policyVersion,
      transportPolicyId:r.transportPolicyId, transportPolicyVersion:r.transportPolicyVersion,
      canonicalUrl:r.targetUrl, receiptId:'receipt.fixture', maxResponseBytes:r.limits.maxResponseBytes,
      fixtureStatus:200,fixtureContentType:'text/html',
      fixtureByteLength:new TextEncoder().encode(html).byteLength,
      fixtureBodySha256:createHash('sha256').update(new TextEncoder().encode(html)).digest('hex'),
      timeoutMs:r.limits.timeoutMs, expiresAt:'2026-10-16T01:00:00.000Z',
    }; },
    async exchange(x) { return { status:200, finalUrl:x.url, contentType:'text/html',
      body:new TextEncoder().encode(html),elapsedMs:3 }; },
    extract,
    async persist(result) { captured.push(result); },
  };
  const result = await executeWebsiteInspectionFixture(req,deps);
  assert.equal(result.status,'review_required');
  assert.equal(result.coverage,'partial');
  assert.equal(result.observations.length,8);
  assert.equal(result.observations.find(x=>x.capability==='contact_form').observation,'observed_present');
  assert.equal(result.observations.find(x=>x.capability==='booking').observation,'unknown');
  assert.deepEqual(result.observations.find(x=>x.capability==='booking').transportReceiptIds,[]);
  assert.equal(captured.length,1);
  assert.equal(JSON.stringify(captured).includes(html),false);
  assert.equal(JSON.stringify(captured).includes('<form'),false);
});

test('inert noscript and iframe fallback markup cannot forge active page features', async t => {
  for (const html of [
    '<noscript><a href="https://instagram.com/brand">link</a><meta name="viewport" content="width=device-width"></noscript>',
    '<iframe src="https://safe.example/"><a href="https://instagram.com/brand">bad link</a></iframe>',
  ]) await t.test(html.slice(0,18),async()=>{
    const r=await extract(evidence(html));
    assert.equal(observation(r,'social_link').observation,'unknown');
    assert.equal(observation(r,'mobile_viewport').observation,'unknown');
  });
});

test('disabled or hidden form controls do not claim an active contact form', async t => {
  for (const html of [
    '<form><input type="hidden" name="email"><textarea>message</textarea></form>',
    '<form><input type="email" disabled><textarea>message</textarea></form>',
    '<form><input type="email"><textarea disabled>message</textarea></form>',
    '<form><input type="email" hidden><textarea>message</textarea></form>',
    '<form><input type="email"><textarea hidden>message</textarea></form>',
  ]) await t.test(html.slice(0,35),async()=>{
    const r=await extract(evidence(html));
    assert.equal(observation(r,'contact_form').observation,'unknown');
  });
});


test('hidden/inert/aria-hidden and display:none ancestors never contribute capability claims', async t => {
  const wrappers = [
    '<div hidden>', '<section inert>', '<article aria-hidden="true">',
    '<aside style="display: none">', '<div style="visibility:hidden">',
    '<div style="opacity:0">', '<section style="visibility:collapse!important">',
    '<div style="color:red; opacity : 0.0 !important">',
  ];
  const closings = ['</div>', '</section>', '</article>', '</aside>', '</div>',
    '</div>', '</section>', '</div>'];
  const claims = '<form><input type="email"><textarea></textarea></form><a href="https://instagram.com/team">profile</a>';
  for (let i = 0; i < wrappers.length; i++) await t.test(wrappers[i], async () => {
    const r = await extract(evidence(wrappers[i] + claims + closings[i]));
    assert.equal(observation(r,'contact_form').observation,'unknown');
    assert.equal(observation(r,'social_link').observation,'unknown');
  });
});

test('hidden form, hidden anchor, disabled fieldset, and masked message never masquerade as contact capability', async t => {
  const bodies = [
    '<form hidden><input type="email"><textarea></textarea></form>',
    '<form><fieldset disabled><input type="email"><textarea></textarea></fieldset></form>',
    '<form><input type="checkbox" name="email"><textarea></textarea></form>',
    '<form><input type="password" name="email"><textarea></textarea></form>',
    '<form><input type="email"><textarea aria-hidden="true"></textarea></form>',
    '<form><input type="email"><textarea style="display:none"></textarea></form>',
  ];
  for (const html of bodies) await t.test(html, async () => {
    const r = await extract(evidence(html));
    assert.equal(observation(r,'contact_form').observation,'unknown');
  });
  const anchors = await extract(evidence('<a hidden href="https://instagram.com/team"></a><a inert href="https://x.com/team"></a>'));
  assert.equal(observation(anchors,'social_link').observation,'unknown');
});

test('mismatched closing tag cannot prematurely re-enable hidden subtree scanning', async () => {
  const r = await extract(evidence('<div hidden><section></wrong><a href="https://instagram.com/team">Hidden</a></section></div>'));
  assert.equal(observation(r,'social_link').observation,'unknown');
});

test('visible elements after a properly closed hidden subtree still yield evidence', async () => {
  const html='<div hidden><p>ignored</p><a href="https://x.com/hidden">no</a></div><a href="https://instagram.com/visible">yes</a>';
  const r=await extract(evidence(html));
  assert.equal(positive(r,'social_link'),true);
});

// WEB-012: a static fixture parser must not interpret HTML raw-text and
// metadata content as independently rendered links/forms/viewport metadata.
test('WEB-012: title, xmp, listing, noembed, noframes content cannot forge visible social/viewport claims', async t => {
  for (const element of ['title','xmp','listing','noembed','noframes']) {
    const html = `<${element}><a href="https://instagram.com/forged">fake</a><meta name="viewport" content="width=device-width"></${element}>`;
    await t.test(element, async () => {
      const r = await extract(evidence(html));
      assert.equal(observation(r,'social_link').observation, 'unknown');
      assert.equal(observation(r,'mobile_viewport').observation, 'unknown');
    });
  }
});

test('WEB-012: plaintext consumes the remainder of the page even with a fake closing tag', async () => {
  const html = '<plaintext></plaintext><a href="https://instagram.com/forged">fake</a><meta name="viewport" content="width=device-width">';
  const r = await extract(evidence(html));
  assert.equal(observation(r,'social_link').observation, 'unknown');
  assert.equal(observation(r,'mobile_viewport').observation, 'unknown');
});

test('WEB-012: visible tags AFTER a genuine title or xmp close are still recognized', async () => {
  const html = '<title><a href="https://instagram.com/forged"></title><xmp><meta name="viewport" content="width=device-width"></xmp>'+
    '<a href="https://instagram.com/real">Real</a><meta name="viewport" content="width=device-width">';
  const r = await extract(evidence(html));
  assert.equal(positive(r,'social_link'), true);
  assert.equal(positive(r,'mobile_viewport'), true);
});

test('WEB-013: CDATA-like blocks in HTML text cannot forge a link or viewport tag', async () => {
  const html = '<![CDATA[<a href="https://instagram.com/forged">fake</a><meta name="viewport" content="width=device-width">]]>';
  const r = await extract(evidence(html));
  assert.equal(observation(r,'social_link').observation, 'unknown');
  assert.equal(observation(r,'mobile_viewport').observation, 'unknown');
});

test('WEB-014: dense HTML tag floods fail closed within fixture byte budget', async () => {
  const html = '<span></span>'.repeat(20_001);
  const fixture = evidence(html);
  fixture.request.limits.maxResponseBytes = 1_000_000;
  await assert.rejects(extract(fixture), err =>
    err instanceof WebsiteFixtureExtractionError && err.code === 'M04_FIXTURE_TAG_BUDGET');
});

test('WEB-014: ordinary bounded documents remain parseable after tag-budget enforcement', async () => {
  const html = '<span></span>'.repeat(150) + '<a href="https://instagram.com/genuine">real</a>';
  const result = await extract(evidence(html));
  assert.equal(positive(result, 'social_link'), true);
});