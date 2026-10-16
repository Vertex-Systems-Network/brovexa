import { describe, expect, it, vi } from 'vitest';
import type { createPgPool } from '@brovexa/db';
import { createM04NonLiveDatabaseIntegration } from './website-inspection-native-integration';

const workspaceId = '550e8400-e29b-41d4-a716-446655440000';
const inspectionId = 'inspection.001';
function setup() {
  const connect = vi.fn(async () => { throw new Error('unexpected database connection'); });
  const query = vi.fn(async () => ({ rows: [{ id: inspectionId }] }));
  const pool = { connect, query } as unknown as ReturnType<typeof createPgPool>;
  const loadRequest = vi.fn(async () => null);
  const lookup = vi.fn(async () => null);
  const exchange = vi.fn(async () => { throw new Error('unexpected transport'); });
  const policyForWorkspace = vi.fn(async (workspaceId: string) => ({
    workspaceId, retentionTtlSeconds: 86_400, deletionRequired: true as const,
  }));
  const authorizeDeletion = vi.fn(async () => false);
  const opts = { pool, loadRequest, lookup, exchange, policyForWorkspace, authorizeDeletion };
  return { opts, connect, query, loadRequest, lookup, exchange, authorizeDeletion };
}

describe('M04 non-live native integration composition', () => {
  it('registers only an opt-in fixture handler with no DB/transport activity', () => {
    const s = setup();
    const r = createM04NonLiveDatabaseIntegration(s.opts);
    expect(Object.keys(r.handlers)).toEqual(['website_inspection_fixture']);
    expect(Object.isFrozen(r)).toBe(true);
    expect(s.connect).not.toHaveBeenCalled();
    expect(s.lookup).not.toHaveBeenCalled();
    expect(s.exchange).not.toHaveBeenCalled();
  });

  it('does not call the transport without a trusted scoped request', async () => {
    const s = setup();
    const r = createM04NonLiveDatabaseIntegration(s.opts);
    await expect(r.handlers.website_inspection_fixture({
      workType: 'website_inspection_fixture', workVersion: 1,
      workUnitId: 'work.1', jobRunId: 'job.1', workspaceId,
      correlationId: 'trace.1', attempt: 1,
      payload: { kind: 'website_inspection_fixture', inspectionId },
      isCancellationRequested: async () => false,
    })).rejects.toMatchObject({ code: 'M04_WORK_REQUEST_MISSING' });
    expect(s.exchange).not.toHaveBeenCalled();
    expect(s.connect).not.toHaveBeenCalled();
  });

  it('refuses deletion across unapproved workspace, including false and malformed scopes', async () => {
    const s = setup();
    const r = createM04NonLiveDatabaseIntegration(s.opts);
    await expect(r.deleteEvidence({ workspaceId: 'bad', inspectionId }))
      .rejects.toMatchObject({ code: 'M04_DELETION_SCOPE_INVALID' });
    await expect(r.deleteEvidence({ workspaceId, inspectionId }))
      .rejects.toMatchObject({ code: 'M04_DELETION_NOT_AUTHORIZED' });
    expect(s.query).not.toHaveBeenCalled();
  });

  it('reuses exactly the authorized scope in the database deletion query', async () => {
    const s = setup();
    s.opts.authorizeDeletion.mockResolvedValue(true);
    const r = createM04NonLiveDatabaseIntegration(s.opts);
    const scope = { workspaceId, inspectionId };
    await expect(r.deleteEvidence(scope)).resolves.toBe(true);
    expect(s.opts.authorizeDeletion).toHaveBeenCalledWith(scope);
    expect(s.query.mock.calls[0]?.[1]).toEqual([inspectionId, workspaceId]);
  });
});