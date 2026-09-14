import { describe, expect, it } from 'vitest';
import { enforceSourceTransportSandboxBudget } from './source-transport-sandbox-budget';

const budget = {
  maxResponseBytes: 1024,
  timeoutMs: 1000,
  maxRedirectHops: 3,
};

describe('enforceSourceTransportSandboxBudget', () => {
  it('allows usage within every sandbox budget', () => {
    expect(
      enforceSourceTransportSandboxBudget(budget, {
        responseBytes: 512,
        elapsedMs: 500,
        redirectHops: 1,
      }),
    ).toEqual({ decision: 'allow', reason: 'WITHIN_BUDGET' });
  });

  it('blocks response byte overruns', () => {
    expect(
      enforceSourceTransportSandboxBudget(budget, {
        responseBytes: 1025,
        elapsedMs: 500,
        redirectHops: 1,
      }),
    ).toEqual({ decision: 'block', reason: 'BYTE_BUDGET_EXCEEDED' });
  });

  it('blocks timeout and redirect overruns', () => {
    expect(
      enforceSourceTransportSandboxBudget(budget, {
        responseBytes: 10,
        elapsedMs: 1001,
        redirectHops: 1,
      }),
    ).toEqual({ decision: 'block', reason: 'TIME_BUDGET_EXCEEDED' });
    expect(
      enforceSourceTransportSandboxBudget(budget, {
        responseBytes: 10,
        elapsedMs: 10,
        redirectHops: 4,
      }),
    ).toEqual({ decision: 'block', reason: 'REDIRECT_BUDGET_EXCEEDED' });
  });

  it('fails closed for invalid negative usage', () => {
    expect(
      enforceSourceTransportSandboxBudget(budget, {
        responseBytes: -1,
        elapsedMs: 10,
        redirectHops: 0,
      }),
    ).toEqual({ decision: 'block', reason: 'INVALID_USAGE' });
  });
});
