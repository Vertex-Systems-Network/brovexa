"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestSourceTransportError = void 0;
exports.executeInjectedTestTransport = executeInjectedTestTransport;
const node_url_1 = require("node:url");
class TestSourceTransportError extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
        this.name = 'TestSourceTransportError';
    }
}
exports.TestSourceTransportError = TestSourceTransportError;
const contentTypePattern = /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/;
function normalizedContentType(value) {
    return value.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}
function validContentType(value) {
    return typeof value === 'string' && contentTypePattern.test(normalizedContentType(value));
}
function canonicalUrl(value, code) {
    if (typeof value !== 'string')
        throw new TestSourceTransportError(code);
    try {
        return new node_url_1.URL(value).href;
    }
    catch {
        throw new TestSourceTransportError(code);
    }
}
function ensureByteBudget(value, code) {
    if (!Number.isSafeInteger(value) || value <= 0)
        throw new TestSourceTransportError(code);
}
function ensureTimeoutBudget(value, code) {
    if (!Number.isSafeInteger(value) || value < 100 || value > 120_000)
        throw new TestSourceTransportError(code);
}
async function executeInjectedTestTransport(request, admission, exchange) {
    if (request.transportKind !== 'test')
        throw new TestSourceTransportError('TEST_TRANSPORT_NETWORK_FORBIDDEN');
    if (admission.decision !== 'allow')
        throw new TestSourceTransportError('TEST_TRANSPORT_ADMISSION_BLOCKED');
    if (admission.transportRequestId !== request.transportRequestId) {
        throw new TestSourceTransportError('TEST_TRANSPORT_ADMISSION_ID_MISMATCH');
    }
    const requestUrl = canonicalUrl(request.url, 'TEST_TRANSPORT_INVALID_REQUEST_URL');
    const admissionUrl = canonicalUrl(admission.canonicalUrl, 'TEST_TRANSPORT_INVALID_ADMISSION_URL');
    if (admissionUrl !== requestUrl)
        throw new TestSourceTransportError('TEST_TRANSPORT_ADMISSION_URL_MISMATCH');
    ensureByteBudget(request.maxResponseBytes, 'TEST_TRANSPORT_INVALID_BYTE_BUDGET');
    ensureTimeoutBudget(request.timeoutMs, 'TEST_TRANSPORT_INVALID_TIMEOUT_BUDGET');
    ensureByteBudget(admission.maxResponseBytes, 'TEST_TRANSPORT_INVALID_ADMISSION_BYTE_BUDGET');
    ensureTimeoutBudget(admission.timeoutMs, 'TEST_TRANSPORT_INVALID_ADMISSION_TIMEOUT_BUDGET');
    if (request.maxResponseBytes > admission.maxResponseBytes) {
        throw new TestSourceTransportError('TEST_TRANSPORT_BYTE_BUDGET_WIDENED');
    }
    if (request.timeoutMs > admission.timeoutMs)
        throw new TestSourceTransportError('TEST_TRANSPORT_TIMEOUT_BUDGET_WIDENED');
    if (request.acceptedContentTypes.length === 0 || request.acceptedContentTypes.some((value) => !validContentType(value))) {
        throw new TestSourceTransportError('TEST_TRANSPORT_CONTENT_TYPES_INVALID');
    }
    const result = await exchange({
        transportRequestId: request.transportRequestId,
        url: requestUrl,
        maxResponseBytes: request.maxResponseBytes,
        timeoutMs: request.timeoutMs,
    });
    if (!Number.isInteger(result.status) || result.status < 100 || result.status > 599) {
        throw new TestSourceTransportError('TEST_TRANSPORT_INVALID_STATUS');
    }
    if (result.status >= 300 && result.status < 400) {
        throw new TestSourceTransportError('TEST_TRANSPORT_REDIRECT_REQUIRES_REVALIDATION');
    }
    const finalUrl = canonicalUrl(result.finalUrl, 'TEST_TRANSPORT_INVALID_FINAL_URL');
    if (finalUrl !== requestUrl)
        throw new TestSourceTransportError('TEST_TRANSPORT_FINAL_URL_CHANGED');
    if (!Number.isFinite(result.elapsedMs) || result.elapsedMs < 0 || result.elapsedMs > request.timeoutMs) {
        throw new TestSourceTransportError('TEST_TRANSPORT_TIMEOUT_EXCEEDED');
    }
    if (!(result.body instanceof Uint8Array))
        throw new TestSourceTransportError('TEST_TRANSPORT_INVALID_BODY');
    if (result.body.byteLength > request.maxResponseBytes) {
        throw new TestSourceTransportError('TEST_TRANSPORT_RESPONSE_TOO_LARGE');
    }
    if (!validContentType(result.contentType))
        throw new TestSourceTransportError('TEST_TRANSPORT_INVALID_CONTENT_TYPE');
    const contentType = normalizedContentType(result.contentType);
    const accepted = new Set(request.acceptedContentTypes.map(normalizedContentType));
    if (!accepted.has(contentType))
        throw new TestSourceTransportError('TEST_TRANSPORT_CONTENT_TYPE_NOT_ALLOWED');
    return result;
}
//# sourceMappingURL=source-test-transport.js.map