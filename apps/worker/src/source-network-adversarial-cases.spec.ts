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

  it('covers unspecified, documentation, reserved, multicast threat classes', () => {
    const threats = new Set(sourceNetworkAdversarialCases.map((testCase) => testCase.threat));
    for (const required of ['unspecified', 'documentation', 'reserved', 'multicast'] as const) {
      expect(threats.has(required)).toBe(true);
    }
  });

  it('includes encoded/alternative representation test cases', () => {
    const threats = new Set(sourceNetworkAdversarialCases.map((testCase) => testCase.threat));
    for (const required of ['encoded_ipv4', 'mixed_case', 'zero_padded'] as const) {
      expect(threats.has(required)).toBe(true);
    }
  });

  it('covers all major cloud metadata endpoints', () => {
    const metadataCases = sourceNetworkAdversarialCases.filter((c) => c.threat === 'metadata');
    expect(metadataCases.length).toBeGreaterThanOrEqual(4);
    const ids = metadataCases.map((c) => c.id);
    expect(ids.some((id) => id.includes('aws'))).toBe(true);
    expect(ids.some((id) => id.includes('ecs') || id.includes('aliyun'))).toBe(true);
    expect(ids.some((id) => id.includes('gcp'))).toBe(true);
  });

  it('covers IPv4 and IPv6 variants for each threat class where applicable', () => {
    const byThreat = new Map<string, typeof sourceNetworkAdversarialCases>();
    for (const tc of sourceNetworkAdversarialCases) {
      if (!byThreat.has(tc.threat)) byThreat.set(tc.threat, []);
      byThreat.get(tc.threat)!.push(tc);
    }

    // Check that private has both v4 and v6
    const privateCases = byThreat.get('private') ?? [];
    const hasV4 = privateCases.some((c) => c.address.includes('.'));
    const hasV6 = privateCases.some((c) => c.address.includes(':'));
    expect(hasV4 && hasV6).toBe(true);

    // Check that loopback has both v4 and v6
    const loopbackCases = byThreat.get('loopback') ?? [];
    const lbHasV4 = loopbackCases.some((c) => c.address.includes('.'));
    const lbHasV6 = loopbackCases.some((c) => c.address.includes(':'));
    expect(lbHasV4 && lbHasV6).toBe(true);

    // Check that link_local has both v4 and v6
    const linkLocalCases = byThreat.get('link_local') ?? [];
    const llHasV4 = linkLocalCases.some((c) => c.address.includes('.'));
    const llHasV6 = linkLocalCases.some((c) => c.address.includes(':'));
    expect(llHasV4 && llHasV6).toBe(true);
  });

  it('has comprehensive range coverage with start and end addresses', () => {
    const privateCases = sourceNetworkAdversarialCases.filter((c) => c.threat === 'private');
    const hasEndAddresses = privateCases.some((c) => c.id.endsWith('-end'));
    expect(hasEndAddresses).toBe(true);

    const multicastCases = sourceNetworkAdversarialCases.filter((c) => c.threat === 'multicast');
    const mcHasEnd = multicastCases.some((c) => c.id.endsWith('-end'));
    expect(mcHasEnd).toBe(true);
  });
});
