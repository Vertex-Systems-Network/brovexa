import { describe, expect, it } from 'vitest';
import { observeSourceTransportRebinding, SourceTransportHopChainSchema } from './source-transport-hop-chain';

function chainFixture() {
  return {
    version: '1.0.0' as const,
    sourceRequestId: 'source.request.1',
    sourceTaskId: 'source.task.1',
    connectorKey: 'connector.company_sites',
    connectorVersion: '1.0.0',
    transportPolicyId: 'transport.policy.1',
    transportPolicyVersion: '1.0.0',
    revalidateEachHop: true as const,
    hops: [
      {
        hopIndex: 0,
        transportRequestId: 'transport.request.0',
        url: 'https://example.com/start',
        requestedAt: '2026-09-03T00:00:00.000Z',
        resolution: {
          transportRequestId: 'transport.request.0',
          url: 'https://example.com/start',
          hostname: 'example.com',
          resolvedAt: '2026-09-03T00:00:01.000Z',
          addresses: [{ address: '93.184.216.34', family: 4 as const, classification: 'public' as const }],
        },
        previousRedirect: null,
      },
      {
        hopIndex: 1,
        transportRequestId: 'transport.request.1',
        url: 'https://example.com/next',
        requestedAt: '2026-09-03T00:00:03.000Z',
        resolution: {
          transportRequestId: 'transport.request.1',
          url: 'https://example.com/next',
          hostname: 'example.com',
          resolvedAt: '2026-09-03T00:00:04.000Z',
          addresses: [{ address: '93.184.216.35', family: 4 as const, classification: 'public' as const }],
        },
        previousRedirect: {
          fromTransportRequestId: 'transport.request.0',
          fromUrl: 'https://example.com/start',
          status: 302,
          location: '/next',
          observedAt: '2026-09-03T00:00:02.000Z',
        },
      },
    ],
  };
}

describe('SourceTransportHopChainSchema', () => {
  it('accepts a contiguous redirect chain with fresh per-hop resolution evidence', () => {
    expect(SourceTransportHopChainSchema.parse(chainFixture()).hops).toHaveLength(2);
  });

  it('requires explicit previous redirect evidence after hop zero', () => {
    const chain = chainFixture();
    chain.hops[1]!.previousRedirect = null;
    expect(() => SourceTransportHopChainSchema.parse(chain)).toThrow(/previous redirect evidence/);
  });

  it('rejects skipped or reordered hop indexes', () => {
    const chain = chainFixture();
    chain.hops[1]!.hopIndex = 2;
    expect(() => SourceTransportHopChainSchema.parse(chain)).toThrow(/contiguous/);
  });

  it('rejects duplicate transport request IDs', () => {
    const chain = chainFixture();
    chain.hops[1]!.transportRequestId = 'transport.request.0';
    chain.hops[1]!.resolution.transportRequestId = 'transport.request.0';
    expect(() => SourceTransportHopChainSchema.parse(chain)).toThrow(/request IDs must be unique/);
  });

  it('binds each resolution to the hop request identity and URL', () => {
    const requestMismatch = chainFixture();
    requestMismatch.hops[1]!.resolution.transportRequestId = 'transport.request.attacker';
    expect(() => SourceTransportHopChainSchema.parse(requestMismatch)).toThrow(/same transport request ID/);

    const urlMismatch = chainFixture();
    urlMismatch.hops[1]!.resolution.url = 'https://evil.example/next';
    urlMismatch.hops[1]!.resolution.hostname = 'evil.example';
    expect(() => SourceTransportHopChainSchema.parse(urlMismatch)).toThrow(/exactly bind/);
  });

  it('requires the previous redirect to resolve exactly to the next hop URL', () => {
    const chain = chainFixture();
    chain.hops[1]!.previousRedirect!.location = 'https://evil.example/next';
    expect(() => SourceTransportHopChainSchema.parse(chain)).toThrow(/resolve exactly to the next hop URL/);
  });

  it('requires newly produced resolution evidence for each redirect hop', () => {
    const chain = chainFixture();
    chain.hops[1]!.requestedAt = '2026-09-03T00:00:01.000Z';
    chain.hops[1]!.resolution.resolvedAt = '2026-09-03T00:00:01.000Z';
    chain.hops[1]!.previousRedirect!.observedAt = '2026-09-03T00:00:01.000Z';
    expect(() => SourceTransportHopChainSchema.parse(chain)).toThrow(/newly produced resolution evidence/);
  });

  it('rejects redirect evidence that predates the previous DNS evidence', () => {
    const chain = chainFixture();
    chain.hops[1]!.previousRedirect!.observedAt = '2026-09-03T00:00:00.500Z';
    expect(() => SourceTransportHopChainSchema.parse(chain)).toThrow(/cannot predate/);
  });
});

describe('observeSourceTransportRebinding', () => {
  it('reports a same-host address-set change without treating it as authorization', () => {
    expect(observeSourceTransportRebinding(chainFixture())).toEqual([
      {
        hopIndex: 1,
        hostname: 'example.com',
        previousAddresses: ['4:93.184.216.34'],
        currentAddresses: ['4:93.184.216.35'],
      },
    ]);
  });

  it('does not report a change when the canonical address set is unchanged', () => {
    const chain = chainFixture();
    chain.hops[1]!.resolution.addresses = [{
      address: '93.184.216.34',
      family: 4,
      classification: 'public',
    }];
    expect(observeSourceTransportRebinding(chain)).toEqual([]);
  });
});
