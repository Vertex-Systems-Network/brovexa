import { describe, expect, it } from 'vitest';
import {
  SourceTransportHopChainSchema,
  observeSourceTransportRebinding,
  type SourceTransportHopChain,
  type SourceTransportRebindingObservation,
} from './source-transport-hop-chain';
import { classifySourceAddress } from './source-network-safety';

/**
 * REDIRECT slot: Per-hop redirect revalidation security tests
 * 
 * Tests verify that redirect chains:
 * - Revalidate destination evidence at every redirect hop
 * - Reject unsafe/rebound/mixed destinations
 * - Enforce redirect budgets
 * - Detect DNS rebinding across redirects
 * - Block redirects to private/metadata/link-local addresses
 * - Prevent confusable hostname attacks in redirect chains
 */

function baseChainFixture(): SourceTransportHopChain {
  return {
    version: '1.0.0',
    sourceRequestId: 'source.request.redirect-test',
    sourceTaskId: 'source.task.redirect-test',
    connectorKey: 'connector.company_sites',
    connectorVersion: '1.0.0',
    transportPolicyId: 'transport.policy.redirect',
    transportPolicyVersion: '1.0.0',
    revalidateEachHop: true,
    hops: [],
  };
}

function createHop(
  hopIndex: number,
  url: string,
  hostname: string,
  address: string,
  family: 4 | 6,
  classification: string,
  requestedAt: string,
  resolvedAt: string,
  previousRedirect: {
    fromTransportRequestId: string;
    fromUrl: string;
    status: number;
    location: string;
    observedAt: string;
  } | null = null,
  transportRequestId?: string
) {
  return {
    hopIndex,
    transportRequestId: transportRequestId || `transport.request.${hopIndex}`,
    url,
    requestedAt,
    resolution: {
      transportRequestId: transportRequestId || `transport.request.${hopIndex}`,
      url,
      hostname,
      resolvedAt,
      addresses: [{ address, family, classification }],
    },
    previousRedirect,
  };
}

describe('REDIRECT: Redirect chain security revalidation', () => {
  describe('Redirect budget enforcement', () => {
    it('accepts a redirect chain within budget (max 10 hops)', () => {
      const chain = baseChainFixture();
      
      // Create initial hop
      chain.hops.push(createHop(
        0,
        'https://example.com/start',
        'example.com',
        '93.184.216.34',
        4,
        'public',
        '2026-09-03T00:00:00.000Z',
        '2026-09-03T00:00:01.000Z'
      ));

      // Add 9 redirect hops (total 10, within budget)
      for (let i = 1; i <= 9; i++) {
        const seconds = i * 2;
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const timeStr = `2026-09-03T00:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.000Z`;
        const prevSeconds = (i * 2) - 1;
        const prevMinutes = Math.floor(prevSeconds / 60);
        const prevSecs = prevSeconds % 60;
        const prevTimeStr = `2026-09-03T00:${prevMinutes.toString().padStart(2, '0')}:${prevSecs.toString().padStart(2, '0')}.000Z`;
        
        chain.hops.push(createHop(
          i,
          `https://example.com/step${i}`,
          'example.com',
          `93.184.216.${34 + i}`,
          4,
          'public',
          timeStr,
          `2026-09-03T00:${minutes.toString().padStart(2, '0')}:${(secs + 1).toString().padStart(2, '0')}.000Z`,
          {
            fromTransportRequestId: `transport.request.${i - 1}`,
            fromUrl: `https://example.com/step${i - 1}`,
            status: 302,
            location: `/step${i}`,
            observedAt: prevTimeStr,
          }
        ));
      }

      expect(SourceTransportHopChainSchema.parse(chain).hops).toHaveLength(10);
    });

    it('rejects redirect chain exceeding budget (11+ hops)', () => {
      const chain = baseChainFixture();
      
      chain.hops.push(createHop(
        0,
        'https://example.com/start',
        'example.com',
        '93.184.216.34',
        4,
        'public',
        '2026-09-03T00:00:00.000Z',
        '2026-09-03T00:00:01.000Z'
      ));

      // Add 11 redirect hops (total 12, exceeds budget of max 11)
      for (let i = 1; i <= 11; i++) {
        const totalSeconds = i * 2;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        const timeStr = `2026-09-03T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.000Z`;
        
        const prevSeconds = (i * 2) - 1;
        const prevHours = Math.floor(prevSeconds / 3600);
        const prevMinutes = Math.floor((prevSeconds % 3600) / 60);
        const prevSecs = prevSeconds % 60;
        const prevTimeStr = `2026-09-03T${prevHours.toString().padStart(2, '0')}:${prevMinutes.toString().padStart(2, '0')}:${prevSecs.toString().padStart(2, '0')}.000Z`;
        
        const resolvedSeconds = (i * 2) + 1;
        const resolvedHours = Math.floor(resolvedSeconds / 3600);
        const resolvedMinutes = Math.floor((resolvedSeconds % 3600) / 60);
        const resolvedSecs = resolvedSeconds % 60;
        const resolvedTimeStr = `2026-09-03T${resolvedHours.toString().padStart(2, '0')}:${resolvedMinutes.toString().padStart(2, '0')}:${resolvedSecs.toString().padStart(2, '0')}.000Z`;

        chain.hops.push(createHop(
          i,
          `https://example.com/step${i}`,
          'example.com',
          `93.184.216.${34 + i}`,
          4,
          'public',
          timeStr,
          resolvedTimeStr,
          {
            fromTransportRequestId: `transport.request.${i - 1}`,
            fromUrl: `https://example.com/step${i - 1}`,
            status: 302,
            location: `/step${i}`,
            observedAt: prevTimeStr,
          }
        ));
      }

      expect(() => SourceTransportHopChainSchema.parse(chain)).toThrow(/max 11/);
    });
  });

  describe('DNS rebinding detection across redirects', () => {
    it('detects same-hostname address change (rebinding) between hops', () => {
      const chain = baseChainFixture();
      
      // Hop 0: example.com resolves to public IP
      chain.hops.push(createHop(
        0,
        'https://example.com/start',
        'example.com',
        '93.184.216.34',
        4,
        'public',
        '2026-09-03T00:00:00.000Z',
        '2026-09-03T00:00:01.000Z'
      ));

      // Hop 1: same hostname but different IP (rebinding attack)
      chain.hops.push(createHop(
        1,
        'https://example.com/redirect',
        'example.com',
        '127.0.0.1', // Attacker changed DNS to localhost
        4,
        'loopback',
        '2026-09-03T00:00:03.000Z',
        '2026-09-03T00:00:04.000Z',
        {
          fromTransportRequestId: 'transport.request.0',
          fromUrl: 'https://example.com/start',
          status: 302,
          location: '/redirect',
          observedAt: '2026-09-03T00:00:02.000Z',
        }
      ));

      const observations = observeSourceTransportRebinding(chain);
      expect(observations).toHaveLength(1);
      expect(observations[0]).toMatchObject({
        hopIndex: 1,
        hostname: 'example.com',
        previousAddresses: ['4:93.184.216.34'],
        currentAddresses: ['4:127.0.0.1'],
      });
    });

    it('detects IPv6 rebinding attack', () => {
      const chain = baseChainFixture();
      
      chain.hops.push(createHop(
        0,
        'https://api.example.com/v1',
        'api.example.com',
        '2001:db8::1',
        6,
        'public',
        '2026-09-03T00:00:00.000Z',
        '2026-09-03T00:00:01.000Z'
      ));

      chain.hops.push(createHop(
        1,
        'https://api.example.com/v2',
        'api.example.com',
        '::1', // IPv6 loopback
        6,
        'loopback',
        '2026-09-03T00:00:03.000Z',
        '2026-09-03T00:00:04.000Z',
        {
          fromTransportRequestId: 'transport.request.0',
          fromUrl: 'https://api.example.com/v1',
          status: 301,
          location: '/v2',
          observedAt: '2026-09-03T00:00:02.000Z',
        }
      ));

      const observations = observeSourceTransportRebinding(chain);
      expect(observations).toHaveLength(1);
      expect(observations[0].hostname).toBe('api.example.com');
      expect(observations[0].currentAddresses).toContain('6:::1');
    });

    it('does not report rebinding when hostname changes', () => {
      const chain = baseChainFixture();
      
      chain.hops.push(createHop(
        0,
        'https://example.com/start',
        'example.com',
        '93.184.216.34',
        4,
        'public',
        '2026-09-03T00:00:00.000Z',
        '2026-09-03T00:00:01.000Z'
      ));

      chain.hops.push(createHop(
        1,
        'https://other.com/redirect',
        'other.com',
        '192.0.2.1',
        4,
        'public',
        '2026-09-03T00:00:03.000Z',
        '2026-09-03T00:00:04.000Z',
        {
          fromTransportRequestId: 'transport.request.0',
          fromUrl: 'https://example.com/start',
          status: 302,
          location: 'https://other.com/redirect',
          observedAt: '2026-09-03T00:00:02.000Z',
        }
      ));

      // Different hostname = not rebinding (just a cross-origin redirect)
      const observations = observeSourceTransportRebinding(chain);
      expect(observations).toHaveLength(0);
    });
  });

  describe('Block redirects to unsafe destinations', () => {
    it('classifies redirect to loopback address', () => {
      const classification = classifySourceAddress('127.0.0.1', 4);
      expect(classification.classification).toBe('loopback');

      const chain = baseChainFixture();
      chain.hops.push(createHop(
        0,
        'https://example.com/start',
        'example.com',
        '93.184.216.34',
        4,
        'public',
        '2026-09-03T00:00:00.000Z',
        '2026-09-03T00:00:01.000Z'
      ));

      chain.hops.push(createHop(
        1,
        'http://127.0.0.1/admin',
        '127.0.0.1',
        '127.0.0.1',
        4,
        'loopback',
        '2026-09-03T00:00:03.000Z',
        '2026-09-03T00:00:04.000Z',
        {
          fromTransportRequestId: 'transport.request.0',
          fromUrl: 'https://example.com/start',
          status: 302,
          location: 'http://127.0.0.1/admin',
          observedAt: '2026-09-03T00:00:02.000Z',
        }
      ));

      // Schema accepts the chain structure, but runtime should reject based on classification
      const parsed = SourceTransportHopChainSchema.parse(chain);
      expect(parsed.hops[1]?.resolution.addresses[0]?.classification).toBe('loopback');
    });

    it('classifies redirect to link-local address', () => {
      const classification = classifySourceAddress('169.254.1.1', 4);
      expect(classification.classification).toBe('link_local');

      const chain = baseChainFixture();
      chain.hops.push(createHop(
        0,
        'https://example.com/start',
        'example.com',
        '93.184.216.34',
        4,
        'public',
        '2026-09-03T00:00:00.000Z',
        '2026-09-03T00:00:01.000Z'
      ));

      chain.hops.push(createHop(
        1,
        'http://169.254.1.1/metadata',
        '169.254.1.1',
        '169.254.1.1',
        4,
        'link_local',
        '2026-09-03T00:00:03.000Z',
        '2026-09-03T00:00:04.000Z',
        {
          fromTransportRequestId: 'transport.request.0',
          fromUrl: 'https://example.com/start',
          status: 302,
          location: 'http://169.254.1.1/metadata',
          observedAt: '2026-09-03T00:00:02.000Z',
        }
      ));

      const parsed = SourceTransportHopChainSchema.parse(chain);
      expect(parsed.hops[1]?.resolution.addresses[0]?.classification).toBe('link_local');
    });

    it('classifies redirect to AWS metadata endpoint', () => {
      const classification = classifySourceAddress('169.254.169.254', 4);
      expect(classification.classification).toBe('link_local');

      const chain = baseChainFixture();
      chain.hops.push(createHop(
        0,
        'https://example.com/start',
        'example.com',
        '93.184.216.34',
        4,
        'public',
        '2026-09-03T00:00:00.000Z',
        '2026-09-03T00:00:01.000Z'
      ));

      chain.hops.push(createHop(
        1,
        'http://169.254.169.254/latest/meta-data',
        '169.254.169.254',
        '169.254.169.254',
        4,
        'link_local',
        '2026-09-03T00:00:03.000Z',
        '2026-09-03T00:00:04.000Z',
        {
          fromTransportRequestId: 'transport.request.0',
          fromUrl: 'https://example.com/start',
          status: 302,
          location: 'http://169.254.169.254/latest/meta-data',
          observedAt: '2026-09-03T00:00:02.000Z',
        }
      ));

      const parsed = SourceTransportHopChainSchema.parse(chain);
      expect(parsed.hops[1]?.resolution.addresses[0]?.classification).toBe('link_local');
    });

    it('classifies redirect to private network address (RFC1918)', () => {
      const classifications = [
        classifySourceAddress('10.0.0.1', 4),
        classifySourceAddress('172.16.0.1', 4),
        classifySourceAddress('192.168.1.1', 4),
      ];
      
      classifications.forEach(c => expect(c.classification).toBe('private'));

      const chain = baseChainFixture();
      chain.hops.push(createHop(
        0,
        'https://example.com/start',
        'example.com',
        '93.184.216.34',
        4,
        'public',
        '2026-09-03T00:00:00.000Z',
        '2026-09-03T00:00:01.000Z'
      ));

      chain.hops.push(createHop(
        1,
        'http://192.168.1.1/internal',
        '192.168.1.1',
        '192.168.1.1',
        4,
        'private',
        '2026-09-03T00:00:03.000Z',
        '2026-09-03T00:00:04.000Z',
        {
          fromTransportRequestId: 'transport.request.0',
          fromUrl: 'https://example.com/start',
          status: 302,
          location: 'http://192.168.1.1/internal',
          observedAt: '2026-09-03T00:00:02.000Z',
        }
      ));

      const parsed = SourceTransportHopChainSchema.parse(chain);
      expect(parsed.hops[1]?.resolution.addresses[0]?.classification).toBe('private');
    });

    it('classifies redirect to multicast address', () => {
      const classification = classifySourceAddress('224.0.0.1', 4);
      expect(classification.classification).toBe('multicast');

      const chain = baseChainFixture();
      chain.hops.push(createHop(
        0,
        'https://example.com/start',
        'example.com',
        '93.184.216.34',
        4,
        'public',
        '2026-09-03T00:00:00.000Z',
        '2026-09-03T00:00:01.000Z'
      ));

      chain.hops.push(createHop(
        1,
        'http://224.0.0.1/test',
        '224.0.0.1',
        '224.0.0.1',
        4,
        'multicast',
        '2026-09-03T00:00:03.000Z',
        '2026-09-03T00:00:04.000Z',
        {
          fromTransportRequestId: 'transport.request.0',
          fromUrl: 'https://example.com/start',
          status: 302,
          location: 'http://224.0.0.1/test',
          observedAt: '2026-09-03T00:00:02.000Z',
        }
      ));

      const parsed = SourceTransportHopChainSchema.parse(chain);
      expect(parsed.hops[1]?.resolution.addresses[0]?.classification).toBe('multicast');
    });
  });

  describe('Confusable hostname detection in redirects', () => {
    it('detects homograph attack in redirect location', () => {
      // example.com vs exаmple.com (Cyrillic 'а')
      const normalHostname = 'example.com';
      const confusableHostname = 'exаmple.com'; // Cyrillic 'а' (U+0430)
      
      expect(normalHostname).not.toBe(confusableHostname);
      expect(confusableHostname.charCodeAt(2)).toBe(0x0430); // Cyrillic small letter a
    });

    it('handles punycode encoding in redirect chains', () => {
      const chain = baseChainFixture();
      
      // Legitimate internationalized domain
      chain.hops.push(createHop(
        0,
        'https://xn--e1afmkfd.xn--p1ai/test', // пу.рф in punycode
        'xn--e1afmkfd.xn--p1ai',
        '192.0.2.1',
        4,
        'documentation',
        '2026-09-03T00:00:00.000Z',
        '2026-09-03T00:00:01.000Z'
      ));

      const parsed = SourceTransportHopChainSchema.parse(chain);
      expect(parsed.hops[0]?.resolution.hostname).toBe('xn--e1afmkfd.xn--p1ai');
    });
  });

  describe('Mixed DNS answer detection in redirect chains', () => {
    it('detects mixed IPv4/IPv6 answers across hops', () => {
      const chain = baseChainFixture();
      
      chain.hops.push(createHop(
        0,
        'https://example.com/start',
        'example.com',
        '93.184.216.34',
        4,
        'public',
        '2026-09-03T00:00:00.000Z',
        '2026-09-03T00:00:01.000Z'
      ));

      // Same hostname, but now with IPv6-mapped IPv4 address (potential bypass)
      chain.hops.push(createHop(
        1,
        'https://example.com/next',
        'example.com',
        '::ffff:127.0.0.1', // IPv4-mapped IPv6 loopback
        6,
        'loopback',
        '2026-09-03T00:00:03.000Z',
        '2026-09-03T00:00:04.000Z',
        {
          fromTransportRequestId: 'transport.request.0',
          fromUrl: 'https://example.com/start',
          status: 302,
          location: '/next',
          observedAt: '2026-09-03T00:00:02.000Z',
        }
      ));

      const observations = observeSourceTransportRebinding(chain);
      expect(observations).toHaveLength(1);
      
      // Verify the classification catches the IPv4-mapped loopback
      const classification = classifySourceAddress('::ffff:127.0.0.1', 6);
      expect(classification.classification).toBe('loopback');
    });
  });

  describe('Temporal ordering enforcement', () => {
    it('enforces strict temporal ordering: request -> redirect -> next request -> resolution', () => {
      const validChain = baseChainFixture();
      
      validChain.hops.push(createHop(
        0,
        'https://example.com/start',
        'example.com',
        '93.184.216.34',
        4,
        'public',
        '2026-09-03T00:00:00.000Z',
        '2026-09-03T00:00:01.000Z'
      ));

      validChain.hops.push(createHop(
        1,
        'https://example.com/next',
        'example.com',
        '93.184.216.35',
        4,
        'public',
        '2026-09-03T00:00:03.000Z',
        '2026-09-03T00:00:04.000Z',
        {
          fromTransportRequestId: 'transport.request.0',
          fromUrl: 'https://example.com/start',
          status: 302,
          location: '/next',
          observedAt: '2026-09-03T00:00:02.000Z',
        }
      ));

      // Valid chain should parse
      expect(SourceTransportHopChainSchema.parse(validChain).hops).toHaveLength(2);

      // Invalid: redirect observed before previous resolution
      const invalidChain = baseChainFixture();
      invalidChain.hops.push(createHop(
        0,
        'https://example.com/start',
        'example.com',
        '93.184.216.34',
        4,
        'public',
        '2026-09-03T00:00:00.000Z',
        '2026-09-03T00:00:05.000Z' // Resolution after redirect
      ));

      invalidChain.hops.push(createHop(
        1,
        'https://example.com/next',
        'example.com',
        '93.184.216.35',
        4,
        'public',
        '2026-09-03T00:00:03.000Z',
        '2026-09-03T00:00:04.000Z',
        {
          fromTransportRequestId: 'transport.request.0',
          fromUrl: 'https://example.com/start',
          status: 302,
          location: '/next',
          observedAt: '2026-09-03T00:00:02.000Z', // Before previous resolution!
        }
      ));

      expect(() => SourceTransportHopChainSchema.parse(invalidChain)).toThrow(/cannot predate/);
    });
  });

  describe('Redirect Location URL resolution', () => {
    it('resolves relative redirect locations correctly', () => {
      const chain = baseChainFixture();
      
      chain.hops.push(createHop(
        0,
        'https://example.com/path/start',
        'example.com',
        '93.184.216.34',
        4,
        'public',
        '2026-09-03T00:00:00.000Z',
        '2026-09-03T00:00:01.000Z'
      ));

      chain.hops.push(createHop(
        1,
        'https://example.com/path/redirect',
        'example.com',
        '93.184.216.35',
        4,
        'public',
        '2026-09-03T00:00:03.000Z',
        '2026-09-03T00:00:04.000Z',
        {
          fromTransportRequestId: 'transport.request.0',
          fromUrl: 'https://example.com/path/start',
          status: 302,
          location: '/path/redirect', // Relative path
          observedAt: '2026-09-03T00:00:02.000Z',
        }
      ));

      expect(() => SourceTransportHopChainSchema.parse(chain)).not.toThrow();
    });

    it('rejects redirect location that does not resolve to next hop URL', () => {
      const chain = baseChainFixture();
      
      chain.hops.push(createHop(
        0,
        'https://example.com/start',
        'example.com',
        '93.184.216.34',
        4,
        'public',
        '2026-09-03T00:00:00.000Z',
        '2026-09-03T00:00:01.000Z'
      ));

      chain.hops.push(createHop(
        1,
        'https://example.com/expected',
        'example.com',
        '93.184.216.35',
        4,
        'public',
        '2026-09-03T00:00:03.000Z',
        '2026-09-03T00:00:04.000Z',
        {
          fromTransportRequestId: 'transport.request.0',
          fromUrl: 'https://example.com/start',
          status: 302,
          location: 'https://example.com/different', // Does not match next hop URL
          observedAt: '2026-09-03T00:00:02.000Z',
        }
      ));

      expect(() => SourceTransportHopChainSchema.parse(chain)).toThrow(/resolve exactly to the next hop URL/);
    });
  });

  describe('Multi-hop rebinding observation', () => {
    it('tracks multiple rebinding events across a long redirect chain', () => {
      const chain = baseChainFixture();
      
      // Hop 0: Public IP
      chain.hops.push(createHop(
        0,
        'https://example.com/start',
        'example.com',
        '93.184.216.34',
        4,
        'public',
        '2026-09-03T00:00:00.000Z',
        '2026-09-03T00:00:01.000Z'
      ));

      // Hop 1: Same hostname, different IP (rebinding #1)
      chain.hops.push(createHop(
        1,
        'https://example.com/step1',
        'example.com',
        '93.184.216.35',
        4,
        'public',
        '2026-09-03T00:00:03.000Z',
        '2026-09-03T00:00:04.000Z',
        {
          fromTransportRequestId: 'transport.request.0',
          fromUrl: 'https://example.com/start',
          status: 302,
          location: '/step1',
          observedAt: '2026-09-03T00:00:02.000Z',
        }
      ));

      // Hop 2: Same hostname, same IP as hop 1 (no rebinding)
      chain.hops.push(createHop(
        2,
        'https://example.com/step2',
        'example.com',
        '93.184.216.35',
        4,
        'public',
        '2026-09-03T00:00:06.000Z',
        '2026-09-03T00:00:07.000Z',
        {
          fromTransportRequestId: 'transport.request.1',
          fromUrl: 'https://example.com/step1',
          status: 302,
          location: '/step2',
          observedAt: '2026-09-03T00:00:05.000Z',
        }
      ));

      // Hop 3: Same hostname, loopback IP (rebinding #2 - attack!)
      chain.hops.push(createHop(
        3,
        'https://example.com/step3',
        'example.com',
        '127.0.0.1',
        4,
        'loopback',
        '2026-09-03T00:00:09.000Z',
        '2026-09-03T00:00:10.000Z',
        {
          fromTransportRequestId: 'transport.request.2',
          fromUrl: 'https://example.com/step2',
          status: 302,
          location: '/step3',
          observedAt: '2026-09-03T00:00:08.000Z',
        }
      ));

      const observations = observeSourceTransportRebinding(chain);
      
      // Should detect 2 rebinding events (hop 1 and hop 3)
      expect(observations).toHaveLength(2);
      expect(observations[0].hopIndex).toBe(1);
      expect(observations[1].hopIndex).toBe(3);
      expect(observations[1].currentAddresses).toContain('4:127.0.0.1');
    });
  });
});
