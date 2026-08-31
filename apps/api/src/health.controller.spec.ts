import { HealthResponseSchema } from '@brovexa/contracts';
import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns a contract-valid health response', () => {
    const response = new HealthController().getHealth();
    const parsed = HealthResponseSchema.parse(response);

    expect(parsed.status).toBe('ok');
    expect(parsed.service).toBe('brovexa-api');
    expect(parsed.version).toBe('0.1.0');
  });
});
