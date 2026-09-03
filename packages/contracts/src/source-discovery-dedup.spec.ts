import { describe, expect, it } from 'vitest';
import { SourceDiscoveryDedupBatchSchema } from './source-discovery-dedup';

function candidate(candidateId: string, sourceReferenceId: string) {
  return {
    candidateId,
    objectType: 'business' as const,
    candidateState: 'unverified' as const,
    fields: { name: candidateId },
    fieldNames: ['name'],
    dataClassifications: ['PUBLIC_BUSINESS'] as const,
    storageClass: 'NORMALIZED_FACT' as const,
    sourceReferenceIds: [sourceReferenceId],
    observedAt: '2026-09-04T00:00:00.000Z',
  };
}

function batch() {
  return {
    version: '1.0.0' as const,
    batchId: 'dedup-batch-1',
    workspaceId: 'workspace-1',
    researchJobId: 'research-job-1',
    candidates: [candidate('candidate-1', 'reference-1'), candidate('candidate-2', 'reference-2')],
    evidence: [
      {
        candidateId: 'candidate-1',
        keyKind: 'website_origin' as const,
        keyValue: 'https://example.com',
        sourceReferenceIds: ['reference-1'],
      },
      {
        candidateId: 'candidate-2',
        keyKind: 'website_origin' as const,
        keyValue: 'HTTPS://EXAMPLE.COM',
        sourceReferenceIds: ['reference-2'],
      },
    ],
    groups: [
      {
        groupId: 'group-1',
        candidateIds: ['candidate-1', 'candidate-2'],
        decision: 'duplicate' as const,
        matchedKeys: [{ keyKind: 'website_origin' as const, keyValue: 'https://example.com' }],
        reasonCodes: ['dedup.website_origin_match'],
        canonicalizationState: 'unverified_candidates_only' as const,
      },
    ],
    evaluatedAt: '2026-09-04T00:01:00.000Z',
  };
}

describe('SourceDiscoveryDedupBatchSchema', () => {
  it('accepts provenance-bound deterministic duplicate evidence while candidates remain unverified', () => {
    const value = batch();
    expect(SourceDiscoveryDedupBatchSchema.parse(value)).toEqual(value);
    expect(value.candidates.every((item) => item.candidateState === 'unverified')).toBe(true);
    expect(value.groups[0]?.canonicalizationState).toBe('unverified_candidates_only');
  });

  it('rejects evidence for unknown candidates or undeclared source references', () => {
    expect(
      SourceDiscoveryDedupBatchSchema.safeParse({
        ...batch(),
        evidence: [{ ...batch().evidence[0], candidateId: 'candidate-missing' }],
      }).success,
    ).toBe(false);

    expect(
      SourceDiscoveryDedupBatchSchema.safeParse({
        ...batch(),
        evidence: [{ ...batch().evidence[0], sourceReferenceIds: ['reference-other'] }, batch().evidence[1]],
      }).success,
    ).toBe(false);
  });

  it('rejects groups whose declared matched key is not evidenced by every candidate', () => {
    const value = batch();
    value.evidence[1] = { ...value.evidence[1], keyValue: 'https://other.example' };
    expect(SourceDiscoveryDedupBatchSchema.safeParse(value).success).toBe(false);
  });

  it('allows normalized name/location evidence only as possible-duplicate evidence', () => {
    const value = batch();
    value.evidence = value.evidence.map((item) => ({
      ...item,
      keyKind: 'normalized_name_location' as const,
      keyValue: 'example dental|istanbul',
    }));
    value.groups[0] = {
      ...value.groups[0]!,
      matchedKeys: [{ keyKind: 'normalized_name_location' as const, keyValue: 'example dental|istanbul' }],
    };
    expect(SourceDiscoveryDedupBatchSchema.safeParse(value).success).toBe(false);

    value.groups[0] = { ...value.groups[0]!, decision: 'possible_duplicate' as const };
    expect(SourceDiscoveryDedupBatchSchema.safeParse(value).success).toBe(true);
  });

  it('rejects duplicate evidence and overlapping dedup groups', () => {
    const value = batch();
    value.evidence.push({ ...value.evidence[0]! });
    expect(SourceDiscoveryDedupBatchSchema.safeParse(value).success).toBe(false);

    const overlap = batch();
    overlap.groups.push({ ...overlap.groups[0]!, groupId: 'group-2' });
    expect(SourceDiscoveryDedupBatchSchema.safeParse(overlap).success).toBe(false);
  });
});
