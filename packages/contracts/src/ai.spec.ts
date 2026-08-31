import { describe, expect, it } from 'vitest';
import {
  AgentDefinitionSchema,
  AgentRunSchema,
  ContextReceiptSchema,
  EvalResultSchema,
  MemoryRecordSchema,
  isMemoryNamespaceAllowed,
} from './ai';

const baseAgentDefinition = {
  key: 'agent.control.context',
  version: '1.0.0',
  status: 'draft',
  purpose: 'Build minimum-necessary scoped context for one governed task.',
  nonGoals: ['Do not mutate canonical business state.'],
  triggerTypes: ['agent_run'],
  inputSchemaId: 'context.request.v1',
  outputSchemaId: 'context.receipt.v1',
  allowedTools: ['context.read'],
  allowedCommands: [],
  memory: {
    read: ['workspace/*', 'user/*', 'run/*', 'system/procedural/*'],
    propose: [],
    commit: [],
    supersede: [],
  },
  autonomyTier: 'T0',
  humanInterrupts: ['scope_conflict'],
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
  retryLimit: 1,
  budget: {
    maxTokens: 0,
    maxSearches: 0,
    maxApiCalls: 8,
    maxCredits: 0,
    maxCurrencyMicros: 0,
    maxRuntimeMs: 30_000,
    maxConcurrency: 1,
  },
  deterministicValidators: ['tenant_scope', 'policy_scope'],
  evidenceRequired: false,
  minimumConfidence: 0.8,
  reviewBelowConfidence: 0.9,
  evalSuiteId: 'AI-CONTEXT-001',
  evalThreshold: 0.99,
  dataClassifications: ['WORKSPACE_CONFIDENTIAL'],
  telemetryRedactionPolicyId: 'telemetry.default',
  owner: 'platform-ai',
  changeReason: 'Initial executable context-builder contract.',
} as const;

describe('AgentDefinitionSchema', () => {
  it('accepts a bounded deterministic agent definition', () => {
    const parsed = AgentDefinitionSchema.parse(baseAgentDefinition);
    expect(parsed.key).toBe('agent.control.context');
    expect(parsed.modelPolicy.routingMode).toBe('deterministic_only');
  });

  it('rejects direct procedural-memory mutation authority', () => {
    expect(() =>
      AgentDefinitionSchema.parse({
        ...baseAgentDefinition,
        memory: {
          ...baseAgentDefinition.memory,
          commit: ['system/procedural/policy'],
        },
      }),
    ).toThrow(/procedural memory/i);
  });

  it('requires human approval for T4 definitions', () => {
    expect(() =>
      AgentDefinitionSchema.parse({
        ...baseAgentDefinition,
        autonomyTier: 'T4',
        requiresHumanApproval: false,
      }),
    ).toThrow(/human approval/i);
  });

  it('prevents deterministic agents from claiming model routes', () => {
    expect(() =>
      AgentDefinitionSchema.parse({
        ...baseAgentDefinition,
        modelPolicy: {
          routingMode: 'deterministic_only',
          allowedProviderIds: ['provider-x'],
          allowedModelIds: ['model-x'],
          fallbackModelIds: [],
        },
      }),
    ).toThrow(/deterministic-only/i);
  });
});

describe('ContextReceiptSchema', () => {
  const receipt = {
    id: 'ctx_1',
    taskId: 'task_1',
    workspaceId: 'ws_alpha',
    userId: 'user_1',
    runId: 'run_1',
    agentKey: 'agent.control.context',
    agentVersion: '1.0.0',
    policyRefs: ['policy.source.v1'],
    canonicalRefs: ['business_1'],
    memoryRefs: [
      {
        memoryId: 'mem_1',
        version: '1',
        namespace: 'workspace/ws_alpha/business/business_1',
        authority: 'verified_fact',
        status: 'active',
      },
      {
        memoryId: 'mem_2',
        version: '1',
        namespace: 'user/user_1/workspace/ws_alpha/preference/language',
        authority: 'explicit_configuration',
        status: 'active',
      },
    ],
    tokenBudget: 4_000,
    maxCurrencyMicros: 50_000,
    createdAt: '2026-09-01T00:00:00.000Z',
  } as const;

  it('accepts only memory from the explicit workspace/user/run scope', () => {
    const parsed = ContextReceiptSchema.parse(receipt);
    expect(parsed.memoryRefs).toHaveLength(2);
    expect(isMemoryNamespaceAllowed('run/run_1/checkpoint/latest', receipt)).toBe(true);
  });

  it('fails closed on cross-workspace memory', () => {
    expect(() =>
      ContextReceiptSchema.parse({
        ...receipt,
        memoryRefs: [
          {
            ...receipt.memoryRefs[0],
            namespace: 'workspace/ws_other/business/business_1',
          },
        ],
      }),
    ).toThrow(/outside the receipt tenant/i);
  });
});

describe('MemoryRecordSchema', () => {
  const memory = {
    id: 'mem_1',
    version: '1',
    namespace: 'workspace/ws_alpha/research/market-1',
    workspaceId: 'ws_alpha',
    runId: 'run_1',
    type: 'research',
    subtype: 'query_coverage',
    subjectRefs: ['research_job_1'],
    contentSchemaId: 'memory.research.coverage',
    contentSchemaVersion: '1',
    content: { attemptedQueries: ['example'] },
    provenance: [{ kind: 'run', refId: 'run_1' }],
    writer: 'system',
    aiDerived: false,
    confidence: 1,
    authority: 'historical_context',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    status: 'active',
    retentionPolicyId: 'retention.research.default',
    readCapabilities: ['memory.view'],
    writeCapabilities: ['memory.manage'],
    dataClassification: 'WORKSPACE_CONFIDENTIAL',
    sourcePolicyRefs: [],
    jurisdictionRefs: [],
  } as const;

  it('accepts a provenance-bearing scoped memory record', () => {
    const parsed = MemoryRecordSchema.parse(memory);
    expect(parsed.namespace).toBe(memory.namespace);
  });

  it('requires derivation metadata for AI-derived memory', () => {
    expect(() => MemoryRecordSchema.parse({ ...memory, writer: 'agent', aiDerived: true })).toThrow(/derivation metadata/i);
  });

  it('requires an explicit reason when memory is deleted', () => {
    expect(() => MemoryRecordSchema.parse({ ...memory, status: 'deleted' })).toThrow(/deletion reason/i);

    const deleted = MemoryRecordSchema.parse({
      ...memory,
      status: 'deleted',
      deletionReason: 'Authorized workspace deletion request.',
    });
    expect(deleted.status).toBe('deleted');
  });

  it('rejects a namespace that disagrees with canonical scope fields', () => {
    expect(() =>
      MemoryRecordSchema.parse({
        ...memory,
        namespace: 'workspace/ws_other/research/market-1',
      }),
    ).toThrow(/canonical scope/i);
  });
});

describe('AgentRunSchema', () => {
  const run = {
    id: 'agent_run_1',
    workspaceId: 'ws_alpha',
    agentKey: 'agent.control.context',
    agentVersion: '1.0.0',
    executionMode: 'deterministic',
    promptVersion: '1.0.0',
    skillVersions: {},
    contextReceiptId: 'ctx_1',
    status: 'succeeded',
    result: { contextReceiptId: 'ctx_1' },
    confidence: 1,
    uncertainty: [],
    evidenceIds: [],
    factIds: [],
    sourceIds: [],
    assumptions: [],
    conflicts: [],
    toolSummary: [],
    cost: {
      inputTokens: 0,
      outputTokens: 0,
      searches: 0,
      apiCalls: 2,
      credits: 0,
      currencyMicros: 0,
    },
    validationState: 'passed',
    evaluatorState: 'not_required',
    proposedActions: [],
    startedAt: '2026-09-01T00:00:00.000Z',
    completedAt: '2026-09-01T00:00:01.000Z',
  } as const;

  it('separates deterministic execution from model/provider claims', () => {
    expect(AgentRunSchema.parse(run).executionMode).toBe('deterministic');

    expect(() => AgentRunSchema.parse({ ...run, providerId: 'provider-x', modelId: 'model-x' })).toThrow(
      /cannot claim model\/provider/i,
    );
  });

  it('requires provider and model identifiers for model execution', () => {
    expect(() => AgentRunSchema.parse({ ...run, executionMode: 'model' })).toThrow(/explicit provider and model/i);
  });
});

describe('EvalResultSchema', () => {
  const evaluation = {
    id: 'eval_1',
    evaluatorRunId: 'agent_run_eval',
    subjectRunId: 'agent_run_subject',
    decision: 'accept',
    evidenceState: 'verified',
    reasonCodes: ['evidence_complete'],
    evidenceRefs: ['evidence_1'],
    policyRefs: ['policy_1'],
    confidence: 0.99,
    createdAt: '2026-09-01T00:00:02.000Z',
  } as const;

  it('requires an independent evaluator run', () => {
    expect(() =>
      EvalResultSchema.parse({
        ...evaluation,
        evaluatorRunId: evaluation.subjectRunId,
      }),
    ).toThrow(/independent evaluation/i);
  });

  it('cannot accept non-verified evidence', () => {
    expect(() => EvalResultSchema.parse({ ...evaluation, evidenceState: 'insufficient' })).toThrow(/evidence is verified/i);
  });
});
