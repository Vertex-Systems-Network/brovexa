import { describe, expect, it } from 'vitest';
import {
  acquireAuthorizedM04LiveRoot,
  isPublicM04Ipv4,
  M04LiveAcquisitionError,
  type M04LiveReadRequest,
  type M04LivePermit,
  type M04LiveAcquisitionDependencies,
} from './website-live-acquisition';
import { inspectAuthorizedM04LiveRoot } from './website-live-assessment';

const valid: M04LiveReadRequest = {
  version: '2.0.0', executionMode: 'live', networkRequested: true,
  credentialedFetchRequested: false, rawPayloadRequested: false, outreachRequested: false,
  workspaceId: '550e8400-e29b-41d4-a716-446655440000', inspectionId: 'inspect.42',
  canonicalBusinessId: 'business.42', domainVerificationId: 'verify.42',
  verifiedDomain: 'example.com', sourceKey: 'source.approved_web',
  sourceAdmissionDecisionRef: 'admission.42', sourcePolicyId: 'policy.web',
  sourcePolicyVersion: '1.0.0', transportPolicyId: 'transport.web',
  transportPolicyVersion: '1.0.0', targetUrl: 'https://example.com/',
  maxResponseBytes: 1000, timeoutMs: 1000,
};
const permit: M04LivePermit = {
  ...valid, decision: 'allow', permission: 'live_root_read',
  networkApproved: true, credentialsApproved: false, outreachApproved: false,
  rawBodyRetentionApproved: false, maxResponseBytes: 1000, timeoutMs: 1000,
  expiresAt: '2026-10-16T12:00:00.000Z',
};
function deps() {
  return {
    enabled: true as const, now: () => new Date('2026-10-16T11:00:00.000Z'),
    loadPermit: async () => permit,
    resolveAddresses: async () => ['8.8.8.8'],
    admitM02Hop: async (input: {
      workspaceId: string; inspectionId: string; canonicalUrl: string;
      resolvedIpv4: string; maxResponseBytes: number; timeoutMs: number;
      transportPolicyId: string; transportPolicyVersion: string;
    }) => ({ ...input, decision: 'allow' as const, transportKind: 'network' as const,
      expiresAt: '2026-10-16T11:02:00.000Z' }),
    transport: async () => ({ status: 200, contentType: 'text/html',
      contentEncoding: 'identity', body: new TextEncoder().encode('<html></html>') }),
  };
}

describe('M04 live v2 permission and SSRF preflight', () => {
  it('requires a separate M02 hop gate before any live read', async () => {
    const blocked = { ...deps(), admitM02Hop: async () => ({
      decision: 'blocked' as const, workspaceId: valid.workspaceId,
      inspectionId: valid.inspectionId, transportKind: 'network' as const,
      canonicalUrl: valid.targetUrl, resolvedIpv4: '8.8.8.8',
      maxResponseBytes: valid.maxResponseBytes, timeoutMs: valid.timeoutMs,
      transportPolicyId: valid.transportPolicyId,
      transportPolicyVersion: valid.transportPolicyVersion,
      expiresAt: '2026-10-16T11:02:00.000Z',
    }) };
    await expect(acquireAuthorizedM04LiveRoot(valid, blocked))
      .rejects.toMatchObject({ code: 'M04_LIVE_M02_HOP_BLOCKED' });
  });
  it('fails closed on mixed public and internal DNS', async () => {
    const invalid = { ...deps(), resolveAddresses: async () => ['8.8.8.8', '127.0.0.1'] };
    await expect(acquireAuthorizedM04LiveRoot(valid, invalid))
      .rejects.toMatchObject({ code: 'M04_LIVE_DNS_NONPUBLIC' });
    expect(isPublicM04Ipv4('169.254.169.254')).toBe(false);
  });
  it('retains distinct live v2 provenance; no raw body in the report', async () => {
    const report = await inspectAuthorizedM04LiveRoot(valid, deps());
    expect(report.version).toBe('2.0.0');
    expect(report.request.networkRequested).toBe(true);
    expect(report.status).toBe('review_required');
    expect(report.coverage).toBe('partial');
    expect(report.bodyIncluded).toBe(false);
    expect(JSON.stringify(report)).not.toContain('<html>');
  });
  it('does not grant network admission by default', async () => {
    const d = { ...deps(), enabled: false as const };
    await expect(acquireAuthorizedM04LiveRoot(valid, d as unknown as M04LiveAcquisitionDependencies))
      .rejects.toBeInstanceOf(M04LiveAcquisitionError);
  });
});