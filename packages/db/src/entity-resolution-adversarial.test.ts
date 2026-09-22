import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { persistBusinessDomainVerificationDecision } from './entity-enrichment-persistence';

const workspaceId = '550e8400-e29b-41d4-a716-446655440000';

function persistencePool(
  observedAt: Date,
  refreshAfterSeconds: number | null,
  evaluatedAt: Date,
): Pool {
  const query = vi
    .fn()
    .mockResolvedValueOnce({
      rows: [{
        id: 'domain-evidence.adversarial.persistence.1',
        kind: 'official_website',
        effect: 'supports_domain',
        observed_at: observedAt,
        refresh_after_seconds:
          refreshAfterSeconds === null ? null : String(refreshAfterSeconds),
      }],
    })
    .mockResolvedValueOnce({
      rows: [{
        id: 'domain-verification.adversarial.persistence.1',
        workspace_id: workspaceId,
        canonical_business_id: 'business.1',
        normalized_domain: 'example.com',
        decision: 'verified',
        method: 'deterministic',
        confidence: 0.99,
        evidence_ids: ['domain-evidence.adversarial.persistence.1'],
        reason_codes: ['domain_independent_support'],
        review_decision_ref: null,
        evaluated_at: evaluatedAt,
        created_at: evaluatedAt,
      }],
    });
  return { query } as unknown as Pool;
}

function deterministicVerification(evaluatedAt: Date) {
  return {
    verificationId: 'domain-verification.adversarial.persistence.1',
    workspaceId,
    canonicalBusinessId: 'business.1',
    normalizedDomain: 'example.com',
    decision: 'verified' as const,
    method: 'deterministic' as const,
    confidence: 0.99,
    evidenceIds: ['domain-evidence.adversarial.persistence.1'],
    reasonCodes: ['domain_independent_support'],
    reviewDecisionRef: null,
    evaluatedAt,
  };
}

describe('M03-ER-006 persistence adversarial invariants', () => {
  it('rejects stale deterministic evidence at the persistence API boundary', async () => {
    const observedAt = new Date('2026-09-22T00:00:00.000Z');
    const evaluatedAt = new Date('2026-09-22T02:00:00.000Z');
    const pool = persistencePool(observedAt, 3600, evaluatedAt);

    await expect(
      persistBusinessDomainVerificationDecision(
        pool,
        deterministicVerification(evaluatedAt),
      ),
    ).rejects.toMatchObject({ code: 'DOMAIN_DECISION_EVIDENCE_INVALID' });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('rejects domain verification evaluated before its referenced evidence was observed', async () => {
    const observedAt = new Date('2026-09-22T02:00:00.000Z');
    const evaluatedAt = new Date('2026-09-22T01:00:00.000Z');
    const pool = persistencePool(observedAt, 3600, evaluatedAt);

    await expect(
      persistBusinessDomainVerificationDecision(
        pool,
        deterministicVerification(evaluatedAt),
      ),
    ).rejects.toMatchObject({ code: 'DOMAIN_DECISION_EVIDENCE_INVALID' });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('rolls 0015 back in dependency-safe reverse table order', async () => {
    const rollback = await readFile(
      resolve(process.cwd(), 'migrations/down/0015_entity_enrichment_evidence_persistence.down.sql'),
      'utf8',
    );
    const contact = rollback.indexOf('DROP TABLE IF EXISTS approved_business_contact_evidence;');
    const eligibility = rollback.indexOf('DROP TABLE IF EXISTS contact_data_eligibility_decisions;');
    const verification = rollback.indexOf('DROP TABLE IF EXISTS business_domain_verification_decisions;');
    const evidence = rollback.indexOf('DROP TABLE IF EXISTS business_domain_evidence;');

    expect(contact).toBeGreaterThanOrEqual(0);
    expect(contact).toBeLessThan(eligibility);
    expect(eligibility).toBeLessThan(verification);
    expect(verification).toBeLessThan(evidence);
  });

  it('prevents purged evidence from satisfying a new domain verification decision', async () => {
    const migration = await readFile(
      resolve(process.cwd(), 'migrations/0015_entity_enrichment_evidence_persistence.up.sql'),
      'utf8',
    );
    const start = migration.indexOf('CREATE OR REPLACE FUNCTION brovexa_internal.guard_domain_verification_decision()');
    const end = migration.indexOf('CREATE TRIGGER business_domain_verification_decisions_policy_guard');
    const guard = migration.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(guard).toContain('evidence.purged_at IS NULL');
    expect(guard).toContain('evidence.workspace_id = NEW.workspace_id');
    expect(guard).toContain('evidence.canonical_business_id = NEW.canonical_business_id');
  });

  it('keeps policy purge workspace-scoped, deletion-gated and irreversible', async () => {
    const persistence = await readFile(
      resolve(process.cwd(), 'src/entity-enrichment-persistence.ts'),
      'utf8',
    );
    const migration = await readFile(
      resolve(process.cwd(), 'migrations/0015_entity_enrichment_evidence_persistence.up.sql'),
      'utf8',
    );

    expect(persistence).toContain('workspace_id=$2::uuid');
    expect(persistence).toContain('deletion_required=true');
    expect(migration).toContain('only permits a one-way policy purge transition');
    expect(migration).toContain("outreach_authorization = 'not_evaluated'");
  });
});
