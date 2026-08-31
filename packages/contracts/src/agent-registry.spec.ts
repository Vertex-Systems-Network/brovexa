import { describe, expect, it } from 'vitest';
import type { AgentDefinition } from './agents';
import { AgentRegistry, AgentRegistryError } from './agent-registry';

function definition(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
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
        memoryTypes: ['semantic', 'episodic', 'research'],
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
    ...overrides,
  };
}

function expectRegistryCode(code: AgentRegistryError['code']) {
  return (error: unknown) => error instanceof AgentRegistryError && error.code === code;
}

describe('AgentRegistry', () => {
  it('registers immutable definitions and resolves exact capabilities', () => {
    const registry = new AgentRegistry([definition()]);
    const registered = registry.get('agent.control.context', 1);

    expect(Object.isFrozen(registered)).toBe(true);
    expect(Object.isFrozen(registered.memoryCapabilities)).toBe(true);
    expect(registry.canUseTool('agent.control.context', 1, 'context.read', 'internal.read')).toBe(true);
    expect(
      registry.canAccessMemory('agent.control.context', 1, 'workspace', 'read', 'semantic'),
    ).toBe(true);
    expect(
      registry.canAccessMemory('agent.control.context', 1, 'workspace', 'commit', 'semantic'),
    ).toBe(false);
  });

  it('rejects duplicate key/version registration', () => {
    const registry = new AgentRegistry([definition()]);
    expect(() => registry.register(definition())).toThrowError(
      expect.objectContaining({ code: 'DUPLICATE_AGENT_DEFINITION' }),
    );
  });

  it('rejects external tool access in the provider-neutral foundation registry', () => {
    expect(
      () =>
        new AgentRegistry([
          definition({
            autonomyTier: 'T2',
            tools: [{ key: 'source.search', access: 'external.read' }],
          }),
        ]),
    ).toThrowError(expectRegistryCode('EXTERNAL_TOOL_ACCESS_NOT_ALLOWED'));
  });

  it('rejects write tools that exceed the declared autonomy tier', () => {
    expect(
      () =>
        new AgentRegistry([
          definition({
            autonomyTier: 'T1',
            tools: [{ key: 'memory.write', access: 'internal.write' }],
          }),
        ]),
    ).toThrowError(expectRegistryCode('TOOL_ACCESS_EXCEEDS_AUTONOMY'));
  });

  it('rejects canonical commands below proposal autonomy', () => {
    expect(
      () => new AgentRegistry([definition({ canonicalCommands: ['memory.propose'] })]),
    ).toThrowError(expectRegistryCode('COMMAND_ACCESS_EXCEEDS_AUTONOMY'));
  });

  it('allows only explicitly reviewed canonical commands in foundation mode', () => {
    const allowed = new AgentRegistry([
      definition({
        key: 'agent.control.memory_curator',
        autonomyTier: 'T2',
        tools: [{ key: 'memory.proposal.write', access: 'internal.write' }],
        canonicalCommands: ['memory.propose'],
        memoryCapabilities: [
          {
            scope: 'workspace',
            actions: ['read', 'propose'],
            memoryTypes: ['semantic'],
          },
        ],
      }),
    ]);
    expect(allowed.get('agent.control.memory_curator', 1).canonicalCommands).toEqual(['memory.propose']);

    expect(
      () =>
        new AgentRegistry([
          definition({
            autonomyTier: 'T2',
            tools: [],
            canonicalCommands: ['workspace.delete'],
          }),
        ]),
    ).toThrowError(expectRegistryCode('CANONICAL_COMMAND_NOT_ALLOWED'));
  });

  it('never lets ordinary agent definitions mutate system procedural memory', () => {
    expect(
      () =>
        new AgentRegistry([
          definition({
            autonomyTier: 'T2',
            memoryCapabilities: [
              {
                scope: 'system.procedural',
                actions: ['read', 'commit'],
                memoryTypes: ['procedural'],
              },
            ],
          }),
        ]),
    ).toThrowError(expectRegistryCode('SYSTEM_PROCEDURAL_MEMORY_WRITE_NOT_ALLOWED'));
  });

  it('enforces the configured maximum autonomy tier', () => {
    expect(() => new AgentRegistry([definition({ autonomyTier: 'T3', tools: [] })])).toThrowError(
      expectRegistryCode('AUTONOMY_TIER_NOT_ALLOWED'),
    );
  });
});
