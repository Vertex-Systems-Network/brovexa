import { describe, expect, it } from 'vitest';
import { bindSourceAdapterResolution } from './source-adapter-resolution-binding';

const validInput = {
  transportRequestId: 'transport-1',
  canonicalUrl: 'https://example.com/path',
  hostname: 'Example.COM',
  resolvedAt: '2026-09-11T03:00:00.000Z',
  resolvedAddressKeys: ['4:8.8.8.8'],
};

describe('bindSourceAdapterResolution', () => {
  it('normalizes hostname and preserves unique address evidence', () => {
    expect(bindSourceAdapterResolution(validInput)).toEqual({
      version: 1,
      ...validInput,
      hostname: 'example.com',
    });
  });

  it('fails closed for duplicate address evidence', () => {
    expect(() =>
      bindSourceAdapterResolution({
        ...validInput,
        resolvedAddressKeys: ['4:8.8.8.8', '4:8.8.8.8'],
      }),
    ).toThrow('SOURCE_ADAPTER_RESOLUTION_DUPLICATE_ADDRESS');
  });

  it('fails closed for empty resolution sets', () => {
    expect(() => bindSourceAdapterResolution({ ...validInput, resolvedAddressKeys: [] })).toThrow(
      'SOURCE_ADAPTER_RESOLUTION_INVALID_ADDRESS_COUNT',
    );
  });

  it('rejects invalid resolution timestamps', () => {
    expect(() => bindSourceAdapterResolution({ ...validInput, resolvedAt: 'not-a-date' })).toThrow(
      'SOURCE_ADAPTER_RESOLUTION_INVALID_RESOLVED_AT',
    );
  });
});
