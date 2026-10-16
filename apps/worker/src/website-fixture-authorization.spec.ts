import { describe, expect, it } from 'vitest';
import { createWebsiteStoredFixtureAuthorizer } from './website-fixture-authorization';
import type { WebsiteInspectionRequest } from '@brovexa/contracts';

const REQUEST: WebsiteInspectionRequest = {
  version: '1.0.0', inspectionId: 'inspection.fixture.1',
  workspaceId: '550e8400-e29b-41d4-a716-446655440000',
  canonicalBusinessId: 'business.fixture.1', verifiedDomain: 'example.com',
  domainVerification: { verificationId: 'verify.fixture.1', decision: 'verified',
    evidenceIds: ['domain.evidence.1'] },
  targetUrl: 'https://example.com/', sourceKey: 'source.test',
  sourceAdmissionDecisionRef: 'admission.fixture.1', sourceAdmissionDecision: 'allow',
  sourcePolicySnapshot: { policyId: 'source.policy', policyVersion: '1.0.0' },
  transportPolicyId: 'transport.policy', transportPolicyVersion: '1.0.0',
  limits: { maxPages: 1, maxResponseBytes: 1024, timeoutMs: 1000 },
  executionMode: 'test_only', networkRequested: false, credentialedFetchRequested: false,
  rawPayloadRequested: false, outreachRequested: false,
  requestedAt: '2026-10-15T23:00:00.000Z',
};

function record() {
  return {
    decision: 'allow' as const, transportKind: 'test' as const,
    workspaceId: REQUEST.workspaceId, inspectionId: REQUEST.inspectionId,
    canonicalBusinessId: REQUEST.canonicalBusinessId,
    verifiedDomain: REQUEST.verifiedDomain,
    verificationId: REQUEST.domainVerification.verificationId,
    domainEvidenceIds: [...REQUEST.domainVerification.evidenceIds],
    sourceKey: REQUEST.sourceKey,
    sourceAdmissionDecisionRef: REQUEST.sourceAdmissionDecisionRef,
    sourcePolicyId: REQUEST.sourcePolicySnapshot.policyId,
    sourcePolicyVersion: REQUEST.sourcePolicySnapshot.policyVersion,
    transportPolicyId: REQUEST.transportPolicyId,
    transportPolicyVersion: REQUEST.transportPolicyVersion,
    canonicalUrl: REQUEST.targetUrl, receiptId: 'receipt.fixture.1',
    fixtureBodySha256: 'a'.repeat(64), fixtureStatus: 200,
    fixtureContentType: 'text/html' as const, fixtureByteLength: 0,
    maxResponseBytes: 1024, timeoutMs: 1000, expiresAt: '2026-10-17T00:00:00.000Z',
  };
}

describe('M04-WEB-015 stored fixture admission own-property snapshot (candidate)', () => {
  it('refuses getter-backed receipt without invocation', async () => {
    const value = record();
    let getterCalls = 0;
    Object.defineProperty(value, 'receiptId', {
      get() { getterCalls++; return 'receipt.fixture.1'; },
    });
    const authorize = createWebsiteStoredFixtureAuthorizer(async () => value);
    await expect(authorize(REQUEST)).rejects.toMatchObject({ code: 'M04_FIXTURE_RECORD_INVALID' });
    expect(getterCalls).toBe(0);
  });

  it('refuses array-element accessor before receipt is authorized', async () => {
    const value = record();
    let getterCalls = 0;
    Object.defineProperty(value.domainEvidenceIds, '0', {
      get() { getterCalls++; return 'domain.evidence.1'; },
    });
    const authorize = createWebsiteStoredFixtureAuthorizer(async () => value);
    await expect(authorize(REQUEST)).rejects.toMatchObject({ code: 'M04_FIXTURE_RECORD_INVALID' });
    expect(getterCalls).toBe(0);
  });

  it('returns a detached allow-list that is not affected by reuse of DB lookup rows', async () => {
    const value = record();
    const authorize = createWebsiteStoredFixtureAuthorizer(async () => value);
    const snapshot = await authorize(REQUEST);
    value.receiptId = 'receipt.forged';
    value.domainEvidenceIds[0] = 'domain.forged';
    expect(snapshot.receiptId).toBe('receipt.fixture.1');
    expect(snapshot.domainEvidenceIds).toEqual(['domain.evidence.1']);
  });
});