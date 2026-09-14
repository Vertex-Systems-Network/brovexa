"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceTransportResolutionEvidenceSchema = exports.SourceResolvedAddressEvidenceSchema = void 0;
exports.sourceResolutionAddressKey = sourceResolutionAddressKey;
const node_net_1 = require("node:net");
const node_url_1 = require("node:url");
const zod_1 = require("zod");
const source_transport_address_1 = require("./source-transport-address");
const IdentifierSchema = zod_1.z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const DateTimeSchema = zod_1.z.string().datetime();
const UrlSchema = zod_1.z.string().url().max(2048);
const HostnameSchema = zod_1.z.string().trim().min(1).max(253);
function normalizedHost(value) {
    const host = value.trim().toLowerCase();
    return host.endsWith('.') ? host.slice(0, -1) : host;
}
function sourceResolutionAddressKey(address, family) {
    const normalizedAddress = address.trim().toLowerCase();
    if (normalizedAddress.includes('%') || family === 4 || (0, node_net_1.isIP)(normalizedAddress) !== 6) {
        return `${family}:${normalizedAddress}`;
    }
    try {
        const hostname = new node_url_1.URL(`http://[${normalizedAddress}]/`).hostname.toLowerCase();
        const canonicalIpv6 = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
        return `6:${canonicalIpv6}`;
    }
    catch {
        return `6:${normalizedAddress}`;
    }
}
exports.SourceResolvedAddressEvidenceSchema = zod_1.z
    .object({
    address: zod_1.z.string().trim().min(2).max(64),
    family: zod_1.z.union([zod_1.z.literal(4), zod_1.z.literal(6)]),
    classification: source_transport_address_1.SourceTransportAddressClassSchema,
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
    const detectedFamily = (0, node_net_1.isIP)(evidence.address);
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
exports.SourceTransportResolutionEvidenceSchema = zod_1.z
    .object({
    transportRequestId: IdentifierSchema,
    url: UrlSchema,
    hostname: HostnameSchema,
    resolvedAt: DateTimeSchema,
    addresses: zod_1.z.array(exports.SourceResolvedAddressEvidenceSchema).min(1).max(32),
})
    .superRefine((resolution, ctx) => {
    const parsed = new node_url_1.URL(resolution.url);
    if (normalizedHost(parsed.hostname) !== normalizedHost(resolution.hostname)) {
        ctx.addIssue({
            code: 'custom',
            path: ['hostname'],
            message: 'Resolution hostname must match the canonical URL hostname.',
        });
    }
    const keys = resolution.addresses.map((address) => sourceResolutionAddressKey(address.address, address.family));
    if (new Set(keys).size !== keys.length) {
        ctx.addIssue({
            code: 'custom',
            path: ['addresses'],
            message: 'Resolved address evidence must not contain duplicate addresses.',
        });
    }
});
//# sourceMappingURL=source-resolution-evidence.js.map