import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@brovexa/contracts';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'brovexa-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}
