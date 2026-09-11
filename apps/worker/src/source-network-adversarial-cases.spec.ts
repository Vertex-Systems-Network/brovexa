import { describe, expect, it } from 'vitest';
import { classifySourceIpAddress } from './source-ip-classifier';
import { adversarialSourceNetworkCaseIdsAreUnique, sourceNetworkAdversarialCases } from './source-network-adversarial-cases';

describe('sourceNetworkAdversarialCases', () => {
  it('keeps adversarial case identifiers unique', () => {
    expect(adversarialSourceNetworkCaseIdsAreUnique()).toBe(true);
  });

  it.each(sourceNetworkAdversarialCases)('$id remains non-public under the canonical classifier', (testCase) => {
    const classification = classifySourceIpAddress(testCase.address).classification;
    expect(classification).not.toBe('public');
    expect(testCase.expectedDecision).toBe('block');
  });

  it('covers metadata, private, loopback, link-local and mapped-private SSRF classes', () => {
    const threats = new Set(sourceNetworkAdversarialCases.map((testCase) => testCase.threat));
    for (const required of ['metadata', 'private', 'loopback', 'link_local', 'mapped_private'] as const) {
      expect(threats.has(required)).toBe(true);
    }
  });
});
