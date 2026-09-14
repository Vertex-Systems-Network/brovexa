"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestDiscoveryError = void 0;
exports.buildTestDiscoveryUrl = buildTestDiscoveryUrl;
exports.executeInjectedTestDiscovery = executeInjectedTestDiscovery;
const source_test_transport_1 = require("./source-test-transport");
class TestDiscoveryError extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
        this.name = 'TestDiscoveryError';
    }
}
exports.TestDiscoveryError = TestDiscoveryError;
function httpUrl(rawUrl, errorCode) {
    let url;
    try {
        url = new URL(rawUrl);
    }
    catch {
        throw new TestDiscoveryError(errorCode);
    }
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname || url.username || url.password) {
        throw new TestDiscoveryError(errorCode);
    }
    return url;
}
function discoveryUrl(endpoint, query) {
    if (!/^[A-Z]{2}$/.test(query.countryCode))
        throw new TestDiscoveryError('TEST_DISCOVERY_COUNTRY_INVALID');
    if (query.locality.trim().length === 0 || query.locality.length > 160) {
        throw new TestDiscoveryError('TEST_DISCOVERY_LOCALITY_INVALID');
    }
    if (query.niche.trim().length === 0 || query.niche.length > 160)
        throw new TestDiscoveryError('TEST_DISCOVERY_NICHE_INVALID');
    if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 1000) {
        throw new TestDiscoveryError('TEST_DISCOVERY_LIMIT_INVALID');
    }
    const url = httpUrl(endpoint, 'TEST_DISCOVERY_ENDPOINT_INVALID');
    url.searchParams.set('country', query.countryCode);
    url.searchParams.set('limit', String(query.limit));
    url.searchParams.set('locality', query.locality.trim());
    url.searchParams.set('niche', query.niche.trim());
    url.searchParams.sort();
    return url.href;
}
function parsePayload(body, limit) {
    let payload;
    try {
        payload = JSON.parse(new TextDecoder().decode(body));
    }
    catch {
        throw new TestDiscoveryError('TEST_DISCOVERY_PAYLOAD_INVALID_JSON');
    }
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.candidates)) {
        throw new TestDiscoveryError('TEST_DISCOVERY_PAYLOAD_INVALID_SHAPE');
    }
    const rawCandidates = payload.candidates;
    if (rawCandidates.length > limit)
        throw new TestDiscoveryError('TEST_DISCOVERY_RESULT_LIMIT_EXCEEDED');
    const seen = new Set();
    return rawCandidates.map((candidate) => {
        if (!candidate || typeof candidate !== 'object')
            throw new TestDiscoveryError('TEST_DISCOVERY_CANDIDATE_INVALID');
        const value = candidate;
        if (typeof value.externalRef !== 'string' || value.externalRef.trim().length === 0 || value.externalRef.length > 256) {
            throw new TestDiscoveryError('TEST_DISCOVERY_CANDIDATE_REF_INVALID');
        }
        const externalRef = value.externalRef.trim();
        if (seen.has(externalRef))
            throw new TestDiscoveryError('TEST_DISCOVERY_CANDIDATE_DUPLICATE');
        seen.add(externalRef);
        if (typeof value.name !== 'string' || value.name.trim().length === 0 || value.name.length > 512) {
            throw new TestDiscoveryError('TEST_DISCOVERY_CANDIDATE_NAME_INVALID');
        }
        const website = value.website === null || value.website === undefined
            ? null
            : typeof value.website === 'string'
                ? httpUrl(value.website, 'TEST_DISCOVERY_CANDIDATE_WEBSITE_INVALID').href
                : (() => {
                    throw new TestDiscoveryError('TEST_DISCOVERY_CANDIDATE_WEBSITE_INVALID');
                })();
        return {
            externalRef,
            name: value.name.trim(),
            website,
        };
    });
}
function buildTestDiscoveryUrl(endpoint, query) {
    return discoveryUrl(endpoint, query);
}
async function executeInjectedTestDiscovery(input, admission, exchange) {
    const url = discoveryUrl(input.endpoint, input.query);
    const result = await (0, source_test_transport_1.executeInjectedTestTransport)({
        transportRequestId: input.transportRequestId,
        transportKind: 'test',
        url,
        maxResponseBytes: input.maxResponseBytes,
        timeoutMs: input.timeoutMs,
        acceptedContentTypes: ['application/json'],
    }, admission, exchange);
    return parsePayload(result.body, input.query.limit);
}
//# sourceMappingURL=source-test-discovery.js.map