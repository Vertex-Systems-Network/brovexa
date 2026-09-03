import { URL } from 'node:url';
import { z } from 'zod';
import {
  SourceTransportResolutionEvidenceSchema,
  sourceResolutionAddressKey,
  type SourceTransportResolutionEvidence,
} from './source-resolution-evidence';

const IdentifierSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const VersionSchema = z.string().trim().min(1).max(64);
const DateTimeSchema = z.string().datetime();
const UrlSchema = z.string().url().max(2048);

const SourceTransportRedirectEvidenceSchema = z.object({
  fromTransportRequestId: IdentifierSchema,
  fromUrl: UrlSchema,
  status: z.number().int().min(300).max(399),
  location: z.string().trim().min(1).max(2048),
  observedAt: DateTimeSchema,
});
export type SourceTransportRedirectEvidence = z.infer<typeof SourceTransportRedirectEvidenceSchema>;

export const SourceTransportHopEvidenceSchema = z.object({
  hopIndex: z.number().int().min(0).max(10),
  transportRequestId: IdentifierSchema,
  url: UrlSchema,
  requestedAt: DateTimeSchema,
  resolution: SourceTransportResolutionEvidenceSchema,
  previousRedirect: SourceTransportRedirectEvidenceSchema.nullable(),
});
export type SourceTransportHopEvidence = z.infer<typeof SourceTransportHopEvidenceSchema>;

export const SourceTransportHopChainSchema = z
  .object({
    version: z.literal('1.0.0'),
    sourceRequestId: IdentifierSchema,
    sourceTaskId: IdentifierSchema,
    connectorKey: z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    connectorVersion: VersionSchema,
    transportPolicyId: IdentifierSchema,
    transportPolicyVersion: VersionSchema,
    revalidateEachHop: z.literal(true),
    hops: z.array(SourceTransportHopEvidenceSchema).min(1).max(11),
  })
  .superRefine((chain, ctx) => {
    const requestIds = chain.hops.map((hop) => hop.transportRequestId);
    if (new Set(requestIds).size !== requestIds.length) {
      ctx.addIssue({ code: 'custom', path: ['hops'], message: 'Transport hop request IDs must be unique.' });
    }

    for (let index = 0; index < chain.hops.length; index += 1) {
      const hop = chain.hops[index];
      if (!hop) continue;

      if (hop.hopIndex !== index) {
        ctx.addIssue({
          code: 'custom',
          path: ['hops', index, 'hopIndex'],
          message: 'Transport hop indexes must be contiguous and start at zero.',
        });
      }

      const requestUrl = new URL(hop.url).href;
      if (hop.resolution.transportRequestId !== hop.transportRequestId) {
        ctx.addIssue({
          code: 'custom',
          path: ['hops', index, 'resolution', 'transportRequestId'],
          message: 'Each hop resolution must bind to the same transport request ID.',
        });
      }
      if (new URL(hop.resolution.url).href !== requestUrl) {
        ctx.addIssue({
          code: 'custom',
          path: ['hops', index, 'resolution', 'url'],
          message: 'Each hop resolution URL must exactly bind to the hop request URL.',
        });
      }
      if (Date.parse(hop.resolution.resolvedAt) < Date.parse(hop.requestedAt)) {
        ctx.addIssue({
          code: 'custom',
          path: ['hops', index, 'resolution', 'resolvedAt'],
          message: 'Each hop requires fresh resolution evidence produced at or after its request timestamp.',
        });
      }

      if (index === 0) {
        if (hop.previousRedirect !== null) {
          ctx.addIssue({
            code: 'custom',
            path: ['hops', index, 'previousRedirect'],
            message: 'The initial transport hop must not declare previous redirect evidence.',
          });
        }
        continue;
      }

      const previous = chain.hops[index - 1];
      const redirect = hop.previousRedirect;
      if (!previous || !redirect) {
        ctx.addIssue({
          code: 'custom',
          path: ['hops', index, 'previousRedirect'],
          message: 'Every redirect hop after zero must bind explicit previous redirect evidence.',
        });
        continue;
      }

      if (redirect.fromTransportRequestId !== previous.transportRequestId) {
        ctx.addIssue({
          code: 'custom',
          path: ['hops', index, 'previousRedirect', 'fromTransportRequestId'],
          message: 'Redirect evidence must originate from the immediately previous transport request.',
        });
      }
      if (new URL(redirect.fromUrl).href !== new URL(previous.url).href) {
        ctx.addIssue({
          code: 'custom',
          path: ['hops', index, 'previousRedirect', 'fromUrl'],
          message: 'Redirect evidence must originate from the immediately previous hop URL.',
        });
      }

      let redirectTarget: string | null = null;
      try {
        redirectTarget = new URL(redirect.location, redirect.fromUrl).href;
      } catch {
        ctx.addIssue({
          code: 'custom',
          path: ['hops', index, 'previousRedirect', 'location'],
          message: 'Redirect Location must resolve to a canonical absolute URL.',
        });
      }
      if (redirectTarget !== null && redirectTarget !== requestUrl) {
        ctx.addIssue({
          code: 'custom',
          path: ['hops', index, 'url'],
          message: 'Redirect Location must resolve exactly to the next hop URL before revalidation.',
        });
      }

      if (Date.parse(redirect.observedAt) < Date.parse(previous.resolution.resolvedAt)) {
        ctx.addIssue({
          code: 'custom',
          path: ['hops', index, 'previousRedirect', 'observedAt'],
          message: 'Redirect evidence cannot predate the previous hop resolution.',
        });
      }
      if (Date.parse(hop.requestedAt) < Date.parse(redirect.observedAt)) {
        ctx.addIssue({
          code: 'custom',
          path: ['hops', index, 'requestedAt'],
          message: 'A redirect hop request cannot predate the redirect that produced it.',
        });
      }
      if (Date.parse(hop.resolution.resolvedAt) <= Date.parse(previous.resolution.resolvedAt)) {
        ctx.addIssue({
          code: 'custom',
          path: ['hops', index, 'resolution', 'resolvedAt'],
          message: 'Every redirect hop must carry newly produced resolution evidence.',
        });
      }
    }
  });
export type SourceTransportHopChain = z.infer<typeof SourceTransportHopChainSchema>;

export interface SourceTransportRebindingObservation {
  hopIndex: number;
  hostname: string;
  previousAddresses: string[];
  currentAddresses: string[];
}

function normalizedHostname(resolution: SourceTransportResolutionEvidence): string {
  const hostname = new URL(resolution.url).hostname.toLowerCase();
  return hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
}

function canonicalAddressSet(resolution: SourceTransportResolutionEvidence): string[] {
  return resolution.addresses
    .map((address) => sourceResolutionAddressKey(address.address, address.family))
    .sort((left, right) => left.localeCompare(right));
}

export function observeSourceTransportRebinding(rawChain: SourceTransportHopChain): SourceTransportRebindingObservation[] {
  const chain = SourceTransportHopChainSchema.parse(rawChain);
  const observations: SourceTransportRebindingObservation[] = [];

  for (let index = 1; index < chain.hops.length; index += 1) {
    const previous = chain.hops[index - 1];
    const current = chain.hops[index];
    if (!previous || !current) continue;

    const previousHostname = normalizedHostname(previous.resolution);
    const currentHostname = normalizedHostname(current.resolution);
    if (previousHostname !== currentHostname) continue;

    const previousAddresses = canonicalAddressSet(previous.resolution);
    const currentAddresses = canonicalAddressSet(current.resolution);
    if (
      previousAddresses.length !== currentAddresses.length ||
      previousAddresses.some((value, addressIndex) => value !== currentAddresses[addressIndex])
    ) {
      observations.push({
        hopIndex: current.hopIndex,
        hostname: currentHostname,
        previousAddresses,
        currentAddresses,
      });
    }
  }

  return observations;
}
