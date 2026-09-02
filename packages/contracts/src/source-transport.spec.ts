import { describe, expect, it } from 'vitest';
import {
  SourceTransportPolicySchema,
  evaluateSourceTransportAdmission,
  type SourceTransportAdmissionInput,
  type SourceTransportPolicy,
} from './source-transport';

function fixture(): SourceTransportAdmissionInput {
  const policy: SourceTransportPolicy = {
    version: '1.0.0',
    transportPolicyId: 'transport-policy.company-sites',
    transportPolicyVersion: '1.0.0',
    connectorKey: 'connector.company_sites',
    connectorVersion: '1.0.0',
    networkMode: 'test_only',
    allowedSchemes: ['https'],
    allowCleartextHttp: false,
    allowedMethods: ['GET', 'HEAD'],
    allowedPorts: [443],
    allowIpLiteralHosts: false,
    hostPolicy: {
      mode: 'allowlist',
      exactHosts: ['example.com'],
      domainSuffixes: ['example.org'],
      deniedHosts: ['blocked.example.org'],
    },
    redirects: { maxHops: 3, revalidateEachHop: true },
    dns: {
      requireFreshResolutionEachHop: true,
      blockNonPublicAddressClasses: true,
      maxResolutionAgeSeconds: 30,
    },
    limits: { maxResponseBytes: 1_000_000, maxTimeoutMs: 10_000 },
    allowedContentTypes: ['text/html', 'application/json'],
    security: {
      ambientCredentialsProhibited: true,
      urlCredentialsProhibited: true,
      proxyAuthFromEnvironmentProhibited: true,
    },
  };

  return {
    policy,
    request: {
      version: '1.0.0',
      transportRequestId: 'transport-request-1',
      sourceTaskId: 'source-task-1',
      connectorKey: policy.connectorKey,
      connectorVersion: policy.connectorVersion,
      url: 'https://example.com/business',
      method: 'GET',
      transportKind: 'test',
      redirectHop: 0,
      maxResponseBytes: 500_000,
      timeoutMs: 5_000,
      acceptedContentTypes: ['text/html'],
      requestedAt: '2026-09-03T00:00:00.000Z',
    },
    resolution: {
      transportRequestId: 'transport-request-1',
      url: 'https://example.com/business',
      hostname: 'example.com',
      resolvedAt: '2026-09-03T00:00:05.000Z',
      addresses: [{ address: '93.184.216.34', family: 4, classification: 'public' }],
    },
    evaluatedAt: '2026-09-03T00:00:10.000Z',
  };
}

describe('SourceTransportPolicySchema', () => {
  it('requires every-hop DNS and redirect revalidation plus ambient credential isolation', () => {
    const input = fixture().policy as unknown as Record<string, unknown>;
    const redirects = { ...(input.redirects as Record<string, unknown>), revalidateEachHop: false };
    const parsed = SourceTransportPolicySchema.safeParse({ ...input, redirects });
    expect(parsed.success).toBe(false);

    const dns = { ...(input.dns as Record<string, unknown>), requireFreshResolutionEachHop: false };
    expect(SourceTransportPolicySchema.safeParse({ ...input, dns }).success).toBe(false);

    const security = { ...(input.security as Record<string, unknown>), ambientCredentialsProhibited: false };
    expect(SourceTransportPolicySchema.safeParse({ ...input, security }).success).toBe(false);
  });

  it('requires a real host allowlist when allowlist mode is selected', () => {
    const input = fixture().policy;
    const parsed = SourceTransportPolicySchema.safeParse({
      ...input,
      hostPolicy: { mode: 'allowlist', exactHosts: [], domainSuffixes: [], deniedHosts: [] },
    });
    expect(parsed.success).toBe(false);
  });
});

describe('evaluateSourceTransportAdmission', () => {
  it('allows a bounded test transport only when identity, host and public resolution all match', () => {
    const decision = evaluateSourceTransportAdmission(fixture());
    expect(decision.decision).toBe('allow');
    expect(decision.reasonCodes).toEqual([]);
    expect(decision.canonicalUrl).toBe('https://example.com/business');
    expect(decision.hostname).toBe('example.com');
    expect(decision.port).toBe(443);
  });

  it('does not let test-only policy activate a real network transport', () => {
    const input = fixture();
    input.request.transportKind = 'network';
    const decision = evaluateSourceTransportAdmission(input);
    expect(decision.decision).toBe('blocked');
    expect(decision.reasonCodes).toContain('transport_network_test_only');
  });

  it.each(['private', 'loopback', 'link_local', 'metadata', 'reserved'] as const)(
    'blocks %s destination addresses even when the hostname is allowlisted',
    (classification) => {
      const input = fixture();
      input.resolution.addresses = [{ address: '10.0.0.1', family: 4, classification }];
      const decision = evaluateSourceTransportAdmission(input);
      expect(decision.decision).toBe('blocked');
      expect(decision.reasonCodes).toContain('transport_destination_non_public_address');
    },
  );

  it('fails closed when DNS evidence is stale, from the future or empty', () => {
    const stale = fixture();
    stale.resolution.resolvedAt = '2026-09-02T23:59:00.000Z';
    expect(evaluateSourceTransportAdmission(stale).reasonCodes).toContain('transport_resolution_stale');

    const future = fixture();
    future.resolution.resolvedAt = '2026-09-03T00:00:11.000Z';
    expect(evaluateSourceTransportAdmission(future).reasonCodes).toContain('transport_resolution_from_future');

    const empty = fixture();
    empty.resolution.addresses = [];
    expect(evaluateSourceTransportAdmission(empty).reasonCodes).toContain('transport_resolution_empty');
  });

  it('binds the resolution to the exact request and exact URL', () => {
    const wrongRequest = fixture();
    wrongRequest.resolution.transportRequestId = 'transport-request-other';
    expect(evaluateSourceTransportAdmission(wrongRequest).reasonCodes).toContain('transport_resolution_request_mismatch');

    const wrongTarget = fixture();
    wrongTarget.resolution.url = 'https://example.com/other';
    expect(evaluateSourceTransportAdmission(wrongTarget).reasonCodes).toContain('transport_resolution_target_mismatch');
  });

  it('uses label-boundary domain suffix matching instead of substring matching', () => {
    const allowed = fixture();
    allowed.request.url = 'https://api.example.org/business';
    allowed.resolution.url = allowed.request.url;
    allowed.resolution.hostname = 'api.example.org';
    expect(evaluateSourceTransportAdmission(allowed).decision).toBe('allow');

    const confusion = fixture();
    confusion.request.url = 'https://example.org.attacker.test/business';
    confusion.resolution.url = confusion.request.url;
    confusion.resolution.hostname = 'example.org.attacker.test';
    expect(evaluateSourceTransportAdmission(confusion).reasonCodes).toContain('transport_host_not_allowed');
  });

  it('honors explicit deny hosts before a matching suffix allowlist', () => {
    const input = fixture();
    input.request.url = 'https://blocked.example.org/business';
    input.resolution.url = input.request.url;
    input.resolution.hostname = 'blocked.example.org';
    expect(evaluateSourceTransportAdmission(input).reasonCodes).toContain('transport_host_not_allowed');
  });

  it('blocks URL credentials, fragments and IP-literal hosts by default', () => {
    const credentials = fixture();
    credentials.request.url = 'https://user:pass@example.com/business';
    credentials.resolution.url = credentials.request.url;
    expect(evaluateSourceTransportAdmission(credentials).reasonCodes).toContain('transport_url_credentials_forbidden');

    const fragment = fixture();
    fragment.request.url = 'https://example.com/business#private';
    fragment.resolution.url = fragment.request.url;
    expect(evaluateSourceTransportAdmission(fragment).reasonCodes).toContain('transport_url_fragment_not_allowed');

    const literal = fixture();
    literal.policy = {
      ...literal.policy,
      hostPolicy: { mode: 'public_internet', exactHosts: [], domainSuffixes: [], deniedHosts: [] },
    };
    literal.request.url = 'https://93.184.216.34/business';
    literal.resolution.url = literal.request.url;
    literal.resolution.hostname = '93.184.216.34';
    expect(evaluateSourceTransportAdmission(literal).reasonCodes).toContain('transport_ip_literal_not_allowed');
  });

  it('requires an explicit cleartext HTTP opt-in and still emits a warning', () => {
    const blocked = fixture();
    blocked.policy = { ...blocked.policy, allowedSchemes: ['https', 'http'], allowedPorts: [80, 443] };
    blocked.request.url = 'http://example.com/business';
    blocked.resolution.url = blocked.request.url;
    const blockedDecision = evaluateSourceTransportAdmission(blocked);
    expect(blockedDecision.reasonCodes).toContain('transport_cleartext_http_not_allowed');

    const allowed = fixture();
    allowed.policy = {
      ...allowed.policy,
      allowedSchemes: ['https', 'http'],
      allowCleartextHttp: true,
      allowedPorts: [80, 443],
    };
    allowed.request.url = 'http://example.com/business';
    allowed.resolution.url = allowed.request.url;
    const allowedDecision = evaluateSourceTransportAdmission(allowed);
    expect(allowedDecision.decision).toBe('allow');
    expect(allowedDecision.warnings).toContain('transport_cleartext_http');
  });

  it('blocks redirect, response-size, timeout, method and content-type widening', () => {
    const input = fixture();
    input.request.redirectHop = 4;
    input.request.maxResponseBytes = 1_000_001;
    input.request.timeoutMs = 10_001;
    input.request.method = 'POST';
    input.request.acceptedContentTypes = ['application/xml'];
    const decision = evaluateSourceTransportAdmission(input);
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        'transport_redirect_limit_exceeded',
        'transport_response_budget_exceeded',
        'transport_timeout_budget_exceeded',
        'transport_method_not_allowed',
        'transport_content_type_not_allowed',
      ]),
    );
  });

  it('blocks connector identity drift', () => {
    const input = fixture();
    input.request.connectorVersion = '2.0.0';
    expect(evaluateSourceTransportAdmission(input).reasonCodes).toContain('transport_connector_identity_mismatch');
  });
});
