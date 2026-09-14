import { describe, expect, it } from 'vitest';
import { ApiErrorSchema, HealthResponseSchema } from './index';

describe('HealthResponseSchema', () => {
  it('accepts the foundation health contract', () => {
    const parsed = HealthResponseSchema.parse({
      status: 'ok',
      service: 'brovexa-api',
      version: '0.1.0',
      timestamp: '2026-08-30T09:00:00.000Z',
    });

    expect(parsed.status).toBe('ok');
  });

  it('rejects an invalid service or timestamp', () => {
    expect(() =>
      HealthResponseSchema.parse({
        status: 'ok',
        service: 'another-service',
        version: '0.1.0',
        timestamp: 'not-a-date',
      }),
    ).toThrow();
  });
});

describe('ApiErrorSchema', () => {
  it('requires request and trace correlation identifiers', () => {
    expect(
      ApiErrorSchema.parse({
        code: 'FOUNDATION_ERROR',
        message: 'Safe public message',
        requestId: 'req_123',
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      }),
    ).toEqual({
      code: 'FOUNDATION_ERROR',
      message: 'Safe public message',
      requestId: 'req_123',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
    });
  });

  it('rejects missing correlation and malformed trace IDs', () => {
    expect(() =>
      ApiErrorSchema.parse({
        code: 'FOUNDATION_ERROR',
        message: 'Safe public message',
      }),
    ).toThrow();

    expect(() =>
      ApiErrorSchema.parse({
        code: 'FOUNDATION_ERROR',
        message: 'Safe public message',
        requestId: 'req_123',
        traceId: 'not-a-trace-id',
      }),
    ).toThrow();
  });
});
