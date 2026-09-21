import { describe, expect, it } from 'vitest';
import {
  ApprovedBusinessContactEvidenceSchema,
  BusinessDomainVerificationEvaluationSchema,
  ContactDataEligibilityDecisionSchema,
} from './entity-enrichment';

const domainEvidence = {
  version: '1.0.0' as const,
  evidenceId: 'domain-evidence.1',
  workspaceId: 'workspace.1',
  canonicalBusinessId: 'business.1',
  normalizedDomain: 'example.com',
  kind: 'official_website' as const,
  effect: 'supports_domain' as const,
  sourceKey: 'source.public_web',
  sourceReferenceIds: ['ref.domain.1'],
  sourcePolicySnapshot: {
    policyId: 'policy.public-web',
    policyVersion: '1.0.0',
  },
  sourceAdmissionDecisionRef: 'admission.domain.1',
  observedAt: '2026-09-22T00:00:00.000Z',
  recordedAt: '2026-09-22T00:01:00.000Z',
};

const verifiedDomainDecision = {
  verificationId: 'domain-verification.1',
  workspaceId: 'workspace.1',
  canonicalBusinessId: 'business.1',
  normalizedDomain: 'example.com',
  decision: 'verified' as const,
  method: 'deterministic' as const,
  confidence: 0.99,
  evidenceIds: ['domain-evidence.1'],
  reasonCodes: ['domain_official_website_support'],
  reviewDecisionRef: null,
  evaluatedAt: '2026-09-22T00:02:00.000Z',
};

const allowedEligibility = {
  version: '1.0.0' as const,
  eligibilityId: 'contact-eligibility.1',
  workspaceId: 'workspace.1',
  canonicalBusinessId: 'business.1',
  channel: 'email' as const,
  sourceKey: 'source.public_web',
  connectorKey: 'connector.public_web',
  connectorVersion: '1.0.0',
  sourceRequestId: 'request.contact.1',
  sourceAdmissionDecisionRef: 'admission.contact.1',
  sourceReferenceIds: ['ref.contact.1'],
  sourcePolicySnapshot: {
    policyId: 'policy.public-web',
    policyVersion: '1.0.0',
  },
  compliancePolicySnapshot: {
    policyId: 'compliance.contact-data.default',
    policyVersion: '1.0.0',
  },
  purpose: 'business_contact_discovery',
  territory: {
    mode: 'country_allowlist' as const,
    countryCodes: ['US'],
  },
  fieldName: 'contact_email',
  dataClassification: 'PERSONAL_BUSINESS_CONTACT' as const,
  storageClass: 'EVIDENCE_MINIMAL' as const,
  decision: 'allow' as const,
  exportAllowed: false,
  reasonCodes: ['source_and_contact_data_policy_allow'],
  evaluatedAt: '2026-09-22T00:03:00.000Z',
};

describe('BusinessDomainVerificationEvaluationSchema', () => {
  it('accepts deterministic verification backed by independent provider-neutral evidence', () => {
    const parsed = BusinessDomainVerificationEvaluationSchema.parse({
      version: '1.0.0',
      workspaceId: 'workspace.1',
      canonicalBusinessId: 'business.1',
      normalizedDomain: 'example.com',
      evidence: [domainEvidence],
      decision: verifiedDomainDecision,
    });

    expect(parsed.decision.decision).toBe('verified');
    expect(parsed.evidence[0]?.kind).toBe('official_website');
  });

  it('does not let a bare source claim become deterministically verified canonical domain truth', () => {
    expect(() =>
      BusinessDomainVerificationEvaluationSchema.parse({
        version: '1.0.0',
        workspaceId: 'workspace.1',
        canonicalBusinessId: 'business.1',
        normalizedDomain: 'example.com',
        evidence: [{ ...domainEvidence, kind: 'source_claim' }],
        decision: verifiedDomainDecision,
      }),
    ).toThrow(/independently verifiable evidence/);
  });

  it('rejects cross-workspace domain evidence and missing decision evidence references', () => {
    expect(() =>
      BusinessDomainVerificationEvaluationSchema.parse({
        version: '1.0.0',
        workspaceId: 'workspace.1',
        canonicalBusinessId: 'business.1',
        normalizedDomain: 'example.com',
        evidence: [{ ...domainEvidence, workspaceId: 'workspace.attacker' }],
        decision: { ...verifiedDomainDecision, evidenceIds: ['domain-evidence.missing'] },
      }),
    ).toThrow(/workspace must match|must exist/);
  });

  it('requires explicit human review when contradictory evidence is used for a verified domain', () => {
    expect(() =>
      BusinessDomainVerificationEvaluationSchema.parse({
        version: '1.0.0',
        workspaceId: 'workspace.1',
        canonicalBusinessId: 'business.1',
        normalizedDomain: 'example.com',
        evidence: [
          domainEvidence,
          {
            ...domainEvidence,
            evidenceId: 'domain-evidence.2',
            kind: 'registry_record',
            effect: 'contradicts_domain',
            sourceReferenceIds: ['ref.domain.2'],
          },
        ],
        decision: {
          ...verifiedDomainDecision,
          evidenceIds: ['domain-evidence.1', 'domain-evidence.2'],
        },
      }),
    ).toThrow(/requires explicit human review/);
  });

  it('accepts a durable human-review resolution when contradictory evidence is explicitly reviewed', () => {
    const parsed = BusinessDomainVerificationEvaluationSchema.parse({
      version: '1.0.0',
      workspaceId: 'workspace.1',
      canonicalBusinessId: 'business.1',
      normalizedDomain: 'example.com',
      evidence: [
        domainEvidence,
        {
          ...domainEvidence,
          evidenceId: 'domain-evidence.2',
          kind: 'registry_record',
          effect: 'contradicts_domain',
          sourceReferenceIds: ['ref.domain.2'],
        },
      ],
      decision: {
        ...verifiedDomainDecision,
        method: 'human_review',
        reviewDecisionRef: 'review.domain.1',
        evidenceIds: ['domain-evidence.1', 'domain-evidence.2'],
      },
    });

    expect(parsed.decision.reviewDecisionRef).toBe('review.domain.1');
  });
});

describe('ContactDataEligibilityDecisionSchema', () => {
  it('fails closed on export while contact data is blocked or still awaiting review', () => {
    expect(() =>
      ContactDataEligibilityDecisionSchema.parse({
        ...allowedEligibility,
        decision: 'review_required',
        exportAllowed: true,
        reasonCodes: ['contact_data_policy_review_required'],
      }),
    ).toThrow(/cannot be export-authorized/);
  });

  it('requires explicit bounded territory semantics without duplicate country codes', () => {
    expect(() =>
      ContactDataEligibilityDecisionSchema.parse({
        ...allowedEligibility,
        territory: {
          mode: 'country_allowlist',
          countryCodes: ['US', 'US'],
        },
      }),
    ).toThrow(/countryCodes must be unique/);
  });
});

describe('ApprovedBusinessContactEvidenceSchema', () => {
  it('persists approved provenance-bound contact evidence without granting outreach permission', () => {
    const parsed = ApprovedBusinessContactEvidenceSchema.parse({
      version: '1.0.0',
      contactEvidenceId: 'contact-evidence.1',
      workspaceId: 'workspace.1',
      canonicalBusinessId: 'business.1',
      channel: 'email',
      normalizedValue: 'sales@example.com',
      sourceKey: 'source.public_web',
      sourceReferenceIds: ['ref.contact.1'],
      observedAt: '2026-09-22T00:03:30.000Z',
      recordedAt: '2026-09-22T00:04:00.000Z',
      dataEligibility: allowedEligibility,
      outreachAuthorization: 'not_evaluated',
    });

    expect(parsed.outreachAuthorization).toBe('not_evaluated');
    expect(parsed.dataEligibility.decision).toBe('allow');
  });

  it('rejects contact evidence when ContactDataEligibility is blocked or review-required', () => {
    expect(() =>
      ApprovedBusinessContactEvidenceSchema.parse({
        version: '1.0.0',
        contactEvidenceId: 'contact-evidence.blocked',
        workspaceId: 'workspace.1',
        canonicalBusinessId: 'business.1',
        channel: 'email',
        normalizedValue: 'sales@example.com',
        sourceKey: 'source.public_web',
        sourceReferenceIds: ['ref.contact.1'],
        observedAt: '2026-09-22T00:03:30.000Z',
        recordedAt: '2026-09-22T00:04:00.000Z',
        dataEligibility: {
          ...allowedEligibility,
          decision: 'review_required',
          exportAllowed: false,
          reasonCodes: ['contact_data_policy_review_required'],
        },
        outreachAuthorization: 'not_evaluated',
      }),
    ).toThrow(/requires an allowed ContactDataEligibility decision/);
  });

  it('rejects provenance laundering through source references outside the approved eligibility decision', () => {
    expect(() =>
      ApprovedBusinessContactEvidenceSchema.parse({
        version: '1.0.0',
        contactEvidenceId: 'contact-evidence.provenance',
        workspaceId: 'workspace.1',
        canonicalBusinessId: 'business.1',
        channel: 'email',
        normalizedValue: 'sales@example.com',
        sourceKey: 'source.public_web',
        sourceReferenceIds: ['ref.unapproved'],
        observedAt: '2026-09-22T00:03:30.000Z',
        recordedAt: '2026-09-22T00:04:00.000Z',
        dataEligibility: allowedEligibility,
        outreachAuthorization: 'not_evaluated',
      }),
    ).toThrow(/subset of the references approved/);
  });

  it('rejects attempts to smuggle outreach permission into contact-enrichment evidence', () => {
    expect(() =>
      ApprovedBusinessContactEvidenceSchema.parse({
        version: '1.0.0',
        contactEvidenceId: 'contact-evidence.outreach-bypass',
        workspaceId: 'workspace.1',
        canonicalBusinessId: 'business.1',
        channel: 'email',
        normalizedValue: 'sales@example.com',
        sourceKey: 'source.public_web',
        sourceReferenceIds: ['ref.contact.1'],
        observedAt: '2026-09-22T00:03:30.000Z',
        recordedAt: '2026-09-22T00:04:00.000Z',
        dataEligibility: allowedEligibility,
        outreachAuthorization: 'allow',
      }),
    ).toThrow();
  });

  it('enforces normalized email and E.164 phone forms', () => {
    expect(() =>
      ApprovedBusinessContactEvidenceSchema.parse({
        version: '1.0.0',
        contactEvidenceId: 'contact-evidence.bad-email',
        workspaceId: 'workspace.1',
        canonicalBusinessId: 'business.1',
        channel: 'email',
        normalizedValue: 'Sales@Example.com',
        sourceKey: 'source.public_web',
        sourceReferenceIds: ['ref.contact.1'],
        observedAt: '2026-09-22T00:03:30.000Z',
        recordedAt: '2026-09-22T00:04:00.000Z',
        dataEligibility: allowedEligibility,
        outreachAuthorization: 'not_evaluated',
      }),
    ).toThrow(/normalized lowercase email/);

    expect(() =>
      ApprovedBusinessContactEvidenceSchema.parse({
        version: '1.0.0',
        contactEvidenceId: 'contact-evidence.bad-phone',
        workspaceId: 'workspace.1',
        canonicalBusinessId: 'business.1',
        channel: 'phone',
        normalizedValue: '555-0100',
        sourceKey: 'source.public_web',
        sourceReferenceIds: ['ref.contact.1'],
        observedAt: '2026-09-22T00:03:30.000Z',
        recordedAt: '2026-09-22T00:04:00.000Z',
        dataEligibility: { ...allowedEligibility, channel: 'phone', fieldName: 'contact_phone' },
        outreachAuthorization: 'not_evaluated',
      }),
    ).toThrow(/E.164/);
  });
});
