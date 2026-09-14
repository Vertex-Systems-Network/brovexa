export interface SourceNetworkAdversarialCase {
  id: string;
  address: string;
  threat: 'metadata' | 'loopback' | 'private' | 'link_local' | 'multicast' | 'documentation' | 'reserved' | 'mapped_private';
  expectedDecision: 'block';
}

export const sourceNetworkAdversarialCases: readonly SourceNetworkAdversarialCase[] = [
  { id: 'aws-metadata', address: '169.254.169.254', threat: 'metadata', expectedDecision: 'block' },
  { id: 'ecs-metadata', address: '169.254.170.2', threat: 'metadata', expectedDecision: 'block' },
  { id: 'loopback-v4', address: '127.0.0.1', threat: 'loopback', expectedDecision: 'block' },
  { id: 'private-v4-a', address: '10.0.0.1', threat: 'private', expectedDecision: 'block' },
  { id: 'link-local-v4', address: '169.254.1.1', threat: 'link_local', expectedDecision: 'block' },
  { id: 'multicast-v4', address: '224.0.0.1', threat: 'multicast', expectedDecision: 'block' },
  { id: 'documentation-v4', address: '203.0.113.9', threat: 'documentation', expectedDecision: 'block' },
  { id: 'loopback-v6', address: '::1', threat: 'loopback', expectedDecision: 'block' },
  { id: 'private-v6', address: 'fd00::1', threat: 'private', expectedDecision: 'block' },
  { id: 'link-local-v6', address: 'fe80::1', threat: 'link_local', expectedDecision: 'block' },
  { id: 'mapped-private-v6', address: '::ffff:10.0.0.1', threat: 'mapped_private', expectedDecision: 'block' },
  { id: 'reserved-v6', address: '2001::1', threat: 'reserved', expectedDecision: 'block' },
] as const;

export function adversarialSourceNetworkCaseIdsAreUnique(): boolean {
  const ids = sourceNetworkAdversarialCases.map((testCase) => testCase.id);
  return new Set(ids).size === ids.length;
}
