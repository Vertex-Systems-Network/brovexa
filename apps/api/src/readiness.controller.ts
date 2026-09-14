import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import type { ReadinessResponse } from '@brovexa/contracts';
import { DatabaseService } from './database.service';

@Controller()
export class ReadinessController {
  constructor(private readonly database: DatabaseService) {}

  @Get('ready')
  async getReadiness(): Promise<ReadinessResponse> {
    const database = await this.database.readiness();

    if (!database.configured) {
      throw new ServiceUnavailableException({
        code: 'DATABASE_NOT_CONFIGURED',
        message: 'Database readiness is not configured.',
      });
    }

    if (!database.ok) {
      throw new ServiceUnavailableException({
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database readiness check failed.',
      });
    }

    if (database.probe.serverMajor !== 18 || !database.probe.schemaReady) {
      throw new ServiceUnavailableException({
        code: 'DATABASE_SCHEMA_NOT_READY',
        message: 'Database schema is not ready for this application version.',
      });
    }

    return {
      status: 'ready',
      database: {
        serverVersion: database.probe.serverVersion,
        serverMajor: database.probe.serverMajor,
        schemaReady: true,
      },
    };
  }
}
