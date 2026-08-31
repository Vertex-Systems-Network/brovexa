import type { AgentDefinition } from '@brovexa/contracts';
import { describe, expect, it } from 'vitest';
import { AgentRegistry, AgentRegistryError } from './registry';

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

function captureCode(work: () => unknown): AgentRegistryError['code'] | null {
  try {
    work();
    return null;
  } catch (error) {
    return error instanceof AgentRegistryError ? error.code : null;
  }
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
    expect(captureCode(() => registry.register(definition()))).toBe('DUPLICATE_AGENT_DEFINITION');
  });

  it('rejects external tool access in the provider-neutral foundation registry', () => {
    const code = captureCode(
      () =>
        new AgentRegistry([
          definition({
            autonomyTier: 'T2',
            tools: [{ key: 'source.search', access: 'external.read' }],
          }),
        ]),
    );
    expect(code).toBe('EXTERNAL_TOOL_ACCESS_NOT_ALLOWED');
  });

  it('rejects write tools that exceed the declared autonomy tier', () => {
    const code = captureCode(
      () =>
        new AgentRegistry([
          definition({
            autonomyTier: 'T1',
            tools: [{ key: 'memory.write', access: 'internal.write' }],
          }),
        ]),
    );
    expect(code).toBe('TOOL_ACCESS_EXCEEDS_AUTONOMY');
  });

  it('never lets ordinary agent definitions mutate system procedural memory', () => {
    const code = captureCode(
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
    );
    expect(code).toBe('SYSTEM_PROCEDURAL_MEMORY_WRITE_NOT_ALLOWED');
  });

  it('enforces the configured maximum autonomy tier', () => {
    const code = captureCode(
      () => new AgentRegistry([definition({ autonomyTier: 'T3', tools: [] })]),
    );
    expect(code).toBe('AUTONOMY_TIER_NOT_ALLOWED');
  });
});
