import { randomBytes, randomUUID } from 'node:crypto';
import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type CallHandler,
  type ExceptionFilter,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { ApiError } from '@brovexa/contracts';
import type { Observable } from 'rxjs';

const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const traceparentPattern = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/i;
const publicErrorCodePattern = /^[A-Z][A-Z0-9_]{1,63}$/;

export interface CorrelatedRequest {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
  url?: string;
  requestId?: string;
  traceId?: string;
}

interface CorrelationResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  once(event: 'finish', listener: () => void): void;
}

interface JsonResponse extends CorrelationResponse {
  status(code: number): JsonResponse;
  json(body: ApiError): void;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeRequestId(value: string | string[] | undefined): string {
  const candidate = firstHeader(value)?.trim();
  return candidate && requestIdPattern.test(candidate) ? candidate : randomUUID();
}

export function createTraceId(): string {
  return randomBytes(16).toString('hex');
}

export function extractTraceId(value: string | string[] | undefined): string | null {
  const candidate = firstHeader(value)?.trim();
  if (!candidate) return null;

  const match = traceparentPattern.exec(candidate);
  const traceId = match?.[1]?.toLowerCase();
  const parentId = match?.[2]?.toLowerCase();
  if (!traceId || !parentId || /^0{32}$/.test(traceId) || /^0{16}$/.test(parentId)) return null;
  return traceId;
}

function ensureCorrelation(request: CorrelatedRequest): { requestId: string; traceId: string } {
  const requestId = request.requestId ?? normalizeRequestId(request.headers['x-request-id']);
  const traceId = request.traceId ?? extractTraceId(request.headers.traceparent) ?? createTraceId();
  request.requestId = requestId;
  request.traceId = traceId;
  return { requestId, traceId };
}

export function requestContextMiddleware(
  request: CorrelatedRequest,
  response: Pick<CorrelationResponse, 'setHeader'>,
  next: () => void,
): void {
  const { requestId, traceId } = ensureCorrelation(request);
  response.setHeader('x-request-id', requestId);
  response.setHeader('x-trace-id', traceId);
  next();
}

export function sanitizeRequestPath(request: Pick<CorrelatedRequest, 'originalUrl' | 'url'>): string {
  const rawPath = request.originalUrl ?? request.url ?? '/';
  const withoutQuery = rawPath.split('?', 1)[0] || '/';
  return withoutQuery.slice(0, 512);
}

interface PublicErrorDetails {
  code: string;
  message: string;
}

const genericErrors: Readonly<Record<number, PublicErrorDetails>> = {
  [HttpStatus.BAD_REQUEST]: { code: 'BAD_REQUEST', message: 'The request is invalid.' },
  [HttpStatus.UNAUTHORIZED]: {
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Authentication is required.',
  },
  [HttpStatus.FORBIDDEN]: { code: 'FORBIDDEN', message: 'The request is not permitted.' },
  [HttpStatus.NOT_FOUND]: {
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
  },
  [HttpStatus.CONFLICT]: { code: 'CONFLICT', message: 'The request conflicts with current state.' },
  [HttpStatus.PAYLOAD_TOO_LARGE]: {
    code: 'PAYLOAD_TOO_LARGE',
    message: 'The request payload is too large.',
  },
  [HttpStatus.UNPROCESSABLE_ENTITY]: {
    code: 'UNPROCESSABLE_ENTITY',
    message: 'The request could not be processed.',
  },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: 'RATE_LIMITED',
    message: 'Too many requests were received.',
  },
  [HttpStatus.SERVICE_UNAVAILABLE]: {
    code: 'SERVICE_UNAVAILABLE',
    message: 'The service is temporarily unavailable.',
  },
};

function explicitSafeHttpError(exception: HttpException): PublicErrorDetails | null {
  const body = exception.getResponse();
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;

  const candidate = body as { code?: unknown; message?: unknown };
  if (
    typeof candidate.code !== 'string' ||
    !publicErrorCodePattern.test(candidate.code) ||
    typeof candidate.message !== 'string' ||
    candidate.message.length < 1 ||
    candidate.message.length > 240
  ) {
    return null;
  }

  return { code: candidate.code, message: candidate.message };
}

export function resolvePublicErrorDetails(exception: unknown, statusCode: number): PublicErrorDetails {
  if (exception instanceof HttpException) {
    const explicit = explicitSafeHttpError(exception);
    if (explicit) return explicit;
  }

  if (statusCode >= 500) {
    return { code: 'INTERNAL_ERROR', message: 'The service could not complete the request.' };
  }

  return (
    genericErrors[statusCode] ?? {
      code: `HTTP_${statusCode}`,
      message: 'The request could not be completed.',
    }
  );
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<CorrelatedRequest>();
    const response = http.getResponse<JsonResponse>();
    const { requestId, traceId } = ensureCorrelation(request);
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const details = resolvePublicErrorDetails(exception, statusCode);

    response.setHeader('x-request-id', requestId);
    response.setHeader('x-trace-id', traceId);

    console.error(
      JSON.stringify({
        event: 'api.request.failed',
        requestId,
        traceId,
        statusCode,
        errorClass: exception instanceof Error ? exception.name : 'UnknownError',
      }),
    );

    response.status(statusCode).json({
      ...details,
      requestId,
      traceId,
    });
  }
}

export class RequestLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<CorrelatedRequest>();
    const response = http.getResponse<CorrelationResponse>();
    const { requestId, traceId } = ensureCorrelation(request);
    const startedAt = process.hrtime.bigint();

    response.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      console.info(
        JSON.stringify({
          event: 'api.request.completed',
          requestId,
          traceId,
          method: request.method ?? 'UNKNOWN',
          path: sanitizeRequestPath(request),
          statusCode: response.statusCode,
          durationMs: Number(durationMs.toFixed(3)),
        }),
      );
    });

    return next.handle();
  }
}
