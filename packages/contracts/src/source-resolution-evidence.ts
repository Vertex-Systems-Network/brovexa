import { isIP } from 'node:net';
import { URL } from 'node:url';
import { z } from 'zod';
import { SourceTransportAddressClassSchema } from './source-transport';

const IdentifierSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const DateTimeSchema = z.string().datetime();
const UrlSchema = z.string().url().max(2048);
const HostnameSchema = z.string().trim().min(1).max(253);

function normalizedHost(value: string): string {
  const host = value.trim().toLowerCase();
  return host.endsWith('.') ? host.slice(0, -1) : host;
}

function canonicalAddressKey(address: string, family: 4 | 6): string {
  const normalizedAddress = address.trim().toLowerCase();
  if (normalizedAddress.includes('%') || family === 4 || isIP(normalizedAddress) !== 6) {
    return `${family}:${normalizedAddress}`;
  }

  try {
    const hostname = new URL(`http://[${normalizedAddress}]/`).hostname.toLowerCase();
    const canonicalIpv6 = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
    return `6:${canonicalIpv6}`;
  } catch {
    return `6:${normalizedAddress}`;
  }
}

export const SourceResolvedAddressEvidenceSchema = z
  .object({
    address: z.string().trim().min(2).max(64),
    family: z.union([z.literal(4), z.literal(6)]),
    classification: SourceTransportAddressClassSchema,
  })
  .superRefine((evidence, ctx) => {
    if (evidence.address.includes('%')) {
      ctx.addIssue({
        code: 'custom',
        path: ['address'],
        message: 'Zone-scoped IP addresses are not valid portable resolution evidence.',
      });
      return;
    }

    const detectedFamily = isIP(evidence.address);
    if (detectedFamily === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['address'],
        message: 'Resolved address evidence must contain a syntactically valid IPv4 or IPv6 address.',
      });
      return;
    }

    if (detectedFamily !== evidence.family) {
      ctx.addIssue({
        code: 'custom',
        path: ['family'],
        message: 'Resolved address family must match the actual IP address family.',
      });
    }
  });
export type SourceResolvedAddressEvidence = z.infer<typeof SourceResolvedAddressEvidenceSchema>;

export const SourceTransportResolutionEvidenceSchema = z
  .object({
    transportRequestId: IdentifierSchema,
    url: UrlSchema,
    hostname: HostnameSchema,
    resolvedAt: DateTimeSchema,
    addresses: z.array(SourceResolvedAddressEvidenceSchema).min(1).max(32),
  })
  .superRefine((resolution, ctx) => {
    const parsed = new URL(resolution.url);
    if (normalizedHost(parsed.hostname) !== normalizedHost(resolution.hostname)) {
      ctx.addIssue({
        code: 'custom',
        path: ['hostname'],
        message: 'Resolution hostname must match the canonical URL hostname.',
      });
    }

    const keys = resolution.addresses.map((address) => canonicalAddressKey(address.address, address.family));
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['addresses'],
        message: 'Resolved address evidence must not contain duplicate addresses.',
      });
    }
  });
export type SourceTransportResolutionEvidence = z.infer<typeof SourceTransportResolutionEvidenceSchema>;
