"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceTransportAuditRecordError = void 0;
exports.buildSourceTransportAuditRecord = buildSourceTransportAuditRecord;
const node_url_1 = require("node:url");
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/;
const connectorKeyPattern = /^connector\.[a-z0-9_.-]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class SourceTransportAuditRecordError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'SourceTransportAuditRecordError';
    }
}
exports.SourceTransportAuditRecordError = SourceTransportAuditRecordError;
function invalid(message) {
    throw new SourceTransportAuditRecordError('SOURCE_TRANSPORT_AUDIT_RECORD_INVALID', message);
}
function assertIdentifier(value, field, pattern = identifierPattern) {
    if (typeof value !== 'string' || !pattern.test(value))
        invalid(`${field} must use the canonical identifier format.`);
}
function assertVersion(value, field) {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > 64) {
        invalid(`${field} must be a non-empty version no longer than 64 characters.`);
    }
}
function normalizeCodes(values, field) {
    if (!Array.isArray(values) || values.length > 128)
        invalid(`${field} must contain at most 128 values.`);
    const normalized = values.map((value) => {
        assertIdentifier(value, field);
        return value;
    });
    if (new Set(normalized).size !== normalized.length)
        invalid(`${field} must not contain duplicates.`);
    return normalized;
}
function normalizeHostname(value) {
    const hostname = value.trim().toLowerCase();
    return hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
}
function buildSourceTransportAuditRecord(input) {
    assertIdentifier(input.id, 'id');
    if (!uuidPattern.test(input.workspaceId))
        invalid('workspaceId must be a UUID.');
    assertIdentifier(input.transportRequestId, 'transportRequestId');
    assertIdentifier(input.sourceRequestId, 'sourceRequestId');
    assertIdentifier(input.sourceTaskId, 'sourceTaskId');
    assertIdentifier(input.connectorKey, 'connectorKey', connectorKeyPattern);
    assertVersion(input.connectorVersion, 'connectorVersion');
    assertIdentifier(input.transportPolicyId, 'transportPolicyId');
    assertVersion(input.transportPolicyVersion, 'transportPolicyVersion');
    if (input.decision !== 'allow' && input.decision !== 'blocked')
        invalid('decision must be allow or blocked.');
    const reasonCodes = normalizeCodes(input.reasonCodes, 'reasonCodes');
    const warnings = normalizeCodes(input.warnings, 'warnings');
    if (input.decision === 'blocked' && reasonCodes.length === 0)
        invalid('A blocked decision must include at least one reason code.');
    const canonicalUrl = input.canonicalUrl.trim();
    if (canonicalUrl.length === 0 || canonicalUrl.length > 2048)
        invalid('canonicalUrl must be non-empty and no longer than 2048 characters.');
    let parsedUrl;
    try {
        parsedUrl = new node_url_1.URL(canonicalUrl);
    }
    catch {
        invalid('canonicalUrl must be a valid absolute URL.');
    }
    const hostname = normalizeHostname(input.hostname);
    if (hostname.length === 0 || hostname.length > 253)
        invalid('hostname must be non-empty and no longer than 253 characters.');
    if (normalizeHostname(parsedUrl.hostname) !== hostname)
        invalid('hostname must match the canonicalUrl hostname.');
    if (input.port !== null && (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535)) {
        invalid('port must be null or an integer between 1 and 65535.');
    }
    if (!Number.isSafeInteger(input.maxResponseBytes) || input.maxResponseBytes < 1) {
        invalid('maxResponseBytes must be a positive safe integer.');
    }
    if (!Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 100 || input.timeoutMs > 120000) {
        invalid('timeoutMs must be an integer between 100 and 120000.');
    }
    if (!(input.evaluatedAt instanceof Date) || Number.isNaN(input.evaluatedAt.getTime()))
        invalid('evaluatedAt must be a valid Date.');
    const envelope = Object.freeze({
        transportRequestId: input.transportRequestId,
        sourceRequestId: input.sourceRequestId,
        sourceTaskId: input.sourceTaskId,
        connectorKey: input.connectorKey,
        connectorVersion: input.connectorVersion,
        transportPolicyId: input.transportPolicyId,
        transportPolicyVersion: input.transportPolicyVersion,
        decision: input.decision,
        reasonCodes: Object.freeze([...reasonCodes]),
        warnings: Object.freeze([...warnings]),
        canonicalUrl,
        hostname,
        port: input.port,
        maxResponseBytes: input.maxResponseBytes,
        timeoutMs: input.timeoutMs,
        evaluatedAt: input.evaluatedAt.toISOString(),
    });
    return {
        ...input,
        reasonCodes,
        warnings,
        canonicalUrl,
        hostname,
        evaluatedAt: new Date(input.evaluatedAt.getTime()),
        envelope,
    };
}
//# sourceMappingURL=source-transport-audit-record.js.map