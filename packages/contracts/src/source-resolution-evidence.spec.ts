import { describe, expect, it } from 'vitest';
import { SourceTransportResolutionEvidenceSchema } from './source-resolution-evidence';

const base = {
  transportRequestId: 'transport.req.1',
  url: 'https://example.com/path',
  hostname: 'example.com',
  resolvedAt: '2026-09-03T00:00:00.000Z',
};

describe('SourceTransportResolutionEvidenceSchema', () => {
  it('accepts syntactically valid family-bound public address evidence', () => {
    const parsed = SourceTransportResolutionEvidenceSchema.parse({
      ...base,
      addresses: [
        { address: '8.8.8.8', family: 4, classification: 'public' },
        { address: '2606:4700:4700::1111', family: 6, classification: 'public' },
      ],
    });

    expect(parsed.addresses).toHaveLength(2);
  });

  it('rejects non-IP resolution evidence even when it is labelled public', () => {
    expect(() =>
      SourceTransportResolutionEvidenceSchema.parse({
        ...base,
        addresses: [{ address: 'example.com', family: 4, classification: 'public' }],
      }),
    ).toThrow(/syntactically valid IPv4 or IPv6/);
  });

  it('rejects an address whose declared family does not match its syntax', () => {
    expect(() =>
      SourceTransportResolutionEvidenceSchema.parse({
        ...base,
        addresses: [{ address: '127.0.0.1', family: 6, classification: 'loopback' }],
      }),
    ).toThrow(/family must match/);
  });

  it('rejects zone-scoped IPv6 evidence', () => {
    expect(() =>
      SourceTransportResolutionEvidenceSchema.parse({
        ...base,
        addresses: [{ address: 'fe80::1%eth0', family: 6, classification: 'link_local' }],
      }),
    ).toThrow(/Zone-scoped/);
  });

  it('binds the supplied hostname to the canonical URL hostname', () => {
    expect(() =>
      SourceTransportResolutionEvidenceSchema.parse({
        ...base,
        hostname: 'attacker.example',
        addresses: [{ address: '8.8.8.8', family: 4, classification: 'public' }],
      }),
    ).toThrow(/canonical URL hostname/);
  });

  it('rejects duplicate address evidence', () => {
    expect(() =>
      SourceTransportResolutionEvidenceSchema.parse({
        ...base,
        addresses: [
          { address: '8.8.8.8', family: 4, classification: 'public' },
          { address: '8.8.8.8', family: 4, classification: 'public' },
        ],
      }),
    ).toThrow(/duplicate addresses/);
  });

  it('rejects semantically duplicate IPv6 evidence with different textual forms', () => {
    expect(() =>
      SourceTransportResolutionEvidenceSchema.parse({
        ...base,
        addresses: [
          { address: '2001:db8::1', family: 6, classification: 'documentation' },
          { address: '2001:0db8:0:0:0:0:0:1', family: 6, classification: 'documentation' },
        ],
      }),
    ).toThrow(/duplicate addresses/);
  });
});
