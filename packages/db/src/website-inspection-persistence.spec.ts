import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { persistWebsiteInspectionResult, deleteWebsiteInspectionEvidence,
  type PersistWebsiteInspectionInput } from './website-inspection-persistence';

const workspaceId = '550e8400-e29b-41d4-a716-446655440000';
function sample(): PersistWebsiteInspectionInput {
  return {
    version: '1.0.0',
    request: {
      version: '1.0.0',
      inspectionId: 'inspect.1', workspaceId, canonicalBusinessId: 'business.1',
      verifiedDomain: 'example.com',
      domainVerification: { verificationId: 'verify.1', decision: 'verified', evidenceIds: ['domain.evidence.1'] },
      targetUrl: 'https://example.com/',
      sourceKey: 'source.approved_web', sourceAdmissionDecisionRef: 'admission.1',
      sourceAdmissionDecision: 'allow',
      sourcePolicySnapshot: { policyId: 'policy.web', policyVersion: '1.0.0' },
      transportPolicyId: 'transport.web', transportPolicyVersion: '1.0.0',
      executionMode: 'test_only', networkRequested: false, credentialedFetchRequested: false,
      rawPayloadRequested: false, outreachRequested: false,
      requestedAt: '2026-10-15T00:00:00.000Z',
    },
    status: 'assessed', coverage: 'bounded',
    transportReceiptIds: ['receipt.1'], reasonCodes: [],
    observations: [{ capability: 'contact_form', observation: 'observed_present', reason: 'detected',
      confidence: 0.95, evidenceReferenceIds: ['evidence.1'], transportReceiptIds: ['receipt.1'] }],
    completedAt: '2026-10-15T00:01:00.000Z', bodyIncluded: false,
    retentionTtlSeconds: 86400, deletionRequired: true,
  };
}

function mockPool(handler?: (sql: string, args?: readonly unknown[]) => Promise<{ rows: unknown[] }>) {
  const query = vi.fn(async (sql: string, args?: readonly unknown[]) => {
    if (handler) return handler(sql, args);
    if (sql.startsWith('INSERT INTO website_inspection_runs')) return { rows: [{ id: 'inspect.1' }] };
    return { rows: [] };
  });
  const release = vi.fn();
  const connect = vi.fn(async () => ({ query, release }));
  return { pool: { connect } as unknown as Pool, query, connect, release };
}

describe('M04 website inspection persistence', () => {
  it('writes immutable parent and observations in one transaction', async () => {
    const s = mockPool();
    await expect(persistWebsiteInspectionResult(s.pool, sample()))
      .resolves.toEqual({ inspectionId: 'inspect.1', replayed: false });
    expect(s.query.mock.calls.map((c) => c[0])).toEqual([
      'BEGIN', expect.stringContaining('INSERT INTO website_inspection_runs'),
      expect.stringContaining('INSERT INTO website_capability_observations'), 'COMMIT',
    ]);
    expect(s.release).toHaveBeenCalledOnce();
  });
  it('rejects wrong workspace, unsafe origin, unverified domain and live network flags pre-DB', async () => {
    const s = mockPool();
    const f = sample();
    for (const v of [
      { ...f, request: { ...f.request, workspaceId: 'bad' } },
      { ...f, request: { ...f.request, targetUrl: 'https://example.com/?' } },
      { ...f, request: { ...f.request, domainVerification: {
        ...f.request.domainVerification, decision: 'blocked' as 'verified' } } },
      { ...f, request: { ...f.request, credentialedFetchRequested: true as false } },
      { ...f, request: { ...f.request, networkRequested: true as false } },
    ]) {
      await expect(persistWebsiteInspectionResult(s.pool, v))
        .rejects.toMatchObject({ code: 'WEBSITE_INSPECTION_INPUT_INVALID' });
    }
    expect(s.connect).not.toHaveBeenCalled();
  });
  it('rejects duplicate or foreign receipt evidence and false-negative partial coverage', async () => {
    const s = mockPool(), f = sample();
    for (const v of [
      { ...f, transportReceiptIds: ['receipt.1', 'receipt.1'] },
      { ...f, observations: [{ ...f.observations[0]!, transportReceiptIds: ['foreign'] }] },
      { ...f, observations: [f.observations[0]!, f.observations[0]!] },
      { ...f, status: 'review_required' as const, coverage: 'partial' as const,
        observations: [{ ...f.observations[0]!, observation: 'not_detected' as const,
          reason: 'not_detected_with_bounded_coverage' as const }] },
    ]) await expect(persistWebsiteInspectionResult(s.pool, v))
      .rejects.toMatchObject({ code: 'WEBSITE_INSPECTION_INPUT_INVALID' });
    expect(s.connect).not.toHaveBeenCalled();
  });
  it('accepts identical idempotent replay without writing observations', async () => {
    let hash = '';
    const s = mockPool(async (sql, args) => {
      if (sql.startsWith('INSERT INTO website_inspection_runs')) {
        hash = String(args?.[16]); return { rows: [] };
      }
      if (sql.startsWith('SELECT workspace_id, payload_hash')) {
        return { rows: [{ workspace_id: workspaceId, payload_hash: hash }] };
      }
      return { rows: [] };
    });
    await expect(persistWebsiteInspectionResult(s.pool, sample()))
      .resolves.toEqual({ inspectionId: 'inspect.1', replayed: true });
    expect(s.query.mock.calls.map((c) => c[0]).join(' ')).not.toContain('INSERT INTO website_capability_observations');
  });
  it('fails closed on mismatched replay and rolls back partial evidence writes', async () => {
    const s = mockPool(async (sql) => {
      if (sql.startsWith('INSERT INTO website_inspection_runs')) return { rows: [] };
      if (sql.startsWith('SELECT workspace_id, payload_hash')) {
        return { rows: [{ workspace_id: 'different', payload_hash: '0'.repeat(64) }] };
      }
      return { rows: [] };
    });
    await expect(persistWebsiteInspectionResult(s.pool, sample()))
      .rejects.toMatchObject({ code: 'WEBSITE_INSPECTION_ID_CONFLICT' });
    expect(s.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
    const fail = mockPool(async (sql) => {
      if (sql.startsWith('INSERT INTO website_inspection_runs')) return { rows: [{ id: 'inspect.1' }] };
      if (sql.startsWith('INSERT INTO website_capability_observations')) throw new Error('DB_GUARD');
      return { rows: [] };
    });
    await expect(persistWebsiteInspectionResult(fail.pool, sample())).rejects.toThrow('DB_GUARD');
    expect(fail.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });
  it('restricts explicit deletion to the requested workspace and deletion-required data', async () => {
    const query = vi.fn(async (_sql: string, _args?: readonly unknown[]) => ({ rows: [{ id: 'inspect.1' }] }));
    const pool = { query } as unknown as Pool;
    await expect(deleteWebsiteInspectionEvidence(pool, {
      inspectionId: 'inspect.1', workspaceId,
    })).resolves.toBe(true);
    expect(query.mock.calls[0]?.[0]).toContain('workspace_id = $2 AND deletion_required = true');
    expect(query.mock.calls[0]?.[1]).toEqual(['inspect.1', workspaceId]);
  });
  it('pins reversible SQL to verified domain and receipt binding', async () => {
    const base = resolve(import.meta.dirname, '..', 'migrations');
    const up = await readFile(resolve(base, '0018_website_inspection_evidence.up.sql'), 'utf8');
    const down = await readFile(resolve(base, 'down', '0018_website_inspection_evidence.down.sql'), 'utf8');
    expect(up).toContain('website_runs_verified_domain_fk');
    expect(up).toContain('website_observations_receipt_binding_guard');
    expect(up).toContain('website_runs_assessed_observations_guard');
    expect(up).toContain('NOT body_included AND NOT network_requested');
    expect(down).toContain('DROP TABLE IF EXISTS website_inspection_runs');
  });
});
