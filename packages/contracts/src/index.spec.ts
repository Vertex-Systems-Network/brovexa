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
  it('supports a safe error without a request ID', () => {
    expect(
      ApiErrorSchema.parse({
        code: 'FOUNDATION_ERROR',
        message: 'Safe public message',
      }),
    ).toEqual({
      code: 'FOUNDATION_ERROR',
      message: 'Safe public message',
    });
  });

  it('supports a correlation request ID', () => {
    expect(
      ApiErrorSchema.parse({
        code: 'FOUNDATION_ERROR',
        message: 'Safe public message',
        requestId: 'req_123',
      }).requestId,
    ).toBe('req_123');
  });
});
