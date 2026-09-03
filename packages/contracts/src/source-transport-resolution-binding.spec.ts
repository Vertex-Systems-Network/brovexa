import { describe, expect, it } from 'vitest';
import { SourceTransportResolutionSchema } from './source-transport';

const base = {
  transportRequestId: 'transport.request.binding.1',
  url: 'https://example.com/path',
  hostname: 'example.com',
  resolvedAt: '2026-09-03T00:00:00.000Z',
};

describe('SourceTransportResolutionSchema strict evidence binding', () => {
  it('keeps empty resolution evidence representable so admission can fail closed with a decision code', () => {
    expect(SourceTransportResolutionSchema.safeParse({ ...base, addresses: [] }).success).toBe(true);
  });

  it('rejects malformed, family-mismatched and zone-scoped address evidence', () => {
    expect(
      SourceTransportResolutionSchema.safeParse({
        ...base,
        addresses: [{ address: 'example.com', family: 4, classification: 'public' }],
      }).success,
    ).toBe(false);

    expect(
      SourceTransportResolutionSchema.safeParse({
        ...base,
        addresses: [{ address: '127.0.0.1', family: 6, classification: 'loopback' }],
      }).success,
    ).toBe(false);

    expect(
      SourceTransportResolutionSchema.safeParse({
        ...base,
        addresses: [{ address: 'fe80::1%eth0', family: 6, classification: 'link_local' }],
      }).success,
    ).toBe(false);
  });

  it('binds the declared hostname to the resolution URL hostname', () => {
    expect(
      SourceTransportResolutionSchema.safeParse({
        ...base,
        hostname: 'attacker.example',
        addresses: [{ address: '8.8.8.8', family: 4, classification: 'public' }],
      }).success,
    ).toBe(false);
  });

  it('rejects semantically duplicate IPv6 addresses regardless of textual spelling', () => {
    expect(
      SourceTransportResolutionSchema.safeParse({
        ...base,
        addresses: [
          { address: '2001:db8::1', family: 6, classification: 'documentation' },
          { address: '2001:0db8:0:0:0:0:0:1', family: 6, classification: 'documentation' },
        ],
      }).success,
    ).toBe(false);
  });
});
