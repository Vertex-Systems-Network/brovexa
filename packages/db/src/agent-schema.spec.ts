import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  agentAutonomyTierValues,
  agentContextReceipts,
  agentDefinitionStatusValues,
  agentDefinitions,
  agentExecutionModeValues,
  agentRuns,
  persistedAgentRunStatusValues,
} from './agent-schema';

describe('agent persistence schema contract', () => {
  it('keeps stable canonical table names', () => {
    expect(getTableName(agentDefinitions)).toBe('agent_definitions');
    expect(getTableName(agentContextReceipts)).toBe('agent_context_receipts');
    expect(getTableName(agentRuns)).toBe('agent_runs');
  });

  it('keeps reviewed definition and autonomy states', () => {
    expect(agentDefinitionStatusValues).toEqual(['draft', 'approved', 'disabled']);
    expect(agentAutonomyTierValues).toEqual(['T0', 'T1', 'T2', 'T3', 'T4']);
  });

  it('keeps deterministic/model execution and run lifecycle states explicit', () => {
    expect(agentExecutionModeValues).toEqual(['deterministic', 'model']);
    expect(persistedAgentRunStatusValues).toEqual([
      'queued',
      'running',
      'succeeded',
      'failed',
      'blocked',
      'budget_stopped',
      'cancelled',
      'review_required',
    ]);
  });
});
