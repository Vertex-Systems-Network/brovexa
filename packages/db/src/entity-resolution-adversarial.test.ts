import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('M03-ER-006 persistence adversarial invariants', () => {
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
