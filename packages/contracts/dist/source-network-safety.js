"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decideSourceNetworkSafety = decideSourceNetworkSafety;
exports.classifySourceAddress = classifySourceAddress;
function decideSourceNetworkSafety(addressClasses) {
    const observedClasses = [...addressClasses];
    if (observedClasses.length === 0) {
        return {
            decision: 'block',
            code: 'NO_RESOLVED_ADDRESSES',
            observedClasses,
        };
    }
    if (observedClasses.some((classification) => classification !== 'public')) {
        return {
            decision: 'block',
            code: 'NON_PUBLIC_ADDRESS_PRESENT',
            observedClasses,
        };
    }
    return {
        decision: 'allow',
        code: 'ALL_ADDRESSES_PUBLIC',
        observedClasses,
    };
}
/**
 * Classify an IP address into its network safety class.
 * Supports both IPv4 and IPv6 addresses.
 */
function classifySourceAddress(address, family) {
    const normalized = address.toLowerCase();
    // IPv4 classifications
    if (family === 4) {
        const parts = normalized.split('.');
        if (parts.length !== 4) {
            return { classification: 'invalid' };
        }
        const octets = parts.map((p) => parseInt(p, 10));
        if (octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) {
            return { classification: 'invalid' };
        }
        const [a, b, c, d] = octets;
        // Unspecified: 0.0.0.0
        if (a === 0 && b === 0 && c === 0 && d === 0) {
            return { classification: 'unspecified' };
        }
        // Loopback: 127.0.0.0/8
        if (a === 127) {
            return { classification: 'loopback' };
        }
        // Private: 10.0.0.0/8
        if (a === 10) {
            return { classification: 'private' };
        }
        // Private: 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
        if (a === 172 && b !== undefined && b >= 16 && b <= 31) {
            return { classification: 'private' };
        }
        // Private: 192.168.0.0/16
        if (a === 192 && b === 168) {
            return { classification: 'private' };
        }
        // Link-local: 169.254.0.0/16
        if (a === 169 && b === 254) {
            return { classification: 'link_local' };
        }
        // Multicast: 224.0.0.0/4
        if (a !== undefined && a >= 224 && a <= 239) {
            return { classification: 'multicast' };
        }
        // Documentation: 192.0.2.0/24 (TEST-NET-1)
        if (a === 192 && b === 0 && c === 2) {
            return { classification: 'documentation' };
        }
        // Documentation: 198.51.100.0/24 (TEST-NET-2)
        if (a === 198 && b === 51 && c === 100) {
            return { classification: 'documentation' };
        }
        // Documentation: 203.0.113.0/24 (TEST-NET-3)
        if (a === 203 && b === 0 && c === 113) {
            return { classification: 'documentation' };
        }
        // Reserved: 100.64.0.0/10 (Shared Address Space for CGN)
        if (a === 100 && b !== undefined && b >= 64 && b <= 127) {
            return { classification: 'reserved' };
        }
        // Reserved: 240.0.0.0/4
        if (a !== undefined && a >= 240) {
            return { classification: 'reserved' };
        }
        // All other addresses are public
        return { classification: 'public' };
    }
    // IPv6 classifications
    if (family === 6) {
        // Handle IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
        const ipv4MappedMatch = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (ipv4MappedMatch && ipv4MappedMatch[1]) {
            // Recursively classify the embedded IPv4 address
            return classifySourceAddress(ipv4MappedMatch[1], 4);
        }
        // Loopback: ::1
        if (normalized === '::1') {
            return { classification: 'loopback' };
        }
        // Unspecified: ::
        if (normalized === '::') {
            return { classification: 'unspecified' };
        }
        // Link-local: fe80::/10
        if (normalized.startsWith('fe80:') || normalized.startsWith('fe80::')) {
            return { classification: 'link_local' };
        }
        // Unique local (private): fc00::/7 (fc00:: - fdff:...)
        if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
            return { classification: 'private' };
        }
        // Multicast: ff00::/8
        if (normalized.startsWith('ff')) {
            return { classification: 'multicast' };
        }
        // Documentation: 2001:db8::/32
        if (normalized.startsWith('2001:db8:')) {
            return { classification: 'documentation' };
        }
        // All other IPv6 addresses are considered public
        return { classification: 'public' };
    }
    return { classification: 'invalid' };
}
//# sourceMappingURL=source-network-safety.js.map