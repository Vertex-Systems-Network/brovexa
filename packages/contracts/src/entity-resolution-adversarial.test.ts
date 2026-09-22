import { describe, expect, it } from 'vitest';
import { BusinessDomainVerificationEvaluationSchema } from './entity-enrichment';

const evidence = {
  version: '1.0.0' as const,
  evidenceId: 'domain-evidence.adversarial.1',
  workspaceId: 'workspace.1',
  canonicalBusinessId: 'business.1',
  normalizedDomain: 'example.com',
  kind: 'official_website' as const,
  effect: 'supports_domain' as const,
  sourceKey: 'source.public_web',
  sourceReferenceIds: ['ref.domain.1'],
  sourcePolicySnapshot: { policyId: 'policy.public-web', policyVersion: '1.0.0' },
  sourceAdmissionDecisionRef: 'admission.domain.1',
  sourceAdmissionDecision: 'allow' as const,
  storageClass: 'EVIDENCE_MINIMAL' as const,
  retention: {
    retentionTtlSeconds: null,
    deletionRequired: false,
    refreshAfterSeconds: 3600,
  },
  observedAt: '2026-09-22T00:00:00.000Z',
  recordedAt: '2026-09-22T00:01:00.000Z',
};

function evaluation(evaluatedAt: string) {
  return {
    version: '1.0.0' as const,
    workspaceId: 'workspace.1',
    canonicalBusinessId: 'business.1',
    normalizedDomain: 'example.com',
    evidence: [evidence],
    decision: {
      verificationId: 'domain-verification.adversarial.1',
      workspaceId: 'workspace.1',
      canonicalBusinessId: 'business.1',
      normalizedDomain: 'example.com',
      decision: 'verified' as const,
      method: 'deterministic' as const,
      confidence: 0.99,
      evidenceIds: ['domain-evidence.adversarial.1'],
      reasonCodes: ['domain_independent_support'],
      reviewDecisionRef: null,
      evaluatedAt,
    },
  };
}

describe('M03-ER-006 domain evidence freshness boundary', () => {
  it('accepts independently supported domain evidence while it remains inside its refresh window', () => {
    const parsed = BusinessDomainVerificationEvaluationSchema.parse(
      evaluation('2026-09-22T00:30:00.000Z'),
    );
    expect(parsed.decision.decision).toBe('verified');
  });

  it('fails closed when deterministic verification tries to reuse stale domain evidence', () => {
    expect(() =>
      BusinessDomainVerificationEvaluationSchema.parse(
        evaluation('2026-09-22T02:00:00.000Z'),
      ),
    ).toThrow(/stale|refresh|review/i);
  });
});
