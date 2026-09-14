"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiExceptionFilter = void 0;
exports.normalizeRequestId = normalizeRequestId;
exports.createTraceId = createTraceId;
exports.extractTraceId = extractTraceId;
exports.sanitizeRequestPath = sanitizeRequestPath;
exports.requestContextMiddleware = requestContextMiddleware;
exports.resolvePublicErrorDetails = resolvePublicErrorDetails;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const traceparentPattern = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/i;
const publicErrorCodePattern = /^[A-Z][A-Z0-9_]{1,63}$/;
function firstHeader(value) {
    return Array.isArray(value) ? value[0] : value;
}
function normalizeRequestId(value) {
    const candidate = firstHeader(value)?.trim();
    return candidate && requestIdPattern.test(candidate) ? candidate : (0, node_crypto_1.randomUUID)();
}
function createTraceId() {
    return (0, node_crypto_1.randomBytes)(16).toString('hex');
}
function extractTraceId(value) {
    const candidate = firstHeader(value)?.trim();
    if (!candidate)
        return null;
    const match = traceparentPattern.exec(candidate);
    const traceId = match?.[1]?.toLowerCase();
    const parentId = match?.[2]?.toLowerCase();
    if (!traceId || !parentId || /^0{32}$/.test(traceId) || /^0{16}$/.test(parentId))
        return null;
    return traceId;
}
function ensureCorrelation(request) {
    const requestId = request.requestId ?? normalizeRequestId(request.headers['x-request-id']);
    const traceId = request.traceId ?? extractTraceId(request.headers.traceparent) ?? createTraceId();
    request.requestId = requestId;
    request.traceId = traceId;
    return { requestId, traceId };
}
function sanitizeRequestPath(request) {
    const rawPath = request.originalUrl ?? request.url ?? '/';
    const withoutQuery = rawPath.split('?', 1)[0] || '/';
    return withoutQuery.slice(0, 512);
}
function requestContextMiddleware(request, response, next) {
    const { requestId, traceId } = ensureCorrelation(request);
    const startedAt = process.hrtime.bigint();
    response.setHeader('x-request-id', requestId);
    response.setHeader('x-trace-id', traceId);
    response.once('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        console.info(JSON.stringify({
            event: 'api.request.completed',
            requestId,
            traceId,
            method: request.method ?? 'UNKNOWN',
            path: sanitizeRequestPath(request),
            statusCode: response.statusCode,
            durationMs: Number(durationMs.toFixed(3)),
        }));
    });
    next();
}
const genericErrors = {
    [common_1.HttpStatus.BAD_REQUEST]: { code: 'BAD_REQUEST', message: 'The request is invalid.' },
    [common_1.HttpStatus.UNAUTHORIZED]: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required.',
    },
    [common_1.HttpStatus.FORBIDDEN]: { code: 'FORBIDDEN', message: 'The request is not permitted.' },
    [common_1.HttpStatus.NOT_FOUND]: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
    },
    [common_1.HttpStatus.CONFLICT]: { code: 'CONFLICT', message: 'The request conflicts with current state.' },
    [common_1.HttpStatus.PAYLOAD_TOO_LARGE]: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'The request payload is too large.',
    },
    [common_1.HttpStatus.UNPROCESSABLE_ENTITY]: {
        code: 'UNPROCESSABLE_ENTITY',
        message: 'The request could not be processed.',
    },
    [common_1.HttpStatus.TOO_MANY_REQUESTS]: {
        code: 'RATE_LIMITED',
        message: 'Too many requests were received.',
    },
    [common_1.HttpStatus.SERVICE_UNAVAILABLE]: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'The service is temporarily unavailable.',
    },
};
function explicitSafeHttpError(exception) {
    const body = exception.getResponse();
    if (!body || typeof body !== 'object' || Array.isArray(body))
        return null;
    const candidate = body;
    if (typeof candidate.code !== 'string' ||
        !publicErrorCodePattern.test(candidate.code) ||
        typeof candidate.message !== 'string' ||
        candidate.message.length < 1 ||
        candidate.message.length > 240) {
        return null;
    }
    return { code: candidate.code, message: candidate.message };
}
function resolvePublicErrorDetails(exception, statusCode) {
    if (exception instanceof common_1.HttpException) {
        const explicit = explicitSafeHttpError(exception);
        if (explicit)
            return explicit;
    }
    if (statusCode >= 500) {
        return { code: 'INTERNAL_ERROR', message: 'The service could not complete the request.' };
    }
    return (genericErrors[statusCode] ?? {
        code: `HTTP_${statusCode}`,
        message: 'The request could not be completed.',
    });
}
let ApiExceptionFilter = class ApiExceptionFilter {
    catch(exception, host) {
        const http = host.switchToHttp();
        const request = http.getRequest();
        const response = http.getResponse();
        const { requestId, traceId } = ensureCorrelation(request);
        const statusCode = exception instanceof common_1.HttpException ? exception.getStatus() : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        const details = resolvePublicErrorDetails(exception, statusCode);
        response.setHeader('x-request-id', requestId);
        response.setHeader('x-trace-id', traceId);
        console.error(JSON.stringify({
            event: 'api.request.failed',
            requestId,
            traceId,
            statusCode,
            errorClass: exception instanceof Error ? exception.name : 'UnknownError',
        }));
        response.status(statusCode).json({
            ...details,
            requestId,
            traceId,
        });
    }
};
exports.ApiExceptionFilter = ApiExceptionFilter;
exports.ApiExceptionFilter = ApiExceptionFilter = __decorate([
    (0, common_1.Catch)()
], ApiExceptionFilter);
//# sourceMappingURL=observability.js.map