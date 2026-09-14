import { describe, expect, it } from 'vitest';
import { decideSourceNetworkSafety } from './source-network-safety';

describe('decideSourceNetworkSafety', () => {
  it('fails closed when resolution returns no addresses', () => {
    expect(decideSourceNetworkSafety([])).toEqual({
      decision: 'block',
      code: 'NO_RESOLVED_ADDRESSES',
      observedClasses: [],
    });
  });

  it('blocks the entire resolution set when any address is non-public', () => {
    expect(decideSourceNetworkSafety(['public', 'private'])).toMatchObject({
      decision: 'block',
      code: 'NON_PUBLIC_ADDRESS_PRESENT',
    });
  });

  it('allows only an all-public non-empty resolution set', () => {
    expect(decideSourceNetworkSafety(['public', 'public'])).toMatchObject({
      decision: 'allow',
      code: 'ALL_ADDRESSES_PUBLIC',
    });
  });

  it('does not mutate the caller address-class array', () => {
    const classes = ['public', 'metadata'] as const;
    const snapshot = [...classes];
    decideSourceNetworkSafety(classes);
    expect(classes).toEqual(snapshot);
  });
});
