export interface SourceNetworkRuntimeAdmissionInput {
    transportKind: 'test' | 'network';
    networkMode: 'disabled' | 'test_only';
    policyAllowed: boolean;
    resolutionEvidenceFresh: boolean;
}
export interface SourceNetworkRuntimeAdmission {
    decision: 'allow_test' | 'block';
    reason: 'TEST_TRANSPORT_ALLOWED' | 'PRODUCTION_NETWORK_DISABLED' | 'SOURCE_POLICY_BLOCKED' | 'RESOLUTION_EVIDENCE_STALE';
}
export declare function admitSourceNetworkRuntime(input: SourceNetworkRuntimeAdmissionInput): SourceNetworkRuntimeAdmission;
