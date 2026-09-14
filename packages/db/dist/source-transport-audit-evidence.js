"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSourceTransportAuditEvidence = buildSourceTransportAuditEvidence;
function requireIdentifier(value, field) {
    const normalized = value.trim();
    if (normalized.length === 0 || normalized.length > 128) {
        throw new Error(`SOURCE_TRANSPORT_AUDIT_INVALID_${field.toUpperCase()}`);
    }
    return normalized;
}
function requireCount(value, field) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 64) {
        throw new Error(`SOURCE_TRANSPORT_AUDIT_INVALID_${field.toUpperCase()}`);
    }
    return value;
}
function buildSourceTransportAuditEvidence(input) {
    return {
        version: 1,
        transportRequestId: requireIdentifier(input.transportRequestId, 'transport_request_id'),
        workspaceId: requireIdentifier(input.workspaceId, 'workspace_id'),
        sourceId: requireIdentifier(input.sourceId, 'source_id'),
        disposition: input.disposition,
        reasonCode: requireIdentifier(input.reasonCode, 'reason_code'),
        resolvedAddressCount: requireCount(input.resolvedAddressCount, 'resolved_address_count'),
        redirectHopCount: requireCount(input.redirectHopCount, 'redirect_hop_count'),
    };
}
//# sourceMappingURL=source-transport-audit-evidence.js.map