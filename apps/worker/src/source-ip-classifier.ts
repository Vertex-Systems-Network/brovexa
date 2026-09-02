import { isIP } from 'node:net';

export type SourceIpAddressClass =
  | 'public'
  | 'private'
  | 'loopback'
  | 'link_local'
  | 'metadata'
  | 'multicast'
  | 'unspecified'
  | 'documentation'
  | 'reserved'
  | 'invalid';

export interface SourceIpClassification {
  address: string;
  family: 0 | 4 | 6;
  classification: SourceIpAddressClass;
}

function ipv4ToNumber(address: string): number {
  return address.split('.').reduce((value, octet) => ((value << 8) | Number.parseInt(octet, 10)) >>> 0, 0) >>> 0;
}

function ipv4InCidr(value: number, network: string, prefix: number): boolean {
  const base = ipv4ToNumber(network);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (base & mask);
}

function classifyIpv4(address: string): SourceIpAddressClass {
  const value = ipv4ToNumber(address);

  if (address === '0.0.0.0') return 'unspecified';
  if (ipv4InCidr(value, '127.0.0.0', 8)) return 'loopback';
  if (address === '169.254.169.254' || address === '169.254.170.2' || address === '100.100.100.200') {
    return 'metadata';
  }
  if (
    ipv4InCidr(value, '10.0.0.0', 8) ||
    ipv4InCidr(value, '172.16.0.0', 12) ||
    ipv4InCidr(value, '192.168.0.0', 16)
  ) {
    return 'private';
  }
  if (ipv4InCidr(value, '169.254.0.0', 16)) return 'link_local';
  if (ipv4InCidr(value, '224.0.0.0', 4)) return 'multicast';
  if (
    ipv4InCidr(value, '192.0.2.0', 24) ||
    ipv4InCidr(value, '198.51.100.0', 24) ||
    ipv4InCidr(value, '203.0.113.0', 24)
  ) {
    return 'documentation';
  }
  if (
    ipv4InCidr(value, '0.0.0.0', 8) ||
    ipv4InCidr(value, '100.64.0.0', 10) ||
    ipv4InCidr(value, '192.0.0.0', 24) ||
    ipv4InCidr(value, '192.88.99.0', 24) ||
    ipv4InCidr(value, '198.18.0.0', 15) ||
    ipv4InCidr(value, '240.0.0.0', 4)
  ) {
    return 'reserved';
  }

  return 'public';
}

function expandEmbeddedIpv4(address: string): string {
  if (!address.includes('.')) return address;
  const lastColon = address.lastIndexOf(':');
  const ipv4 = address.slice(lastColon + 1);
  const value = ipv4ToNumber(ipv4);
  const high = ((value >>> 16) & 0xffff).toString(16);
  const low = (value & 0xffff).toString(16);
  return `${address.slice(0, lastColon + 1)}${high}:${low}`;
}

function ipv6ToBigInt(address: string): bigint {
  const expandedAddress = expandEmbeddedIpv4(address.toLowerCase());
  const halves = expandedAddress.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = halves.length === 2 ? 8 - left.length - right.length : 0;
  const groups = halves.length === 2 ? [...left, ...Array.from({ length: missing }, () => '0'), ...right] : left;

  return groups.reduce((value, group) => (value << 16n) | BigInt(Number.parseInt(group, 16)), 0n);
}

function ipv6InCidr(value: bigint, network: string, prefix: number): boolean {
  const base = ipv6ToBigInt(network);
  if (prefix === 0) return true;
  const shift = 128n - BigInt(prefix);
  return value >> shift === base >> shift;
}

function embeddedIpv4FromIpv6(value: bigint): string {
  const v4 = Number(value & 0xffffffffn) >>> 0;
  return `${(v4 >>> 24) & 0xff}.${(v4 >>> 16) & 0xff}.${(v4 >>> 8) & 0xff}.${v4 & 0xff}`;
}

function classifyIpv6(address: string): SourceIpAddressClass {
  const value = ipv6ToBigInt(address);

  if (value === 0n) return 'unspecified';
  if (value === 1n) return 'loopback';
  if (value === ipv6ToBigInt('fd00:ec2::254')) return 'metadata';

  if (ipv6InCidr(value, '::ffff:0:0', 96)) {
    return classifyIpv4(embeddedIpv4FromIpv6(value));
  }

  if (ipv6InCidr(value, 'fc00::', 7)) return 'private';
  if (ipv6InCidr(value, 'fe80::', 10)) return 'link_local';
  if (ipv6InCidr(value, 'ff00::', 8)) return 'multicast';
  if (ipv6InCidr(value, '2001:db8::', 32)) return 'documentation';

  if (
    ipv6InCidr(value, '100::', 64) ||
    ipv6InCidr(value, '2001:2::', 48) ||
    ipv6InCidr(value, '2001:10::', 28) ||
    ipv6InCidr(value, '2001:20::', 28) ||
    ipv6InCidr(value, '3fff::', 20)
  ) {
    return 'reserved';
  }

  return ipv6InCidr(value, '2000::', 3) ? 'public' : 'reserved';
}

export function classifySourceIpAddress(rawAddress: string): SourceIpClassification {
  const address = rawAddress.trim().toLowerCase();
  if (address.includes('%')) return { address, family: 0, classification: 'invalid' };

  const family = isIP(address);
  if (family === 4) return { address, family: 4, classification: classifyIpv4(address) };
  if (family === 6) return { address, family: 6, classification: classifyIpv6(address) };
  return { address, family: 0, classification: 'invalid' };
}

export function isPublicSourceIpAddress(address: string): boolean {
  return classifySourceIpAddress(address).classification === 'public';
}
