export interface SourceNetworkRuntimeAdmissionInput {
  transportKind: 'test' | 'network';
  networkMode: 'disabled' | 'test_only';
  policyAllowed: boolean;
  resolutionEvidenceFresh: boolean;
}

export interface SourceNetworkRuntimeAdmission {
  decision: 'allow_test' | 'block';
  reason:
    | 'TEST_TRANSPORT_ALLOWED'
    | 'PRODUCTION_NETWORK_DISABLED'
    | 'SOURCE_POLICY_BLOCKED'
    | 'RESOLUTION_EVIDENCE_STALE';
}

export function admitSourceNetworkRuntime(
  input: SourceNetworkRuntimeAdmissionInput,
): SourceNetworkRuntimeAdmission {
  if (!input.policyAllowed) {
    return { decision: 'block', reason: 'SOURCE_POLICY_BLOCKED' };
  }

  if (!input.resolutionEvidenceFresh) {
    return { decision: 'block', reason: 'RESOLUTION_EVIDENCE_STALE' };
  }

  if (input.transportKind !== 'test' || input.networkMode !== 'test_only') {
    return { decision: 'block', reason: 'PRODUCTION_NETWORK_DISABLED' };
  }

  return { decision: 'allow_test', reason: 'TEST_TRANSPORT_ALLOWED' };
}
