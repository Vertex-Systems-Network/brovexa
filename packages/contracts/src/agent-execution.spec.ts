import { describe, expect, it } from 'vitest';
import { AgentExecutionPlanSchema } from './agent-execution';

function step(key: string, dependencies: string[] = []) {
  return {
    key,
    agentKey: `agent.research.${key}`,
    agentVersion: '1.0.0',
    dependencies,
    toolKeys: [],
    commandKeys: [],
    policyRefs: ['policy.research.v1'],
    canonicalRefs: [],
    memoryRefs: [],
    budget: {
      maxTokens: 100,
      maxSearches: 0,
      maxApiCalls: 1,
      maxCredits: 0,
      maxCurrencyMicros: 1_000,
      maxRuntimeMs: 1_000,
      maxConcurrency: 1,
    },
  };
}

function plan() {
  return {
    id: 'plan_1',
    workspaceId: 'workspace_1',
    userId: 'user_1',
    runId: 'run_1',
    contextReceiptId: 'context_1',
    orchestratorKey: 'agent.control.orchestrator',
    orchestratorVersion: '1.0.0',
    planVersion: 1,
    maxParallelism: 2,
    steps: [step('discover'), step('verify', ['discover'])],
    createdAt: '2026-09-01T00:00:00.000Z',
  };
}

describe('AgentExecutionPlan contract', () => {
  it('accepts a bounded acyclic plan', () => {
    expect(AgentExecutionPlanSchema.parse(plan()).steps).toHaveLength(2);
  });

  it('requires the canonical orchestrator key', () => {
    expect(
      AgentExecutionPlanSchema.safeParse({ ...plan(), orchestratorKey: 'agent.research.discovery' }).success,
    ).toBe(false);
  });

  it('rejects duplicate and unknown dependencies', () => {
    const candidate = plan();
    candidate.steps[1] = step('verify', ['discover', 'discover', 'missing']);
    expect(AgentExecutionPlanSchema.safeParse(candidate).success).toBe(false);
  });

  it('rejects dependency cycles', () => {
    const candidate = plan();
    candidate.steps = [step('discover', ['verify']), step('verify', ['discover'])];
    expect(AgentExecutionPlanSchema.safeParse(candidate).success).toBe(false);
  });

  it('rejects parallelism above plan width', () => {
    expect(AgentExecutionPlanSchema.safeParse({ ...plan(), maxParallelism: 3 }).success).toBe(false);
  });
});
