import { describe, expect, it } from 'vitest';
import {
  AgentDefinitionSchema,
  AgentRunSchema,
  ContextReceiptSchema,
  MemoryProvenanceSchema,
  agentAutonomyTierValues,
  memoryStatusValues,
  memoryTypeValues,
} from './agents';

const validDefinition = {
  key: 'agent.control.context',
  version: 1,
  status: 'active',
  purpose: 'Build the minimum necessary context for an approved agent run.',
  nonGoals: ['Execute external actions', 'Mutate canonical business state'],
  autonomyTier: 'T0',
  inputSchemaVersion: 1,
  outputSchemaVersion: 1,
  promptVersion: 1,
  skillVersion: 1,
  contextVersion: 1,
  tools: [{ key: 'context.canonical.read', access: 'internal.read' }],
  canonicalCommands: [],
  memoryCapabilities: [
    {
      scope: 'workspace',
      actions: ['read'],
      memoryTypes: ['semantic', 'episodic', 'research'],
    },
  ],
  allowedDataClassifications: ['public', 'internal', 'confidential'],
  budgets: {
    maxRuntimeMs: 30_000,
    maxConcurrency: 1,
    maxToolCalls: 16,
    maxContextTokens: 32_000,
    maxMemoryRecords: 128,
  },
  evaluatorKey: null,
  requiresIndependentEvaluation: false,
} as const;

describe('agent and memory contracts', () => {
  it('keeps reviewed autonomy and memory lifecycle values stable', () => {
    expect(agentAutonomyTierValues).toEqual(['T0', 'T1', 'T2', 'T3', 'T4']);
    expect(memoryTypeValues).toEqual([
      'working',
      'semantic',
      'episodic',
      'procedural',
      'entity',
      'lead',
      'research',
      'workspace_user',
    ]);
    expect(memoryStatusValues).toContain('quarantined');
  });

  it('accepts an explicit least-privilege agent definition', () => {
    expect(AgentDefinitionSchema.parse(validDefinition)).toMatchObject({
      key: 'agent.control.context',
      autonomyTier: 'T0',
    });
  });

  it('binds public AgentRun identity to membership and immutable definition hash', () => {
    const parsed = AgentRunSchema.parse({
      id: '7dce6275-287a-4638-8294-4f8865399427',
      workspaceId: '4a42ae1a-53b3-4998-a6f3-50d3e840d0aa',
      parentRunId: null,
      requestedByMembershipId: 'd3914853-242a-4129-828e-fe5860b2d1e3',
      agentKey: 'agent.control.context',
      agentVersion: 1,
      definitionHash: 'a'.repeat(64),
      status: 'pending',
      correlationId: '8bca2527-f8f7-40a6-acf2-7846d98b5e82',
      input: {},
      startedAt: null,
      completedAt: null,
      createdAt: '2026-08-31T16:00:00.000Z',
      updatedAt: '2026-08-31T16:00:00.000Z',
    });
    expect(parsed.requestedByMembershipId).toBe('d3914853-242a-4129-828e-fe5860b2d1e3');
    expect(parsed.definitionHash).toHaveLength(64);
  });

  it('requires an evaluator identity when independent evaluation is enabled', () => {
    const parsed = AgentDefinitionSchema.safeParse({
      ...validDefinition,
      requiresIndependentEvaluation: true,
      evaluatorKey: null,
    });
    expect(parsed.success).toBe(false);
  });

  it('requires durable memory to carry provenance', () => {
    const parsed = MemoryProvenanceSchema.safeParse({
      evidenceIds: [],
      factIds: [],
      runIds: [],
      userDecisionIds: [],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a context receipt that claims more context than its token budget', () => {
    const parsed = ContextReceiptSchema.safeParse({
      id: '7dce6275-287a-4638-8294-4f8865399427',
      workspaceId: '4a42ae1a-53b3-4998-a6f3-50d3e840d0aa',
      agentRunId: 'd3914853-242a-4129-828e-fe5860b2d1e3',
      agentKey: 'agent.control.context',
      agentVersion: 1,
      contextVersion: 1,
      tokenBudget: 100,
      selectedTokenCost: 101,
      selectedItems: [],
      selectionDigest: 'a'.repeat(64),
      createdAt: '2026-08-31T16:00:00.000Z',
    });
    expect(parsed.success).toBe(false);
  });
});
