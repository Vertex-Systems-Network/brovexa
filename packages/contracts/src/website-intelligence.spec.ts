import { describe, expect, it } from 'vitest';
import {
  WebsiteInspectionRequestSchema,
  WebsiteInspectionResultSchema,
  type WebsiteInspectionRequest,
  type WebsiteInspectionResult,
} from './website-intelligence';

function request(): WebsiteInspectionRequest {
  return {
    version: '1.0.0',
    inspectionId: 'inspect.001',
    workspaceId: 'workspace.001',
    canonicalBusinessId: 'business.001',
    verifiedDomain: 'example.com',
    domainVerification: {
      verificationId: 'verification.001',
      decision: 'verified',
      evidenceIds: ['domain.evidence.001'],
    },
    targetUrl: 'https://example.com/',
    sourceKey: 'source.approved_web',
    sourceAdmissionDecisionRef: 'admission.001',
    sourceAdmissionDecision: 'allow',
    sourcePolicySnapshot: { policyId: 'source.policy.001', policyVersion: '1.0.0' },
    transportPolicyId: 'transport.policy.001',
    transportPolicyVersion: '1.0.0',
    limits: { maxPages: 1, maxResponseBytes: 100_000, timeoutMs: 5_000 },
    executionMode: 'test_only',
    networkRequested: false,
    credentialedFetchRequested: false,
    rawPayloadRequested: false,
    outreachRequested: false,
    requestedAt: '2026-10-15T00:00:00.000Z',
  };
}

function result(): WebsiteInspectionResult {
  return {
    version: '1.0.0',
    request: request(),
    status: 'assessed',
    coverage: 'bounded',
    transportReceiptIds: ['receipt.001'],
    observations: [{
      capability: 'contact_form',
      observation: 'observed_present',
      reason: 'detected',
      confidence: 0.9,
      evidenceReferenceIds: ['evidence.001'],
      transportReceiptIds: ['receipt.001'],
    }],
    reasonCodes: [],
    completedAt: '2026-10-15T00:01:00.000Z',
    bodyIncluded: false,
  };
}

describe('M04 website inspection request contract', () => {
  it('accepts a bounded test-only request with verified canonical domain and policy references', () => {
    expect(WebsiteInspectionRequestSchema.parse(request())).toEqual(request());
  });

  it('rejects wrong domain, suffix confusion, IP literals and internal hostnames', () => {
    for (const targetUrl of [
      'https://example.com.attacker.test/', 'https://127.0.0.1/',
      'https://[::1]/', 'https://user:pass@example.com/',
      'http://example.com/', 'https://example.com:8443/',
      'https://example.com/?token=secret', 'https://example.com/#top',
      'https://example.com/admin',
    ]) {
      expect(WebsiteInspectionRequestSchema.safeParse({ ...request(), targetUrl }).success).toBe(false);
    }
    expect(WebsiteInspectionRequestSchema.safeParse({
      ...request(), verifiedDomain: '127.0.0.1', targetUrl: 'https://127.0.0.1/',
    }).success).toBe(false);
    expect(WebsiteInspectionRequestSchema.safeParse({
      ...request(), verifiedDomain: 'admin.internal', targetUrl: 'https://admin.internal/',
    }).success).toBe(false);
  });

  it('rejects unverified domains, missing provenance and any live/credential/outreach intent', () => {
    const base = request();
    expect(WebsiteInspectionRequestSchema.safeParse({
      ...base, domainVerification: { ...base.domainVerification, decision: 'review_required' },
    }).success).toBe(false);
    expect(WebsiteInspectionRequestSchema.safeParse({
      ...base, domainVerification: { ...base.domainVerification, evidenceIds: [] },
    }).success).toBe(false);
    for (const key of [
      'networkRequested', 'credentialedFetchRequested', 'rawPayloadRequested', 'outreachRequested',
    ] as const) {
      expect(WebsiteInspectionRequestSchema.safeParse({ ...base, [key]: true }).success).toBe(false);
    }
    expect(WebsiteInspectionRequestSchema.safeParse({
      ...base, executionMode: 'production',
    }).success).toBe(false);
    expect(WebsiteInspectionRequestSchema.safeParse({
      ...base, sourceAdmissionDecision: 'block',
    }).success).toBe(false);
  });

  it('rejects duplicate verification references, invalid budget and unknown fields', () => {
    const base = request();
    expect(WebsiteInspectionRequestSchema.safeParse({
      ...base, domainVerification: { ...base.domainVerification, evidenceIds: ['same', 'same'] },
    }).success).toBe(false);
    expect(WebsiteInspectionRequestSchema.safeParse({
      ...base, limits: { ...base.limits, maxPages: 100 },
    }).success).toBe(false);
    expect(WebsiteInspectionRequestSchema.safeParse({
      ...base, targetUrl: 'https://example.com/', injectedCredentials: 'secret',
    }).success).toBe(false);
  });
});

describe('M04 website capability evidence contracts', () => {
  it('accepts a fully evidenced result without storing raw HTML', () => {
    expect(WebsiteInspectionResultSchema.parse(result())).toEqual(result());
  });

  it('retains uncertainty instead of silently converting unknown into negative evidence', () => {
    const base = result();
    const unknown = {
      capability: 'commerce' as const,
      observation: 'unknown' as const,
      reason: 'insufficient_evidence' as const,
      confidence: null,
      evidenceReferenceIds: [],
      transportReceiptIds: [],
    };
    expect(WebsiteInspectionResultSchema.safeParse({
      ...base, status: 'review_required', coverage: 'partial',
      observations: [unknown],
    }).success).toBe(true);
    expect(WebsiteInspectionResultSchema.safeParse({
      ...base, observations: [{ ...unknown, observation: 'not_detected' }],
    }).success).toBe(false);
  });

  it('does not treat not-detected as a proven absence or allow it with partial coverage', () => {
    const base = result();
    const notDetected = {
      ...base.observations[0]!,
      observation: 'not_detected' as const,
      reason: 'not_detected_with_bounded_coverage' as const,
    };
    expect(WebsiteInspectionResultSchema.safeParse({
      ...base, observations: [notDetected],
    }).success).toBe(true);
    expect(WebsiteInspectionResultSchema.safeParse({
      ...base, coverage: 'partial', status: 'review_required', observations: [notDetected],
    }).success).toBe(false);
    expect(WebsiteInspectionResultSchema.safeParse({
      ...base, observations: [{ ...notDetected, evidenceReferenceIds: [] }],
    }).success).toBe(false);
  });

  it('rejects forged or duplicate receipt IDs, duplicated capabilities and contradictory statuses', () => {
    const base = result();
    const observation = base.observations[0]!;
    expect(WebsiteInspectionResultSchema.safeParse({
      ...base, observations: [{ ...observation, transportReceiptIds: ['receipt.unapproved'] }],
    }).success).toBe(false);
    expect(WebsiteInspectionResultSchema.safeParse({
      ...base, transportReceiptIds: ['receipt.001', 'receipt.001'],
    }).success).toBe(false);
    expect(WebsiteInspectionResultSchema.safeParse({
      ...base, observations: [observation, observation],
    }).success).toBe(false);
    expect(WebsiteInspectionResultSchema.safeParse({
      ...base, status: 'assessed', coverage: 'none',
    }).success).toBe(false);
    expect(WebsiteInspectionResultSchema.safeParse({
      ...base, status: 'unavailable', coverage: 'bounded', reasonCodes: ['failed'],
    }).success).toBe(false);
  });

  it('allows documented unavailable status only with zero inspection coverage', () => {
    const base = result();
    const unavailable = { ...base, status: 'unavailable' as const,
      coverage: 'none' as const, transportReceiptIds: [], observations: [],
      reasonCodes: ['transport.blocked'] };
    expect(WebsiteInspectionResultSchema.safeParse(unavailable).success).toBe(true);
    expect(WebsiteInspectionResultSchema.safeParse({
      ...unavailable, reasonCodes: [],
    }).success).toBe(false);
  });

  it('requires chronological evidence, strict result shape and bounded observation count', () => {
    const base = result();
    expect(WebsiteInspectionResultSchema.safeParse({
      ...base, completedAt: '2026-10-14T23:59:00.000Z',
    }).success).toBe(false);
    expect(WebsiteInspectionResultSchema.safeParse({
      ...base, bodyIncluded: true,
    }).success).toBe(false);
    expect(WebsiteInspectionResultSchema.safeParse({
      ...base, observations: [...base.observations, ...base.observations,
        ...base.observations, ...base.observations, ...base.observations,
        ...base.observations, ...base.observations, ...base.observations,
        ...base.observations],
    }).success).toBe(false);
  });
});
