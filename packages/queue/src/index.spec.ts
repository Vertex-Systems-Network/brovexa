import { describe, expect, it } from 'vitest';
import { deliveryJobId, parseQueueRedisUrl } from './index';

describe('queue foundation', () => {
  it('parses a local Redis-protocol URL without broad provider assumptions', () => {
    expect(parseQueueRedisUrl('redis://127.0.0.1:6379/2')).toMatchObject({
      host: '127.0.0.1',
      port: 6379,
      db: 2,
      maxRetriesPerRequest: null,
    });
  });

  it('rejects non-redis schemes in the M01 transport contract', () => {
    expect(() => parseQueueRedisUrl('https://example.com')).toThrow(/redis:\/\//i);
  });

  it('uses deterministic attempt-scoped delivery ids', () => {
    expect(deliveryJobId('abc', 3)).toBe('wu-abc-a3');
  });
});
