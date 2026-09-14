"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.admitSourceNetworkRuntime = admitSourceNetworkRuntime;
function admitSourceNetworkRuntime(input) {
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
//# sourceMappingURL=source-network-runtime-admission.js.map