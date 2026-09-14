export interface SourceNetworkVerificationCase {
  id: string;
  address: string;
  expectedDecision: 'allow' | 'block';
  expectedClass: string;
}

export const sourceNetworkVerificationMatrix: readonly SourceNetworkVerificationCase[] = [
  { id: 'public-ipv4', address: '8.8.8.8', expectedDecision: 'allow', expectedClass: 'public' },
  { id: 'private-ipv4', address: '10.0.0.1', expectedDecision: 'block', expectedClass: 'private' },
  { id: 'loopback-ipv4', address: '127.0.0.1', expectedDecision: 'block', expectedClass: 'loopback' },
  { id: 'metadata-ipv4', address: '169.254.169.254', expectedDecision: 'block', expectedClass: 'metadata' },
  { id: 'linklocal-ipv6', address: 'fe80::1', expectedDecision: 'block', expectedClass: 'link_local' },
  { id: 'private-ipv6', address: 'fd00::1', expectedDecision: 'block', expectedClass: 'private' },
  { id: 'documentation-ipv6', address: '2001:db8::1', expectedDecision: 'block', expectedClass: 'documentation' },
  { id: 'multicast-ipv6', address: 'ff02::1', expectedDecision: 'block', expectedClass: 'multicast' },
] as const;

export function verificationCaseIdsAreUnique(): boolean {
  const ids = sourceNetworkVerificationMatrix.map((testCase) => testCase.id);
  return new Set(ids).size === ids.length;
}
