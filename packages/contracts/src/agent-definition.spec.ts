import { describe, expect, it } from 'vitest';
import type { AgentDefinition } from './agents';
import { hashAgentDefinition } from './agent-definition';

function definition(): AgentDefinition {
  return {
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
      maxContextTokens: 8_000,
      maxMemoryRecords: 64,
    },
    evaluatorKey: null,
    requiresIndependentEvaluation: false,
  };
}

describe('hashAgentDefinition', () => {
  it('is deterministic for the same reviewed definition', () => {
    const first = definition();
    const second = JSON.parse(JSON.stringify(first)) as AgentDefinition;
    expect(hashAgentDefinition(first)).toBe(hashAgentDefinition(second));
    expect(hashAgentDefinition(first)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when an authority-relevant definition field changes', () => {
    const first = definition();
    const second: AgentDefinition = {
      ...first,
      version: 2,
      promptVersion: 2,
    };
    expect(hashAgentDefinition(first)).not.toBe(hashAgentDefinition(second));
  });
});
