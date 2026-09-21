import { describe, expect, it } from 'vitest';
import type {
  EntityResolutionPersistenceAdapter,
  ResolveBusinessEntityInput,
} from './entity-resolution-runtime';
import { resolveBusinessEntityDeterministically } from './entity-resolution-runtime';

function createPersistenceRecorder() {
  const observations: unknown[] = [];
  const evidence: unknown[] = [];
  const decisions: unknown[] = [];
  const aliases: unknown[] = [];

  const adapter: EntityResolutionPersistenceAdapter = {
    async persistObservation(input) {
      observations.push(input);
    },
    async persistEvidence(input) {
      evidence.push(input);
    },
    async persistDecision(input) {
      decisions.push(input);
    },
    async persistAlias(input) {
      aliases.push(input);
    },
  };

  return { adapter, observations, evidence, decisions, aliases };
}

function baseInput(
  persistence: EntityResolutionPersistenceAdapter,
): Omit<ResolveBusinessEntityInput, 'candidateLookup'> {
  return {
    pool: {} as ResolveBusinessEntityInput['pool'],
    persistence,
    thresholdPolicy: {
      policyId: 'resolution.default',
      version: '1.0.0',
      reviewMinimum: 0.6,
      autoMatchMinimum: 0.9,
    },
    observation: {
      workspaceId: 'workspace.1',
      sourceObservationId: 'observation.1',
      sourceCandidateId: 'candidate.1',
      sourceKey: 'source.registry',
      observedAt: new Date('2026-09-21T00:00:00.000Z'),
      sourceReferenceIds: ['ref.domain', 'ref.name', 'ref.locality'],
      identitySignals: [
        {
          signalId: 'signal.domain',
          kind: 'domain',
          rawValue: 'Example.COM',
          sourceScope: null,
          sourceReferenceIds: ['ref.domain'],
        },
        {
          signalId: 'signal.name',
          kind: 'business_name',
          rawValue: 'Example & Co',
          sourceScope: null,
          sourceReferenceIds: ['ref.name'],
        },
        {
          signalId: 'signal.locality',
          kind: 'locality',
          rawValue: 'Multan',
          sourceScope: null,
          sourceReferenceIds: ['ref.locality'],
        },
      ],
    },
    evaluatedAt: new Date('2026-09-21T00:01:00.000Z'),
  };
}

describe('resolveBusinessEntityDeterministically', () => {
  it('auto-matches only one candidate that covers every exact key above threshold', async () => {
    const recorder = createPersistenceRecorder();
    const result = await resolveBusinessEntityDeterministically({
      ...baseInput(recorder.adapter),
      candidateLookup: async ({ keys }) => {
        const domain = keys.find((key) => key.keyKind === 'domain_exact');
        if (!domain) throw new Error('expected domain key');
        return [
          {
            candidateCanonicalBusinessId: 'business.1',
            keyKind: domain.keyKind,
            keyValue: domain.keyValue,
            keyScope: domain.keyScope,
            confidence: 0.99,
          },
        ];
      },
    });

    expect(result.status).toBe('matched_existing');
    expect(result.candidateCanonicalBusinessId).toBe('business.1');
    expect(result.aliasAttached).toBe(true);
    expect(recorder.observations).toHaveLength(1);
    expect(recorder.evidence).toHaveLength(1);
    expect(recorder.decisions).toHaveLength(1);
    expect(recorder.aliases).toHaveLength(1);
  });

  it('requires review when multiple canonical candidates match deterministic keys', async () => {
    const recorder = createPersistenceRecorder();
    const result = await resolveBusinessEntityDeterministically({
      ...baseInput(recorder.adapter),
      candidateLookup: async ({ keys }) => {
        const domain = keys.find((key) => key.keyKind === 'domain_exact');
        const locality = keys.find((key) => key.keyKind === 'name_locality');
        if (!domain || !locality) throw new Error('expected candidate keys');
        return [
          {
            candidateCanonicalBusinessId: 'business.1',
            keyKind: domain.keyKind,
            keyValue: domain.keyValue,
            keyScope: domain.keyScope,
            confidence: 0.99,
          },
          {
            candidateCanonicalBusinessId: 'business.2',
            keyKind: locality.keyKind,
            keyValue: locality.keyValue,
            keyScope: locality.keyScope,
            confidence: 0.8,
          },
        ];
      },
    });

    expect(result.status).toBe('review_required');
    expect(result.candidateCanonicalBusinessId).toBeNull();
    expect(result.reasonCodes).toContain('identity_multiple_candidates');
    expect(recorder.aliases).toHaveLength(0);
    expect(recorder.decisions).toHaveLength(1);
  });

  it('requires review when a unique candidate does not cover every generated exact key', async () => {
    const recorder = createPersistenceRecorder();
    const input = baseInput(recorder.adapter);
    input.observation.sourceReferenceIds = [
      ...input.observation.sourceReferenceIds,
      'ref.external',
    ];
    input.observation.identitySignals = [
      ...input.observation.identitySignals,
      {
        signalId: 'signal.external',
        kind: 'source_external_ref',
        rawValue: 'provider-123',
        sourceScope: 'source.registry',
        sourceReferenceIds: ['ref.external'],
      },
    ];

    const result = await resolveBusinessEntityDeterministically({
      ...input,
      candidateLookup: async ({ keys }) => {
        const domain = keys.find((key) => key.keyKind === 'domain_exact');
        if (!domain) throw new Error('expected domain key');
        return [
          {
            candidateCanonicalBusinessId: 'business.1',
            keyKind: domain.keyKind,
            keyValue: domain.keyValue,
            keyScope: domain.keyScope,
            confidence: 0.99,
          },
        ];
      },
    });

    expect(result.status).toBe('review_required');
    expect(result.reasonCodes).toContain('identity_exact_key_coverage_incomplete');
    expect(recorder.aliases).toHaveLength(0);
  });

  it('persists the normalized observation but does not fabricate candidate evidence when no candidate exists', async () => {
    const recorder = createPersistenceRecorder();
    const result = await resolveBusinessEntityDeterministically({
      ...baseInput(recorder.adapter),
      candidateLookup: async () => [],
    });

    expect(result).toMatchObject({
      status: 'review_required',
      candidateCanonicalBusinessId: null,
      evidence: [],
      decision: null,
      reasonCodes: ['identity_no_candidate_evidence'],
      aliasAttached: false,
    });
    expect(recorder.observations).toHaveLength(1);
    expect(recorder.evidence).toHaveLength(0);
    expect(recorder.decisions).toHaveLength(0);
  });

  it('keeps structured-AI matching inactive even when a caller attempts to enable the seam', async () => {
    const recorder = createPersistenceRecorder();

    await expect(
      resolveBusinessEntityDeterministically({
        ...baseInput(recorder.adapter),
        structuredAi: { enabled: true },
        candidateLookup: async () => [],
      }),
    ).rejects.toThrow(/separate authorization/);

    expect(recorder.observations).toHaveLength(0);
  });

  it('validates candidate evidence before invoking an injected persistence side effect', async () => {
    const recorder = createPersistenceRecorder();

    await expect(
      resolveBusinessEntityDeterministically({
        ...baseInput(recorder.adapter),
        candidateLookup: async ({ keys }) => {
          const domain = keys.find((key) => key.keyKind === 'domain_exact');
          if (!domain) throw new Error('expected domain key');
          return [
            {
              candidateCanonicalBusinessId: 'invalid candidate id with spaces',
              keyKind: domain.keyKind,
              keyValue: domain.keyValue,
              keyScope: domain.keyScope,
              confidence: 0.99,
            },
          ];
        },
      }),
    ).rejects.toThrow();

    expect(recorder.evidence).toHaveLength(0);
    expect(recorder.decisions).toHaveLength(0);
    expect(recorder.aliases).toHaveLength(0);
  });

  it('rejects lookup keys that were not generated from the approved observation evidence', async () => {
    const recorder = createPersistenceRecorder();

    await expect(
      resolveBusinessEntityDeterministically({
        ...baseInput(recorder.adapter),
        candidateLookup: async () => [
          {
            candidateCanonicalBusinessId: 'business.1',
            keyKind: 'domain_exact',
            keyValue: 'attacker.example',
            keyScope: null,
            confidence: 1,
          },
        ],
      }),
    ).rejects.toThrow(/outside the generated candidate set/);

    expect(recorder.decisions).toHaveLength(0);
    expect(recorder.aliases).toHaveLength(0);
  });

  it('creates a new immutable evaluation identity when deterministic confidence materially changes', async () => {
    const first = createPersistenceRecorder();
    const second = createPersistenceRecorder();

    const resolveWithConfidence = async (
      confidence: number,
      persistence: EntityResolutionPersistenceAdapter,
    ) =>
      resolveBusinessEntityDeterministically({
        ...baseInput(persistence),
        candidateLookup: async ({ keys }) => {
          const domain = keys.find((key) => key.keyKind === 'domain_exact');
          if (!domain) throw new Error('expected domain key');
          return [
            {
              candidateCanonicalBusinessId: 'business.1',
              keyKind: domain.keyKind,
              keyValue: domain.keyValue,
              keyScope: domain.keyScope,
              confidence,
            },
          ];
        },
      });

    const firstResult = await resolveWithConfidence(0.99, first.adapter);
    const secondResult = await resolveWithConfidence(0.95, second.adapter);

    expect(secondResult.evidence[0]?.evidenceId).not.toBe(firstResult.evidence[0]?.evidenceId);
    expect(secondResult.decision?.decisionId).not.toBe(firstResult.decision?.decisionId);
  });

  it('produces stable evidence and decision IDs independent of candidate lookup ordering', async () => {
    const first = createPersistenceRecorder();
    const second = createPersistenceRecorder();

    const lookup: ResolveBusinessEntityInput['candidateLookup'] = async ({ keys }) => {
      const domain = keys.find((key) => key.keyKind === 'domain_exact');
      const locality = keys.find((key) => key.keyKind === 'name_locality');
      if (!domain || !locality) throw new Error('expected keys');
      return [
        {
          candidateCanonicalBusinessId: 'business.1',
          keyKind: locality.keyKind,
          keyValue: locality.keyValue,
          keyScope: locality.keyScope,
          confidence: 0.95,
        },
        {
          candidateCanonicalBusinessId: 'business.1',
          keyKind: domain.keyKind,
          keyValue: domain.keyValue,
          keyScope: domain.keyScope,
          confidence: 0.99,
        },
      ];
    };

    const firstResult = await resolveBusinessEntityDeterministically({
      ...baseInput(first.adapter),
      candidateLookup: lookup,
    });
    const secondResult = await resolveBusinessEntityDeterministically({
      ...baseInput(second.adapter),
      candidateLookup: async (input) => [...(await lookup(input))].reverse(),
    });

    expect(secondResult.evidence.map((item) => item.evidenceId)).toEqual(
      firstResult.evidence.map((item) => item.evidenceId),
    );
    expect(secondResult.decision?.decisionId).toBe(firstResult.decision?.decisionId);
  });
});
