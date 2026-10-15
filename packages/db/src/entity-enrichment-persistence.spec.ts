import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  EntityEnrichmentPersistenceError,
  persistApprovedBusinessContactEvidence,
  persistBusinessDomainEvidence,
  persistBusinessDomainVerificationDecision,
  persistContactDataEligibilityDecision,
  purgeApprovedBusinessContactEvidence,
} from './entity-enrichment-persistence';

const workspaceId = '550e8400-e29b-41d4-a716-446655440000';
const observedAt = new Date('2026-09-22T00:00:00.000Z');
const recordedAt = new Date('2026-09-22T00:01:00.000Z');
const evaluatedAt = new Date('2026-09-22T00:02:00.000Z');

function poolWith(query: ReturnType<typeof vi.fn>): Pool {
  return { query } as unknown as Pool;
}

const domainInput = {
  evidenceId: 'domain-evidence.1',
  workspaceId,
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
  retention: { retentionTtlSeconds: 2592000, deletionRequired: true, refreshAfterSeconds: 604800 },
  observedAt,
  recordedAt,
};

const eligibilityInput = {
  eligibilityId: 'eligibility.1',
  workspaceId,
  canonicalBusinessId: 'business.1',
  channel: 'email' as const,
  sourceKey: 'source.public_web',
  connectorKey: 'connector.public_web',
  connectorVersion: '1.0.0',
  sourceRequestId: 'request.contact.1',
  sourceAdmissionDecisionRef: 'admission.contact.1',
  sourceAdmissionDecision: 'allow' as const,
  sourceReferenceIds: ['ref.contact.1'],
  sourcePolicySnapshot: { policyId: 'policy.public-web', policyVersion: '1.0.0' },
  compliancePolicySnapshot: { policyId: 'compliance.contact', policyVersion: '1.0.0' },
  purpose: 'business_contact_discovery',
  territory: { mode: 'country_allowlist' as const, countryCodes: ['US'] },
  fieldName: 'contact_email',
  dataClassification: 'PERSONAL_BUSINESS_CONTACT' as const,
  storageClass: 'EVIDENCE_MINIMAL' as const,
  retention: { retentionTtlSeconds: 2592000, deletionRequired: true, refreshAfterSeconds: 604800 },
  decision: 'allow' as const,
  displayAllowed: true,
  exportAllowed: false,
  reasonCodes: ['contact_policy_allow'],
  evaluatedAt,
};

describe('entity enrichment persistence validation', () => {
  it('rejects duplicate domain provenance before touching the database', async () => {
    const query = vi.fn();
    await expect(
      persistBusinessDomainEvidence(poolWith(query), {
        ...domainInput,
        sourceReferenceIds: ['ref.domain.1', 'ref.domain.1'],
      }),
    ).rejects.toMatchObject({ code: 'ENTITY_ENRICHMENT_INPUT_INVALID' });
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects deterministic verification backed only by a source claim', async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{
        id: 'domain-evidence.1',
        kind: 'source_claim',
        effect: 'supports_domain',
        observed_at: observedAt,
        refresh_after_seconds: '604800',
      }],
    });
    await expect(
      persistBusinessDomainVerificationDecision(poolWith(query), {
        verificationId: 'verification.1',
        workspaceId,
        canonicalBusinessId: 'business.1',
        normalizedDomain: 'example.com',
        decision: 'verified',
        method: 'deterministic',
        confidence: 0.99,
        evidenceIds: ['domain-evidence.1'],
        reasonCodes: ['domain_support'],
        reviewDecisionRef: null,
        evaluatedAt,
      }),
    ).rejects.toMatchObject({ code: 'DOMAIN_DECISION_EVIDENCE_INVALID' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects stale deterministic domain verification before insert', async () => {
    const staleEvaluatedAt = new Date('2026-09-22T02:00:00.000Z');
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{
        id: 'domain-evidence.1',
        kind: 'official_website',
        effect: 'supports_domain',
        observed_at: observedAt,
        refresh_after_seconds: '3600',
      }],
    });

    await expect(
      persistBusinessDomainVerificationDecision(poolWith(query), {
        verificationId: 'verification.stale.1',
        workspaceId,
        canonicalBusinessId: 'business.1',
        normalizedDomain: 'example.com',
        decision: 'verified',
        method: 'deterministic',
        confidence: 0.99,
        evidenceIds: ['domain-evidence.1'],
        reasonCodes: ['domain_independent_support'],
        reviewDecisionRef: null,
        evaluatedAt: staleEvaluatedAt,
      }),
    ).rejects.toMatchObject({ code: 'DOMAIN_DECISION_EVIDENCE_INVALID' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects verified domain evaluation before referenced evidence observation', async () => {
    const futureObservedAt = new Date('2026-09-22T02:00:00.000Z');
    const earlyEvaluatedAt = new Date('2026-09-22T01:00:00.000Z');
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{
        id: 'domain-evidence.1',
        kind: 'official_website',
        effect: 'supports_domain',
        observed_at: futureObservedAt,
        refresh_after_seconds: '3600',
      }],
    });

    await expect(
      persistBusinessDomainVerificationDecision(poolWith(query), {
        verificationId: 'verification.future.1',
        workspaceId,
        canonicalBusinessId: 'business.1',
        normalizedDomain: 'example.com',
        decision: 'verified',
        method: 'human_review',
        confidence: 0.99,
        evidenceIds: ['domain-evidence.1'],
        reasonCodes: ['domain_reviewed'],
        reviewDecisionRef: 'review.domain.1',
        evaluatedAt: earlyEvaluatedAt,
      }),
    ).rejects.toMatchObject({ code: 'DOMAIN_DECISION_EVIDENCE_INVALID' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('allows stale evidence only through explicit human review provenance', async () => {
    const staleEvaluatedAt = new Date('2026-09-22T02:00:00.000Z');
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{
          id: 'domain-evidence.1',
          kind: 'official_website',
          effect: 'supports_domain',
          observed_at: observedAt,
          refresh_after_seconds: '3600',
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'verification.reviewed.1',
          workspace_id: workspaceId,
          canonical_business_id: 'business.1',
          normalized_domain: 'example.com',
          decision: 'verified',
          method: 'human_review',
          confidence: 0.99,
          evidence_ids: ['domain-evidence.1'],
          reason_codes: ['domain_reviewed'],
          review_decision_ref: 'review.domain.1',
          evaluated_at: staleEvaluatedAt,
          created_at: staleEvaluatedAt,
        }],
      });

    const result = await persistBusinessDomainVerificationDecision(poolWith(query), {
      verificationId: 'verification.reviewed.1',
      workspaceId,
      canonicalBusinessId: 'business.1',
      normalizedDomain: 'example.com',
      decision: 'verified',
      method: 'human_review',
      confidence: 0.99,
      evidenceIds: ['domain-evidence.1'],
      reasonCodes: ['domain_reviewed'],
      reviewDecisionRef: 'review.domain.1',
      evaluatedAt: staleEvaluatedAt,
    });
    expect(result.created).toBe(true);
    expect(result.record.reviewDecisionRef).toBe('review.domain.1');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('fails closed when review-required contact data tries to enable display or export', async () => {
    const query = vi.fn();
    await expect(
      persistContactDataEligibilityDecision(poolWith(query), {
        ...eligibilityInput,
        decision: 'review_required',
        displayAllowed: true,
        exportAllowed: false,
      }),
    ).rejects.toMatchObject({ code: 'ENTITY_ENRICHMENT_INPUT_INVALID' });
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects duplicate country codes and non-normalized email values before persistence', async () => {
    const eligibilityQuery = vi.fn();
    await expect(
      persistContactDataEligibilityDecision(poolWith(eligibilityQuery), {
        ...eligibilityInput,
        territory: { mode: 'country_allowlist', countryCodes: ['US', 'US'] },
      }),
    ).rejects.toBeInstanceOf(EntityEnrichmentPersistenceError);
    expect(eligibilityQuery).not.toHaveBeenCalled();

    const contactQuery = vi.fn();
    await expect(
      persistApprovedBusinessContactEvidence(poolWith(contactQuery), {
        contactEvidenceId: 'contact-evidence.1',
        workspaceId,
        canonicalBusinessId: 'business.1',
        channel: 'email',
        normalizedValue: 'Sales@Example.com',
        sourceKey: 'source.public_web',
        sourceReferenceIds: ['ref.contact.1'],
        eligibilityId: 'eligibility.1',
        outreachAuthorization: 'not_evaluated',
        observedAt,
        recordedAt,
      }),
    ).rejects.toMatchObject({ code: 'ENTITY_ENRICHMENT_INPUT_INVALID' });
    expect(contactQuery).not.toHaveBeenCalled();
  });

  it('binds approved contact evidence to a same-workspace allowed eligibility decision', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{
          id: 'eligibility.1',
          workspace_id: workspaceId,
          canonical_business_id: 'business.1',
          channel: 'email',
          source_key: 'source.public_web',
          connector_key: 'connector.public_web',
          connector_version: '1.0.0',
          source_request_id: 'request.contact.1',
          source_admission_decision_ref: 'admission.contact.1',
          source_admission_decision: 'allow',
          source_reference_ids: ['ref.contact.1'],
          source_policy_id: 'policy.public-web',
          source_policy_version: '1.0.0',
          compliance_policy_id: 'compliance.contact',
          compliance_policy_version: '1.0.0',
          purpose: 'business_contact_discovery',
          territory_mode: 'country_allowlist',
          country_codes: ['US'],
          field_name: 'contact_email',
          data_classification: 'PERSONAL_BUSINESS_CONTACT',
          storage_class: 'EVIDENCE_MINIMAL',
          retention_ttl_seconds: '2592000',
          deletion_required: true,
          refresh_after_seconds: '604800',
          decision: 'allow',
          display_allowed: true,
          export_allowed: false,
          reason_codes: ['contact_policy_allow'],
          evaluated_at: evaluatedAt,
          created_at: evaluatedAt,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'contact-evidence.1',
          workspace_id: workspaceId,
          canonical_business_id: 'business.1',
          channel: 'email',
          normalized_value: 'sales@example.com',
          source_key: 'source.public_web',
          source_reference_ids: ['ref.contact.1'],
          eligibility_id: 'eligibility.1',
          outreach_authorization: 'not_evaluated',
          deletion_required: true,
          observed_at: observedAt,
          recorded_at: recordedAt,
          purged_at: null,
          purge_reason_code: null,
          created_at: recordedAt,
        }],
      });

    const result = await persistApprovedBusinessContactEvidence(poolWith(query), {
      contactEvidenceId: 'contact-evidence.1',
      workspaceId,
      canonicalBusinessId: 'business.1',
      channel: 'email',
      normalizedValue: 'sales@example.com',
      sourceKey: 'source.public_web',
      sourceReferenceIds: ['ref.contact.1'],
      eligibilityId: 'eligibility.1',
      outreachAuthorization: 'not_evaluated',
      observedAt,
      recordedAt,
    });
    expect(result.created).toBe(true);
    expect(result.record.outreachAuthorization).toBe('not_evaluated');
    expect(query.mock.calls[0]?.[0]).toContain('workspace_id=$2::uuid');
  });

  it('does not purge evidence unless its retained policy explicitly requires deletion', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'contact-evidence.1',
          workspace_id: workspaceId,
          deletion_required: false,
          purged_at: null,
          purge_reason_code: null,
        }],
      });

    await expect(
      purgeApprovedBusinessContactEvidence(poolWith(query), {
        evidenceId: 'contact-evidence.1',
        workspaceId,
        purgedAt: new Date('2026-10-22T00:00:00.000Z'),
        purgeReasonCode: 'retention_expired',
      }),
    ).rejects.toMatchObject({ code: 'EVIDENCE_PURGE_INVALID' });
    expect(query.mock.calls[0]?.[0]).toContain('workspace_id=$2::uuid');
    expect(query.mock.calls[0]?.[0]).toContain('deletion_required=true');
  });
});

describe('0015 entity enrichment evidence migration contract', () => {
  it('persists all four bounded records and provides reverse-order rollback', async () => {
    const migration = await readFile(
      resolve(process.cwd(), 'migrations/0015_entity_enrichment_evidence_persistence.up.sql'),
      'utf8',
    );
    const rollback = await readFile(
      resolve(process.cwd(), 'migrations/down/0015_entity_enrichment_evidence_persistence.down.sql'),
      'utf8',
    );
    for (const table of [
      'business_domain_evidence',
      'business_domain_verification_decisions',
      'contact_data_eligibility_decisions',
      'approved_business_contact_evidence',
    ]) {
      expect(migration).toContain(`CREATE TABLE ${table}`);
      expect(rollback).toContain(`DROP TABLE IF EXISTS ${table}`);
    }
    expect(migration).toContain('business_domain_verification_decisions_evidence_binding_guard');
    expect(migration).toContain('approved_business_contact_evidence_eligibility_guard');
    expect(migration).toContain('approved_business_contact_evidence_purge_transition_guard');
    expect(migration).toContain('guard_entity_enrichment_value_policy');
    expect(migration).toContain("outreach_authorization = 'not_evaluated'");
    expect(migration).not.toContain('http://');
    expect(migration).not.toContain('https://');
  });

  it('adds and rolls back the 0016 durable domain freshness guard', async () => {
    const migration = await readFile(
      resolve(process.cwd(), 'migrations/0016_entity_enrichment_freshness_guard.up.sql'),
      'utf8',
    );
    const rollback = await readFile(
      resolve(process.cwd(), 'migrations/down/0016_entity_enrichment_freshness_guard.down.sql'),
      'utf8',
    );

    expect(migration).toContain('NEW.evaluated_at < evidence.observed_at');
    expect(migration).toContain('evidence.refresh_after_seconds IS NOT NULL');
    expect(migration).toContain('make_interval');
    expect(migration).toContain('business_domain_verification_decisions_freshness_guard');
    expect(rollback).toContain('CREATE OR REPLACE FUNCTION brovexa_internal.guard_domain_verification_decision()');
    expect(rollback).toContain('business_domain_verification_decisions_policy_guard');
  });

  it('keeps replay and purge lookups workspace-scoped', async () => {
    const persistence = await readFile(resolve(process.cwd(), 'src/entity-enrichment-persistence.ts'), 'utf8');
    for (const table of [
      'business_domain_evidence',
      'business_domain_verification_decisions',
      'contact_data_eligibility_decisions',
      'approved_business_contact_evidence',
    ]) {
      expect(persistence).toContain(`FROM ${table} WHERE id=$1 AND workspace_id=$2::uuid`);
    }
    expect(persistence).toContain("table:'business_domain_evidence'|'approved_business_contact_evidence'");
  });
});
