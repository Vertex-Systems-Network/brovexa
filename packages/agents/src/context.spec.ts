import type { AgentDefinition } from '@brovexa/contracts';
import { describe, expect, it } from 'vitest';
import {
  ContextSelectionError,
  buildContextSelection,
  type ContextCandidate,
} from './context';

const workspaceA = 'a5f8fa4b-0de1-42f6-8535-78110e5cb5b1';
const workspaceB = '7e7240b8-83fe-44f0-ac66-77f386ca074b';
const userA = 'ee7c0037-99b1-4649-b036-cb2f7c6b2844';

const definition: AgentDefinition = {
  key: 'agent.control.context',
  version: 1,
  status: 'active',
  purpose: 'Build minimum necessary context.',
  nonGoals: ['Execute external actions'],
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
    maxContextTokens: 1_000,
    maxMemoryRecords: 64,
  },
  evaluatorKey: null,
  requiresIndependentEvaluation: false,
};

function candidate(overrides: Partial<ContextCandidate> = {}): ContextCandidate {
  return {
    sourceKind: 'memory',
    referenceType: 'memory.record',
    referenceId: 'memory-a',
    workspaceId: workspaceA,
    userId: null,
    required: false,
    authorityClass: 5,
    relevanceBps: 8_000,
    confidenceBps: 8_000,
    tokenCost: 100,
    memoryStatus: 'active',
    conflicted: false,
    observedAt: '2026-08-31T15:00:00.000Z',
    expiresAt: '2026-09-30T00:00:00.000Z',
    ...overrides,
  };
}

function captureCode(work: () => unknown): ContextSelectionError['code'] | null {
  try {
    work();
    return null;
  } catch (error) {
    return error instanceof ContextSelectionError ? error.code : null;
  }
}

describe('buildContextSelection', () => {
  it('rejects cross-tenant and cross-user optional memory instead of leaking it', () => {
    const selection = buildContextSelection({
      definition,
      workspaceId: workspaceA,
      userId: userA,
      tokenBudget: 500,
      now: new Date('2026-08-31T16:00:00.000Z'),
      candidates: [
        candidate({ referenceId: 'tenant-b', workspaceId: workspaceB }),
        candidate({ referenceId: 'other-user', userId: '0d300afd-0d64-4b6b-a42c-8099d439496e' }),
        candidate({ referenceId: 'allowed' }),
      ],
    });

    expect(selection.selectedItems.map((item) => item.referenceId)).toEqual(['allowed']);
    expect(selection.rejected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ referenceId: 'tenant-b', reason: 'WORKSPACE_MISMATCH' }),
        expect.objectContaining({ referenceId: 'other-user', reason: 'USER_SCOPE_MISMATCH' }),
      ]),
    );
  });

  it('fails closed when required context crosses a tenant boundary', () => {
    const code = captureCode(() =>
      buildContextSelection({
        definition,
        workspaceId: workspaceA,
        userId: userA,
        tokenBudget: 500,
        candidates: [candidate({ workspaceId: workspaceB, required: true })],
      }),
    );
    expect(code).toBe('REQUIRED_CONTEXT_UNAVAILABLE');
  });

  it('excludes stale/conflicted/expired memory from optional context', () => {
    const selection = buildContextSelection({
      definition,
      workspaceId: workspaceA,
      userId: userA,
      tokenBudget: 500,
      now: new Date('2026-08-31T16:00:00.000Z'),
      candidates: [
        candidate({ referenceId: 'stale', memoryStatus: 'stale' }),
        candidate({ referenceId: 'conflicted', conflicted: true }),
        candidate({ referenceId: 'expired', expiresAt: '2026-08-31T15:59:59.000Z' }),
      ],
    });

    expect(selection.selectedItems).toEqual([]);
    expect(selection.rejected.map((item) => item.reason).sort()).toEqual([
      'MEMORY_CONFLICTED',
      'MEMORY_EXPIRED',
      'MEMORY_NOT_ACTIVE',
    ]);
  });

  it('always fits required context first and deterministically ranks optional context', () => {
    const selection = buildContextSelection({
      definition,
      workspaceId: workspaceA,
      userId: null,
      tokenBudget: 250,
      candidates: [
        candidate({
          sourceKind: 'canonical',
          referenceType: 'business',
          referenceId: 'required-business',
          required: true,
          authorityClass: 3,
          tokenCost: 100,
        }),
        candidate({ referenceId: 'lower-authority', authorityClass: 6, tokenCost: 100 }),
        candidate({ referenceId: 'higher-authority', authorityClass: 4, tokenCost: 100 }),
      ],
    });

    expect(selection.selectedItems.map((item) => item.referenceId)).toEqual([
      'required-business',
      'higher-authority',
    ]);
    expect(selection.selectedTokenCost).toBe(200);
    expect(selection.selectionDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(selection.rejected).toContainEqual(
      expect.objectContaining({ referenceId: 'lower-authority', reason: 'OPTIONAL_BUDGET_EXHAUSTED' }),
    );
  });

  it('refuses to exceed the AgentDefinition context budget', () => {
    const code = captureCode(() =>
      buildContextSelection({
        definition,
        workspaceId: workspaceA,
        userId: null,
        tokenBudget: 1_001,
        candidates: [],
      }),
    );
    expect(code).toBe('CONTEXT_BUDGET_EXCEEDS_AGENT_LIMIT');
  });

  it('fails rather than silently dropping required context when the budget is insufficient', () => {
    const code = captureCode(() =>
      buildContextSelection({
        definition,
        workspaceId: workspaceA,
        userId: null,
        tokenBudget: 100,
        candidates: [candidate({ required: true, tokenCost: 101 })],
      }),
    );
    expect(code).toBe('REQUIRED_CONTEXT_EXCEEDS_BUDGET');
  });
});
