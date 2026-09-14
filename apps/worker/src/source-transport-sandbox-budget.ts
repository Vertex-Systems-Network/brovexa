export interface SourceTransportSandboxBudget {
  maxResponseBytes: number;
  timeoutMs: number;
  maxRedirectHops: number;
}

export interface SourceTransportSandboxUsage {
  responseBytes: number;
  elapsedMs: number;
  redirectHops: number;
}

export type SourceTransportSandboxBudgetDecision =
  | { decision: 'allow'; reason: 'WITHIN_BUDGET' }
  | { decision: 'block'; reason: 'BYTE_BUDGET_EXCEEDED' | 'TIME_BUDGET_EXCEEDED' | 'REDIRECT_BUDGET_EXCEEDED' | 'INVALID_USAGE' };

function validCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function enforceSourceTransportSandboxBudget(
  budget: SourceTransportSandboxBudget,
  usage: SourceTransportSandboxUsage,
): SourceTransportSandboxBudgetDecision {
  if (
    !validCount(budget.maxResponseBytes) ||
    !validCount(budget.timeoutMs) ||
    !validCount(budget.maxRedirectHops) ||
    !validCount(usage.responseBytes) ||
    !validCount(usage.elapsedMs) ||
    !validCount(usage.redirectHops)
  ) {
    return { decision: 'block', reason: 'INVALID_USAGE' };
  }
  if (usage.responseBytes > budget.maxResponseBytes) {
    return { decision: 'block', reason: 'BYTE_BUDGET_EXCEEDED' };
  }
  if (usage.elapsedMs > budget.timeoutMs) {
    return { decision: 'block', reason: 'TIME_BUDGET_EXCEEDED' };
  }
  if (usage.redirectHops > budget.maxRedirectHops) {
    return { decision: 'block', reason: 'REDIRECT_BUDGET_EXCEEDED' };
  }
  return { decision: 'allow', reason: 'WITHIN_BUDGET' };
}
