import { describe, expect, it } from 'vitest';
import { classifySourceIpAddress, isPublicSourceIpAddress } from './source-ip-classifier';

describe('classifySourceIpAddress', () => {
  it.each([
    ['8.8.8.8', 4, 'public'],
    ['10.0.0.1', 4, 'private'],
    ['127.0.0.1', 4, 'loopback'],
    ['169.254.1.10', 4, 'link_local'],
    ['169.254.169.254', 4, 'metadata'],
    ['224.0.0.1', 4, 'multicast'],
    ['0.0.0.0', 4, 'unspecified'],
    ['192.0.2.10', 4, 'documentation'],
    ['100.64.0.1', 4, 'reserved'],
    ['2606:4700:4700::1111', 6, 'public'],
    ['fc00::1', 6, 'private'],
    ['::1', 6, 'loopback'],
    ['fe80::1', 6, 'link_local'],
    ['fd00:ec2::254', 6, 'metadata'],
    ['ff02::1', 6, 'multicast'],
    ['::', 6, 'unspecified'],
    ['2001:db8::1', 6, 'documentation'],
    ['100::1', 6, 'reserved'],
    ['2001:0:7f00:1::1', 6, 'reserved'],
    ['2002:7f00:1::1', 6, 'reserved'],
    ['3ffe::1', 6, 'reserved'],
  ] as const)('classifies %s as %s/%s', (address, family, classification) => {
    expect(classifySourceIpAddress(address)).toMatchObject({ family, classification });
  });

  it('inherits the embedded IPv4 safety class for IPv4-mapped IPv6 addresses', () => {
    expect(classifySourceIpAddress('::ffff:127.0.0.1')).toMatchObject({ family: 6, classification: 'loopback' });
    expect(classifySourceIpAddress('::ffff:10.1.2.3')).toMatchObject({ family: 6, classification: 'private' });
    expect(classifySourceIpAddress('::ffff:169.254.169.254')).toMatchObject({ family: 6, classification: 'metadata' });
  });

  it('fails closed for IPv6 transition mechanisms that can encode IPv4 destinations', () => {
    expect(classifySourceIpAddress('2001:0:7f00:1::1')).toMatchObject({ family: 6, classification: 'reserved' });
    expect(classifySourceIpAddress('2002:7f00:1::1')).toMatchObject({ family: 6, classification: 'reserved' });
    expect(isPublicSourceIpAddress('2001:0:7f00:1::1')).toBe(false);
    expect(isPublicSourceIpAddress('2002:7f00:1::1')).toBe(false);
  });

  it('fails closed for malformed and zone-scoped addresses', () => {
    expect(classifySourceIpAddress('not-an-ip')).toMatchObject({ family: 0, classification: 'invalid' });
    expect(classifySourceIpAddress('fe80::1%eth0')).toMatchObject({ family: 0, classification: 'invalid' });
  });

  it('reports public eligibility only for the public class', () => {
    expect(isPublicSourceIpAddress('8.8.8.8')).toBe(true);
    expect(isPublicSourceIpAddress('2606:4700:4700::1111')).toBe(true);
    expect(isPublicSourceIpAddress('127.0.0.1')).toBe(false);
    expect(isPublicSourceIpAddress('::ffff:127.0.0.1')).toBe(false);
  });
});
