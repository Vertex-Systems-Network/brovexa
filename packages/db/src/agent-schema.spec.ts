import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  agentCheckpoints,
  agentRunStatusValues,
  agentRuns,
  contextReceipts,
  memoryConflicts,
  memoryRecords,
  memoryStatusValues,
  memoryTypeValues,
} from './agent-schema';

describe('agent and memory database schema contract', () => {
  it('keeps stable durable table names', () => {
    expect(getTableName(agentRuns)).toBe('agent_runs');
    expect(getTableName(agentCheckpoints)).toBe('agent_checkpoints');
    expect(getTableName(memoryRecords)).toBe('memory_records');
    expect(getTableName(memoryConflicts)).toBe('memory_conflicts');
    expect(getTableName(contextReceipts)).toBe('context_receipts');
  });

  it('keeps reviewed run and memory lifecycle values', () => {
    expect(agentRunStatusValues).toEqual([
      'pending',
      'running',
      'paused',
      'review',
      'succeeded',
      'failed',
      'cancelled',
    ]);
    expect(memoryTypeValues).toContain('research');
    expect(memoryStatusValues).toContain('quarantined');
  });
});
