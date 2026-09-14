import { describe, expect, it } from 'vitest';
import { evaluateSourceNetworkResolution } from './source-network-resolution-policy';

describe('evaluateSourceNetworkResolution', () => {
  it('fails closed when no resolved addresses exist', () => {
    expect(evaluateSourceNetworkResolution([])).toEqual({
      decision: 'block',
      reason: 'NO_ADDRESSES',
      classifications: [],
    });
  });

  it('blocks duplicate answers instead of silently deduplicating', () => {
    expect(evaluateSourceNetworkResolution(['8.8.8.8', '8.8.8.8'])).toMatchObject({
      decision: 'block',
      reason: 'DUPLICATE_ADDRESS',
    });
  });

  it('blocks a mixed public/private answer set', () => {
    expect(evaluateSourceNetworkResolution(['8.8.8.8', '10.0.0.1'])).toMatchObject({
      decision: 'block',
      reason: 'NON_PUBLIC_OR_INVALID_ADDRESS',
    });
  });

  it('blocks IPv4-mapped private IPv6 answers', () => {
    expect(evaluateSourceNetworkResolution(['::ffff:10.0.0.1'])).toMatchObject({
      decision: 'block',
      reason: 'NON_PUBLIC_OR_INVALID_ADDRESS',
    });
  });

  it('allows only a non-empty all-public answer set', () => {
    expect(evaluateSourceNetworkResolution(['8.8.8.8', '2606:4700:4700::1111'])).toMatchObject({
      decision: 'allow',
      reason: 'ALL_PUBLIC',
    });
  });
});
