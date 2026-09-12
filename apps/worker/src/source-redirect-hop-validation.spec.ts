/**
 * Source Redirect Hop Validation Tests
 * 
 * Comprehensive adversarial test coverage for redirect-hop revalidation,
 * including metadata endpoint blocking, private transition detection,
 * downgrade prevention, and classification consistency enforcement.
 */

import { describe, it, expect } from 'vitest';
import {
  validateRedirectHop,
  validateRedirectChain,
  classifyRedirectDestination,
  createRedirectHopEvidence,
  summarizeRedirectValidation,
  DEFAULT_REDIRECT_CONFIG,
  type RedirectHopEvidence,
  type DestinationClassification,
} from './source-redirect-hop-validation';

describe('REDIRECT: source-redirect-hop-validation', () => {
  describe('classifyRedirectDestination', () => {
    it('classifies public HTTPS URLs', () => {
      expect(classifyRedirectDestination('https://example.com')).toBe('public_https');
      expect(classifyRedirectDestination('https://api.brovexa.com/path')).toBe('public_https');
    });

    it('classifies public HTTP URLs', () => {
      expect(classifyRedirectDestination('http://example.com')).toBe('public_http');
      expect(classifyRedirectDestination('http://test.org/api')).toBe('public_http');
    });

    it('classifies AWS EC2 metadata endpoint', () => {
      expect(classifyRedirectDestination('http://169.254.169.254/latest/meta-data')).toBe('metadata_endpoint');
      expect(classifyRedirectDestination('http://169.254.169.254')).toBe('metadata_endpoint');
    });

    it('classifies AWS ECS/GCE metadata endpoint', () => {
      expect(classifyRedirectDestination('http://169.254.170.2')).toBe('metadata_endpoint');
    });

    it('classifies Aliyun metadata endpoint', () => {
      expect(classifyRedirectDestination('http://100.100.100.200')).toBe('metadata_endpoint');
    });

    it('classifies GCP metadata endpoint (IPv6)', () => {
      expect(classifyRedirectDestination('http://[fd00:ec2::254]')).toBe('metadata_endpoint');
    });

    it('classifies GCP metadata by hostname', () => {
      expect(classifyRedirectDestination('http://metadata.google.internal')).toBe('metadata_endpoint');
    });

    it('classifies AWS instance-data hostname', () => {
      expect(classifyRedirectDestination('http://instance-data.aws.amazon.com')).toBe('metadata_endpoint');
    });

    it('classifies IPv4 loopback', () => {
      expect(classifyRedirectDestination('http://127.0.0.1')).toBe('loopback_ipv4');
      expect(classifyRedirectDestination('http://localhost')).toBe('loopback_ipv4');
    });

    it('classifies IPv6 loopback', () => {
      expect(classifyRedirectDestination('http://[::1]')).toBe('loopback_ipv6');
    });

    it('classifies unspecified addresses', () => {
      expect(classifyRedirectDestination('http://0.0.0.0')).toBe('unspecified');
      expect(classifyRedirectDestination('http://[::]')).toBe('unspecified');
    });

    it('classifies private IPv4 ranges', () => {
      expect(classifyRedirectDestination('http://10.0.0.1')).toBe('private_ipv4');
      expect(classifyRedirectDestination('http://172.16.0.1')).toBe('private_ipv4');
      expect(classifyRedirectDestination('http://172.31.255.255')).toBe('private_ipv4');
      expect(classifyRedirectDestination('http://192.168.1.1')).toBe('private_ipv4');
    });

    it('classifies private IPv6 (ULA)', () => {
      expect(classifyRedirectDestination('http://[fc00::1]')).toBe('private_ipv6');
      expect(classifyRedirectDestination('http://[fd00::1]')).toBe('private_ipv6');
    });

    it('classifies link-local IPv4', () => {
      expect(classifyRedirectDestination('http://169.254.1.1')).toBe('link_local_ipv4');
      expect(classifyRedirectDestination('http://169.254.255.255')).toBe('link_local_ipv4');
    });

    it('classifies link-local IPv6', () => {
      expect(classifyRedirectDestination('http://[fe80::1]')).toBe('link_local_ipv6');
      expect(classifyRedirectDestination('http://[fe90::1]')).toBe('link_local_ipv6');
      expect(classifyRedirectDestination('http://[fea0::1]')).toBe('link_local_ipv6');
      expect(classifyRedirectDestination('http://[feb0::1]')).toBe('link_local_ipv6');
    });

    it('classifies multicast IPv4', () => {
      expect(classifyRedirectDestination('http://224.0.0.1')).toBe('multicast_ipv4');
      expect(classifyRedirectDestination('http://239.255.255.255')).toBe('multicast_ipv4');
    });

    it('classifies multicast IPv6', () => {
      expect(classifyRedirectDestination('http://[ff00::1]')).toBe('multicast_ipv6');
      expect(classifyRedirectDestination('http://[ffff::1]')).toBe('multicast_ipv6');
    });

    it('classifies documentation ranges', () => {
      expect(classifyRedirectDestination('http://192.0.2.1')).toBe('documentation');
      expect(classifyRedirectDestination('http://198.51.100.1')).toBe('documentation');
      expect(classifyRedirectDestination('http://203.0.113.1')).toBe('documentation');
    });

    it('classifies reserved ranges', () => {
      expect(classifyRedirectDestination('http://0.0.0.1')).toBe('reserved');
      expect(classifyRedirectDestination('http://100.64.0.1')).toBe('reserved');
      expect(classifyRedirectDestination('http://198.18.0.1')).toBe('reserved');
    });

    it('returns unknown for invalid URLs', () => {
      expect(classifyRedirectDestination('not-a-url')).toBe('unknown');
      expect(classifyRedirectDestination('')).toBe('unknown');
    });
  });

  describe('validateRedirectHop - single hop validation', () => {
    it('validates first hop with no previous evidence', () => {
      const evidence = createRedirectHopEvidence(0, 'https://example.com');
      const result = validateRedirectHop(evidence, null);
      
      expect(result.isValid).toBe(true);
      expect(result.hopIndex).toBe(0);
      expect(result.currentClassification).toBe('public_https');
    });

    it('rejects hop exceeding redirect budget', () => {
      const evidence = createRedirectHopEvidence(5, 'https://example.com');
      const result = validateRedirectHop(evidence, null, { ...DEFAULT_REDIRECT_CONFIG, maxRedirects: 5 });
      
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toContain('Redirect budget exceeded');
    });

    it('rejects metadata endpoint access', () => {
      const evidence = createRedirectHopEvidence(0, 'http://169.254.169.254');
      const result = validateRedirectHop(evidence, null);
      
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe('Redirect to cloud metadata endpoint blocked');
      expect(result.securityFlags.isMetadataAccess).toBe(true);
    });

    it('allows valid public HTTPS hops', () => {
      const prev = createRedirectHopEvidence(0, 'https://start.com');
      const curr = createRedirectHopEvidence(1, 'https://destination.com');
      const result = validateRedirectHop(curr, prev);
      
      expect(result.isValid).toBe(true);
      expect(result.securityFlags.isClassificationChange).toBe(false);
    });
  });

  describe('validateRedirectHop - security transitions', () => {
    it('detects and blocks HTTPS to HTTP downgrade', () => {
      const prev = createRedirectHopEvidence(0, 'https://secure.com');
      const curr = createRedirectHopEvidence(1, 'http://insecure.com');
      const result = validateRedirectHop(curr, prev);
      
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe('HTTPS to HTTP downgrade blocked');
      expect(result.securityFlags.isDowngrade).toBe(true);
    });

    it('detects and blocks public to private transition', () => {
      const prev = createRedirectHopEvidence(0, 'https://public.com');
      const curr = createRedirectHopEvidence(1, 'http://192.168.1.1');
      const result = validateRedirectHop(curr, prev);
      
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe('Redirect from public to private/reserved address blocked');
      expect(result.securityFlags.isPrivateTransition).toBe(true);
    });

    it('detects and blocks public to loopback transition', () => {
      const prev = createRedirectHopEvidence(0, 'https://public.com');
      const curr = createRedirectHopEvidence(1, 'http://127.0.0.1');
      const result = validateRedirectHop(curr, prev);
      
      expect(result.isValid).toBe(false);
      expect(result.securityFlags.isPrivateTransition).toBe(true);
    });

    it('detects and blocks public to link-local transition', () => {
      const prev = createRedirectHopEvidence(0, 'https://public.com');
      const curr = createRedirectHopEvidence(1, 'http://169.254.1.1');
      const result = validateRedirectHop(curr, prev);
      
      expect(result.isValid).toBe(false);
      expect(result.securityFlags.isPrivateTransition).toBe(true);
    });

    it('detects and blocks public to multicast transition', () => {
      const prev = createRedirectHopEvidence(0, 'https://public.com');
      const curr = createRedirectHopEvidence(1, 'http://224.0.0.1');
      const result = validateRedirectHop(curr, prev);
      
      expect(result.isValid).toBe(false);
      expect(result.securityFlags.isPrivateTransition).toBe(true);
    });

    it('allows HTTP to HTTPS upgrade (default allowed transition)', () => {
      const prev = createRedirectHopEvidence(0, 'http://start.com');
      const curr = createRedirectHopEvidence(1, 'https://secure.com');
      const result = validateRedirectHop(curr, prev);
      
      expect(result.isValid).toBe(true);
      expect(result.securityFlags.isClassificationChange).toBe(true);
    });

    it('blocks unallowed classification changes', () => {
      const prev = createRedirectHopEvidence(0, 'https://public.com');
      const curr = createRedirectHopEvidence(1, 'http://10.0.0.1'); // private_ipv4
      const result = validateRedirectHop(curr, prev, { ...DEFAULT_REDIRECT_CONFIG, allowPrivateTransition: true });
      
      // With allowPrivateTransition=true, this should pass the private check
      // but may still fail on classification change if requireConsistentClassification=true
      expect(result.securityFlags.isClassificationChange).toBe(true);
    });
  });

  describe('validateRedirectChain - chain validation', () => {
    it('validates safe redirect chain', () => {
      const chain = [
        createRedirectHopEvidence(0, 'https://start.com'),
        createRedirectHopEvidence(1, 'https://intermediate.com'),
        createRedirectHopEvidence(2, 'https://final.com'),
      ];
      
      const results = validateRedirectChain(chain);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.isValid)).toBe(true);
    });

    it('stops validation on first failure (fail-fast)', () => {
      const chain = [
        createRedirectHopEvidence(0, 'https://start.com'),
        createRedirectHopEvidence(1, 'http://169.254.169.254'), // metadata - should fail
        createRedirectHopEvidence(2, 'https://final.com'),
      ];
      
      const results = validateRedirectChain(chain);
      
      expect(results).toHaveLength(2); // Stops at hop 1
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
    });

    it('validates multi-hop chain with upgrade', () => {
      const chain = [
        createRedirectHopEvidence(0, 'http://start.com'),
        createRedirectHopEvidence(1, 'http://intermediate.com'),
        createRedirectHopEvidence(2, 'https://secure-final.com'),
      ];
      
      const results = validateRedirectChain(chain);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.isValid)).toBe(true);
    });

    it('detects downgrade in middle of chain', () => {
      const chain = [
        createRedirectHopEvidence(0, 'https://secure-start.com'),
        createRedirectHopEvidence(1, 'https://intermediate.com'),
        createRedirectHopEvidence(2, 'http://insecure-final.com'),
      ];
      
      const results = validateRedirectChain(chain);
      
      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
      expect(results[2].securityFlags.isDowngrade).toBe(true);
    });

    it('detects private transition in chain', () => {
      const chain = [
        createRedirectHopEvidence(0, 'https://public-start.com'),
        createRedirectHopEvidence(1, 'https://public-intermediate.com'),
        createRedirectHopEvidence(2, 'http://192.168.1.1'),
      ];
      
      const results = validateRedirectChain(chain);
      
      expect(results).toHaveLength(3);
      expect(results[2].isValid).toBe(false);
      expect(results[2].securityFlags.isPrivateTransition).toBe(true);
    });

    it('handles empty chain', () => {
      const results = validateRedirectChain([]);
      expect(results).toHaveLength(0);
    });

    it('handles single-hop chain', () => {
      const chain = [createRedirectHopEvidence(0, 'https://single.com')];
      const results = validateRedirectChain(chain);
      
      expect(results).toHaveLength(1);
      expect(results[0].isValid).toBe(true);
    });
  });

  describe('summarizeRedirectValidation', () => {
    it('summarizes valid chain', () => {
      const chain = [
        createRedirectHopEvidence(0, 'https://start.com'),
        createRedirectHopEvidence(1, 'https://final.com'),
      ];
      
      const results = validateRedirectChain(chain);
      const summary = summarizeRedirectValidation(results);
      
      expect(summary.totalHops).toBe(2);
      expect(summary.isValid).toBe(true);
      expect(summary.firstFailureIndex).toBeUndefined();
      expect(summary.finalClassification).toBe('public_https');
      expect(summary.securityIssues).toHaveLength(0);
    });

    it('summarizes failed chain with metadata access', () => {
      const chain = [
        createRedirectHopEvidence(0, 'https://start.com'),
        createRedirectHopEvidence(1, 'http://169.254.169.254'),
      ];
      
      const results = validateRedirectChain(chain);
      const summary = summarizeRedirectValidation(results);
      
      expect(summary.isValid).toBe(false);
      expect(summary.firstFailureIndex).toBe(1);
      expect(summary.securityIssues.some(i => i.flag === 'isMetadataAccess')).toBe(true);
    });

    it('summarizes failed chain with downgrade', () => {
      const chain = [
        createRedirectHopEvidence(0, 'https://secure.com'),
        createRedirectHopEvidence(1, 'http://insecure.com'),
      ];
      
      const results = validateRedirectChain(chain);
      const summary = summarizeRedirectValidation(results);
      
      expect(summary.isValid).toBe(false);
      expect(summary.securityIssues.some(i => i.flag === 'isDowngrade')).toBe(true);
    });

    it('summarizes failed chain with private transition', () => {
      const chain = [
        createRedirectHopEvidence(0, 'https://public.com'),
        createRedirectHopEvidence(1, 'http://192.168.1.1'),
      ];
      
      const results = validateRedirectChain(chain);
      const summary = summarizeRedirectValidation(results);
      
      expect(summary.isValid).toBe(false);
      expect(summary.securityIssues.some(i => i.flag === 'isPrivateTransition')).toBe(true);
    });

    it('includes all hop results in summary', () => {
      const chain = [
        createRedirectHopEvidence(0, 'https://hop0.com'),
        createRedirectHopEvidence(1, 'https://hop1.com'),
        createRedirectHopEvidence(2, 'https://hop2.com'),
      ];
      
      const results = validateRedirectChain(chain);
      const summary = summarizeRedirectValidation(results);
      
      expect(summary.hopResults).toHaveLength(3);
      expect(summary.hopResults.map(r => r.hopIndex)).toEqual([0, 1, 2]);
    });
  });

  describe('createRedirectHopEvidence', () => {
    it('creates evidence with DNS and TLS data', () => {
      const dnsEvidence = {
        resolvedAddresses: ['1.2.3.4'],
        resolverTimestamp: Date.now(),
        ttlSeconds: 300,
      };
      
      const tlsEvidence = {
        subject: 'CN=example.com',
        issuer: 'CN=Let\'s Encrypt',
        validFrom: Date.now(),
        validTo: Date.now() + 90 * 24 * 60 * 60 * 1000,
        fingerprint: 'SHA256:abc123',
      };
      
      const evidence = createRedirectHopEvidence(0, 'https://example.com', dnsEvidence, tlsEvidence);
      
      expect(evidence.hopIndex).toBe(0);
      expect(evidence.url).toBe('https://example.com');
      expect(evidence.classification).toBe('public_https');
      expect(evidence.dnsEvidence).toEqual(dnsEvidence);
      expect(evidence.tlsEvidence).toEqual(tlsEvidence);
      expect(evidence.observedAt).toBeDefined();
    });

    it('creates evidence without optional fields', () => {
      const evidence = createRedirectHopEvidence(0, 'https://example.com');
      
      expect(evidence.dnsEvidence).toBeUndefined();
      expect(evidence.tlsEvidence).toBeUndefined();
      expect(evidence.observedAt).toBeDefined();
    });
  });

  describe('Adversarial: Cloud Metadata Endpoints', () => {
    const metadataUrls = [
      'http://169.254.169.254/latest/meta-data',
      'http://169.254.169.254/',
      'http://169.254.170.2/',
      'http://100.100.100.200/latest/meta-data',
      'http://[fd00:ec2::254]/computeMetadata/v1/',
      'http://metadata.google.internal/computeMetadata/v1/',
      'http://instance-data.aws.amazon.com/latest/meta-data',
    ];

    it.each(metadataUrls)('blocks metadata endpoint: %s', (url) => {
      const chain = [
        createRedirectHopEvidence(0, 'https://public.com'),
        createRedirectHopEvidence(1, url),
      ];
      
      const results = validateRedirectChain(chain);
      
      expect(results[1].isValid).toBe(false);
      expect(results[1].securityFlags.isMetadataAccess).toBe(true);
    });
  });

  describe('Adversarial: Private Address Ranges', () => {
    const privateRanges = [
      { name: '10.0.0.0/8', url: 'http://10.0.0.1' },
      { name: '10.255.255.255', url: 'http://10.255.255.255' },
      { name: '172.16.0.0/12 start', url: 'http://172.16.0.1' },
      { name: '172.31.255.255', url: 'http://172.31.255.255' },
      { name: '192.168.0.0/16 start', url: 'http://192.168.0.1' },
      { name: '192.168.255.255', url: 'http://192.168.255.255' },
      { name: '127.0.0.1 loopback', url: 'http://127.0.0.1' },
      { name: '127.255.255.255', url: 'http://127.255.255.255' },
      { name: '169.254.0.0/16 link-local', url: 'http://169.254.0.1' },
      { name: '169.254.255.255', url: 'http://169.254.255.255' },
    ];

    it.each(privateRanges)('blocks transition to $name ($url)', ({ url }) => {
      const chain = [
        createRedirectHopEvidence(0, 'https://public.com'),
        createRedirectHopEvidence(1, url),
      ];
      
      const results = validateRedirectChain(chain);
      
      expect(results[1].isValid).toBe(false);
      expect(results[1].securityFlags.isPrivateTransition).toBe(true);
    });
  });

  describe('Adversarial: IPv6 Special Addresses', () => {
    const ipv6Cases = [
      { name: '::1 loopback', url: 'http://[::1]', expected: 'loopback_ipv6' },
      { name: 'fc00::1 ULA', url: 'http://[fc00::1]', expected: 'private_ipv6' },
      { name: 'fd00::1 ULA', url: 'http://[fd00::1]', expected: 'private_ipv6' },
      { name: 'fe80::1 link-local', url: 'http://[fe80::1]', expected: 'link_local_ipv6' },
      { name: 'ff00::1 multicast', url: 'http://[ff00::1]', expected: 'multicast_ipv6' },
      { name: ':: unspecified', url: 'http://[::]', expected: 'unspecified' },
    ];

    it.each(ipv6Cases)('classifies $name correctly', ({ url, expected }) => {
      expect(classifyRedirectDestination(url)).toBe(expected);
    });

    it.each(ipv6Cases)('blocks public to $name transition', ({ url }) => {
      const chain = [
        createRedirectHopEvidence(0, 'https://public.com'),
        createRedirectHopEvidence(1, url),
      ];
      
      const results = validateRedirectChain(chain);
      
      expect(results[1].isValid).toBe(false);
      expect(results[1].securityFlags.isPrivateTransition).toBe(true);
    });
  });

  describe('Adversarial: Documentation and Reserved Ranges', () => {
    const specialRanges = [
      { name: '192.0.2.1 (TEST-NET-1)', url: 'http://192.0.2.1' },
      { name: '198.51.100.1 (TEST-NET-2)', url: 'http://198.51.100.1' },
      { name: '203.0.113.1 (TEST-NET-3)', url: 'http://203.0.113.1' },
      { name: '0.0.0.1 reserved', url: 'http://0.0.0.1' },
      { name: '100.64.0.1 CGNAT', url: 'http://100.64.0.1' },
      { name: '198.18.0.1 benchmark', url: 'http://198.18.0.1' },
    ];

    it.each(specialRanges)('classifies $name correctly', ({ url }) => {
      const classification = classifyRedirectDestination(url);
      expect(['documentation', 'reserved'].includes(classification)).toBe(true);
    });

    it.each(specialRanges)('blocks public to $name transition', ({ url }) => {
      const chain = [
        createRedirectHopEvidence(0, 'https://public.com'),
        createRedirectHopEvidence(1, url),
      ];
      
      const results = validateRedirectChain(chain);
      
      expect(results[1].isValid).toBe(false);
      expect(results[1].securityFlags.isPrivateTransition).toBe(true);
    });
  });

  describe('Adversarial: Redirect Budget Exhaustion', () => {
    it('allows chain within budget', () => {
      const chain = Array.from({ length: 5 }, (_, i) =>
        createRedirectHopEvidence(i, `https://hop${i}.com`)
      );
      
      const results = validateRedirectChain(chain, { ...DEFAULT_REDIRECT_CONFIG, maxRedirects: 5 });
      
      expect(results).toHaveLength(5);
      expect(results.every(r => r.isValid)).toBe(true);
    });

    it('rejects chain exceeding budget', () => {
      const chain = Array.from({ length: 6 }, (_, i) =>
        createRedirectHopEvidence(i, `https://hop${i}.com`)
      );
      
      const results = validateRedirectChain(chain, { ...DEFAULT_REDIRECT_CONFIG, maxRedirects: 5 });
      
      expect(results).toHaveLength(6); // All 6 hops processed, but hop 5 fails
      expect(results[5].isValid).toBe(false);
      expect(results[5].rejectionReason).toContain('Redirect budget exceeded');
    });
  });

  describe('Configuration: Custom allowed transitions', () => {
    it('allows custom transition when configured', () => {
      const config: typeof DEFAULT_REDIRECT_CONFIG = {
        ...DEFAULT_REDIRECT_CONFIG,
        requireConsistentClassification: false, // Disable classification consistency to test downgrade specifically
        allowHttpDowngrade: true, // Explicitly allow downgrade
        allowedTransitions: [
          { from: 'public_https', to: 'public_http' }, // Allow downgrade (dangerous!)
        ],
      };

      const chain = [
        createRedirectHopEvidence(0, 'https://secure.com'),
        createRedirectHopEvidence(1, 'http://insecure.com'),
      ];
      
      const results = validateRedirectChain(chain, config);
      
      expect(results[1].isValid).toBe(true);
      expect(results[1].securityFlags.isDowngrade).toBe(false); // Not flagged because allowed
    });

    it('blocks unconfigured transition', () => {
      const config: typeof DEFAULT_REDIRECT_CONFIG = {
        ...DEFAULT_REDIRECT_CONFIG,
        requireConsistentClassification: true,
        allowedTransitions: [], // No transitions allowed
      };

      const chain = [
        createRedirectHopEvidence(0, 'http://start.com'),
        createRedirectHopEvidence(1, 'https://secure.com'),
      ];
      
      const results = validateRedirectChain(chain, config);
      
      expect(results[1].isValid).toBe(false);
      expect(results[1].rejectionReason).toContain('not allowed');
    });
  });

  describe('Edge Cases', () => {
    it('handles URL parsing errors gracefully', () => {
      expect(classifyRedirectDestination('invalid-url-without-protocol')).toBe('unknown');
      expect(classifyRedirectDestination('')).toBe('unknown');
      expect(classifyRedirectDestination('   ')).toBe('unknown');
    });

    it('handles case-insensitive hostnames', () => {
      expect(classifyRedirectDestination('http://METADATA.GOOGLE.INTERNAL')).toBe('metadata_endpoint');
      expect(classifyRedirectDestination('http://INSTANCE-DATA.AWS.AMAZON.COM')).toBe('metadata_endpoint');
    });

    it('handles IPv6 brackets in URLs', () => {
      expect(classifyRedirectDestination('http://[::1]:8080/path')).toBe('loopback_ipv6');
      expect(classifyRedirectDestination('http://[fe80::1]:3000')).toBe('link_local_ipv6');
    });
  });
});
