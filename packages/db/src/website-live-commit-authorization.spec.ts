import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** WEB-036 candidate native migration tests; a real PostgreSQL18 up/down test
 * remains a separate acceptance gate (it must not be simulated as passed). */
const dir = resolve(import.meta.dirname, '..', 'migrations');

describe('WEB-036 deferred owner-grant evidence fence', () => {
  it('checks expiry and current workspace owner during the commit phase', async () => {
    const sql = await readFile(resolve(dir, '0021_website_live_commit_authorization_guard.up.sql'), 'utf8');
    expect(sql).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(sql).toContain('AFTER INSERT ON website_live_inspection_runs');
    expect(sql).toContain('g.expires_at > clock_timestamp()');
    expect(sql).toContain('NEW.completed_at <= g.expires_at');
    expect(sql).toContain("wm.status = 'active'");
    expect(sql).toContain("wr.kind = 'owner'");
    expect(sql).toContain("s.decision = 'allow'");
  });
  it('keeps source, domain and retention scope within the original owner grant', async () => {
    const sql = await readFile(resolve(dir, '0021_website_live_commit_authorization_guard.up.sql'), 'utf8');
    for (const field of ['canonical_business_id', 'domain_verification_id', 'verified_domain',
      'source_admission_decision_ref', 'source_policy_id', 'transport_policy_id']) {
      expect(sql).toContain(`NEW.${field} = g.${field}`);
    }
    expect(sql).toContain('NEW.max_response_bytes <= g.max_response_bytes');
    expect(sql).toContain('NEW.timeout_ms <= g.timeout_ms');
    expect(sql).toContain('NEW.retention_ttl_seconds <= g.retention_ttl_seconds');
    expect(sql).toContain('FOR SHARE OF g, w, wm, u, wmr, wr, d, s');
  });
  it('has an explicitly reversible guard and does not relax v1 or v2 safety rules', async () => {
    const down = await readFile(resolve(dir, 'down', '0021_website_live_commit_authorization_guard.down.sql'), 'utf8');
    expect(down).toContain('DROP TRIGGER IF EXISTS website_live_evidence_active_grant_guard');
    expect(down).toContain('DROP FUNCTION IF EXISTS brovexa_internal.guard_website_live_commit_authorization()');
    expect(down).not.toContain('DROP TABLE');
  });
});