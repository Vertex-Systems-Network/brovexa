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
    sourcePolicySnapshot: {
      policyId: 'policy.source.company_sites',
      policyVersion: '1.0.0',
    },
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
    sourceRequest: {
      version: '1.0.0',
      requestId: 'source-request-1',
      workspaceId: 'workspace-1',
      researchJobId: 'research-job-1',
      researchRunId: 'research-run-1',
      workUnitId: 'work-unit-1',
      sourceTaskId: 'source-task-1',
      connectorKey: policy.connectorKey,
      connectorVersion: policy.connectorVersion,
      sourceKey: 'source.company_sites',
      operation: 'fetch',
      executionIntent: 'execute',
      purpose: 'research.website',
      intendedUse: 'business.verification',
      requestedFields: ['business.name', 'website.url'],
      requestedDataClassifications: ['PUBLIC_BUSINESS'],
      geography: { countryCodes: ['TR'], areaRefs: [] },
      storageClass: 'EVIDENCE_MINIMAL',
      exportRequested: false,
      rawPayloadRequested: false,
      robotsDecision: 'allowed',
      targetUrl: 'https://example.com/business',
      query: { categories: [], externalRefs: [], filters: {} },
      pagination: {},
      budget: {
        maxRequests: 4,
        maxPages: 4,
        maxBytes: 750_000,
        maxCurrencyMicros: 0,
        maxRuntimeMs: 7_500,
        maxConcurrency: 1,
      },
      policySnapshot: {
        policyId: policy.sourcePolicySnapshot.policyId,
        policyVersion: policy.sourcePolicySnapshot.policyVersion,
      },
      requestedAt: '2026-09-03T00:00:00.000Z',
    },
    request: {
      version: '1.0.0',
      transportRequestId: 'transport-request-1',
      sourceRequestId: 'source-request-1',
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
    expect(SourceTransportPolicySchema.safeParse({ ...input, redirects }).success).toBe(false);

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
  it('allows a bounded test transport only when source admission, host and public resolution all match', () => {
    const decision = evaluateSourceTransportAdmission(fixture());
    expect(decision.decision).toBe('allow');
    expect(decision.reasonCodes).toEqual([]);
    expect(decision.canonicalUrl).toBe('https://example.com/business');
    expect(decision.hostname).toBe('example.com');
    expect(decision.port).toBe(443);
    expect(decision.maxResponseBytes).toBe(500_000);
    expect(decision.timeoutMs).toBe(5_000);
  });

  it('binds transport identity to the exact admitted SourceRequest and policy snapshot', () => {
    const wrongRequest = fixture();
    wrongRequest.request.sourceRequestId = 'source-request-other';
    expect(evaluateSourceTransportAdmission(wrongRequest).reasonCodes).toContain('transport_source_request_identity_mismatch');

    const wrongTask = fixture();
    wrongTask.request.sourceTaskId = 'source-task-other';
    expect(evaluateSourceTransportAdmission(wrongTask).reasonCodes).toContain('transport_source_request_identity_mismatch');

    const wrongPolicy = fixture();
    wrongPolicy.policy = {
      ...wrongPolicy.policy,
      sourcePolicySnapshot: { policyId: 'policy.other', policyVersion: '1.0.0' },
    };
    expect(evaluateSourceTransportAdmission(wrongPolicy).reasonCodes).toContain('transport_source_policy_snapshot_mismatch');
  });

  it('does not let transport widen the admitted SourceRequest target or resource budgets', () => {
    const target = fixture();
    target.request.url = 'https://example.com/other';
    target.resolution.url = target.request.url;
    expect(evaluateSourceTransportAdmission(target).reasonCodes).toContain('transport_source_target_mismatch');

    const bytes = fixture();
    bytes.request.maxResponseBytes = 750_001;
    expect(evaluateSourceTransportAdmission(bytes).reasonCodes).toContain('transport_source_byte_budget_exceeded');

    const runtime = fixture();
    runtime.request.timeoutMs = 7_501;
    expect(evaluateSourceTransportAdmission(runtime).reasonCodes).toContain('transport_source_runtime_budget_exceeded');
  });

  it('does not let test-only policy activate a real network transport', () => {
    const input = fixture();
    input.request.transportKind = 'network';
    const decision = evaluateSourceTransportAdmission(input);
    expect(decision.decision).toBe('blocked');
    expect(decision.reasonCodes).toContain('transport_network_test_only');
  });

  it('requires an executable SourceRequest before any real network transport', () => {
    const input = fixture();
    input.policy = { ...input.policy, networkMode: 'provider_network' };
    input.sourceRequest.executionIntent = 'preflight';
    input.request.transportKind = 'network';
    expect(evaluateSourceTransportAdmission(input).reasonCodes).toContain('transport_source_request_not_executable');
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

  it('binds the resolution to the exact transport request and exact hop URL', () => {
    const wrongRequest = fixture();
    wrongRequest.resolution.transportRequestId = 'transport-request-other';
    expect(evaluateSourceTransportAdmission(wrongRequest).reasonCodes).toContain('transport_resolution_request_mismatch');

    const wrongTarget = fixture();
    wrongTarget.resolution.url = 'https://example.com/other';
    expect(evaluateSourceTransportAdmission(wrongTarget).reasonCodes).toContain('transport_resolution_target_mismatch');
  });

  it('uses label-boundary domain suffix matching instead of substring matching on redirected hops', () => {
    const allowed = fixture();
    allowed.request.redirectHop = 1;
    allowed.request.url = 'https://api.example.org/business';
    allowed.resolution.url = allowed.request.url;
    allowed.resolution.hostname = 'api.example.org';
    expect(evaluateSourceTransportAdmission(allowed).decision).toBe('allow');

    const confusion = fixture();
    confusion.request.redirectHop = 1;
    confusion.request.url = 'https://example.org.attacker.test/business';
    confusion.resolution.url = confusion.request.url;
    confusion.resolution.hostname = 'example.org.attacker.test';
    expect(evaluateSourceTransportAdmission(confusion).reasonCodes).toContain('transport_host_not_allowed');
  });

  it('honors explicit deny hosts before a matching suffix allowlist', () => {
    const input = fixture();
    input.request.redirectHop = 1;
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
    literal.request.redirectHop = 1;
    literal.request.url = 'https://93.184.216.34/business';
    literal.resolution.url = literal.request.url;
    literal.resolution.hostname = '93.184.216.34';
    expect(evaluateSourceTransportAdmission(literal).reasonCodes).toContain('transport_ip_literal_not_allowed');
  });

  it('requires an explicit cleartext HTTP opt-in and still emits a warning', () => {
    const blocked = fixture();
    blocked.policy = { ...blocked.policy, allowedSchemes: ['https', 'http'], allowedPorts: [80, 443] };
    blocked.request.url = 'http://example.com/business';
    blocked.sourceRequest.targetUrl = blocked.request.url;
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
    allowed.sourceRequest.targetUrl = allowed.request.url;
    allowed.resolution.url = allowed.request.url;
    const allowedDecision = evaluateSourceTransportAdmission(allowed);
    expect(allowedDecision.decision).toBe('allow');
    expect(allowedDecision.warnings).toContain('transport_cleartext_http');
  });

  it('blocks redirect, policy-limit, method and content-type widening', () => {
    const input = fixture();
    input.sourceRequest.budget.maxBytes = 2_000_000;
    input.sourceRequest.budget.maxRuntimeMs = 20_000;
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
    expect(evaluateSourceTransportAdmission(input).reasonCodes).toContain('transport_source_request_identity_mismatch');
  });
});
