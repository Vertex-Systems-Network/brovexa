import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  agentRunTransitions,
  lifecycleActorTypeValues,
  memoryLifecycleEventTypeValues,
  memoryRecordLifecycleEvents,
} from './agent-lifecycle-schema';

describe('M01A AgentRun/memory lifecycle database schema contract', () => {
  it('keeps stable append-only lifecycle table names', () => {
    expect(getTableName(agentRunTransitions)).toBe('agent_run_transitions');
    expect(getTableName(memoryRecordLifecycleEvents)).toBe('memory_record_lifecycle_events');
  });

  it('keeps lifecycle actor kinds bounded', () => {
    expect(lifecycleActorTypeValues).toEqual(['system', 'user', 'agent', 'worker', 'curator']);
  });

  it('keeps memory lifecycle event kinds explicit', () => {
    expect(memoryLifecycleEventTypeValues).toEqual(['status_changed', 'superseded', 'deleted']);
  });
});
