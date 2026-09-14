"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceTransportObservabilityEventSchema = exports.SourceTransportMetricLabelSchema = exports.sourceTransportMetricLabelValues = exports.SourceTransportFailureReasonSchema = exports.sourceTransportFailureReasonValues = void 0;
exports.normalizeFailureReason = normalizeFailureReason;
exports.bucketResponseSize = bucketResponseSize;
exports.bucketDuration = bucketDuration;
exports.bucketRedirectHops = bucketRedirectHops;
exports.bucketHttpStatus = bucketHttpStatus;
exports.buildSourceTransportObservabilityEvent = buildSourceTransportObservabilityEvent;
const zod_1 = require("zod");
/**
 * Normalized failure reason codes for source transport operations.
 * These provide bounded-cardinality telemetry signals that are:
 * - tenant-safe (no PII or credentials)
 * - payload-safe (no response bodies or sensitive data)
 * - provider-neutral (no provider-specific error codes)
 */
exports.sourceTransportFailureReasonValues = [
    // Network-level failures
    'DNS_RESOLUTION_FAILED',
    'DNS_TIMEOUT',
    'DNS_NXDOMAIN',
    'DNS_MIXED_ANSWERS',
    'CONNECTION_REFUSED',
    'CONNECTION_TIMEOUT',
    'CONNECTION_RESET',
    'TLS_HANDSHAKE_FAILED',
    'TLS_CERTIFICATE_INVALID',
    'TLS_CERTIFICATE_EXPIRED',
    // Policy/admission failures
    'ADMISSION_BLOCKED_PRIVATE_ADDRESS',
    'ADMISSION_BLOCKED_LOOPBACK',
    'ADMISSION_BLOCKED_LINK_LOCAL',
    'ADMISSION_BLOCKED_METADATA_ENDPOINT',
    'ADMISSION_BLOCKED_MULTICAST',
    'ADMISSION_BLOCKED_DOCUMENTATION',
    'ADMISSION_BLOCKED_RESERVED',
    'ADMISSION_BLOCKED_HOST_NOT_ALLOWED',
    'ADMISSION_BLOCKED_SCHEME_NOT_ALLOWED',
    'ADMISSION_BLOCKED_PORT_NOT_ALLOWED',
    'ADMISSION_BLOCKED_METHOD_NOT_ALLOWED',
    'ADMISSION_BLOCKED_REDIRECT_HOP_LIMIT',
    'ADMISSION_BLOCKED_REDIRECT_UNSAFE',
    'ADMISSION_BLOCKED_REDIRECT_REBINDING',
    // Transport execution failures
    'TRANSPORT_HTTP_STATUS_ERROR',
    'TRANSPORT_RESPONSE_TOO_LARGE',
    'TRANSPORT_TIMEOUT',
    'TRANSPORT_BODY_DIGEST_MISMATCH',
    'TRANSPORT_REDIRECT_CHAIN_INVALID',
    // Input/validation failures
    'INVALID_URL_FORMAT',
    'INVALID_HOSTNAME',
    'INVALID_SOURCE_REQUEST_ID',
    'INVALID_TRANSPORT_POLICY',
    // System failures
    'INTERNAL_ERROR',
    'CAPACITY_EXHAUSTED',
];
exports.SourceTransportFailureReasonSchema = zod_1.z.enum(exports.sourceTransportFailureReasonValues);
/**
 * Bounded cardinality metric labels for source transport observability.
 * All labels use predefined enum values to prevent cardinality explosion.
 */
exports.sourceTransportMetricLabelValues = [
    // Address classification outcomes
    'address_class_public',
    'address_class_private',
    'address_class_loopback',
    'address_class_link_local',
    'address_class_metadata',
    'address_class_multicast',
    'address_class_unspecified',
    'address_class_documentation',
    'address_class_reserved',
    'address_class_invalid',
    // Decision outcomes
    'decision_allow',
    'decision_block',
    // Network modes
    'network_mode_disabled',
    'network_mode_test_only',
    'network_mode_provider_network',
    // HTTP status class buckets
    'http_status_2xx',
    'http_status_3xx',
    'http_status_4xx',
    'http_status_5xx',
    // Redirect hop count buckets
    'redirect_hops_0',
    'redirect_hops_1_to_3',
    'redirect_hops_4_to_6',
    'redirect_hops_7_plus',
    // Response size buckets (bytes)
    'response_size_0_to_1kb',
    'response_size_1kb_to_100kb',
    'response_size_100kb_to_1mb',
    'response_size_1mb_plus',
    // Duration buckets (milliseconds)
    'duration_0_to_100ms',
    'duration_100ms_to_1s',
    'duration_1s_to_10s',
    'duration_10s_plus',
];
exports.SourceTransportMetricLabelSchema = zod_1.z.enum(exports.sourceTransportMetricLabelValues);
/**
 * A single transport observability event.
 * Designed for bounded storage and aggregation.
 */
exports.SourceTransportObservabilityEventSchema = zod_1.z.object({
    version: zod_1.z.literal('1.0.0'),
    eventId: zod_1.z.string().uuid(),
    timestamp: zod_1.z.string().datetime(),
    // Correlation identifiers (for trace reconstruction, not stored in metrics)
    transportRequestId: zod_1.z.string().trim().min(1).max(128),
    sourceRequestId: zod_1.z.string().trim().min(1).max(128),
    sourceTaskId: zod_1.z.string().trim().min(1).max(128),
    workspaceId: zod_1.z.string().uuid(),
    // Bounded labels for aggregation
    labels: zod_1.z.array(exports.SourceTransportMetricLabelSchema).max(16),
    // Optional failure reason (only present on failure)
    failureReason: exports.SourceTransportFailureReasonSchema.optional(),
    // Quantitative measurements
    metrics: zod_1.z.object({
        redirectHopCount: zod_1.z.number().int().min(0).max(64),
        resolvedAddressCount: zod_1.z.number().int().min(0).max(64),
        responseBytes: zod_1.z.number().int().min(0).max(100_000_000), // 100MB max
        elapsedMs: zod_1.z.number().int().min(0).max(300_000), // 5 min max
        httpStatus: zod_1.z.number().int().min(100).max(599).optional(),
    }),
    // Safety attestation
    attestations: zod_1.z.object({
        noCredentialsLogged: zod_1.z.literal(true),
        noPayloadBodyLogged: zod_1.z.literal(true),
        noTenantSpecificDataLogged: zod_1.z.literal(true),
    }),
}).strict();
/**
 * Build a normalized failure reason from an error scenario.
 * Maps detailed errors to bounded cardinality reason codes.
 */
function normalizeFailureReason(errorCode, context) {
    const code = errorCode.toUpperCase();
    // DNS failures
    if (code.includes('DNS') || code.includes('RESOLUTION')) {
        if (code.includes('TIMEOUT'))
            return 'DNS_TIMEOUT';
        if (code.includes('NXDOMAIN') || code.includes('NOT_FOUND'))
            return 'DNS_NXDOMAIN';
        if (code.includes('MIXED'))
            return 'DNS_MIXED_ANSWERS';
        return 'DNS_RESOLUTION_FAILED';
    }
    // Connection failures
    if (code.includes('REFUSED'))
        return 'CONNECTION_REFUSED';
    if (code.includes('TIMEOUT'))
        return 'CONNECTION_TIMEOUT';
    if (code.includes('RESET') || code.includes('ABORT'))
        return 'CONNECTION_RESET';
    // TLS failures
    if (code.includes('TLS') || code.includes('SSL') || code.includes('CERTIFICATE')) {
        if (code.includes('HANDSHAKE'))
            return 'TLS_HANDSHAKE_FAILED';
        if (code.includes('EXPIRED'))
            return 'TLS_CERTIFICATE_EXPIRED';
        if (code.includes('INVALID') || code.includes('VERIFY'))
            return 'TLS_CERTIFICATE_INVALID';
        return 'TLS_HANDSHAKE_FAILED';
    }
    // Admission/policy failures based on address class
    if (context?.addressClass) {
        const addrClass = context.addressClass.toLowerCase();
        if (addrClass === 'private')
            return 'ADMISSION_BLOCKED_PRIVATE_ADDRESS';
        if (addrClass === 'loopback')
            return 'ADMISSION_BLOCKED_LOOPBACK';
        if (addrClass === 'link_local')
            return 'ADMISSION_BLOCKED_LINK_LOCAL';
        if (addrClass === 'metadata')
            return 'ADMISSION_BLOCKED_METADATA_ENDPOINT';
        if (addrClass === 'multicast')
            return 'ADMISSION_BLOCKED_MULTICAST';
        if (addrClass === 'documentation')
            return 'ADMISSION_BLOCKED_DOCUMENTATION';
        if (addrClass === 'reserved')
            return 'ADMISSION_BLOCKED_RESERVED';
    }
    // Admission failures based on policy
    if (code.includes('HOST') || code.includes('ALLOWLIST'))
        return 'ADMISSION_BLOCKED_HOST_NOT_ALLOWED';
    if (code.includes('SCHEME'))
        return 'ADMISSION_BLOCKED_SCHEME_NOT_ALLOWED';
    if (code.includes('PORT'))
        return 'ADMISSION_BLOCKED_PORT_NOT_ALLOWED';
    if (code.includes('METHOD'))
        return 'ADMISSION_BLOCKED_METHOD_NOT_ALLOWED';
    // Redirect failures
    if (code.includes('REDIRECT')) {
        if (code.includes('HOP') || code.includes('LIMIT') || code.includes('LOOP')) {
            return 'ADMISSION_BLOCKED_REDIRECT_HOP_LIMIT';
        }
        if (code.includes('UNSAFE') || code.includes('REBIND')) {
            return 'ADMISSION_BLOCKED_REDIRECT_REBINDING';
        }
        return 'ADMISSION_BLOCKED_REDIRECT_UNSAFE';
    }
    // Transport execution failures
    if (code.includes('STATUS') && context?.httpStatus) {
        return 'TRANSPORT_HTTP_STATUS_ERROR';
    }
    if (code.includes('SIZE') || code.includes('LARGE') || code.includes('LIMIT')) {
        return 'TRANSPORT_RESPONSE_TOO_LARGE';
    }
    if (code.includes('DIGEST') || code.includes('HASH') || code.includes('CHECKSUM')) {
        return 'TRANSPORT_BODY_DIGEST_MISMATCH';
    }
    if (code.includes('CHAIN') || code.includes('INVALID')) {
        return 'TRANSPORT_REDIRECT_CHAIN_INVALID';
    }
    // Input validation failures
    if (code.includes('URL') || code.includes('URI'))
        return 'INVALID_URL_FORMAT';
    if (code.includes('HOSTNAME') || code.includes('HOST'))
        return 'INVALID_HOSTNAME';
    if (code.includes('SOURCE_REQUEST'))
        return 'INVALID_SOURCE_REQUEST_ID';
    if (code.includes('POLICY'))
        return 'INVALID_TRANSPORT_POLICY';
    // System failures
    if (code.includes('CAPACITY') || code.includes('QUOTA') || code.includes('LIMIT')) {
        return 'CAPACITY_EXHAUSTED';
    }
    // Default to internal error
    return 'INTERNAL_ERROR';
}
/**
 * Bucket a response size into bounded cardinality label.
 */
function bucketResponseSize(bytes) {
    if (bytes <= 1_024)
        return 'response_size_0_to_1kb';
    if (bytes <= 100_000)
        return 'response_size_1kb_to_100kb';
    if (bytes <= 1_000_000)
        return 'response_size_100kb_to_1mb';
    return 'response_size_1mb_plus';
}
/**
 * Bucket a duration into bounded cardinality label.
 */
function bucketDuration(ms) {
    if (ms <= 100)
        return 'duration_0_to_100ms';
    if (ms <= 1_000)
        return 'duration_100ms_to_1s';
    if (ms <= 10_000)
        return 'duration_1s_to_10s';
    return 'duration_10s_plus';
}
/**
 * Bucket redirect hop count into bounded cardinality label.
 */
function bucketRedirectHops(count) {
    if (count === 0)
        return 'redirect_hops_0';
    if (count <= 3)
        return 'redirect_hops_1_to_3';
    if (count <= 6)
        return 'redirect_hops_4_to_6';
    return 'redirect_hops_7_plus';
}
/**
 * Bucket HTTP status into status class label.
 */
function bucketHttpStatus(status) {
    if (status >= 200 && status < 300)
        return 'http_status_2xx';
    if (status >= 300 && status < 400)
        return 'http_status_3xx';
    if (status >= 400 && status < 500)
        return 'http_status_4xx';
    if (status >= 500 && status < 600)
        return 'http_status_5xx';
    return null;
}
/**
 * Build an observability event from transport execution results.
 */
function buildSourceTransportObservabilityEvent(input) {
    const { randomUUID } = require('node:crypto');
    const labels = [];
    // Add address class labels
    if (input.addressClasses && input.addressClasses.length > 0) {
        for (const addrClass of input.addressClasses) {
            const label = `address_class_${addrClass.toLowerCase()}`;
            if (exports.sourceTransportMetricLabelValues.includes(label)) {
                labels.push(label);
            }
        }
    }
    // Add decision label
    labels.push(input.decision === 'allow' ? 'decision_allow' : 'decision_block');
    // Add network mode label
    labels.push(`network_mode_${input.networkMode}`);
    // Add bucketed metric labels
    labels.push(bucketResponseSize(input.responseBytes));
    labels.push(bucketDuration(input.elapsedMs));
    labels.push(bucketRedirectHops(input.redirectHopCount));
    if (input.httpStatus) {
        const statusLabel = bucketHttpStatus(input.httpStatus);
        if (statusLabel)
            labels.push(statusLabel);
    }
    return {
        version: '1.0.0',
        eventId: randomUUID(),
        timestamp: new Date().toISOString(),
        transportRequestId: input.transportRequestId.trim().slice(0, 128),
        sourceRequestId: input.sourceRequestId.trim().slice(0, 128),
        sourceTaskId: input.sourceTaskId.trim().slice(0, 128),
        workspaceId: input.workspaceId,
        labels: labels.slice(0, 16), // Enforce max 16 labels
        failureReason: input.disposition === 'failure' && input.failureReason
            ? normalizeFailureReason(input.failureReason, {
                addressClass: input.addressClasses?.[0] !== undefined ? input.addressClasses[0] : undefined,
                httpStatus: input.httpStatus !== undefined ? input.httpStatus : undefined,
                redirectHopCount: input.redirectHopCount,
            })
            : undefined,
        metrics: {
            redirectHopCount: Math.min(input.redirectHopCount, 64),
            resolvedAddressCount: Math.min(input.resolvedAddressCount, 64),
            responseBytes: Math.min(input.responseBytes, 100_000_000),
            elapsedMs: Math.min(input.elapsedMs, 300_000),
            httpStatus: input.httpStatus,
        },
        attestations: {
            noCredentialsLogged: true,
            noPayloadBodyLogged: true,
            noTenantSpecificDataLogged: true,
        },
    };
}
//# sourceMappingURL=source-transport-observability.js.map