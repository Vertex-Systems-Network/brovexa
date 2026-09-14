import { describe, expect, it } from 'vitest';
import {
  SourceDiscoveryDedupBatchSchema,
  type SourceDiscoveryDedupBatch,
} from './source-discovery-dedup';

function candidate(
  candidateId: string,
  sourceReferenceId: string,
): SourceDiscoveryDedupBatch['candidates'][number] {
  return {
    candidateId,
    objectType: 'business',
    candidateState: 'unverified',
    fields: { name: candidateId },
    fieldNames: ['name'],
    dataClassifications: ['PUBLIC_BUSINESS'],
    storageClass: 'NORMALIZED_FACT',
    sourceReferenceIds: [sourceReferenceId],
    observedAt: '2026-09-04T00:00:00.000Z',
  };
}

function batch(): SourceDiscoveryDedupBatch {
  return {
    version: '1.0.0',
    batchId: 'dedup-batch-1',
    workspaceId: 'workspace-1',
    researchJobId: 'research-job-1',
    candidates: [candidate('candidate-1', 'reference-1'), candidate('candidate-2', 'reference-2')],
    evidence: [
      {
        candidateId: 'candidate-1',
        keyKind: 'website_origin',
        keyValue: 'https://example.com',
        keyScope: null,
        sourceReferenceIds: ['reference-1'],
      },
      {
        candidateId: 'candidate-2',
        keyKind: 'website_origin',
        keyValue: 'HTTPS://EXAMPLE.COM/',
        keyScope: null,
        sourceReferenceIds: ['reference-2'],
      },
    ],
    groups: [
      {
        groupId: 'group-1',
        candidateIds: ['candidate-1', 'candidate-2'],
        decision: 'duplicate',
        matchedKeys: [{ keyKind: 'website_origin', keyValue: 'https://example.com', keyScope: null }],
        reasonCodes: ['dedup.website_origin_match'],
        canonicalizationState: 'unverified_candidates_only',
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
    const unknownCandidate = batch();
    unknownCandidate.evidence = [{ ...unknownCandidate.evidence[0]!, candidateId: 'candidate-missing' }];
    expect(SourceDiscoveryDedupBatchSchema.safeParse(unknownCandidate).success).toBe(false);

    const undeclaredReference = batch();
    undeclaredReference.evidence[0] = {
      ...undeclaredReference.evidence[0]!,
      sourceReferenceIds: ['reference-other'],
    };
    expect(SourceDiscoveryDedupBatchSchema.safeParse(undeclaredReference).success).toBe(false);
  });

  it('rejects groups whose declared matched key is not evidenced by every candidate', () => {
    const value = batch();
    value.evidence[1] = { ...value.evidence[1]!, keyValue: 'https://other.example' };
    expect(SourceDiscoveryDedupBatchSchema.safeParse(value).success).toBe(false);
  });

  it('allows normalized name/location evidence only as possible-duplicate evidence', () => {
    const hardDuplicate = batch();
    hardDuplicate.evidence = hardDuplicate.evidence.map((item) => ({
      ...item,
      keyKind: 'normalized_name_location',
      keyValue: 'example dental|istanbul',
      keyScope: null,
    }));
    hardDuplicate.groups[0] = {
      ...hardDuplicate.groups[0]!,
      matchedKeys: [{ keyKind: 'normalized_name_location', keyValue: 'example dental|istanbul', keyScope: null }],
    };
    expect(SourceDiscoveryDedupBatchSchema.safeParse(hardDuplicate).success).toBe(false);

    const possibleDuplicate = structuredClone(hardDuplicate);
    possibleDuplicate.groups[0] = { ...possibleDuplicate.groups[0]!, decision: 'possible_duplicate' };
    expect(SourceDiscoveryDedupBatchSchema.safeParse(possibleDuplicate).success).toBe(true);
  });

  it('requires provider scope for source external references and does not merge equal refs across scopes', () => {
    const scoped = batch();
    scoped.evidence = [
      {
        candidateId: 'candidate-1',
        keyKind: 'source_external_ref',
        keyValue: '123',
        keyScope: 'source.directory_a',
        sourceReferenceIds: ['reference-1'],
      },
      {
        candidateId: 'candidate-2',
        keyKind: 'source_external_ref',
        keyValue: '123',
        keyScope: 'source.directory_b',
        sourceReferenceIds: ['reference-2'],
      },
    ];
    scoped.groups[0] = {
      ...scoped.groups[0]!,
      matchedKeys: [{ keyKind: 'source_external_ref', keyValue: '123', keyScope: 'source.directory_a' }],
    };
    expect(SourceDiscoveryDedupBatchSchema.safeParse(scoped).success).toBe(false);

    scoped.evidence[1] = { ...scoped.evidence[1]!, keyScope: 'source.directory_a' };
    expect(SourceDiscoveryDedupBatchSchema.safeParse(scoped).success).toBe(true);

    const unscoped = batch();
    unscoped.evidence[0] = {
      ...unscoped.evidence[0]!,
      keyKind: 'source_external_ref',
      keyValue: '123',
      keyScope: null,
    };
    expect(SourceDiscoveryDedupBatchSchema.safeParse(unscoped).success).toBe(false);
  });

  it('rejects unsafe or non-origin website identity keys', () => {
    const withPath = batch();
    withPath.evidence[0] = { ...withPath.evidence[0]!, keyValue: 'https://example.com/path' };
    expect(SourceDiscoveryDedupBatchSchema.safeParse(withPath).success).toBe(false);

    const withCredentials = batch();
    withCredentials.evidence[0] = { ...withCredentials.evidence[0]!, keyValue: 'https://user:secret@example.com/' };
    expect(SourceDiscoveryDedupBatchSchema.safeParse(withCredentials).success).toBe(false);

    const nonWeb = batch();
    nonWeb.evidence[0] = { ...nonWeb.evidence[0]!, keyValue: 'ftp://example.com/' };
    expect(SourceDiscoveryDedupBatchSchema.safeParse(nonWeb).success).toBe(false);
  });

  it('rejects duplicate evidence and overlapping dedup groups', () => {
    const duplicateEvidence = batch();
    duplicateEvidence.evidence.push({ ...duplicateEvidence.evidence[0]! });
    expect(SourceDiscoveryDedupBatchSchema.safeParse(duplicateEvidence).success).toBe(false);

    const overlap = batch();
    overlap.groups.push({ ...overlap.groups[0]!, groupId: 'group-2' });
    expect(SourceDiscoveryDedupBatchSchema.safeParse(overlap).success).toBe(false);
  });
});
