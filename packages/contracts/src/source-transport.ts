import { URL } from 'node:url';
import { z } from 'zod';
import { SourceRequestEnvelopeSchema } from './source';
import { SourceResolvedAddressEvidenceSchema, sourceResolutionAddressKey } from './source-resolution-evidence';
import { SourceTransportAddressClassSchema } from './source-transport-address';

export { SourceTransportAddressClassSchema, sourceTransportAddressClassValues } from './source-transport-address';
export type { SourceTransportAddressClass } from './source-transport-address';

const IdentifierSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const VersionSchema = z.string().trim().min(1).max(64);
const DateTimeSchema = z.string().datetime();
const UrlSchema = z.string().url().max(2048);
const HostnameSchema = z.string().trim().min(1).max(253);
const PortSchema = z.number().int().min(1).max(65_535);
const PositiveSafeIntegerSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const ContentTypeSchema = z
  .string()
  .trim()
  .min(3)
  .max(128)
  .regex(/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/);

function normalizedHost(value: string): string {
  const host = value.trim().toLowerCase();
  return host.endsWith('.') ? host.slice(0, -1) : host;
}

function hasDuplicates(values: readonly string[], normalize: (value: string) => string = (value) => value): boolean {
  const normalized = values.map(normalize);
  return new Set(normalized).size !== normalized.length;
}

function addDuplicateIssue(
  values: readonly string[],
  ctx: z.RefinementCtx,
  path: (string | number)[],
  message: string,
  normalize?: (value: string) => string,
): void {
  if (hasDuplicates(values, normalize)) ctx.addIssue({ code: 'custom', path, message });
}

function isSubset(values: readonly string[], allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed.map((value) => value.toLowerCase()));
  return values.every((value) => allowedSet.has(value.toLowerCase()));
}

function hostMatchesSuffix(host: string, suffix: string): boolean {
  const normalizedSuffix = normalizedHost(suffix);
  return host === normalizedSuffix || host.endsWith(`.${normalizedSuffix}`);
}

function isIpLiteralHost(hostname: string): boolean {
  if (hostname.startsWith('[') && hostname.endsWith(']')) return true;
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function intrinsicDeniedHost(hostname: string): boolean {
  const host = normalizedHost(hostname);
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === 'localhost.localdomain' ||
    host === 'metadata.google.internal'
  );
}

export const sourceTransportNetworkModeValues = ['disabled', 'test_only', 'provider_network'] as const;
export const SourceTransportNetworkModeSchema = z.enum(sourceTransportNetworkModeValues);
export type SourceTransportNetworkMode = z.infer<typeof SourceTransportNetworkModeSchema>;

export const sourceTransportMethodValues = ['GET', 'HEAD', 'POST'] as const;
export const SourceTransportMethodSchema = z.enum(sourceTransportMethodValues);
export type SourceTransportMethod = z.infer<typeof SourceTransportMethodSchema>;

export const SourceTransportPolicySchema = z
  .object({
    version: z.literal('1.0.0'),
    transportPolicyId: IdentifierSchema,
    transportPolicyVersion: VersionSchema,
    connectorKey: z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    connectorVersion: VersionSchema,
    sourcePolicySnapshot: z.object({
      policyId: IdentifierSchema,
      policyVersion: VersionSchema,
    }),
    networkMode: SourceTransportNetworkModeSchema,
    allowedSchemes: z.array(z.enum(['https', 'http'])).min(1).max(2),
    allowCleartextHttp: z.boolean(),
    allowedMethods: z.array(SourceTransportMethodSchema).min(1).max(sourceTransportMethodValues.length),
    allowedPorts: z.array(PortSchema).min(1).max(32),
    allowIpLiteralHosts: z.boolean(),
    hostPolicy: z.object({
      mode: z.enum(['public_internet', 'allowlist']),
      exactHosts: z.array(HostnameSchema).max(256),
      domainSuffixes: z.array(HostnameSchema).max(256),
      deniedHosts: z.array(HostnameSchema).max(256),
    }),
    redirects: z.object({
      maxHops: z.number().int().min(0).max(10),
      revalidateEachHop: z.literal(true),
    }),
    dns: z.object({
      requireFreshResolutionEachHop: z.literal(true),
      blockNonPublicAddressClasses: z.literal(true),
      maxResolutionAgeSeconds: z.number().int().min(1).max(300),
    }),
    limits: z.object({
      maxResponseBytes: PositiveSafeIntegerSchema.max(50 * 1024 * 1024),
      maxTimeoutMs: z.number().int().min(100).max(120_000),
    }),
    allowedContentTypes: z.array(ContentTypeSchema).min(1).max(64),
    security: z.object({
      ambientCredentialsProhibited: z.literal(true),
      urlCredentialsProhibited: z.literal(true),
      proxyAuthFromEnvironmentProhibited: z.literal(true),
    }),
  })
  .superRefine((policy, ctx) => {
    addDuplicateIssue(policy.allowedSchemes, ctx, ['allowedSchemes'], 'allowedSchemes must be unique.');
    addDuplicateIssue(policy.allowedMethods, ctx, ['allowedMethods'], 'allowedMethods must be unique.');
    if (new Set(policy.allowedPorts).size !== policy.allowedPorts.length) {
      ctx.addIssue({ code: 'custom', path: ['allowedPorts'], message: 'allowedPorts must be unique.' });
    }
    addDuplicateIssue(
      policy.hostPolicy.exactHosts,
      ctx,
      ['hostPolicy', 'exactHosts'],
      'exactHosts must be unique.',
      normalizedHost,
    );
    addDuplicateIssue(
      policy.hostPolicy.domainSuffixes,
      ctx,
      ['hostPolicy', 'domainSuffixes'],
      'domainSuffixes must be unique.',
      normalizedHost,
    );
    addDuplicateIssue(
      policy.hostPolicy.deniedHosts,
      ctx,
      ['hostPolicy', 'deniedHosts'],
      'deniedHosts must be unique.',
      normalizedHost,
    );
    addDuplicateIssue(
      policy.allowedContentTypes,
      ctx,
      ['allowedContentTypes'],
      'allowedContentTypes must be unique.',
      (value) => value.toLowerCase(),
    );

    if (policy.hostPolicy.mode === 'allowlist' && policy.hostPolicy.exactHosts.length + policy.hostPolicy.domainSuffixes.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['hostPolicy'],
        message: 'allowlist host policy requires at least one exact host or domain suffix.',
      });
    }
    if (
      policy.hostPolicy.mode === 'public_internet' &&
      (policy.hostPolicy.exactHosts.length > 0 || policy.hostPolicy.domainSuffixes.length > 0)
    ) {
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
export type SourceTransportPolicy = z.infer<typeof SourceTransportPolicySchema>;

export const SourceTransportRequestSchema = z.object({
  version: z.literal('1.0.0'),
  transportRequestId: IdentifierSchema,
  sourceRequestId: IdentifierSchema,
  sourceTaskId: IdentifierSchema,
  connectorKey: z.string().regex(/^connector\.[a-z0-9_.-]+$/),
  connectorVersion: VersionSchema,
  url: UrlSchema,
  method: SourceTransportMethodSchema,
  transportKind: z.enum(['test', 'network']),
  redirectHop: z.number().int().min(0).max(10),
  maxResponseBytes: PositiveSafeIntegerSchema.max(50 * 1024 * 1024),
  timeoutMs: z.number().int().min(100).max(120_000),
  acceptedContentTypes: z.array(ContentTypeSchema).min(1).max(64),
  requestedAt: DateTimeSchema,
});
export type SourceTransportRequest = z.infer<typeof SourceTransportRequestSchema>;

export const SourceTransportResolutionSchema = z
  .object({
    transportRequestId: IdentifierSchema,
    url: UrlSchema,
    hostname: HostnameSchema,
    resolvedAt: DateTimeSchema,
    addresses: z.array(SourceResolvedAddressEvidenceSchema).max(32),
  })
  .superRefine((resolution, ctx) => {
    const parsed = new URL(resolution.url);
    if (normalizedHost(parsed.hostname) !== normalizedHost(resolution.hostname)) {
      ctx.addIssue({
        code: 'custom',
        path: ['hostname'],
        message: 'Resolution hostname must match the canonical URL hostname.',
      });
    }

    const keys = resolution.addresses.map((address) => sourceResolutionAddressKey(address.address, address.family));
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['addresses'],
        message: 'resolved addresses must be unique.',
      });
    }
  });
export type SourceTransportResolution = z.infer<typeof SourceTransportResolutionSchema>;

export const SourceTransportAdmissionInputSchema = z.object({
  policy: SourceTransportPolicySchema,
  sourceRequest: SourceRequestEnvelopeSchema,
  request: SourceTransportRequestSchema,
  resolution: SourceTransportResolutionSchema,
  evaluatedAt: DateTimeSchema,
});
export type SourceTransportAdmissionInput = z.infer<typeof SourceTransportAdmissionInputSchema>;

export const SourceTransportAdmissionDecisionSchema = z.object({
  decision: z.enum(['allow', 'blocked']),
  reasonCodes: z.array(IdentifierSchema),
  warnings: z.array(IdentifierSchema),
  transportPolicyId: IdentifierSchema,
  transportPolicyVersion: VersionSchema,
  connectorKey: z.string().regex(/^connector\.[a-z0-9_.-]+$/),
  connectorVersion: VersionSchema,
  sourceRequestId: IdentifierSchema,
  transportRequestId: IdentifierSchema,
  canonicalUrl: UrlSchema,
  hostname: HostnameSchema,
  port: PortSchema.nullable(),
  maxResponseBytes: PositiveSafeIntegerSchema,
  timeoutMs: z.number().int().min(100).max(120_000),
  evaluatedAt: DateTimeSchema,
});
export type SourceTransportAdmissionDecision = z.infer<typeof SourceTransportAdmissionDecisionSchema>;

function parseCanonicalUrl(value: string): URL {
  return new URL(value);
}

function effectivePort(url: URL): number | null {
  if (url.port) {
    const parsed = Number.parseInt(url.port, 10);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65_535 ? parsed : null;
  }
  if (url.protocol === 'https:') return 443;
  if (url.protocol === 'http:') return 80;
  return null;
}

function hostAllowed(policy: SourceTransportPolicy, hostname: string): boolean {
  const host = normalizedHost(hostname);
  if (intrinsicDeniedHost(host)) return false;
  if (policy.hostPolicy.deniedHosts.some((denied) => hostMatchesSuffix(host, denied))) return false;
  if (policy.hostPolicy.mode === 'public_internet') return true;

  const exactHosts = new Set(policy.hostPolicy.exactHosts.map(normalizedHost));
  if (exactHosts.has(host)) return true;
  return policy.hostPolicy.domainSuffixes.some((suffix) => hostMatchesSuffix(host, suffix));
}

export function evaluateSourceTransportAdmission(rawInput: SourceTransportAdmissionInput): SourceTransportAdmissionDecision {
  const input = SourceTransportAdmissionInputSchema.parse(rawInput);
  const { policy, sourceRequest, request, resolution } = input;
  const blocked = new Set<string>();
  const warnings = new Set<string>();
  const target = parseCanonicalUrl(request.url);
  const resolvedTarget = parseCanonicalUrl(resolution.url);
  const hostname = normalizedHost(target.hostname);
  const resolvedHostname = normalizedHost(resolution.hostname);
  const port = effectivePort(target);

  if (policy.connectorKey !== request.connectorKey || policy.connectorVersion !== request.connectorVersion) {
    blocked.add('transport_connector_identity_mismatch');
  }
  if (
    sourceRequest.requestId !== request.sourceRequestId ||
    sourceRequest.sourceTaskId !== request.sourceTaskId ||
    sourceRequest.connectorKey !== request.connectorKey ||
    sourceRequest.connectorVersion !== request.connectorVersion
  ) {
    blocked.add('transport_source_request_identity_mismatch');
  }
  if (
    policy.sourcePolicySnapshot.policyId !== sourceRequest.policySnapshot.policyId ||
    policy.sourcePolicySnapshot.policyVersion !== sourceRequest.policySnapshot.policyVersion
  ) {
    blocked.add('transport_source_policy_snapshot_mismatch');
  }
  if (request.transportKind === 'network' && sourceRequest.executionIntent !== 'execute') {
    blocked.add('transport_source_request_not_executable');
  }
  if (request.maxResponseBytes > sourceRequest.budget.maxBytes) blocked.add('transport_source_byte_budget_exceeded');
  if (request.timeoutMs > sourceRequest.budget.maxRuntimeMs) blocked.add('transport_source_runtime_budget_exceeded');
  if (request.redirectHop === 0 && sourceRequest.targetUrl) {
    const admittedTarget = parseCanonicalUrl(sourceRequest.targetUrl);
    if (admittedTarget.href !== target.href) blocked.add('transport_source_target_mismatch');
  }

  if (resolution.transportRequestId !== request.transportRequestId) {
    blocked.add('transport_resolution_request_mismatch');
  }
  if (target.href !== resolvedTarget.href || hostname !== resolvedHostname || normalizedHost(resolvedTarget.hostname) !== hostname) {
    blocked.add('transport_resolution_target_mismatch');
  }

  if (policy.networkMode === 'disabled') blocked.add('transport_network_disabled');
  if (policy.networkMode === 'test_only' && request.transportKind === 'network') {
    blocked.add('transport_network_test_only');
  }

  const scheme = target.protocol.slice(0, -1);
  if (!policy.allowedSchemes.includes(scheme as 'https' | 'http')) blocked.add('transport_scheme_not_allowed');
  if (scheme === 'http') {
    if (!policy.allowCleartextHttp) blocked.add('transport_cleartext_http_not_allowed');
    else warnings.add('transport_cleartext_http');
  }
  if (!policy.allowedMethods.includes(request.method)) blocked.add('transport_method_not_allowed');
  if (port === null || !policy.allowedPorts.includes(port)) blocked.add('transport_port_not_allowed');

  if ((target.username || target.password) && policy.security.urlCredentialsProhibited) {
    blocked.add('transport_url_credentials_forbidden');
  }
  if (target.hash) blocked.add('transport_url_fragment_not_allowed');
  if (!hostAllowed(policy, hostname)) blocked.add('transport_host_not_allowed');
  if (isIpLiteralHost(hostname) && !policy.allowIpLiteralHosts) blocked.add('transport_ip_literal_not_allowed');

  if (request.redirectHop > policy.redirects.maxHops) blocked.add('transport_redirect_limit_exceeded');

  const resolutionAgeMs = Date.parse(input.evaluatedAt) - Date.parse(resolution.resolvedAt);
  if (resolutionAgeMs < 0) blocked.add('transport_resolution_from_future');
  if (resolutionAgeMs > policy.dns.maxResolutionAgeSeconds * 1000) blocked.add('transport_resolution_stale');
  if (resolution.addresses.length === 0) blocked.add('transport_resolution_empty');
  if (resolution.addresses.some((address) => address.classification !== 'public')) {
    blocked.add('transport_destination_non_public_address');
  }

  if (request.maxResponseBytes > policy.limits.maxResponseBytes) blocked.add('transport_response_budget_exceeded');
  if (request.timeoutMs > policy.limits.maxTimeoutMs) blocked.add('transport_timeout_budget_exceeded');
  if (!isSubset(request.acceptedContentTypes, policy.allowedContentTypes)) {
    blocked.add('transport_content_type_not_allowed');
  }

  return SourceTransportAdmissionDecisionSchema.parse({
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
