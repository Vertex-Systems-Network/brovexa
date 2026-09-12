import { z } from 'zod';
/**
 * Normalized failure reason codes for source transport operations.
 * These provide bounded-cardinality telemetry signals that are:
 * - tenant-safe (no PII or credentials)
 * - payload-safe (no response bodies or sensitive data)
 * - provider-neutral (no provider-specific error codes)
 */
export declare const sourceTransportFailureReasonValues: readonly ['DNS_RESOLUTION_FAILED', 'DNS_TIMEOUT', 'DNS_NXDOMAIN', 'DNS_MIXED_ANSWERS', 'CONNECTION_REFUSED', 'CONNECTION_TIMEOUT', 'CONNECTION_RESET', 'TLS_HANDSHAKE_FAILED', 'TLS_CERTIFICATE_INVALID', 'TLS_CERTIFICATE_EXPIRED', 'ADMISSION_BLOCKED_PRIVATE_ADDRESS', 'ADMISSION_BLOCKED_LOOPBACK', 'ADMISSION_BLOCKED_LINK_LOCAL', 'ADMISSION_BLOCKED_METADATA_ENDPOINT', 'ADMISSION_BLOCKED_MULTICAST', 'ADMISSION_BLOCKED_DOCUMENTATION', 'ADMISSION_BLOCKED_RESERVED', 'ADMISSION_BLOCKED_HOST_NOT_ALLOWED', 'ADMISSION_BLOCKED_SCHEME_NOT_ALLOWED', 'ADMISSION_BLOCKED_PORT_NOT_ALLOWED', 'ADMISSION_BLOCKED_METHOD_NOT_ALLOWED', 'ADMISSION_BLOCKED_REDIRECT_HOP_LIMIT', 'ADMISSION_BLOCKED_REDIRECT_UNSAFE', 'ADMISSION_BLOCKED_REDIRECT_REBINDING', 'TRANSPORT_HTTP_STATUS_ERROR', 'TRANSPORT_RESPONSE_TOO_LARGE', 'TRANSPORT_TIMEOUT', 'TRANSPORT_BODY_DIGEST_MISMATCH', 'TRANSPORT_REDIRECT_CHAIN_INVALID', 'INVALID_URL_FORMAT', 'INVALID_HOSTNAME', 'INVALID_SOURCE_REQUEST_ID', 'INVALID_TRANSPORT_POLICY', 'INTERNAL_ERROR', 'CAPACITY_EXHAUSTED'];
export declare const SourceTransportFailureReasonSchema: z.ZodEnum<{
    ADMISSION_BLOCKED_DOCUMENTATION: "ADMISSION_BLOCKED_DOCUMENTATION";
    ADMISSION_BLOCKED_HOST_NOT_ALLOWED: "ADMISSION_BLOCKED_HOST_NOT_ALLOWED";
    ADMISSION_BLOCKED_LINK_LOCAL: "ADMISSION_BLOCKED_LINK_LOCAL";
    ADMISSION_BLOCKED_LOOPBACK: "ADMISSION_BLOCKED_LOOPBACK";
    ADMISSION_BLOCKED_METADATA_ENDPOINT: "ADMISSION_BLOCKED_METADATA_ENDPOINT";
    ADMISSION_BLOCKED_METHOD_NOT_ALLOWED: "ADMISSION_BLOCKED_METHOD_NOT_ALLOWED";
    ADMISSION_BLOCKED_MULTICAST: "ADMISSION_BLOCKED_MULTICAST";
    ADMISSION_BLOCKED_PORT_NOT_ALLOWED: "ADMISSION_BLOCKED_PORT_NOT_ALLOWED";
    ADMISSION_BLOCKED_PRIVATE_ADDRESS: "ADMISSION_BLOCKED_PRIVATE_ADDRESS";
    ADMISSION_BLOCKED_REDIRECT_HOP_LIMIT: "ADMISSION_BLOCKED_REDIRECT_HOP_LIMIT";
    ADMISSION_BLOCKED_REDIRECT_REBINDING: "ADMISSION_BLOCKED_REDIRECT_REBINDING";
    ADMISSION_BLOCKED_REDIRECT_UNSAFE: "ADMISSION_BLOCKED_REDIRECT_UNSAFE";
    ADMISSION_BLOCKED_RESERVED: "ADMISSION_BLOCKED_RESERVED";
    ADMISSION_BLOCKED_SCHEME_NOT_ALLOWED: "ADMISSION_BLOCKED_SCHEME_NOT_ALLOWED";
    CAPACITY_EXHAUSTED: "CAPACITY_EXHAUSTED";
    CONNECTION_REFUSED: "CONNECTION_REFUSED";
    CONNECTION_RESET: "CONNECTION_RESET";
    CONNECTION_TIMEOUT: "CONNECTION_TIMEOUT";
    DNS_MIXED_ANSWERS: "DNS_MIXED_ANSWERS";
    DNS_NXDOMAIN: "DNS_NXDOMAIN";
    DNS_RESOLUTION_FAILED: "DNS_RESOLUTION_FAILED";
    DNS_TIMEOUT: "DNS_TIMEOUT";
    INTERNAL_ERROR: "INTERNAL_ERROR";
    INVALID_HOSTNAME: "INVALID_HOSTNAME";
    INVALID_SOURCE_REQUEST_ID: "INVALID_SOURCE_REQUEST_ID";
    INVALID_TRANSPORT_POLICY: "INVALID_TRANSPORT_POLICY";
    INVALID_URL_FORMAT: "INVALID_URL_FORMAT";
    TLS_CERTIFICATE_EXPIRED: "TLS_CERTIFICATE_EXPIRED";
    TLS_CERTIFICATE_INVALID: "TLS_CERTIFICATE_INVALID";
    TLS_HANDSHAKE_FAILED: "TLS_HANDSHAKE_FAILED";
    TRANSPORT_BODY_DIGEST_MISMATCH: "TRANSPORT_BODY_DIGEST_MISMATCH";
    TRANSPORT_HTTP_STATUS_ERROR: "TRANSPORT_HTTP_STATUS_ERROR";
    TRANSPORT_REDIRECT_CHAIN_INVALID: "TRANSPORT_REDIRECT_CHAIN_INVALID";
    TRANSPORT_RESPONSE_TOO_LARGE: "TRANSPORT_RESPONSE_TOO_LARGE";
    TRANSPORT_TIMEOUT: "TRANSPORT_TIMEOUT";
}>;
export type SourceTransportFailureReason = z.infer<typeof SourceTransportFailureReasonSchema>;
/**
 * Bounded cardinality metric labels for source transport observability.
 * All labels use predefined enum values to prevent cardinality explosion.
 */
export declare const sourceTransportMetricLabelValues: readonly ['address_class_public', 'address_class_private', 'address_class_loopback', 'address_class_link_local', 'address_class_metadata', 'address_class_multicast', 'address_class_unspecified', 'address_class_documentation', 'address_class_reserved', 'address_class_invalid', 'decision_allow', 'decision_block', 'network_mode_disabled', 'network_mode_test_only', 'network_mode_provider_network', 'http_status_2xx', 'http_status_3xx', 'http_status_4xx', 'http_status_5xx', 'redirect_hops_0', 'redirect_hops_1_to_3', 'redirect_hops_4_to_6', 'redirect_hops_7_plus', 'response_size_0_to_1kb', 'response_size_1kb_to_100kb', 'response_size_100kb_to_1mb', 'response_size_1mb_plus', 'duration_0_to_100ms', 'duration_100ms_to_1s', 'duration_1s_to_10s', 'duration_10s_plus'];
export declare const SourceTransportMetricLabelSchema: z.ZodEnum<{
    address_class_documentation: "address_class_documentation";
    address_class_invalid: "address_class_invalid";
    address_class_link_local: "address_class_link_local";
    address_class_loopback: "address_class_loopback";
    address_class_metadata: "address_class_metadata";
    address_class_multicast: "address_class_multicast";
    address_class_private: "address_class_private";
    address_class_public: "address_class_public";
    address_class_reserved: "address_class_reserved";
    address_class_unspecified: "address_class_unspecified";
    decision_allow: "decision_allow";
    decision_block: "decision_block";
    duration_0_to_100ms: "duration_0_to_100ms";
    duration_100ms_to_1s: "duration_100ms_to_1s";
    duration_10s_plus: "duration_10s_plus";
    duration_1s_to_10s: "duration_1s_to_10s";
    http_status_2xx: "http_status_2xx";
    http_status_3xx: "http_status_3xx";
    http_status_4xx: "http_status_4xx";
    http_status_5xx: "http_status_5xx";
    network_mode_disabled: "network_mode_disabled";
    network_mode_provider_network: "network_mode_provider_network";
    network_mode_test_only: "network_mode_test_only";
    redirect_hops_0: "redirect_hops_0";
    redirect_hops_1_to_3: "redirect_hops_1_to_3";
    redirect_hops_4_to_6: "redirect_hops_4_to_6";
    redirect_hops_7_plus: "redirect_hops_7_plus";
    response_size_0_to_1kb: "response_size_0_to_1kb";
    response_size_100kb_to_1mb: "response_size_100kb_to_1mb";
    response_size_1kb_to_100kb: "response_size_1kb_to_100kb";
    response_size_1mb_plus: "response_size_1mb_plus";
}>;
export type SourceTransportMetricLabel = z.infer<typeof SourceTransportMetricLabelSchema>;
/**
 * A single transport observability event.
 * Designed for bounded storage and aggregation.
 */
export declare const SourceTransportObservabilityEventSchema: z.ZodObject<{
    version: z.ZodLiteral<"1.0.0">;
    eventId: z.ZodString;
    timestamp: z.ZodString;
    transportRequestId: z.ZodString;
    sourceRequestId: z.ZodString;
    sourceTaskId: z.ZodString;
    workspaceId: z.ZodString;
    labels: z.ZodArray<z.ZodEnum<{
        address_class_documentation: "address_class_documentation";
        address_class_invalid: "address_class_invalid";
        address_class_link_local: "address_class_link_local";
        address_class_loopback: "address_class_loopback";
        address_class_metadata: "address_class_metadata";
        address_class_multicast: "address_class_multicast";
        address_class_private: "address_class_private";
        address_class_public: "address_class_public";
        address_class_reserved: "address_class_reserved";
        address_class_unspecified: "address_class_unspecified";
        decision_allow: "decision_allow";
        decision_block: "decision_block";
        duration_0_to_100ms: "duration_0_to_100ms";
        duration_100ms_to_1s: "duration_100ms_to_1s";
        duration_10s_plus: "duration_10s_plus";
        duration_1s_to_10s: "duration_1s_to_10s";
        http_status_2xx: "http_status_2xx";
        http_status_3xx: "http_status_3xx";
        http_status_4xx: "http_status_4xx";
        http_status_5xx: "http_status_5xx";
        network_mode_disabled: "network_mode_disabled";
        network_mode_provider_network: "network_mode_provider_network";
        network_mode_test_only: "network_mode_test_only";
        redirect_hops_0: "redirect_hops_0";
        redirect_hops_1_to_3: "redirect_hops_1_to_3";
        redirect_hops_4_to_6: "redirect_hops_4_to_6";
        redirect_hops_7_plus: "redirect_hops_7_plus";
        response_size_0_to_1kb: "response_size_0_to_1kb";
        response_size_100kb_to_1mb: "response_size_100kb_to_1mb";
        response_size_1kb_to_100kb: "response_size_1kb_to_100kb";
        response_size_1mb_plus: "response_size_1mb_plus";
    }>>;
    failureReason: z.ZodOptional<z.ZodEnum<{
        ADMISSION_BLOCKED_DOCUMENTATION: "ADMISSION_BLOCKED_DOCUMENTATION";
        ADMISSION_BLOCKED_HOST_NOT_ALLOWED: "ADMISSION_BLOCKED_HOST_NOT_ALLOWED";
        ADMISSION_BLOCKED_LINK_LOCAL: "ADMISSION_BLOCKED_LINK_LOCAL";
        ADMISSION_BLOCKED_LOOPBACK: "ADMISSION_BLOCKED_LOOPBACK";
        ADMISSION_BLOCKED_METADATA_ENDPOINT: "ADMISSION_BLOCKED_METADATA_ENDPOINT";
        ADMISSION_BLOCKED_METHOD_NOT_ALLOWED: "ADMISSION_BLOCKED_METHOD_NOT_ALLOWED";
        ADMISSION_BLOCKED_MULTICAST: "ADMISSION_BLOCKED_MULTICAST";
        ADMISSION_BLOCKED_PORT_NOT_ALLOWED: "ADMISSION_BLOCKED_PORT_NOT_ALLOWED";
        ADMISSION_BLOCKED_PRIVATE_ADDRESS: "ADMISSION_BLOCKED_PRIVATE_ADDRESS";
        ADMISSION_BLOCKED_REDIRECT_HOP_LIMIT: "ADMISSION_BLOCKED_REDIRECT_HOP_LIMIT";
        ADMISSION_BLOCKED_REDIRECT_REBINDING: "ADMISSION_BLOCKED_REDIRECT_REBINDING";
        ADMISSION_BLOCKED_REDIRECT_UNSAFE: "ADMISSION_BLOCKED_REDIRECT_UNSAFE";
        ADMISSION_BLOCKED_RESERVED: "ADMISSION_BLOCKED_RESERVED";
        ADMISSION_BLOCKED_SCHEME_NOT_ALLOWED: "ADMISSION_BLOCKED_SCHEME_NOT_ALLOWED";
        CAPACITY_EXHAUSTED: "CAPACITY_EXHAUSTED";
        CONNECTION_REFUSED: "CONNECTION_REFUSED";
        CONNECTION_RESET: "CONNECTION_RESET";
        CONNECTION_TIMEOUT: "CONNECTION_TIMEOUT";
        DNS_MIXED_ANSWERS: "DNS_MIXED_ANSWERS";
        DNS_NXDOMAIN: "DNS_NXDOMAIN";
        DNS_RESOLUTION_FAILED: "DNS_RESOLUTION_FAILED";
        DNS_TIMEOUT: "DNS_TIMEOUT";
        INTERNAL_ERROR: "INTERNAL_ERROR";
        INVALID_HOSTNAME: "INVALID_HOSTNAME";
        INVALID_SOURCE_REQUEST_ID: "INVALID_SOURCE_REQUEST_ID";
        INVALID_TRANSPORT_POLICY: "INVALID_TRANSPORT_POLICY";
        INVALID_URL_FORMAT: "INVALID_URL_FORMAT";
        TLS_CERTIFICATE_EXPIRED: "TLS_CERTIFICATE_EXPIRED";
        TLS_CERTIFICATE_INVALID: "TLS_CERTIFICATE_INVALID";
        TLS_HANDSHAKE_FAILED: "TLS_HANDSHAKE_FAILED";
        TRANSPORT_BODY_DIGEST_MISMATCH: "TRANSPORT_BODY_DIGEST_MISMATCH";
        TRANSPORT_HTTP_STATUS_ERROR: "TRANSPORT_HTTP_STATUS_ERROR";
        TRANSPORT_REDIRECT_CHAIN_INVALID: "TRANSPORT_REDIRECT_CHAIN_INVALID";
        TRANSPORT_RESPONSE_TOO_LARGE: "TRANSPORT_RESPONSE_TOO_LARGE";
        TRANSPORT_TIMEOUT: "TRANSPORT_TIMEOUT";
    }>>;
    metrics: z.ZodObject<{
        redirectHopCount: z.ZodNumber;
        resolvedAddressCount: z.ZodNumber;
        responseBytes: z.ZodNumber;
        elapsedMs: z.ZodNumber;
        httpStatus: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    attestations: z.ZodObject<{
        noCredentialsLogged: z.ZodLiteral<true>;
        noPayloadBodyLogged: z.ZodLiteral<true>;
        noTenantSpecificDataLogged: z.ZodLiteral<true>;
    }, z.core.$strip>;
}, z.core.$strict>;
export type SourceTransportObservabilityEvent = z.infer<typeof SourceTransportObservabilityEventSchema>;
/**
 * Build a normalized failure reason from an error scenario.
 * Maps detailed errors to bounded cardinality reason codes.
 */
export declare function normalizeFailureReason(errorCode: string, context?: {
    addressClass?: string | undefined;
    httpStatus?: number | undefined;
    redirectHopCount?: number | undefined;
}): SourceTransportFailureReason;
/**
 * Bucket a response size into bounded cardinality label.
 */
export declare function bucketResponseSize(bytes: number): SourceTransportMetricLabel;
/**
 * Bucket a duration into bounded cardinality label.
 */
export declare function bucketDuration(ms: number): SourceTransportMetricLabel;
/**
 * Bucket redirect hop count into bounded cardinality label.
 */
export declare function bucketRedirectHops(count: number): SourceTransportMetricLabel;
/**
 * Bucket HTTP status into status class label.
 */
export declare function bucketHttpStatus(status: number): SourceTransportMetricLabel | null;
/**
 * Build an observability event from transport execution results.
 */
export declare function buildSourceTransportObservabilityEvent(input: {
    transportRequestId: string;
    sourceRequestId: string;
    sourceTaskId: string;
    workspaceId: string;
    disposition: 'success' | 'failure';
    failureReason?: string;
    redirectHopCount: number;
    resolvedAddressCount: number;
    responseBytes: number;
    elapsedMs: number;
    httpStatus?: number;
    addressClasses?: readonly string[];
    networkMode: 'disabled' | 'test_only' | 'provider_network';
    decision: 'allow' | 'block';
}): SourceTransportObservabilityEvent;
