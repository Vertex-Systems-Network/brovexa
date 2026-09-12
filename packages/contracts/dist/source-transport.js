"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceTransportAdmissionDecisionSchema = exports.SourceTransportAdmissionInputSchema = exports.SourceTransportResolutionSchema = exports.SourceTransportRequestSchema = exports.SourceTransportPolicySchema = exports.SourceTransportMethodSchema = exports.sourceTransportMethodValues = exports.SourceTransportNetworkModeSchema = exports.sourceTransportNetworkModeValues = exports.sourceTransportAddressClassValues = exports.SourceTransportAddressClassSchema = void 0;
exports.evaluateSourceTransportAdmission = evaluateSourceTransportAdmission;
const node_url_1 = require("node:url");
const zod_1 = require("zod");
const source_1 = require("./source");
const source_resolution_evidence_1 = require("./source-resolution-evidence");
var source_transport_address_1 = require("./source-transport-address");
Object.defineProperty(exports, "SourceTransportAddressClassSchema", { enumerable: true, get: function () { return source_transport_address_1.SourceTransportAddressClassSchema; } });
Object.defineProperty(exports, "sourceTransportAddressClassValues", { enumerable: true, get: function () { return source_transport_address_1.sourceTransportAddressClassValues; } });
const IdentifierSchema = zod_1.z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const VersionSchema = zod_1.z.string().trim().min(1).max(64);
const DateTimeSchema = zod_1.z.string().datetime();
const UrlSchema = zod_1.z.string().url().max(2048);
const HostnameSchema = zod_1.z.string().trim().min(1).max(253);
const PortSchema = zod_1.z.number().int().min(1).max(65_535);
const PositiveSafeIntegerSchema = zod_1.z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const ContentTypeSchema = zod_1.z
    .string()
    .trim()
    .min(3)
    .max(128)
    .regex(/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/);
function normalizedHost(value) {
    const host = value.trim().toLowerCase();
    return host.endsWith('.') ? host.slice(0, -1) : host;
}
function hasDuplicates(values, normalize = (value) => value) {
    const normalized = values.map(normalize);
    return new Set(normalized).size !== normalized.length;
}
function addDuplicateIssue(values, ctx, path, message, normalize) {
    if (hasDuplicates(values, normalize))
        ctx.addIssue({ code: 'custom', path, message });
}
function isSubset(values, allowed) {
    const allowedSet = new Set(allowed.map((value) => value.toLowerCase()));
    return values.every((value) => allowedSet.has(value.toLowerCase()));
}
function hostMatchesSuffix(host, suffix) {
    const normalizedSuffix = normalizedHost(suffix);
    return host === normalizedSuffix || host.endsWith(`.${normalizedSuffix}`);
}
function isIpLiteralHost(hostname) {
    if (hostname.startsWith('[') && hostname.endsWith(']'))
        return true;
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}
function intrinsicDeniedHost(hostname) {
    const host = normalizedHost(hostname);
    return (host === 'localhost' ||
        host.endsWith('.localhost') ||
        host === 'localhost.localdomain' ||
        host === 'metadata.google.internal');
}
exports.sourceTransportNetworkModeValues = ['disabled', 'test_only', 'provider_network'];
exports.SourceTransportNetworkModeSchema = zod_1.z.enum(exports.sourceTransportNetworkModeValues);
exports.sourceTransportMethodValues = ['GET', 'HEAD', 'POST'];
exports.SourceTransportMethodSchema = zod_1.z.enum(exports.sourceTransportMethodValues);
exports.SourceTransportPolicySchema = zod_1.z
    .object({
    version: zod_1.z.literal('1.0.0'),
    transportPolicyId: IdentifierSchema,
    transportPolicyVersion: VersionSchema,
    connectorKey: zod_1.z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    connectorVersion: VersionSchema,
    sourcePolicySnapshot: zod_1.z.object({
        policyId: IdentifierSchema,
        policyVersion: VersionSchema,
    }),
    networkMode: exports.SourceTransportNetworkModeSchema,
    allowedSchemes: zod_1.z.array(zod_1.z.enum(['https', 'http'])).min(1).max(2),
    allowCleartextHttp: zod_1.z.boolean(),
    allowedMethods: zod_1.z.array(exports.SourceTransportMethodSchema).min(1).max(exports.sourceTransportMethodValues.length),
    allowedPorts: zod_1.z.array(PortSchema).min(1).max(32),
    allowIpLiteralHosts: zod_1.z.boolean(),
    hostPolicy: zod_1.z.object({
        mode: zod_1.z.enum(['public_internet', 'allowlist']),
        exactHosts: zod_1.z.array(HostnameSchema).max(256),
        domainSuffixes: zod_1.z.array(HostnameSchema).max(256),
        deniedHosts: zod_1.z.array(HostnameSchema).max(256),
    }),
    redirects: zod_1.z.object({
        maxHops: zod_1.z.number().int().min(0).max(10),
        revalidateEachHop: zod_1.z.literal(true),
    }),
    dns: zod_1.z.object({
        requireFreshResolutionEachHop: zod_1.z.literal(true),
        blockNonPublicAddressClasses: zod_1.z.literal(true),
        maxResolutionAgeSeconds: zod_1.z.number().int().min(1).max(300),
    }),
    limits: zod_1.z.object({
        maxResponseBytes: PositiveSafeIntegerSchema.max(50 * 1024 * 1024),
        maxTimeoutMs: zod_1.z.number().int().min(100).max(120_000),
    }),
    allowedContentTypes: zod_1.z.array(ContentTypeSchema).min(1).max(64),
    security: zod_1.z.object({
        ambientCredentialsProhibited: zod_1.z.literal(true),
        urlCredentialsProhibited: zod_1.z.literal(true),
        proxyAuthFromEnvironmentProhibited: zod_1.z.literal(true),
    }),
})
    .superRefine((policy, ctx) => {
    addDuplicateIssue(policy.allowedSchemes, ctx, ['allowedSchemes'], 'allowedSchemes must be unique.');
    addDuplicateIssue(policy.allowedMethods, ctx, ['allowedMethods'], 'allowedMethods must be unique.');
    if (new Set(policy.allowedPorts).size !== policy.allowedPorts.length) {
        ctx.addIssue({ code: 'custom', path: ['allowedPorts'], message: 'allowedPorts must be unique.' });
    }
    addDuplicateIssue(policy.hostPolicy.exactHosts, ctx, ['hostPolicy', 'exactHosts'], 'exactHosts must be unique.', normalizedHost);
    addDuplicateIssue(policy.hostPolicy.domainSuffixes, ctx, ['hostPolicy', 'domainSuffixes'], 'domainSuffixes must be unique.', normalizedHost);
    addDuplicateIssue(policy.hostPolicy.deniedHosts, ctx, ['hostPolicy', 'deniedHosts'], 'deniedHosts must be unique.', normalizedHost);
    addDuplicateIssue(policy.allowedContentTypes, ctx, ['allowedContentTypes'], 'allowedContentTypes must be unique.', (value) => value.toLowerCase());
    if (policy.hostPolicy.mode === 'allowlist' && policy.hostPolicy.exactHosts.length + policy.hostPolicy.domainSuffixes.length === 0) {
        ctx.addIssue({
            code: 'custom',
            path: ['hostPolicy'],
            message: 'allowlist host policy requires at least one exact host or domain suffix.',
        });
    }
    if (policy.hostPolicy.mode === 'public_internet' &&
        (policy.hostPolicy.exactHosts.length > 0 || policy.hostPolicy.domainSuffixes.length > 0)) {
        ctx.addIssue({
            code: 'custom',
            path: ['hostPolicy'],
            message: 'public_internet host policy must not declare allowlist hosts.',
        });
    }
    if (!policy.allowedSchemes.includes('http') && policy.allowCleartextHttp) {
        ctx.addIssue({
            code: 'custom',
            path: ['allowCleartextHttp'],
            message: 'allowCleartextHttp cannot be enabled when http is not an allowed scheme.',
        });
    }
});
exports.SourceTransportRequestSchema = zod_1.z.object({
    version: zod_1.z.literal('1.0.0'),
    transportRequestId: IdentifierSchema,
    sourceRequestId: IdentifierSchema,
    sourceTaskId: IdentifierSchema,
    connectorKey: zod_1.z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    connectorVersion: VersionSchema,
    url: UrlSchema,
    method: exports.SourceTransportMethodSchema,
    transportKind: zod_1.z.enum(['test', 'network']),
    redirectHop: zod_1.z.number().int().min(0).max(10),
    maxResponseBytes: PositiveSafeIntegerSchema.max(50 * 1024 * 1024),
    timeoutMs: zod_1.z.number().int().min(100).max(120_000),
    acceptedContentTypes: zod_1.z.array(ContentTypeSchema).min(1).max(64),
    requestedAt: DateTimeSchema,
});
exports.SourceTransportResolutionSchema = zod_1.z
    .object({
    transportRequestId: IdentifierSchema,
    url: UrlSchema,
    hostname: HostnameSchema,
    resolvedAt: DateTimeSchema,
    addresses: zod_1.z.array(source_resolution_evidence_1.SourceResolvedAddressEvidenceSchema).max(32),
})
    .superRefine((resolution, ctx) => {
    const parsed = new node_url_1.URL(resolution.url);
    if (normalizedHost(parsed.hostname) !== normalizedHost(resolution.hostname)) {
        ctx.addIssue({
            code: 'custom',
            path: ['hostname'],
            message: 'Resolution hostname must match the canonical URL hostname.',
        });
    }
    const keys = resolution.addresses.map((address) => (0, source_resolution_evidence_1.sourceResolutionAddressKey)(address.address, address.family));
    if (new Set(keys).size !== keys.length) {
        ctx.addIssue({
            code: 'custom',
            path: ['addresses'],
            message: 'resolved addresses must be unique.',
        });
    }
});
exports.SourceTransportAdmissionInputSchema = zod_1.z.object({
    policy: exports.SourceTransportPolicySchema,
    sourceRequest: source_1.SourceRequestEnvelopeSchema,
    request: exports.SourceTransportRequestSchema,
    resolution: exports.SourceTransportResolutionSchema,
    evaluatedAt: DateTimeSchema,
});
exports.SourceTransportAdmissionDecisionSchema = zod_1.z.object({
    decision: zod_1.z.enum(['allow', 'blocked']),
    reasonCodes: zod_1.z.array(IdentifierSchema),
    warnings: zod_1.z.array(IdentifierSchema),
    transportPolicyId: IdentifierSchema,
    transportPolicyVersion: VersionSchema,
    connectorKey: zod_1.z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    connectorVersion: VersionSchema,
    sourceRequestId: IdentifierSchema,
    transportRequestId: IdentifierSchema,
    canonicalUrl: UrlSchema,
    hostname: HostnameSchema,
    port: PortSchema.nullable(),
    maxResponseBytes: PositiveSafeIntegerSchema,
    timeoutMs: zod_1.z.number().int().min(100).max(120_000),
    evaluatedAt: DateTimeSchema,
});
function parseCanonicalUrl(value) {
    return new node_url_1.URL(value);
}
function effectivePort(url) {
    if (url.port) {
        const parsed = Number.parseInt(url.port, 10);
        return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65_535 ? parsed : null;
    }
    if (url.protocol === 'https:')
        return 443;
    if (url.protocol === 'http:')
        return 80;
    return null;
}
function hostAllowed(policy, hostname) {
    const host = normalizedHost(hostname);
    if (intrinsicDeniedHost(host))
        return false;
    if (policy.hostPolicy.deniedHosts.some((denied) => hostMatchesSuffix(host, denied)))
        return false;
    if (policy.hostPolicy.mode === 'public_internet')
        return true;
    const exactHosts = new Set(policy.hostPolicy.exactHosts.map(normalizedHost));
    if (exactHosts.has(host))
        return true;
    return policy.hostPolicy.domainSuffixes.some((suffix) => hostMatchesSuffix(host, suffix));
}
function evaluateSourceTransportAdmission(rawInput) {
    const input = exports.SourceTransportAdmissionInputSchema.parse(rawInput);
    const { policy, sourceRequest, request, resolution } = input;
    const blocked = new Set();
    const warnings = new Set();
    const target = parseCanonicalUrl(request.url);
    const resolvedTarget = parseCanonicalUrl(resolution.url);
    const hostname = normalizedHost(target.hostname);
    const resolvedHostname = normalizedHost(resolution.hostname);
    const port = effectivePort(target);
    if (policy.connectorKey !== request.connectorKey || policy.connectorVersion !== request.connectorVersion) {
        blocked.add('transport_connector_identity_mismatch');
    }
    if (sourceRequest.requestId !== request.sourceRequestId ||
        sourceRequest.sourceTaskId !== request.sourceTaskId ||
        sourceRequest.connectorKey !== request.connectorKey ||
        sourceRequest.connectorVersion !== request.connectorVersion) {
        blocked.add('transport_source_request_identity_mismatch');
    }
    if (policy.sourcePolicySnapshot.policyId !== sourceRequest.policySnapshot.policyId ||
        policy.sourcePolicySnapshot.policyVersion !== sourceRequest.policySnapshot.policyVersion) {
        blocked.add('transport_source_policy_snapshot_mismatch');
    }
    if (request.transportKind === 'network' && sourceRequest.executionIntent !== 'execute') {
        blocked.add('transport_source_request_not_executable');
    }
    if (request.maxResponseBytes > sourceRequest.budget.maxBytes)
        blocked.add('transport_source_byte_budget_exceeded');
    if (request.timeoutMs > sourceRequest.budget.maxRuntimeMs)
        blocked.add('transport_source_runtime_budget_exceeded');
    if (request.redirectHop === 0 && sourceRequest.targetUrl) {
        const admittedTarget = parseCanonicalUrl(sourceRequest.targetUrl);
        if (admittedTarget.href !== target.href)
            blocked.add('transport_source_target_mismatch');
    }
    if (resolution.transportRequestId !== request.transportRequestId) {
        blocked.add('transport_resolution_request_mismatch');
    }
    if (target.href !== resolvedTarget.href || hostname !== resolvedHostname || normalizedHost(resolvedTarget.hostname) !== hostname) {
        blocked.add('transport_resolution_target_mismatch');
    }
    if (policy.networkMode === 'disabled')
        blocked.add('transport_network_disabled');
    if (policy.networkMode === 'test_only' && request.transportKind === 'network') {
        blocked.add('transport_network_test_only');
    }
    const scheme = target.protocol.slice(0, -1);
    if (!policy.allowedSchemes.includes(scheme))
        blocked.add('transport_scheme_not_allowed');
    if (scheme === 'http') {
        if (!policy.allowCleartextHttp)
            blocked.add('transport_cleartext_http_not_allowed');
        else
            warnings.add('transport_cleartext_http');
    }
    if (!policy.allowedMethods.includes(request.method))
        blocked.add('transport_method_not_allowed');
    if (port === null || !policy.allowedPorts.includes(port))
        blocked.add('transport_port_not_allowed');
    if ((target.username || target.password) && policy.security.urlCredentialsProhibited) {
        blocked.add('transport_url_credentials_forbidden');
    }
    if (target.hash)
        blocked.add('transport_url_fragment_not_allowed');
    if (!hostAllowed(policy, hostname))
        blocked.add('transport_host_not_allowed');
    if (isIpLiteralHost(hostname) && !policy.allowIpLiteralHosts)
        blocked.add('transport_ip_literal_not_allowed');
    if (request.redirectHop > policy.redirects.maxHops)
        blocked.add('transport_redirect_limit_exceeded');
    const resolutionAgeMs = Date.parse(input.evaluatedAt) - Date.parse(resolution.resolvedAt);
    if (resolutionAgeMs < 0)
        blocked.add('transport_resolution_from_future');
    if (resolutionAgeMs > policy.dns.maxResolutionAgeSeconds * 1000)
        blocked.add('transport_resolution_stale');
    if (resolution.addresses.length === 0)
        blocked.add('transport_resolution_empty');
    if (resolution.addresses.some((address) => address.classification !== 'public')) {
        blocked.add('transport_destination_non_public_address');
    }
    if (request.maxResponseBytes > policy.limits.maxResponseBytes)
        blocked.add('transport_response_budget_exceeded');
    if (request.timeoutMs > policy.limits.maxTimeoutMs)
        blocked.add('transport_timeout_budget_exceeded');
    if (!isSubset(request.acceptedContentTypes, policy.allowedContentTypes)) {
        blocked.add('transport_content_type_not_allowed');
    }
    return exports.SourceTransportAdmissionDecisionSchema.parse({
        decision: blocked.size > 0 ? 'blocked' : 'allow',
        reasonCodes: [...blocked].sort(),
        warnings: [...warnings].sort(),
        transportPolicyId: policy.transportPolicyId,
        transportPolicyVersion: policy.transportPolicyVersion,
        connectorKey: request.connectorKey,
        connectorVersion: request.connectorVersion,
        sourceRequestId: request.sourceRequestId,
        transportRequestId: request.transportRequestId,
        canonicalUrl: target.href,
        hostname,
        port,
        maxResponseBytes: Math.min(request.maxResponseBytes, policy.limits.maxResponseBytes, sourceRequest.budget.maxBytes),
        timeoutMs: Math.min(request.timeoutMs, policy.limits.maxTimeoutMs, sourceRequest.budget.maxRuntimeMs),
        evaluatedAt: input.evaluatedAt,
    });
}
//# sourceMappingURL=source-transport.js.map