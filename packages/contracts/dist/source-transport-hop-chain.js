"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceTransportHopChainSchema = exports.SourceTransportHopEvidenceSchema = void 0;
exports.observeSourceTransportRebinding = observeSourceTransportRebinding;
const node_url_1 = require("node:url");
const zod_1 = require("zod");
const source_resolution_evidence_1 = require("./source-resolution-evidence");
const IdentifierSchema = zod_1.z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const VersionSchema = zod_1.z.string().trim().min(1).max(64);
const DateTimeSchema = zod_1.z.string().datetime();
const UrlSchema = zod_1.z.string().url().max(2048);
const SourceTransportRedirectEvidenceSchema = zod_1.z.object({
    fromTransportRequestId: IdentifierSchema,
    fromUrl: UrlSchema,
    status: zod_1.z.number().int().min(300).max(399),
    location: zod_1.z.string().trim().min(1).max(2048),
    observedAt: DateTimeSchema,
});
exports.SourceTransportHopEvidenceSchema = zod_1.z.object({
    hopIndex: zod_1.z.number().int().min(0).max(10),
    transportRequestId: IdentifierSchema,
    url: UrlSchema,
    requestedAt: DateTimeSchema,
    resolution: source_resolution_evidence_1.SourceTransportResolutionEvidenceSchema,
    previousRedirect: SourceTransportRedirectEvidenceSchema.nullable(),
});
exports.SourceTransportHopChainSchema = zod_1.z
    .object({
    version: zod_1.z.literal('1.0.0'),
    sourceRequestId: IdentifierSchema,
    sourceTaskId: IdentifierSchema,
    connectorKey: zod_1.z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    connectorVersion: VersionSchema,
    transportPolicyId: IdentifierSchema,
    transportPolicyVersion: VersionSchema,
    revalidateEachHop: zod_1.z.literal(true),
    hops: zod_1.z.array(exports.SourceTransportHopEvidenceSchema).min(1).max(11),
})
    .superRefine((chain, ctx) => {
    const requestIds = chain.hops.map((hop) => hop.transportRequestId);
    if (new Set(requestIds).size !== requestIds.length) {
        ctx.addIssue({ code: 'custom', path: ['hops'], message: 'Transport hop request IDs must be unique.' });
    }
    for (let index = 0; index < chain.hops.length; index += 1) {
        const hop = chain.hops[index];
        if (!hop)
            continue;
        if (hop.hopIndex !== index) {
            ctx.addIssue({
                code: 'custom',
                path: ['hops', index, 'hopIndex'],
                message: 'Transport hop indexes must be contiguous and start at zero.',
            });
        }
        const requestUrl = new node_url_1.URL(hop.url).href;
        if (hop.resolution.transportRequestId !== hop.transportRequestId) {
            ctx.addIssue({
                code: 'custom',
                path: ['hops', index, 'resolution', 'transportRequestId'],
                message: 'Each hop resolution must bind to the same transport request ID.',
            });
        }
        if (new node_url_1.URL(hop.resolution.url).href !== requestUrl) {
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
        if (new node_url_1.URL(redirect.fromUrl).href !== new node_url_1.URL(previous.url).href) {
            ctx.addIssue({
                code: 'custom',
                path: ['hops', index, 'previousRedirect', 'fromUrl'],
                message: 'Redirect evidence must originate from the immediately previous hop URL.',
            });
        }
        let redirectTarget = null;
        try {
            redirectTarget = new node_url_1.URL(redirect.location, redirect.fromUrl).href;
        }
        catch {
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
function normalizedHostname(resolution) {
    const hostname = new node_url_1.URL(resolution.url).hostname.toLowerCase();
    return hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
}
function canonicalAddressSet(resolution) {
    return resolution.addresses
        .map((address) => (0, source_resolution_evidence_1.sourceResolutionAddressKey)(address.address, address.family))
        .sort((left, right) => left.localeCompare(right));
}
function observeSourceTransportRebinding(rawChain) {
    const chain = exports.SourceTransportHopChainSchema.parse(rawChain);
    const observations = [];
    for (let index = 1; index < chain.hops.length; index += 1) {
        const previous = chain.hops[index - 1];
        const current = chain.hops[index];
        if (!previous || !current)
            continue;
        const previousHostname = normalizedHostname(previous.resolution);
        const currentHostname = normalizedHostname(current.resolution);
        if (previousHostname !== currentHostname)
            continue;
        const previousAddresses = canonicalAddressSet(previous.resolution);
        const currentAddresses = canonicalAddressSet(current.resolution);
        if (previousAddresses.length !== currentAddresses.length ||
            previousAddresses.some((value, addressIndex) => value !== currentAddresses[addressIndex])) {
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
//# sourceMappingURL=source-transport-hop-chain.js.map