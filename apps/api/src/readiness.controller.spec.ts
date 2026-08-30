import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from './database.service';
import { ReadinessController } from './readiness.controller';

function controllerWith(readiness: DatabaseService['readiness']) {
  return new ReadinessController({ readiness } as DatabaseService);
}

describe('ReadinessController', () => {
  it('returns ready only for PostgreSQL 18 with the expected schema', async () => {
    const readiness = vi.fn().mockResolvedValue({
      configured: true,
      ok: true,
      probe: { serverVersion: '18.6', serverMajor: 18, schemaReady: true },
    });

    await expect(controllerWith(readiness).getReadiness()).resolves.toEqual({
      status: 'ready',
      database: { serverVersion: '18.6', serverMajor: 18, schemaReady: true },
    });
  });

  it('fails closed when the database is not configured', async () => {
    const readiness = vi.fn().mockResolvedValue({ configured: false });
    await expect(controllerWith(readiness).getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('fails closed when the schema is not ready', async () => {
    const readiness = vi.fn().mockResolvedValue({
      configured: true,
      ok: true,
      probe: { serverVersion: '18.6', serverMajor: 18, schemaReady: false },
    });
    await expect(controllerWith(readiness).getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
