import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  persistedDataClassificationValues,
  persistedMemoryAuthorityValues,
  persistedMemoryStatusValues,
  persistedMemoryTypeValues,
  persistedMemoryWriterValues,
  memoryRecords,
} from './memory-record-schema';
import {
  agentEvalResults,
  persistedEvalDecisionValues,
  persistedEvidenceStateValues,
} from './eval-result-schema';

describe('M01A memory/evaluation database schema contract', () => {
  it('keeps stable persistence table names', () => {
    expect(getTableName(memoryRecords)).toBe('memory_records');
    expect(getTableName(agentEvalResults)).toBe('agent_eval_results');
  });

  it('keeps memory lifecycle and authority values aligned with executable contracts', () => {
    expect(persistedMemoryTypeValues).toEqual([
      'working',
      'semantic',
      'episodic',
      'procedural',
      'entity',
      'lead',
      'research',
      'workspace_user',
    ]);
    expect(persistedMemoryWriterValues).toEqual(['user', 'agent', 'system', 'curator']);
    expect(persistedMemoryAuthorityValues).toEqual([
      'platform_policy',
      'explicit_configuration',
      'verified_fact',
      'reviewed_human_decision',
      'evaluated_agent_conclusion',
      'agent_inference',
      'historical_context',
    ]);
    expect(persistedMemoryStatusValues).toEqual([
      'proposed',
      'active',
      'stale',
      'conflicted',
      'superseded',
      'rejected',
      'deleted',
    ]);
    expect(persistedDataClassificationValues).toContain('AI_DERIVED');
    expect(persistedDataClassificationValues).toContain('AUDIT_IMMUTABLE');
  });

  it('keeps evaluation decisions and evidence states aligned with executable contracts', () => {
    expect(persistedEvalDecisionValues).toEqual(['accept', 'reject', 'review']);
    expect(persistedEvidenceStateValues).toEqual([
      'verified',
      'insufficient',
      'contradicted',
      'stale',
      'policy_invalid',
    ]);
  });
});
