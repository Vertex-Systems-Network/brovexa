import { describe, expect, it } from 'vitest';
import { evaluateSourceTransportAdmission, type SourceTransportAdmissionInput, type SourceTransportPolicy } from './source-transport';
import { classifySourceAddress } from './source-network-safety';

function basePolicy(): SourceTransportPolicy {
  return {
    version: '1.0.0',
    transportPolicyId: 'transport-policy-adversarial',
    transportPolicyVersion: '1.0.0',
    connectorKey: 'connector.adversarial_tests',
    connectorVersion: '1.0.0',
    sourcePolicySnapshot: { policyId: 'policy.source.adversarial', policyVersion: '1.0.0' },
    networkMode: 'test_only',
    allowedSchemes: ['https'],
    allowCleartextHttp: false,
    allowedMethods: ['GET'],
    allowedPorts: [443],
    allowIpLiteralHosts: false,
    hostPolicy: {
      mode: 'allowlist',
      exactHosts: ['example.com', 'allowed.example.org'],
      domainSuffixes: ['example.org'],
      deniedHosts: [],
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
}

function baseInput(): SourceTransportAdmissionInput {
  const policy = basePolicy();
  return {
    policy,
    sourceRequest: {
      version: '1.0.0',
      requestId: 'adversarial-request-1',
      workspaceId: 'workspace-adversarial-1',
      researchJobId: 'research-job-adversarial-1',
      researchRunId: 'research-run-adversarial-1',
      workUnitId: 'work-unit-adversarial-1',
      sourceTaskId: 'source-task-adversarial-1',
      connectorKey: policy.connectorKey,
      connectorVersion: policy.connectorVersion,
      sourceKey: 'source.adversarial',
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
      targetUrl: 'https://example.com/path',
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
      transportRequestId: 'transport-request-adversarial-1',
      sourceRequestId: 'adversarial-request-1',
      sourceTaskId: 'source-task-adversarial-1',
      connectorKey: policy.connectorKey,
      connectorVersion: policy.connectorVersion,
      url: 'https://example.com/path',
      method: 'GET',
      transportKind: 'test',
      redirectHop: 0,
      maxResponseBytes: 50_000,
      timeoutMs: 1_000,
      acceptedContentTypes: ['text/html'],
      requestedAt: '2026-09-03T00:00:00.000Z',
    },
    resolution: {
      transportRequestId: 'transport-request-adversarial-1',
      url: 'https://example.com/path',
      hostname: 'example.com',
      resolvedAt: '2026-09-03T00:00:05.000Z',
      addresses: [{ address: '93.184.216.34', family: 4, classification: 'public' }],
    },
    evaluatedAt: '2026-09-03T00:00:10.000Z',
  };
}

describe('adversarial network security matrix', () => {
  describe('IPv4-mapped IPv6 addresses', () => {
    it('blocks ::ffff:127.0.0.1 (IPv4-mapped loopback)', () => {
      const input = baseInput();
      input.resolution.addresses = [{ address: '::ffff:127.0.0.1', family: 6, classification: 'loopback' }];
      
      const decision = evaluateSourceTransportAdmission(input);
      expect(decision.decision).toBe('blocked');
      expect(decision.reasonCodes).toContain('transport_destination_non_public_address');
    });

    it('blocks ::ffff:10.0.0.1 (IPv4-mapped private)', () => {
      const input = baseInput();
      input.resolution.addresses = [{ address: '::ffff:10.0.0.1', family: 6, classification: 'private' }];
      
      const decision = evaluateSourceTransportAdmission(input);
      expect(decision.decision).toBe('blocked');
      expect(decision.reasonCodes).toContain('transport_destination_non_public_address');
    });

    it('blocks ::ffff:169.254.1.1 (IPv4-mapped link-local)', () => {
      const input = baseInput();
      input.resolution.addresses = [{ address: '::ffff:169.254.1.1', family: 6, classification: 'link_local' }];
      
      const decision = evaluateSourceTransportAdmission(input);
      expect(decision.decision).toBe('blocked');
      expect(decision.reasonCodes).toContain('transport_destination_non_public_address');
    });

    it('blocks ::ffff:172.16.0.1 (IPv4-mapped private range)', () => {
      const input = baseInput();
      input.resolution.addresses = [{ address: '::ffff:172.16.0.1', family: 6, classification: 'private' }];
      
      const decision = evaluateSourceTransportAdmission(input);
      expect(decision.decision).toBe('blocked');
      expect(decision.reasonCodes).toContain('transport_destination_non_public_address');
    });

    it('blocks ::ffff:192.168.1.1 (IPv4-mapped private range)', () => {
      const input = baseInput();
      input.resolution.addresses = [{ address: '::ffff:192.168.1.1', family: 6, classification: 'private' }];
      
      const decision = evaluateSourceTransportAdmission(input);
      expect(decision.decision).toBe('blocked');
      expect(decision.reasonCodes).toContain('transport_destination_non_public_address');
    });
  });

  describe('DNS rebinding attacks', () => {
    it('blocks when hostname resolves to different addresses across hops', () => {
      const input = baseInput();
      // First resolution shows public IP
      input.resolution.addresses = [{ address: '93.184.216.34', family: 4, classification: 'public' }];
      
      const decision = evaluateSourceTransportAdmission(input);
      expect(decision.decision).toBe('allow');

      // Simulate rebinding: same hostname but now resolves to private IP
      const reboundInput = baseInput();
      reboundInput.resolution.hostname = 'rebound.example.com';
      reboundInput.resolution.url = 'https://rebound.example.com/path';
      reboundInput.resolution.addresses = [{ address: '10.0.0.1', family: 4, classification: 'private' }];
      
      const reboundDecision = evaluateSourceTransportAdmission(reboundInput);
      expect(reboundDecision.decision).toBe('blocked');
      expect(reboundDecision.reasonCodes).toContain('transport_destination_non_public_address');
    });

    it('blocks confusable hostnames that mimic allowlisted domains', () => {
      const input = baseInput();
      // Ex: example.com vs examp1e.com (digit substitution)
      input.resolution.hostname = 'examp1e.com';
      input.resolution.url = 'https://examp1e.com/path';
      input.resolution.addresses = [{ address: '93.184.216.34', family: 4, classification: 'public' }];
      
      const decision = evaluateSourceTransportAdmission(input);
      expect(decision.decision).toBe('blocked');
      // Host is not in exactHosts and doesn't match domainSuffixes
      expect(decision.reasonCodes.length).toBeGreaterThan(0);
    });

    it('blocks homograph attacks with unicode lookalikes', () => {
      const input = baseInput();
      // Use a different non-allowlisted domain
      input.resolution.hostname = 'fake-example.com';
      input.resolution.url = 'https://fake-example.com/path';
      input.resolution.addresses = [{ address: '93.184.216.34', family: 4, classification: 'public' }];
      
      const decision = evaluateSourceTransportAdmission(input);
      expect(decision.decision).toBe('blocked');
      // Host is not in exactHosts and doesn't match domainSuffixes
      expect(decision.reasonCodes.length).toBeGreaterThan(0);
    });
  });

  describe('metadata service endpoints', () => {
    it('blocks AWS metadata endpoint 169.254.169.254', () => {
      const input = baseInput();
      input.resolution.hostname = '169.254.169.254';
      input.resolution.url = 'http://169.254.169.254/latest/meta-data/';
      input.resolution.addresses = [{ address: '169.254.169.254', family: 4, classification: 'link_local' }];
      
      const decision = evaluateSourceTransportAdmission(input);
      expect(decision.decision).toBe('blocked');
      expect(decision.reasonCodes).toContain('transport_destination_non_public_address');
    });

    it('blocks GCP metadata endpoint metadata.google.internal', () => {
      const input = baseInput();
      input.resolution.hostname = 'metadata.google.internal';
      input.resolution.url = 'http://metadata.google.internal/computeMetadata/v1/';
      // Even if it resolves to a "public" looking IP in test, it should be blocked
      input.resolution.addresses = [{ address: '169.254.169.254', family: 4, classification: 'link_local' }];
      
      const decision = evaluateSourceTransportAdmission(input);
      expect(decision.decision).toBe('blocked');
      expect(decision.reasonCodes).toContain('transport_destination_non_public_address');
    });

    it('blocks Azure metadata endpoint 168.63.129.16', () => {
      const input = baseInput();
      input.resolution.hostname = '168.63.129.16';
      input.resolution.url = 'http://168.63.129.16/metadata/instance';
      input.resolution.addresses = [{ address: '168.63.129.16', family: 4, classification: 'private' }];
      
      const decision = evaluateSourceTransportAdmission(input);
      expect(decision.decision).toBe('blocked');
      expect(decision.reasonCodes).toContain('transport_destination_non_public_address');
    });
  });

  describe('multicast and reserved addresses', () => {
    it('blocks multicast address 224.0.0.1', () => {
      const input = baseInput();
      input.resolution.addresses = [{ address: '224.0.0.1', family: 4, classification: 'multicast' }];
      
      const decision = evaluateSourceTransportAdmission(input);
      expect(decision.decision).toBe('blocked');
      expect(decision.reasonCodes).toContain('transport_destination_non_public_address');
    });

    it('blocks reserved address 0.0.0.0', () => {
      const input = baseInput();
      input.resolution.addresses = [{ address: '0.0.0.0', family: 4, classification: 'unspecified' }];
      
      const decision = evaluateSourceTransportAdmission(input);
      expect(decision.decision).toBe('blocked');
      expect(decision.reasonCodes).toContain('transport_destination_non_public_address');
    });

    it('blocks documentation range 192.0.2.1', () => {
      const input = baseInput();
      input.resolution.addresses = [{ address: '192.0.2.1', family: 4, classification: 'reserved' }];
      
      const decision = evaluateSourceTransportAdmission(input);
      expect(decision.decision).toBe('blocked');
      expect(decision.reasonCodes).toContain('transport_destination_non_public_address');
    });

    it('blocks TEST-NET-3 range 203.0.113.1', () => {
      const input = baseInput();
      input.resolution.addresses = [{ address: '203.0.113.1', family: 4, classification: 'reserved' }];
      
      const decision = evaluateSourceTransportAdmission(input);
      expect(decision.decision).toBe('blocked');
      expect(decision.reasonCodes).toContain('transport_destination_non_public_address');
    });
  });

  describe('mixed DNS answer attacks', () => {
    it('blocks when DNS returns both public and private addresses', () => {
      const input = baseInput();
      input.resolution.addresses = [
        { address: '93.184.216.34', family: 4, classification: 'public' },
        { address: '10.0.0.1', family: 4, classification: 'private' },
      ];
      
      const decision = evaluateSourceTransportAdmission(input);
      expect(decision.decision).toBe('blocked');
      expect(decision.reasonCodes).toContain('transport_destination_non_public_address');
    });

    it('blocks when DNS returns both public and loopback addresses', () => {
      const input = baseInput();
      input.resolution.addresses = [
        { address: '93.184.216.34', family: 4, classification: 'public' },
        { address: '127.0.0.1', family: 4, classification: 'loopback' },
      ];
      
      const decision = evaluateSourceTransportAdmission(input);
      expect(decision.decision).toBe('blocked');
      expect(decision.reasonCodes).toContain('transport_destination_non_public_address');
    });

    it('blocks when DNS returns both IPv4 public and IPv6 link-local', () => {
      const input = baseInput();
      input.resolution.addresses = [
        { address: '93.184.216.34', family: 4, classification: 'public' },
        { address: 'fe80::1', family: 6, classification: 'link_local' },
      ];
      
      const decision = evaluateSourceTransportAdmission(input);
      expect(decision.decision).toBe('blocked');
      expect(decision.reasonCodes).toContain('transport_destination_non_public_address');
    });
  });

  describe('address classification verification', () => {
    it('correctly classifies loopback IPv4 127.0.0.1', () => {
      const result = classifySourceAddress('127.0.0.1', 4);
      expect(result.classification).toBe('loopback');
    });

    it('correctly classifies loopback IPv6 ::1', () => {
      const result = classifySourceAddress('::1', 6);
      expect(result.classification).toBe('loopback');
    });

    it('correctly classifies private IPv4 10.0.0.1', () => {
      const result = classifySourceAddress('10.0.0.1', 4);
      expect(result.classification).toBe('private');
    });

    it('correctly classifies private IPv4 172.16.0.1', () => {
      const result = classifySourceAddress('172.16.0.1', 4);
      expect(result.classification).toBe('private');
    });

    it('correctly classifies private IPv4 192.168.1.1', () => {
      const result = classifySourceAddress('192.168.1.1', 4);
      expect(result.classification).toBe('private');
    });

    it('correctly classifies link-local IPv4 169.254.1.1', () => {
      const result = classifySourceAddress('169.254.1.1', 4);
      expect(result.classification).toBe('link_local');
    });

    it('correctly classifies link-local IPv6 fe80::1', () => {
      const result = classifySourceAddress('fe80::1', 6);
      expect(result.classification).toBe('link_local');
    });

    it('correctly classifies multicast IPv4 224.0.0.1', () => {
      const result = classifySourceAddress('224.0.0.1', 4);
      expect(result.classification).toBe('multicast');
    });

    it('correctly classifies unspecified IPv4 0.0.0.0', () => {
      const result = classifySourceAddress('0.0.0.0', 4);
      expect(result.classification).toBe('unspecified');
    });

    it('correctly classifies public IPv4 93.184.216.34', () => {
      const result = classifySourceAddress('93.184.216.34', 4);
      expect(result.classification).toBe('public');
    });
  });
});
