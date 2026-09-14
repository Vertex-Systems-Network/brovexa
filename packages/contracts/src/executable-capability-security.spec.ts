import { describe, expect, it } from 'vitest';
import { AgentExecutionStepSchema, AgentExecutionWorkPayloadSchema } from './agent-execution';
import { AgentDefinitionSchema, AgentRunSchema, ExecutableCapabilityKeySchema } from './ai';

const maliciousCapabilityKeys = [
  ' tool.search',
  'tool.search ',
  'tool search',
  'tool/search',
  'tool\\search',
  'tool;rm',
  'tool|pipe',
  'tool&next',
  'tool$(id)',
  'tool`id`',
  'tool\nnext',
  '-leading-option',
] as const;

const budget = {
  maxTokens: 100,
  maxSearches: 0,
  maxApiCalls: 1,
  maxCredits: 0,
  maxCurrencyMicros: 1_000,
  maxRuntimeMs: 1_000,
  maxConcurrency: 1,
} as const;

const step = {
  key: 'discover',
  agentKey: 'agent.research.discover',
  agentVersion: '1.0.0',
  dependencies: [],
  toolKeys: ['tool.search'],
  commandKeys: ['command.fetch:v1'],
  policyRefs: ['policy.research.v1'],
  canonicalRefs: [],
  memoryRefs: [],
  budget,
} as const;

const definition = {
  key: 'agent.control.context',
  version: '1.0.0',
  status: 'draft',
  purpose: 'Build scoped context.',
  nonGoals: [],
  triggerTypes: ['agent_run'],
  inputSchemaId: 'context.request.v1',
  outputSchemaId: 'context.receipt.v1',
  allowedTools: ['context.read'],
  allowedCommands: ['command.fetch:v1'],
  memory: { read: [], propose: [], commit: [], supersede: [] },
  autonomyTier: 'T0',
  humanInterrupts: [],
  requiresHumanApproval: false,
  modelPolicy: {
    routingMode: 'deterministic_only',
    allowedProviderIds: [],
    allowedModelIds: [],
    fallbackModelIds: [],
  },
  promptVersion: '1.0.0',
  skillVersions: {},
  contextVersion: '1.0.0',
  retryLimit: 0,
  budget,
  deterministicValidators: ['tenant_scope'],
  evidenceRequired: false,
  minimumConfidence: 0.8,
  reviewBelowConfidence: 0.9,
  evalSuiteId: 'AI-CONTEXT-SEC',
  evalThreshold: 0.99,
  dataClassifications: ['WORKSPACE_CONFIDENTIAL'],
  telemetryRedactionPolicyId: 'telemetry.default',
  owner: 'platform-ai',
  changeReason: 'Security regression fixture.',
} as const;

const run = {
  id: 'run_1',
  workspaceId: 'workspace_1',
  agentKey: 'agent.control.context',
  agentVersion: '1.0.0',
  executionMode: 'deterministic',
  promptVersion: '1.0.0',
  skillVersions: {},
  contextReceiptId: 'ctx_1',
  status: 'succeeded',
  result: { ok: true },
  uncertainty: [],
  evidenceIds: [],
  factIds: [],
  sourceIds: [],
  assumptions: [],
  conflicts: [],
  toolSummary: [{ toolKey: 'tool.search', status: 'succeeded', costMicros: 0 }],
  cost: {
    inputTokens: 0,
    outputTokens: 0,
    searches: 0,
    apiCalls: 1,
    credits: 0,
    currencyMicros: 0,
  },
  validationState: 'passed',
  evaluatorState: 'not_required',
  proposedActions: [{ commandKey: 'command.fetch:v1', payload: {}, evidenceRefs: [] }],
} as const;

describe('executable capability key security boundary', () => {
  it('accepts bounded logical capability keys only', () => {
    for (const key of ['tool.search', 'command.fetch:v1', 'context_read', 'vendor-tool.v2']) {
      expect(ExecutableCapabilityKeySchema.safeParse(key).success).toBe(true);
    }
  });

  it('rejects whitespace, path separators, control characters and shell metacharacters', () => {
    for (const key of maliciousCapabilityKeys) {
      expect(ExecutableCapabilityKeySchema.safeParse(key).success, key).toBe(false);
    }
  });

  it('fails closed in agent definitions', () => {
    expect(AgentDefinitionSchema.safeParse(definition).success).toBe(true);
    for (const key of maliciousCapabilityKeys) {
      expect(AgentDefinitionSchema.safeParse({ ...definition, allowedTools: [key] }).success, key).toBe(false);
      expect(AgentDefinitionSchema.safeParse({ ...definition, allowedCommands: [key] }).success, key).toBe(false);
    }
  });

  it('fails closed in execution steps and dispatched work payloads', () => {
    expect(AgentExecutionStepSchema.safeParse(step).success).toBe(true);
    for (const key of maliciousCapabilityKeys) {
      expect(AgentExecutionStepSchema.safeParse({ ...step, toolKeys: [key] }).success, key).toBe(false);
      expect(AgentExecutionStepSchema.safeParse({ ...step, commandKeys: [key] }).success, key).toBe(false);
    }

    const payload = {
      version: '1.0.0' as const,
      dispatchId: 'dispatch_1',
      handlerRegistryVersion: '1.0.0',
      planId: 'plan_1',
      planVersion: 1,
      workspaceId: 'workspace_1',
      orchestratorRunId: 'run_1',
      contextReceiptId: 'ctx_1',
      maxParallelism: 1,
      stepKey: step.key,
      agentKey: step.agentKey,
      agentVersion: step.agentVersion,
      dependencies: step.dependencies,
      toolKeys: step.toolKeys,
      commandKeys: step.commandKeys,
      policyRefs: step.policyRefs,
      canonicalRefs: step.canonicalRefs,
      memoryRefs: step.memoryRefs,
      budget: step.budget,
    };
    expect(AgentExecutionWorkPayloadSchema.safeParse(payload).success).toBe(true);
    expect(AgentExecutionWorkPayloadSchema.safeParse({ ...payload, commandKeys: ['cmd;next'] }).success).toBe(false);
  });

  it('fails closed for recorded tool IDs and proposed command actions', () => {
    expect(AgentRunSchema.safeParse(run).success).toBe(true);
    expect(
      AgentRunSchema.safeParse({
        ...run,
        toolSummary: [{ toolKey: 'tool;next', status: 'succeeded', costMicros: 0 }],
      }).success,
    ).toBe(false);
    expect(
      AgentRunSchema.safeParse({
        ...run,
        proposedActions: [{ commandKey: 'command/escape', payload: {}, evidenceRefs: [] }],
      }).success,
    ).toBe(false);
  });
});
