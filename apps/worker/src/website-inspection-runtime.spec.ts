import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
  WebsiteInspectionRequestSchema,
  WebsiteInspectionResultSchema,
  type WebsiteInspectionRequest,
} from '@brovexa/contracts';
import { executeWebsiteInspectionFixture } from './website-inspection-runtime';
import { toWebsiteInspectionPersistencePayload } from './website-inspection-db-bridge';

const WORKSPACE = '550e8400-e29b-41d4-a716-446655440000';
const NOW = '2026-10-16T00:00:00.000Z';

function request(): WebsiteInspectionRequest {
  return {
    version: '1.0.0', inspectionId: 'inspection.m04.1', workspaceId: WORKSPACE,
    canonicalBusinessId: 'business.m04.1', verifiedDomain: 'example.com',
    domainVerification: {
      verificationId: 'verification.m04.1', decision: 'verified', evidenceIds: ['domain.evidence.1'],
    },
    targetUrl: 'https://example.com/', sourceKey: 'source.approved_web',
    sourceAdmissionDecisionRef: 'admission.1', sourceAdmissionDecision: 'allow',
    sourcePolicySnapshot: { policyId: 'policy.web', policyVersion: '1.0.0' },
    transportPolicyId: 'policy.transport', transportPolicyVersion: '1.0.0',
    limits: { maxPages: 1, maxResponseBytes: 4096, timeoutMs: 1000 },
    executionMode: 'test_only', networkRequested: false, credentialedFetchRequested: false,
    rawPayloadRequested: false, outreachRequested: false, requestedAt: '2026-10-15T23:00:00.000Z',
  };
}

function fixture(overrides: Record<string, unknown> = {}) {
  const fixtureBody = typeof overrides.fixtureBody === 'string'
    ? new TextEncoder().encode(overrides.fixtureBody)
    : new TextEncoder().encode('<form method="post"></form>');
  const persist = vi.fn(async () => {});
  const exchange = vi.fn(async () => ({
    status: 200, finalUrl: 'https://example.com/', contentType: 'text/html',
    body: Uint8Array.from(fixtureBody), elapsedMs: 1,
  }));
  const authorize = vi.fn(async (r: WebsiteInspectionRequest) => ({
    decision: 'allow' as const, transportKind: 'test' as const,
    workspaceId: r.workspaceId, inspectionId: r.inspectionId, canonicalBusinessId: r.canonicalBusinessId,
    verifiedDomain: r.verifiedDomain, verificationId: r.domainVerification.verificationId,
    domainEvidenceIds: [...r.domainVerification.evidenceIds],
    sourceKey: r.sourceKey, sourceAdmissionDecisionRef: r.sourceAdmissionDecisionRef,
    sourcePolicyId: r.sourcePolicySnapshot.policyId, sourcePolicyVersion: r.sourcePolicySnapshot.policyVersion,
    transportPolicyId: r.transportPolicyId, transportPolicyVersion: r.transportPolicyVersion,
    canonicalUrl: r.targetUrl, receiptId: 'receipt.fixture.1',
    fixtureStatus: 200, fixtureContentType: 'text/html' as const,
    fixtureByteLength: fixtureBody.byteLength,
    fixtureBodySha256: createHash('sha256').update(fixtureBody).digest('hex'),
    maxResponseBytes: r.limits.maxResponseBytes, timeoutMs: r.limits.timeoutMs,
    expiresAt: '2026-10-16T01:00:00.000Z',
  }));
  const deps = {
    contracts: {
      parseRequest: (v: unknown) => WebsiteInspectionRequestSchema.parse(v),
      parseResult: (v: unknown) => WebsiteInspectionResultSchema.parse(v),
    },
    authorize,
    exchange,
    extract: vi.fn(async () => ({
      coverage: 'bounded' as const, reasonCodes: [] as string[],
      findings: [{
        capability: 'contact_form' as const, observation: 'observed_present' as const,
        reason: 'detected' as const, confidence: 0.95,
        evidenceReferenceIds: ['evidence.form.1'],
      }],
    })),
    persist,
    now: () => new Date(NOW),
    ...overrides,
  };
  return { deps, authorize, exchange, persist };
}

describe('M04-WEB-003 native contracts and fixture-only handoff', () => {
  it('emits a Zod-valid partial result and projects onto the WEB-002 storage shape', async () => {
    const { deps, persist } = fixture();
    const result = await executeWebsiteInspectionFixture(request(), deps);
    expect(WebsiteInspectionResultSchema.safeParse(result).success).toBe(true);
    expect(result.status).toBe('review_required');
    expect(persist).toHaveBeenCalledOnce();
    const projected = toWebsiteInspectionPersistencePayload(result, {
      workspaceId: WORKSPACE, retentionTtlSeconds: 86400, deletionRequired: true,
    });
    expect(projected.request).not.toHaveProperty('limits');
    expect(projected).not.toHaveProperty('body');
    expect(projected.deletionRequired).toBe(true);
    expect(projected.observations[0]?.transportReceiptIds).toEqual(['receipt.fixture.1']);
  });

  it('does not execute fixture or persist when source approval is workspace-forged', async () => {
    const { deps, exchange, persist } = fixture({
      authorize: async (r: WebsiteInspectionRequest) => ({
        decision: 'allow' as const, transportKind: 'test' as const,
        workspaceId: '550e8400-e29b-41d4-a716-446655440001',
        inspectionId: r.inspectionId,
        canonicalBusinessId: r.canonicalBusinessId,
        verifiedDomain: r.verifiedDomain, verificationId: r.domainVerification.verificationId,
        domainEvidenceIds: [...r.domainVerification.evidenceIds],
        sourceKey: r.sourceKey, sourceAdmissionDecisionRef: r.sourceAdmissionDecisionRef,
        sourcePolicyId: r.sourcePolicySnapshot.policyId,
        sourcePolicyVersion: r.sourcePolicySnapshot.policyVersion,
        transportPolicyId: r.transportPolicyId,
        transportPolicyVersion: r.transportPolicyVersion,
        canonicalUrl: r.targetUrl, receiptId: 'receipt.fixture.1',
        fixtureStatus: 200, fixtureContentType: 'text/html' as const,
        fixtureByteLength: new TextEncoder().encode('<form method="post"></form>').byteLength,
        fixtureBodySha256: createHash('sha256').update(new TextEncoder().encode('<form method="post"></form>')).digest('hex'),
        maxResponseBytes: 4096, timeoutMs: 1000,
        expiresAt: '2026-10-16T01:00:00.000Z',
      }),
    });
    await expect(executeWebsiteInspectionFixture(request(), deps))
      .rejects.toMatchObject({ code: 'M04_FIXTURE_ADMISSION_INVALID' });
    expect(exchange).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it('never converts unknown capability to not-detected negative evidence', async () => {
    const { deps } = fixture({
      extract: async () => ({ coverage: 'partial' as const, reasonCodes: [], findings: [{
        capability: 'commerce' as const, observation: 'unknown' as const,
        reason: 'insufficient_evidence' as const, confidence: null, evidenceReferenceIds: [],
      }] }),
    });
    const result = await executeWebsiteInspectionFixture(request(), deps);
    expect(result.status).toBe('review_required');
    expect(result.observations[0]?.observation).toBe('unknown');
    expect(result.observations[0]?.transportReceiptIds).toEqual([]);
    expect(WebsiteInspectionResultSchema.safeParse(result).success).toBe(true);
  });

  it('rejects unsafe URL and live network intent using actual public contract', async () => {
    const { deps, exchange } = fixture();
    for (const targetUrl of ['https://example.com', 'https://example.com/?', 'https://localhost/']) {
      await expect(executeWebsiteInspectionFixture({ ...request(), targetUrl }, deps)).rejects.toThrow();
    }
    await expect(executeWebsiteInspectionFixture({ ...request(), networkRequested: true }, deps))
      .rejects.toThrow();
    expect(exchange).not.toHaveBeenCalled();
  });
});

// WEB-004: native integration expectations against actual WEB-001 Zod contracts.
// These are staged tests and have NOT run in the isolated Node 22 harness.
import { extractWebsiteCapabilitiesFromFixture } from './website-fixture-extractor';
import { createWebsiteInspectionPersistenceHandoff,
  type WebsiteInspectionPersistencePayload } from './website-inspection-db-bridge';

describe('M04-WEB-004 deterministic fixture intelligence and DB handoff', () => {
  it('produces an actual Zod-valid partial result, never site-wide negative evidence', async () => {
    const { deps } = fixture({ extract: extractWebsiteCapabilitiesFromFixture });
    const result = await executeWebsiteInspectionFixture(request(), deps);
    expect(WebsiteInspectionResultSchema.parse(result)).toEqual(result);
    expect(result.status).toBe('review_required');
    expect(result.coverage).toBe('partial');
    expect(result.observations).toHaveLength(8);
    expect(result.observations.every(value => value.observation !== 'not_detected')).toBe(true);
    expect(result.observations.some(value => value.observation === 'unknown')).toBe(true);
    expect(result.reasonCodes).toContain('website.single_page_only');
    expect(JSON.stringify(result)).not.toContain('<form');
  });

  it('produces Zod-valid contact/mobile/social evidence from deterministic HTML', async () => {
    const html = `<meta name="viewport" content="width=device-width, initial-scale=1">
      <form><input type="email"><textarea name="message"></textarea></form>
      <a href="https://instagram.com/team">Visit our profile</a>`;
    const { deps } = fixture({
      extract: extractWebsiteCapabilitiesFromFixture,
      fixtureBody: html,
      exchange: async () => ({
        status: 200, finalUrl: 'https://example.com/', contentType: 'text/html',
        body: new TextEncoder().encode(html), elapsedMs: 1,
      }),
    });
    const result = await executeWebsiteInspectionFixture(request(), deps);
    expect(WebsiteInspectionResultSchema.safeParse(result).success).toBe(true);
    for (const kind of ['contact_form', 'mobile_viewport', 'social_link', 'https']) {
      const observed = result.observations.find(item => item.capability === kind);
      expect(observed?.observation).toBe('observed_present');
      expect(observed?.transportReceiptIds).toEqual(['receipt.fixture.1']);
    }
    expect(JSON.stringify(result)).not.toContain('Visit our profile');
  });

  it('rejects unknown fields at the DB handoff boundary with public result schema', async () => {
    const { deps } = fixture({ extract: extractWebsiteCapabilitiesFromFixture, persist: undefined });
    const result = await executeWebsiteInspectionFixture(request(), deps);
    const stored = vi.fn(async (_payload: WebsiteInspectionPersistencePayload) => ({ inspectionId: request().inspectionId, replayed: false }));
    const handoff = createWebsiteInspectionPersistenceHandoff({
      parseResult: raw => WebsiteInspectionResultSchema.parse(raw),
      policyForWorkspace: async () => ({ workspaceId: WORKSPACE, retentionTtlSeconds: 3600, deletionRequired: true }),
      persist: stored,
    });
    await expect(handoff({ ...result, rawHtml: '<script>unsafe</script>' })).rejects.toThrow();
    expect(stored).not.toHaveBeenCalled();
    await expect(handoff(result)).resolves.toEqual({ inspectionId: request().inspectionId, replayed: false });
    expect(stored).toHaveBeenCalledOnce();
    const storedPayload = stored.mock.calls[0]?.[0];
    expect(storedPayload?.request).not.toHaveProperty('limits');
    expect(storedPayload).not.toHaveProperty('rawHtml');
  });
});

// WEB-005 native Zod staging: independent trusted fixture authorization +
// exact response integrity attestation. Not executed in isolated offline harness.
import { createWebsiteStoredFixtureAuthorizer } from './website-fixture-authorization';

describe('M04-WEB-005 trusted fixture binding and attestation', () => {
  it('runs with a separately loaded workspace/inspection-bound fixture decision', async () => {
    const { deps } = fixture();
    const record = { ...await deps.authorize(request()), inspectionId: request().inspectionId };
    const loaded = vi.fn(async (key: { readonly workspaceId: string; readonly inspectionId: string }) => {
      expect(key.workspaceId).toBe(WORKSPACE);
      expect(key.inspectionId).toBe(request().inspectionId);
      return record;
    });
    const actual = await executeWebsiteInspectionFixture(request(), {
      ...deps, authorize: createWebsiteStoredFixtureAuthorizer(loaded),
    });
    expect(loaded).toHaveBeenCalledOnce();
    expect(WebsiteInspectionResultSchema.safeParse(actual).success).toBe(true);
    expect(actual.transportReceiptIds).toEqual(['receipt.fixture.1']);
  });

  it('rejects a response with bytes differing from independently authorized digest', async () => {
    const { deps, persist } = fixture({
      exchange: async () => ({ status: 200, finalUrl: 'https://example.com/',
        contentType: 'text/html', body: new TextEncoder().encode('<html>tampered</html>'), elapsedMs: 1 }),
    });
    await expect(executeWebsiteInspectionFixture(request(), deps)).rejects.toMatchObject({
      code: 'M04_FIXTURE_ATTESTATION_MISMATCH',
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it('rejects foreign verified-domain identity before injected execution', async () => {
    const { deps, exchange, persist } = fixture();
    const record = { ...await deps.authorize(request()), inspectionId: request().inspectionId,
      verifiedDomain: 'other.example.com' };
    await expect(executeWebsiteInspectionFixture(request(), {
      ...deps, authorize: createWebsiteStoredFixtureAuthorizer(async () => record),
    })).rejects.toMatchObject({ code: 'M04_FIXTURE_RECORD_INVALID' });
    expect(exchange).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });
});


describe('M04-WEB-003 attested request/fixture snapshot invariants', () => {
  it('rejects authorizer reuse of a receipt for another inspection ID', async () => {
    const { deps, exchange, persist } = fixture({
      authorize: async (r: WebsiteInspectionRequest) => ({
        ...await fixture().deps.authorize(r), inspectionId: 'inspection.other',
      }),
    });
    await expect(executeWebsiteInspectionFixture(request(), deps))
      .rejects.toMatchObject({ code: 'M04_FIXTURE_ADMISSION_INVALID' });
    expect(exchange).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it('never analyzes later getter-swapped unapproved HTML after attestation', async () => {
    const { deps } = fixture();
    let bodyReads = 0;
    const stable = new TextEncoder().encode('<form method="post"></form>');
    const original = deps.exchange;
    deps.exchange = vi.fn(async () => {
      const response = await original();
      return {
        ...response,
        get body() {
          bodyReads++;
          return bodyReads === 1 ? Uint8Array.from(stable)
            : new TextEncoder().encode('<p>UNAPPROVED</p>');
        },
      };
    });
    const result = await executeWebsiteInspectionFixture(request(), deps);
    expect(result.status).toBe('review_required');
    expect(bodyReads).toBe(1);
  });
});

// WEB-003/004/005 composition checks: staged for native workspace Vitest.
import { createWebsiteFixturePipeline } from './website-inspection-pipeline';

describe('M04 test-only inspection pipeline with native Zod contracts', () => {
  it('integrates stored authorization, attested deterministic extraction and DB handoff', async () => {
    const html = '<meta name="viewport" content="width=device-width"><a href="https://www.instagram.com/acme">visit</a>';
    const base = fixture({ fixtureBody: html });
    const database = vi.fn(async (value: WebsiteInspectionPersistencePayload) => ({
      inspectionId: value.request.inspectionId, replayed: false,
    }));
    const run = createWebsiteFixturePipeline({
      contracts: base.deps.contracts,
      now: () => new Date(NOW),
      lookup: async key => ({
        ...await base.deps.authorize(request()), inspectionId: key.inspectionId,
      }),
      exchange: base.deps.exchange,
      storage: {
        policyForWorkspace: async workspaceId => ({
          workspaceId, retentionTtlSeconds: 86400, deletionRequired: true,
        }),
        persist: database,
      },
    });
    const actual = await run(request());
    expect(WebsiteInspectionResultSchema.safeParse(actual).success).toBe(true);
    expect(actual.status).toBe('review_required');
    expect(actual.coverage).toBe('partial');
    expect(actual.observations).toHaveLength(8);
    expect(actual.observations.find(x => x.capability === 'social_link')?.observation).toBe('observed_present');
    expect(database).toHaveBeenCalledOnce();
    expect(database.mock.calls[0]?.[0].request).not.toHaveProperty('limits');
  });

  it('rejects cross-workspace fixture even when untrusted request is schema-valid', async () => {
    const base = fixture();
    const database = vi.fn(async (value: WebsiteInspectionPersistencePayload) => ({
      inspectionId: value.request.inspectionId, replayed: false,
    }));
    const run = createWebsiteFixturePipeline({
      contracts: base.deps.contracts,
      now: () => new Date(NOW),
      lookup: async key => ({
        ...await base.deps.authorize(request()),
        inspectionId: key.inspectionId,
        workspaceId: '550e8400-e29b-41d4-a716-446655440001',
      }),
      exchange: base.deps.exchange,
      storage: {
        policyForWorkspace: async workspaceId => ({
          workspaceId, retentionTtlSeconds: 86400, deletionRequired: true,
        }),
        persist: database,
      },
    });
    await expect(run(request())).rejects.toThrow();
    expect(database).not.toHaveBeenCalled();
    expect(base.exchange).not.toHaveBeenCalled();
  });
});

// WEB-008 native regression candidates: actual WEB-001 Zod contracts.
describe('M04-WEB-008 single-root evidence ceiling', () => {
  it('downgrades injected bounded positive observations to partial review evidence', async () => {
    const {deps} = fixture();
    const result = await executeWebsiteInspectionFixture(request(), deps);
    expect(result.coverage).toBe('partial');
    expect(result.status).toBe('review_required');
    expect(result.reasonCodes).toContain('website.single_page_only');
    expect(WebsiteInspectionResultSchema.safeParse(result).success).toBe(true);
  });

  it('rejects bounded negative absence claims without persisting them', async () => {
    const {deps, persist} = fixture({extract: async () => ({
      coverage: 'bounded' as const, reasonCodes: [], findings: [{
        capability: 'commerce' as const, observation: 'not_detected' as const,
        reason: 'not_detected_with_bounded_coverage' as const,
        confidence: 0.9, evidenceReferenceIds: ['evidence.none.1'],
      }],
    })});
    await expect(executeWebsiteInspectionFixture(request(),deps)).rejects.toMatchObject({
      code:'M04_FIXTURE_NEGATIVE_UNSUPPORTED',
    });
    expect(persist).not.toHaveBeenCalled();
  });
});

// WEB-009 native regressions: own-data extraction snapshot before mapping.
describe('M04-WEB-009 untrusted extractor snapshots', () => {
  it('rejects getter-based observation TOCTOU without persisting', async () => {
    const evidence = {
      capability: 'contact_form' as const,
      reason: 'detected' as const,
      confidence: 0.95,
      evidenceReferenceIds: ['evidence.form.1'],
    };
    let getterCalls = 0;
    const malicious = Object.defineProperty(evidence, 'observation', {
      enumerable:true, get() { getterCalls++; return getterCalls === 1 ? 'observed_present' : 'not_detected'; },
    });
    const {deps,persist} = fixture({extract:async()=>({
      coverage:'bounded' as const, reasonCodes:[], findings:[malicious],
    })});
    await expect(executeWebsiteInspectionFixture(request(),deps)).rejects.toMatchObject({
      code:'M04_EXTRACTION_INVALID',
    });
    expect(getterCalls).toBe(0);
    expect(persist).not.toHaveBeenCalled();
  });
});

// WEB-010/011 native test candidates; must run against actual Brovexa dependencies.
describe('M04-WEB-010 trusted admission snapshot', () => {
  it('refuses accessor-provided receipt without contacting exchange or DB', async () => {
    const baseline = fixture();
    const candidate = await baseline.authorize(request());
    let accesses = 0;
    Object.defineProperty(candidate, 'receiptId', {
      enumerable: true, get() { accesses++; return accesses === 1 ? 'receipt.fixture.1' : 'receipt.forged'; },
    });
    const { deps, exchange, persist } = fixture({ authorize: async () => candidate });
    await expect(executeWebsiteInspectionFixture(request(), deps)).rejects.toMatchObject({
      code: 'M04_FIXTURE_ADMISSION_INVALID',
    });
    expect(accesses).toBe(0);
    expect(exchange).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it('pins authorization before the asynchronous fixture exchange can mutate it', async () => {
    const baseline = fixture();
    const record = await baseline.authorize(request());
    const { deps } = fixture({
      authorize: async () => record,
      exchange: async () => {
        record.receiptId = 'receipt.forged';
        record.fixtureBodySha256 = '0'.repeat(64);
        const body = new TextEncoder().encode('<form method="post"></form>');
        return { status: 200, finalUrl: 'https://example.com/', contentType: 'text/html',
          body, elapsedMs: 1 };
      },
    });
    const result = await executeWebsiteInspectionFixture(request(), deps);
    expect(result.transportReceiptIds).toEqual(['receipt.fixture.1']);
  });
});

describe('M04-WEB-011 reason budget contract', () => {
  it('fails before persistence when a mandatory single-page warning would exceed 16 reasons', async () => {
    const codes = Array.from({ length: 16 }, (_, i) => `reason.${i}`);
    const { deps, persist } = fixture({ extract: async () => ({
      coverage: 'partial' as const, findings: [], reasonCodes: codes,
    }) });
    await expect(executeWebsiteInspectionFixture(request(), deps)).rejects.toMatchObject({
      code: 'M04_EXTRACTION_REASON_INVALID',
    });
    expect(persist).not.toHaveBeenCalled();
  });
});

// WEB-012/013/014: native Vitest candidates. No live provider or socket activity.
describe('M04-WEB-012/013/014 conservative fixture tokenizer', () => {
  function observationFor(html: string, capability: string) {
    const raw = new TextEncoder().encode(html);
    const r = request();
    r.limits.maxResponseBytes = 1_000_000;
    return extractWebsiteCapabilitiesFromFixture({
      body: raw, request: r, receiptId: 'receipt.fixture.1',
    }).then(result => result.findings.find(item => item.capability === capability)?.observation);
  }

  it('does not promote raw-text title/xmp/listing/noembed/noframes strings into social evidence', async () => {
    for (const tag of ['title', 'xmp', 'listing', 'noembed', 'noframes']) {
      await expect(observationFor(
        `<${tag}><a href="https://instagram.com/forged">fake</a></${tag}>`, 'social_link',
      )).resolves.toBe('unknown');
    }
  });

  it('refuses forged social links after plaintext or inside CDATA-like markup', async () => {
    const forged = '<a href="https://instagram.com/forged">fake</a>';
    await expect(observationFor(`<plaintext></plaintext>${forged}`, 'social_link'))
      .resolves.toBe('unknown');
    await expect(observationFor(`<![CDATA[${forged}]]>`, 'social_link'))
      .resolves.toBe('unknown');
  });

  it('caps tag floods independently of the 1MB byte budget', async () => {
    const html = '<span></span>'.repeat(20_001);
    const body = new TextEncoder().encode(html);
    const r = request();
    r.limits.maxResponseBytes = 1_000_000;
    await expect(extractWebsiteCapabilitiesFromFixture({
      request: r, body, receiptId: 'receipt.fixture.1',
    })).rejects.toMatchObject({ code: 'M04_FIXTURE_TAG_BUDGET' });
  });

  it('continues recognizing visible evidence after genuine raw-text element close', async () => {
    await expect(observationFor(
      '<title><a href="https://instagram.com/forged"></title>' +
      '<a href="https://instagram.com/real">real</a>', 'social_link',
    )).resolves.toBe('observed_present');
  });
});


// WEB-016 native regression candidates: deliberately not run until M04 gate.
describe('M04-WEB-016 transport response own-data and byte-copy safety', () => {
  it('rejects response metadata accessors without executing getter code', async () => {
    let reads = 0;
    const { deps, persist } = fixture({ exchange: async () => ({
      get status() { reads++; throw new Error('GETTER_EXECUTION'); },
      finalUrl: 'https://example.com/', contentType: 'text/html', elapsedMs: 1,
      body: new TextEncoder().encode('<form method="post"></form>'),
    }) });
    await expect(executeWebsiteInspectionFixture(request(), deps))
      .rejects.toMatchObject({ code: 'M04_FIXTURE_RESPONSE_INVALID' });
    expect(reads).toBe(0);
    expect(persist).not.toHaveBeenCalled();
  });

  it('copies attested bytes without invoking a Uint8Array iterator override', async () => {
    const body = new TextEncoder().encode('<form method="post"></form>');
    let calls = 0;
    Object.defineProperty(body, Symbol.iterator, { value() {
      calls++; throw new Error('SHOULD_NOT_RUN');
    } });
    const { deps, persist } = fixture({ exchange: async () => ({
      status: 200, finalUrl: 'https://example.com/', contentType: 'text/html',
      elapsedMs: 1, body,
    }) });
    const result = await executeWebsiteInspectionFixture(request(), deps);
    expect(result.coverage).toBe('partial');
    expect(calls).toBe(0);
    expect(persist).toHaveBeenCalledOnce();
  });
});


// WEB-017 native regression candidates; intentionally deferred until M04 QA.
describe('M04-WEB-017 storage adapter evidence isolation', () => {
  it('never returns evidence mutated by the persistence adapter', async () => {
    const { deps } = fixture({
      persist: async (stored: Awaited<ReturnType<typeof executeWebsiteInspectionFixture>>) => {
        stored.status = 'assessed';
        stored.coverage = 'bounded';
        stored.reasonCodes.length = 0;
        stored.transportReceiptIds.length = 0;
        stored.observations[0]!.evidenceReferenceIds[0] = 'attacker.forged';
      },
    });
    const result = await executeWebsiteInspectionFixture(request(), deps);
    expect(result.status).toBe('review_required');
    expect(result.coverage).toBe('partial');
    expect(result.reasonCodes).toContain('website.single_page_only');
    expect(result.transportReceiptIds).toEqual(['receipt.fixture.1']);
    expect(result.observations[0]?.evidenceReferenceIds).toEqual(['evidence.form.1']);
  });
});