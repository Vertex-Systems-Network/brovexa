import { describe, expect, it } from 'vitest';
import {
  AgentExecutionPlanSchema,
  AgentExecutionWorkPayloadSchema,
  type AgentExecutionPlan,
  type AgentExecutionStep,
} from './agent-execution';

function step(key: string, dependencies: string[] = []): AgentExecutionStep {
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

function plan(): AgentExecutionPlan {
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

  it('rejects recursive orchestrator steps', () => {
    const candidate = plan();
    candidate.steps[0] = { ...step('discover'), agentKey: 'agent.control.orchestrator' };
    expect(AgentExecutionPlanSchema.safeParse(candidate).success).toBe(false);
  });

  it('rejects duplicate and unknown dependencies', () => {
    const candidate = plan();
    candidate.steps[1] = step('verify', ['discover', 'discover', 'missing']);
    expect(AgentExecutionPlanSchema.safeParse(candidate).success).toBe(false);
  });

  it('rejects duplicate scope/tool identifiers', () => {
    const candidate = plan();
    candidate.steps[0] = {
      ...step('discover'),
      toolKeys: ['tool.search', 'tool.search'],
      policyRefs: ['policy.research.v1', 'policy.research.v1'],
    };
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

  it('rejects nested specialist concurrency', () => {
    const candidate = plan();
    candidate.steps[0] = {
      ...step('discover'),
      budget: { ...step('discover').budget, maxConcurrency: 2 },
    };
    expect(AgentExecutionPlanSchema.safeParse(candidate).success).toBe(false);
  });
});

describe('AgentExecutionWorkPayload contract', () => {
  it('accepts the bounded payload emitted to a specialist WorkUnit', () => {
    const specialist = step('discover');
    expect(
      AgentExecutionWorkPayloadSchema.parse({
        version: '1.0.0',
        dispatchId: 'dispatch_1',
        handlerRegistryVersion: '1.0.0',
        planId: 'plan_1',
        planVersion: 1,
        workspaceId: 'workspace_1',
        orchestratorRunId: 'run_1',
        contextReceiptId: 'context_1',
        maxParallelism: 2,
        stepKey: specialist.key,
        agentKey: specialist.agentKey,
        agentVersion: specialist.agentVersion,
        dependencies: specialist.dependencies,
        toolKeys: specialist.toolKeys,
        commandKeys: specialist.commandKeys,
        policyRefs: specialist.policyRefs,
        canonicalRefs: specialist.canonicalRefs,
        memoryRefs: specialist.memoryRefs,
        budget: specialist.budget,
      }).stepKey,
    ).toBe('discover');
  });

  it('rejects recursive orchestrator work and nested concurrency', () => {
    const specialist = step('discover');
    const payload = {
      version: '1.0.0' as const,
      dispatchId: 'dispatch_1',
      handlerRegistryVersion: '1.0.0',
      planId: 'plan_1',
      planVersion: 1,
      workspaceId: 'workspace_1',
      orchestratorRunId: 'run_1',
      contextReceiptId: 'context_1',
      maxParallelism: 2,
      stepKey: specialist.key,
      agentKey: specialist.agentKey,
      agentVersion: specialist.agentVersion,
      dependencies: specialist.dependencies,
      toolKeys: specialist.toolKeys,
      commandKeys: specialist.commandKeys,
      policyRefs: specialist.policyRefs,
      canonicalRefs: specialist.canonicalRefs,
      memoryRefs: specialist.memoryRefs,
      budget: specialist.budget,
    };
    expect(
      AgentExecutionWorkPayloadSchema.safeParse({ ...payload, agentKey: 'agent.control.orchestrator' }).success,
    ).toBe(false);
    expect(
      AgentExecutionWorkPayloadSchema.safeParse({
        ...payload,
        budget: { ...specialist.budget, maxConcurrency: 2 },
      }).success,
    ).toBe(false);
  });
});
