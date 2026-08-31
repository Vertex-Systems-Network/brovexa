import type { AgentDefinition } from '@brovexa/contracts';
import { describe, expect, it } from 'vitest';
import { hashAgentDefinition } from './definition';

const base: AgentDefinition = {
  key: 'agent.control.context',
  version: 1,
  status: 'active',
  purpose: 'Build minimum necessary context.',
  nonGoals: ['External actions'],
  autonomyTier: 'T0',
  inputSchemaVersion: 1,
  outputSchemaVersion: 1,
  promptVersion: 1,
  skillVersion: 1,
  contextVersion: 1,
  tools: [{ key: 'context.read', access: 'internal.read' }],
  canonicalCommands: [],
  memoryCapabilities: [
    {
      scope: 'workspace',
      actions: ['read'],
      memoryTypes: ['semantic'],
    },
  ],
  allowedDataClassifications: ['public', 'internal'],
  budgets: {
    maxRuntimeMs: 30_000,
    maxConcurrency: 1,
    maxToolCalls: 8,
    maxContextTokens: 16_000,
    maxMemoryRecords: 64,
  },
  evaluatorKey: null,
  requiresIndependentEvaluation: false,
};

describe('hashAgentDefinition', () => {
  it('is deterministic for the same validated definition', () => {
    const first = hashAgentDefinition(base);
    const second = hashAgentDefinition({ ...base, budgets: { ...base.budgets } });
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when a security-relevant definition field changes', () => {
    expect(hashAgentDefinition(base)).not.toBe(
      hashAgentDefinition({
        ...base,
        allowedDataClassifications: ['public', 'internal', 'confidential'],
      }),
    );
  });
});
