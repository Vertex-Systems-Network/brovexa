import { describe, expect, it } from 'vitest';
import { SourceDiscoveryDedupBatchSchema, type SourceDiscoveryDedupBatch } from './source-discovery-dedup';
import { evaluateSourceDiscoveryDedup } from './source-discovery-dedup-evaluator';

function candidate(candidateId: string, sourceReferenceId: string): SourceDiscoveryDedupBatch['candidates'][number] {
  return {
    candidateId,
    objectType: 'business',
    candidateState: 'unverified',
    fields: { name: candidateId },
    fieldNames: ['name'],
    dataClassifications: ['PUBLIC_BUSINESS'],
    storageClass: 'NORMALIZED_FACT',
    sourceReferenceIds: [sourceReferenceId],
    observedAt: '2026-09-08T00:00:00.000Z',
  };
}

function baseCandidates() {
  return [
    candidate('candidate-1', 'reference-1'),
    candidate('candidate-2', 'reference-2'),
    candidate('candidate-3', 'reference-3'),
  ];
}

describe('evaluateSourceDiscoveryDedup', () => {
  it('classifies a normalized website origin match as a deterministic duplicate', () => {
    const candidates = baseCandidates().slice(0, 2);
    const groups = evaluateSourceDiscoveryDedup({
      candidates,
      evidence: [
        {
          candidateId: 'candidate-1',
          keyKind: 'website_origin',
          keyValue: 'HTTPS://EXAMPLE.COM/',
          keyScope: null,
          sourceReferenceIds: ['reference-1'],
        },
        {
          candidateId: 'candidate-2',
          keyKind: 'website_origin',
          keyValue: 'https://example.com',
          keyScope: null,
          sourceReferenceIds: ['reference-2'],
        },
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      candidateIds: ['candidate-1', 'candidate-2'],
      decision: 'duplicate',
      matchedKeys: [{ keyKind: 'website_origin', keyValue: 'https://example.com', keyScope: null }],
      reasonCodes: ['dedup.website_origin_match'],
      canonicalizationState: 'unverified_candidates_only',
    });
  });

  it('keeps normalized name and location evidence at possible-duplicate strength', () => {
    const candidates = baseCandidates().slice(0, 2);
    const groups = evaluateSourceDiscoveryDedup({
      candidates,
      evidence: [
        {
          candidateId: 'candidate-1',
          keyKind: 'normalized_name_location',
          keyValue: 'Example Dental|Istanbul',
          keyScope: null,
          sourceReferenceIds: ['reference-1'],
        },
        {
          candidateId: 'candidate-2',
          keyKind: 'normalized_name_location',
          keyValue: 'example dental|istanbul',
          keyScope: null,
          sourceReferenceIds: ['reference-2'],
        },
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.decision).toBe('possible_duplicate');
    expect(groups[0]?.matchedKeys[0]?.keyValue).toBe('example dental|istanbul');
  });

  it('does not collapse equal provider references across different scopes', () => {
    const candidates = baseCandidates();
    const groups = evaluateSourceDiscoveryDedup({
      candidates,
      evidence: [
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
          keyScope: 'source.directory_a',
          sourceReferenceIds: ['reference-2'],
        },
        {
          candidateId: 'candidate-3',
          keyKind: 'source_external_ref',
          keyValue: '123',
          keyScope: 'source.directory_b',
          sourceReferenceIds: ['reference-3'],
        },
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.candidateIds).toEqual(['candidate-1', 'candidate-2']);
    expect(groups[0]?.matchedKeys[0]?.keyScope).toBe('source.directory_a');
  });

  it('produces the same groups and IDs regardless of candidate or evidence ordering', () => {
    const candidates = baseCandidates();
    const evidence: SourceDiscoveryDedupBatch['evidence'] = [
      {
        candidateId: 'candidate-1',
        keyKind: 'provider_fingerprint',
        keyValue: 'fingerprint-1',
        keyScope: 'connector.directory',
        sourceReferenceIds: ['reference-1'],
      },
      {
        candidateId: 'candidate-2',
        keyKind: 'provider_fingerprint',
        keyValue: 'fingerprint-1',
        keyScope: 'connector.directory',
        sourceReferenceIds: ['reference-2'],
      },
    ];

    const forward = evaluateSourceDiscoveryDedup({ candidates, evidence });
    const reversed = evaluateSourceDiscoveryDedup({
      candidates: [...candidates].reverse(),
      evidence: [...evidence].reverse(),
    });

    expect(reversed).toEqual(forward);
    expect(forward[0]?.groupId).toMatch(/^dedup-[0-9a-f]{24}$/);
  });

  it('resolves overlapping evidence into deterministic non-overlapping groups', () => {
    const candidates = baseCandidates();
    const groups = evaluateSourceDiscoveryDedup({
      candidates,
      evidence: [
        {
          candidateId: 'candidate-1',
          keyKind: 'website_origin',
          keyValue: 'https://shared.example',
          keyScope: null,
          sourceReferenceIds: ['reference-1'],
        },
        {
          candidateId: 'candidate-2',
          keyKind: 'website_origin',
          keyValue: 'https://shared.example',
          keyScope: null,
          sourceReferenceIds: ['reference-2'],
        },
        {
          candidateId: 'candidate-2',
          keyKind: 'provider_fingerprint',
          keyValue: 'fingerprint-overlap',
          keyScope: 'connector.directory',
          sourceReferenceIds: ['reference-2'],
        },
        {
          candidateId: 'candidate-3',
          keyKind: 'provider_fingerprint',
          keyValue: 'fingerprint-overlap',
          keyScope: 'connector.directory',
          sourceReferenceIds: ['reference-3'],
        },
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.candidateIds).toEqual(['candidate-1', 'candidate-2']);
    expect(new Set(groups.flatMap((group) => group.candidateIds)).size).toBe(
      groups.flatMap((group) => group.candidateIds).length,
    );
  });

  it('returns no group when no normalized key is shared by at least two candidates', () => {
    const candidates = baseCandidates().slice(0, 2);
    const groups = evaluateSourceDiscoveryDedup({
      candidates,
      evidence: [
        {
          candidateId: 'candidate-1',
          keyKind: 'website_origin',
          keyValue: 'https://one.example',
          keyScope: null,
          sourceReferenceIds: ['reference-1'],
        },
        {
          candidateId: 'candidate-2',
          keyKind: 'website_origin',
          keyValue: 'https://two.example',
          keyScope: null,
          sourceReferenceIds: ['reference-2'],
        },
      ],
    });

    expect(groups).toEqual([]);
  });

  it('fails closed on provenance-invalid evidence before evaluating groups', () => {
    const candidates = baseCandidates().slice(0, 2);

    expect(() =>
      evaluateSourceDiscoveryDedup({
        candidates,
        evidence: [
          {
            candidateId: 'candidate-1',
            keyKind: 'website_origin',
            keyValue: 'https://example.com',
            keyScope: null,
            sourceReferenceIds: ['reference-not-declared'],
          },
        ],
      }),
    ).toThrow();
  });

  it('emits groups that remain valid under the canonical dedup batch contract', () => {
    const candidates = baseCandidates().slice(0, 2);
    const evidence: SourceDiscoveryDedupBatch['evidence'] = [
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
        keyValue: 'https://example.com/',
        keyScope: null,
        sourceReferenceIds: ['reference-2'],
      },
    ];
    const groups = evaluateSourceDiscoveryDedup({ candidates, evidence });

    expect(
      SourceDiscoveryDedupBatchSchema.safeParse({
        version: '1.0.0',
        batchId: 'dedup-batch-regression',
        workspaceId: 'workspace-1',
        researchJobId: 'research-job-1',
        candidates,
        evidence,
        groups,
        evaluatedAt: '2026-09-08T00:01:00.000Z',
      }).success,
    ).toBe(true);
  });
});
