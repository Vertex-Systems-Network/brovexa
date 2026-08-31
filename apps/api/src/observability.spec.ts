import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  extractTraceId,
  normalizeRequestId,
  requestContextMiddleware,
  resolvePublicErrorDetails,
  sanitizeRequestPath,
  type CorrelatedRequest,
} from './observability';

describe('API request correlation', () => {
  it('preserves a bounded safe request ID and rejects unsafe input', () => {
    expect(normalizeRequestId('req-client_123')).toBe('req-client_123');
    expect(normalizeRequestId('bad request id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('extracts only valid W3C version-00 trace IDs', () => {
    expect(
      extractTraceId('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'),
    ).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(extractTraceId('00-00000000000000000000000000000000-00f067aa0ba902b7-01')).toBeNull();
    expect(extractTraceId('00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01')).toBeNull();
    expect(extractTraceId('ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')).toBeNull();
  });

  it('sets response correlation headers and request context', () => {
    const request: CorrelatedRequest = {
      headers: {
        'x-request-id': 'req-abc',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      },
    };
    const headers = new Map<string, string>();
    const next = vi.fn();

    requestContextMiddleware(
      request,
      {
        statusCode: 200,
        setHeader: (name, value) => headers.set(name, value),
        once: () => undefined,
      },
      next,
    );

    expect(request.requestId).toBe('req-abc');
    expect(request.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(headers.get('x-request-id')).toBe('req-abc');
    expect(headers.get('x-trace-id')).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(next).toHaveBeenCalledOnce();
  });

  it('logs every middleware completion without query-string data', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    let finish: () => void = () => undefined;

    requestContextMiddleware(
      {
        headers: { 'x-request-id': 'req-log' },
        method: 'GET',
        originalUrl: '/businesses?token=secret&email=user@example.com',
      },
      {
        statusCode: 404,
        setHeader: () => undefined,
        once: (_event, listener) => {
          finish = listener;
        },
      },
      () => undefined,
    );
    finish();

    expect(info).toHaveBeenCalledOnce();
    const serialized = String(info.mock.calls[0]?.[0]);
    const event = JSON.parse(serialized) as Record<string, unknown>;
    expect(event.event).toBe('api.request.completed');
    expect(event.requestId).toBe('req-log');
    expect(event.method).toBe('GET');
    expect(event.path).toBe('/businesses');
    expect(event.statusCode).toBe(404);
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('user@example.com');
    info.mockRestore();
  });

  it('removes query strings from request paths', () => {
    expect(sanitizeRequestPath({ originalUrl: '/businesses?token=secret&email=user@example.com' })).toBe(
      '/businesses',
    );
  });
});

describe('public API error mapping', () => {
  it('preserves explicitly reviewed safe application error bodies', () => {
    const error = new ServiceUnavailableException({
      code: 'DATABASE_NOT_CONFIGURED',
      message: 'Database readiness is not configured.',
    });

    expect(resolvePublicErrorDetails(error, 503)).toEqual({
      code: 'DATABASE_NOT_CONFIGURED',
      message: 'Database readiness is not configured.',
    });
  });

  it('does not expose arbitrary internal exception messages', () => {
    expect(resolvePublicErrorDetails(new Error('postgresql://user:secret@db/internal'), 500)).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'The service could not complete the request.',
    });
  });

  it('uses stable generic errors instead of framework-generated route details', () => {
    expect(resolvePublicErrorDetails(new Error('Cannot GET /private?id=1'), 404)).toEqual({
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.',
    });
  });
});
