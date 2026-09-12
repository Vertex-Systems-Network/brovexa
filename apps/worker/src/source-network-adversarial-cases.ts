export interface SourceNetworkAdversarialCase {
  id: string;
  address: string;
  threat: 'metadata' | 'loopback' | 'private' | 'link_local' | 'multicast' | 'documentation' | 'reserved' | 'mapped_private' | 'unspecified' | 'encoded_ipv4' | 'mixed_case' | 'zero_padded';
  expectedDecision: 'block';
}

export const sourceNetworkAdversarialCases: readonly SourceNetworkAdversarialCase[] = [
  // Metadata services
  { id: 'aws-metadata', address: '169.254.169.254', threat: 'metadata', expectedDecision: 'block' },
  { id: 'ecs-metadata', address: '169.254.170.2', threat: 'metadata', expectedDecision: 'block' },
  { id: 'aliyun-metadata', address: '100.100.100.200', threat: 'metadata', expectedDecision: 'block' },
  { id: 'gcp-metadata', address: 'fd00:ec2::254', threat: 'metadata', expectedDecision: 'block' },
  
  // Loopback addresses
  { id: 'loopback-v4', address: '127.0.0.1', threat: 'loopback', expectedDecision: 'block' },
  { id: 'loopback-v4-range', address: '127.255.255.255', threat: 'loopback', expectedDecision: 'block' },
  { id: 'loopback-v6', address: '::1', threat: 'loopback', expectedDecision: 'block' },
  
  // Private IPv4 ranges
  { id: 'private-v4-a', address: '10.0.0.1', threat: 'private', expectedDecision: 'block' },
  { id: 'private-v4-a-end', address: '10.255.255.255', threat: 'private', expectedDecision: 'block' },
  { id: 'private-v4-b', address: '172.16.0.1', threat: 'private', expectedDecision: 'block' },
  { id: 'private-v4-b-end', address: '172.31.255.255', threat: 'private', expectedDecision: 'block' },
  { id: 'private-v4-c', address: '192.168.0.1', threat: 'private', expectedDecision: 'block' },
  { id: 'private-v4-c-end', address: '192.168.255.255', threat: 'private', expectedDecision: 'block' },
  
  // Private IPv6 ranges
  { id: 'private-v6', address: 'fd00::1', threat: 'private', expectedDecision: 'block' },
  { id: 'private-v6-end', address: 'fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', threat: 'private', expectedDecision: 'block' },
  
  // Link-local addresses
  { id: 'link-local-v4', address: '169.254.1.1', threat: 'link_local', expectedDecision: 'block' },
  { id: 'link-local-v4-end', address: '169.254.255.255', threat: 'link_local', expectedDecision: 'block' },
  { id: 'link-local-v6', address: 'fe80::1', threat: 'link_local', expectedDecision: 'block' },
  
  // Multicast addresses
  { id: 'multicast-v4', address: '224.0.0.1', threat: 'multicast', expectedDecision: 'block' },
  { id: 'multicast-v4-end', address: '239.255.255.255', threat: 'multicast', expectedDecision: 'block' },
  { id: 'multicast-v6', address: 'ff00::1', threat: 'multicast', expectedDecision: 'block' },
  
  // Documentation ranges (should be blocked in production)
  { id: 'documentation-v4-1', address: '192.0.2.9', threat: 'documentation', expectedDecision: 'block' },
  { id: 'documentation-v4-2', address: '198.51.100.9', threat: 'documentation', expectedDecision: 'block' },
  { id: 'documentation-v4-3', address: '203.0.113.9', threat: 'documentation', expectedDecision: 'block' },
  { id: 'documentation-v6', address: '2001:db8::1', threat: 'documentation', expectedDecision: 'block' },
  
  // Reserved/special ranges
  { id: 'reserved-v4-carrier', address: '100.64.0.1', threat: 'reserved', expectedDecision: 'block' },
  { id: 'reserved-v4-test', address: '198.18.0.1', threat: 'reserved', expectedDecision: 'block' },
  { id: 'reserved-v4-future', address: '240.0.0.1', threat: 'reserved', expectedDecision: 'block' },
  { id: 'reserved-v6-unique', address: '100::1', threat: 'reserved', expectedDecision: 'block' },
  { id: 'reserved-v6-deprecated', address: '2001:10::1', threat: 'reserved', expectedDecision: 'block' },
  { id: 'reserved-v6-ipv4-mapped', address: '2002::1', threat: 'reserved', expectedDecision: 'block' },
  
  // Unspecified addresses
  { id: 'unspecified-v4', address: '0.0.0.0', threat: 'unspecified', expectedDecision: 'block' },
  { id: 'unspecified-v6', address: '::', threat: 'unspecified', expectedDecision: 'block' },
  
  // IPv4-mapped IPv6 addresses (attack vector for bypass)
  { id: 'mapped-private-v6', address: '::ffff:10.0.0.1', threat: 'mapped_private', expectedDecision: 'block' },
  { id: 'mapped-loopback-v6', address: '::ffff:127.0.0.1', threat: 'mapped_private', expectedDecision: 'block' },
  { id: 'mapped-linklocal-v6', address: '::ffff:169.254.1.1', threat: 'mapped_private', expectedDecision: 'block' },
  
  // Encoded/alternative representations
  { id: 'encoded-ipv4-dotted-hex', address: '0x7f.0x00.0x00.0x01', threat: 'encoded_ipv4', expectedDecision: 'block' },
  { id: 'encoded-ipv4-dotted-octal', address: '0177.0000.0000.0001', threat: 'encoded_ipv4', expectedDecision: 'block' },
  { id: 'encoded-ipv4-dword', address: '2130706433', threat: 'encoded_ipv4', expectedDecision: 'block' },
  
  // Mixed case IPv6
  { id: 'mixed-case-v6', address: 'FD00:EC2::254', threat: 'mixed_case', expectedDecision: 'block' },
  
  // Zero-padded IPv4
  { id: 'zero-padded-v4', address: '127.000.000.001', threat: 'zero_padded', expectedDecision: 'block' },
] as const;

export function adversarialSourceNetworkCaseIdsAreUnique(): boolean {
  const ids = sourceNetworkAdversarialCases.map((testCase) => testCase.id);
  return new Set(ids).size === ids.length;
}
