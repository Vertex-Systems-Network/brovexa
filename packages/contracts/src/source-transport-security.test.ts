import { describe, expect, it } from 'vitest';
import { evaluateSourceTransportAdmission, type SourceTransportAdmissionInput, type SourceTransportPolicy } from './source-transport';

function fixture(): SourceTransportAdmissionInput {
  const policy: SourceTransportPolicy = {
    version: '1.0.0',
    transportPolicyId: 'transport-policy.security-regression',
    transportPolicyVersion: '1.0.0',
    connectorKey: 'connector.company_sites',
    connectorVersion: '1.0.0',
    sourcePolicySnapshot: { policyId: 'policy.source.company_sites', policyVersion: '1.0.0' },
    networkMode: 'test_only',
    allowedSchemes: ['https'],
    allowCleartextHttp: false,
    allowedMethods: ['GET'],
    allowedPorts: [443],
    allowIpLiteralHosts: false,
    hostPolicy: {
      mode: 'allowlist',
      exactHosts: ['example.com'],
      domainSuffixes: ['example.org'],
      deniedHosts: ['blocked.example.org'],
    },
    redirects: { maxHops: 3, revalidateEachHop: true },
    dns: { requireFreshResolutionEachHop: true, blockNonPublicAddressClasses: true, maxResolutionAgeSeconds: 30 },
    limits: { maxResponseBytes: 1_000_000, maxTimeoutMs: 10_000 },
    allowedContentTypes: ['text/html'],
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
      requestId: 'source-request-security-1',
      workspaceId: 'workspace-security-1',
      researchJobId: 'research-job-security-1',
      researchRunId: 'research-run-security-1',
      workUnitId: 'work-unit-security-1',
      sourceTaskId: 'source-task-security-1',
      connectorKey: policy.connectorKey,
      connectorVersion: policy.connectorVersion,
      sourceKey: 'source.company_sites',
      operation: 'fetch',
      executionIntent: 'execute',
      purpose: 'research.website',
      intendedUse: 'business.verification',
      requestedFields: ['business.name'],
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
        maxRequests: 2,
        maxPages: 2,
        maxBytes: 100_000,
        maxCurrencyMicros: 0,
        maxRuntimeMs: 2_000,
        maxConcurrency: 1,
      },
      policySnapshot: policy.sourcePolicySnapshot,
      requestedAt: '2026-09-03T00:00:00.000Z',
    },
    request: {
      version: '1.0.0',
      transportRequestId: 'transport-request-security-1',
      sourceRequestId: 'source-request-security-1',
      sourceTaskId: 'source-task-security-1',
      connectorKey: policy.connectorKey,
      connectorVersion: policy.connectorVersion,
      url: 'https://example.com/business',
      method: 'GET',
      transportKind: 'test',
      redirectHop: 0,
      maxResponseBytes: 50_000,
      timeoutMs: 1_000,
      acceptedContentTypes: ['text/html'],
      requestedAt: '2026-09-03T00:00:00.000Z',
    },
    resolution: {
      transportRequestId: 'transport-request-security-1',
      url: 'https://example.com/business',
      hostname: 'example.com',
      resolvedAt: '2026-09-03T00:00:05.000Z',
      addresses: [{ address: '93.184.216.34', family: 4, classification: 'public' }],
    },
    evaluatedAt: '2026-09-03T00:00:10.000Z',
  };
}

function bindTarget(input: SourceTransportAdmissionInput, url: string, hostname: string): void {
  input.sourceRequest.targetUrl = url;
  input.request.url = url;
  input.resolution.url = url;
  input.resolution.hostname = hostname;
}

describe('source transport SSRF regression boundaries', () => {
  it.each([
    ['https://2130706433/business', '127.0.0.1'],
    ['https://0x7f000001/business', '127.0.0.1'],
  ])('blocks alternate numeric loopback URL form %s after URL canonicalization', (url, hostname) => {
    const input = fixture();
    input.policy = {
      ...input.policy,
      hostPolicy: { mode: 'allowlist', exactHosts: ['127.0.0.1'], domainSuffixes: [], deniedHosts: [] },
    };
    bindTarget(input, url, hostname);
    input.resolution.addresses = [{ address: '127.0.0.1', family: 4, classification: 'loopback' }];

    const decision = evaluateSourceTransportAdmission(input);
    expect(decision.decision).toBe('blocked');
    expect(decision.reasonCodes).toContain('transport_ip_literal_not_allowed');
    expect(decision.reasonCodes).toContain('transport_destination_non_public_address');
  });

  it('blocks a mixed DNS answer when even one resolved address is non-public', () => {
    const input = fixture();
    input.resolution.addresses = [
      { address: '93.184.216.34', family: 4, classification: 'public' },
      { address: '10.0.0.7', family: 4, classification: 'private' },
    ];

    const decision = evaluateSourceTransportAdmission(input);
    expect(decision.decision).toBe('blocked');
    expect(decision.reasonCodes).toContain('transport_destination_non_public_address');
  });

  it('does not confuse an allowlisted suffix with an attacker-controlled superdomain', () => {
    const input = fixture();
    bindTarget(input, 'https://example.org.evil.test/business', 'example.org.evil.test');

    const decision = evaluateSourceTransportAdmission(input);
    expect(decision.decision).toBe('blocked');
    expect(decision.reasonCodes).toContain('transport_host_not_allowed');
  });

  it('applies an explicit deny host to all of its descendants', () => {
    const input = fixture();
    bindTarget(input, 'https://deep.blocked.example.org/business', 'deep.blocked.example.org');

    const decision = evaluateSourceTransportAdmission(input);
    expect(decision.decision).toBe('blocked');
    expect(decision.reasonCodes).toContain('transport_host_not_allowed');
  });

  it('never lets test-only policy authorize a network-kind transport request', () => {
    const input = fixture();
    input.request.transportKind = 'network';

    const decision = evaluateSourceTransportAdmission(input);
    expect(decision.decision).toBe('blocked');
    expect(decision.reasonCodes).toContain('transport_network_test_only');
  });
});
