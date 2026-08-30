import { describe, expect, it } from 'vitest';
import { calculateRetryDelayMs } from './runtime';

describe('worker retry policy', () => {
  it('is deterministic for a work unit and attempt', () => {
    expect(calculateRetryDelayMs('work-1', 2, 100, 10_000)).toBe(
      calculateRetryDelayMs('work-1', 2, 100, 10_000),
    );
  });

  it('caps exponential delay before deterministic jitter', () => {
    expect(calculateRetryDelayMs('work-2', 20, 100, 1000)).toBeLessThanOrEqual(1200);
  });
});
