import { describe, expect, it } from 'vitest';
import { admitSourceNetworkRuntime } from './source-network-runtime-admission';

describe('admitSourceNetworkRuntime', () => {
  it('allows only policy-approved test transport with fresh resolution evidence', () => {
    expect(
      admitSourceNetworkRuntime({
        transportKind: 'test',
        networkMode: 'test_only',
        policyAllowed: true,
        resolutionEvidenceFresh: true,
      }),
    ).toEqual({ decision: 'allow_test', reason: 'TEST_TRANSPORT_ALLOWED' });
  });

  it('blocks production network transport even when policy and evidence pass', () => {
    expect(
      admitSourceNetworkRuntime({
        transportKind: 'network',
        networkMode: 'test_only',
        policyAllowed: true,
        resolutionEvidenceFresh: true,
      }),
    ).toEqual({ decision: 'block', reason: 'PRODUCTION_NETWORK_DISABLED' });
  });

  it('blocks policy denial before transport admission', () => {
    expect(
      admitSourceNetworkRuntime({
        transportKind: 'test',
        networkMode: 'test_only',
        policyAllowed: false,
        resolutionEvidenceFresh: true,
      }),
    ).toEqual({ decision: 'block', reason: 'SOURCE_POLICY_BLOCKED' });
  });

  it('blocks stale resolution evidence', () => {
    expect(
      admitSourceNetworkRuntime({
        transportKind: 'test',
        networkMode: 'test_only',
        policyAllowed: true,
        resolutionEvidenceFresh: false,
      }),
    ).toEqual({ decision: 'block', reason: 'RESOLUTION_EVIDENCE_STALE' });
  });
});
