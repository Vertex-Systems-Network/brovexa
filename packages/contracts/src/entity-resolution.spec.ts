import { describe, expect, it } from 'vitest';
import {
  BusinessResolutionEvaluationSchema,
  CandidateBusinessMatchEvidenceSchema,
  CanonicalBusinessMergeRequestSchema,
  CanonicalBusinessSplitRequestSchema,
  SourceBusinessObservationSchema,
} from './entity-resolution';

const observation = {
  version: '1.0.0' as const,
  workspaceId: 'workspace.1',
  sourceObservationId: 'observation.1',
  sourceCandidateId: 'candidate.1',
  sourceKey: 'source.registry',
  observedAt: '2026-09-21T00:00:00.000Z',
  sourceReferenceIds: ['ref.1', 'ref.2'],
  identitySignals: [
    {
      signalId: 'signal.domain',
      kind: 'domain' as const,
      rawValue: 'Example.COM',
      normalizedValue: 'example.com',
      normalizationVersion: '1.0.0',
      sourceScope: null,
      sourceReferenceIds: ['ref.1'],
    },
    {
      signalId: 'signal.external',
      kind: 'source_external_ref' as const,
      rawValue: 'provider-123',
      normalizedValue: 'provider-123',
      normalizationVersion: '1.0.0',
      sourceScope: 'source.registry',
      sourceReferenceIds: ['ref.2'],
    },
  ],
};

const deterministicSupport = {
  evidenceId: 'evidence.1',
  workspaceId: 'workspace.1',
  sourceObservationId: 'observation.1',
  candidateCanonicalBusinessId: 'business.1',
  observationSignalIds: ['signal.domain'],
  sourceReferenceIds: ['ref.1'],
  method: 'deterministic' as const,
  inferenceRef: null,
  effect: 'supports_match' as const,
  reasonCode: 'identity_exact_domain',
  confidence: 0.99,
  recordedAt: '2026-09-21T00:01:00.000Z',
};

const thresholdPolicy = {
  policyId: 'resolution.default',
  version: '1.0.0',
  reviewMinimum: 0.6,
  autoMatchMinimum: 0.9,
};

describe('SourceBusinessObservationSchema', () => {
  it('keeps source observations separate from canonical identities with provenance-bound normalized signals', () => {
    const parsed = SourceBusinessObservationSchema.parse(observation);

    expect(parsed.sourceObservationId).toBe('observation.1');
    expect(parsed.identitySignals).toHaveLength(2);
  });

  it('rejects identity signal provenance outside the enclosing observation', () => {
    expect(() =>
      SourceBusinessObservationSchema.parse({
        ...observation,
        identitySignals: [
          {
            ...observation.identitySignals[0],
            sourceReferenceIds: ['ref.not-in-observation'],
          },
        ],
      }),
    ).toThrow(/provenance must be a subset/);
  });

  it('rejects provider-scoped external references attributed to a different source', () => {
    expect(() =>
      SourceBusinessObservationSchema.parse({
        ...observation,
        identitySignals: [
          {
            ...observation.identitySignals[1],
            sourceScope: 'source.other',
          },
        ],
      }),
    ).toThrow(/scoped to the source/);
  });
});

describe('CandidateBusinessMatchEvidenceSchema', () => {
  it('requires source-observation and canonical-business identity namespaces to remain distinct', () => {
    expect(() =>
      CandidateBusinessMatchEvidenceSchema.parse({
        ...deterministicSupport,
        candidateCanonicalBusinessId: 'observation.1',
      }),
    ).toThrow(/distinct identity namespaces/);
  });

  it('requires a provider-neutral inference reference for structured-AI evidence', () => {
    expect(() =>
      CandidateBusinessMatchEvidenceSchema.parse({
        ...deterministicSupport,
        method: 'structured_ai',
        inferenceRef: null,
      }),
    ).toThrow(/inference reference/);
  });
});

describe('BusinessResolutionEvaluationSchema', () => {
  it('accepts a high-confidence deterministic evidence-backed match without review', () => {
    const parsed = BusinessResolutionEvaluationSchema.parse({
      version: '1.0.0',
      workspaceId: 'workspace.1',
      observation,
      thresholdPolicy,
      evidence: [deterministicSupport],
      decision: {
        decisionId: 'decision.1',
        workspaceId: 'workspace.1',
        sourceObservationId: 'observation.1',
        candidateCanonicalBusinessId: 'business.1',
        decision: 'match_existing',
        confidence: 0.99,
        reviewState: 'not_required',
        reasonCodes: ['identity_exact_domain'],
        evidenceIds: ['evidence.1'],
        evaluatedAt: '2026-09-21T00:02:00.000Z',
      },
    });

    expect(parsed.decision.decision).toBe('match_existing');
  });

  it('rejects evidence provenance borrowed from an unrelated identity signal', () => {
    expect(() =>
      BusinessResolutionEvaluationSchema.parse({
        version: '1.0.0',
        workspaceId: 'workspace.1',
        observation,
        thresholdPolicy,
        evidence: [
          {
            ...deterministicSupport,
            observationSignalIds: ['signal.domain'],
            sourceReferenceIds: ['ref.2'],
          },
        ],
        decision: {
          decisionId: 'decision.provenance-laundering',
          workspaceId: 'workspace.1',
          sourceObservationId: 'observation.1',
          candidateCanonicalBusinessId: 'business.1',
          decision: 'match_existing',
          confidence: 0.99,
          reviewState: 'not_required',
          reasonCodes: ['identity_exact_domain'],
          evidenceIds: ['evidence.1'],
          evaluatedAt: '2026-09-21T00:02:00.000Z',
        },
      }),
    ).toThrow(/bound to the referenced identity signals/);
  });

  it('rejects cross-workspace candidate evidence before a resolution decision can be accepted', () => {
    expect(() =>
      BusinessResolutionEvaluationSchema.parse({
        version: '1.0.0',
        workspaceId: 'workspace.1',
        observation,
        thresholdPolicy,
        evidence: [
          {
            ...deterministicSupport,
            workspaceId: 'workspace.attacker',
          },
        ],
        decision: {
          decisionId: 'decision.cross-workspace',
          workspaceId: 'workspace.1',
          sourceObservationId: 'observation.1',
          candidateCanonicalBusinessId: 'business.1',
          decision: 'match_existing',
          confidence: 0.99,
          reviewState: 'not_required',
          reasonCodes: ['identity_exact_domain'],
          evidenceIds: ['evidence.1'],
          evaluatedAt: '2026-09-21T00:02:00.000Z',
        },
      }),
    ).toThrow(/workspace must match the evaluation workspace/);
  });

  it('fails closed when contradictory evidence is used to auto-match without review approval', () => {
    expect(() =>
      BusinessResolutionEvaluationSchema.parse({
        version: '1.0.0',
        workspaceId: 'workspace.1',
        observation,
        thresholdPolicy,
        evidence: [
          deterministicSupport,
          {
            ...deterministicSupport,
            evidenceId: 'evidence.2',
            observationSignalIds: ['signal.external'],
            sourceReferenceIds: ['ref.2'],
            effect: 'contradicts_match',
            reasonCode: 'identity_external_ref_conflict',
            confidence: 0.95,
          },
        ],
        decision: {
          decisionId: 'decision.2',
          workspaceId: 'workspace.1',
          sourceObservationId: 'observation.1',
          candidateCanonicalBusinessId: 'business.1',
          decision: 'match_existing',
          confidence: 0.96,
          reviewState: 'not_required',
          reasonCodes: ['identity_conflict_present'],
          evidenceIds: ['evidence.1', 'evidence.2'],
          evaluatedAt: '2026-09-21T00:02:00.000Z',
        },
      }),
    ).toThrow(/require explicit review approval/);
  });

  it('fails closed when structured-AI-assisted evidence is used to auto-match without review approval', () => {
    expect(() =>
      BusinessResolutionEvaluationSchema.parse({
        version: '1.0.0',
        workspaceId: 'workspace.1',
        observation,
        thresholdPolicy,
        evidence: [
          {
            ...deterministicSupport,
            method: 'structured_ai',
            inferenceRef: 'inference.entity-match.1',
          },
        ],
        decision: {
          decisionId: 'decision.3',
          workspaceId: 'workspace.1',
          sourceObservationId: 'observation.1',
          candidateCanonicalBusinessId: 'business.1',
          decision: 'match_existing',
          confidence: 0.99,
          reviewState: 'not_required',
          reasonCodes: ['identity_structured_ai_support'],
          evidenceIds: ['evidence.1'],
          evaluatedAt: '2026-09-21T00:02:00.000Z',
        },
      }),
    ).toThrow(/structured-AI-assisted matches require explicit review approval/);
  });

  it('requires approval before creating a new canonical entity despite material match evidence', () => {
    expect(() =>
      BusinessResolutionEvaluationSchema.parse({
        version: '1.0.0',
        workspaceId: 'workspace.1',
        observation,
        thresholdPolicy,
        evidence: [deterministicSupport],
        decision: {
          decisionId: 'decision.4',
          workspaceId: 'workspace.1',
          sourceObservationId: 'observation.1',
          candidateCanonicalBusinessId: null,
          decision: 'create_new',
          confidence: 0.2,
          reviewState: 'not_required',
          reasonCodes: ['identity_create_new'],
          evidenceIds: ['evidence.1'],
          evaluatedAt: '2026-09-21T00:02:00.000Z',
        },
      }),
    ).toThrow(/requires explicit review approval/);
  });
});

describe('reversible canonical business change requests', () => {
  it('requires merge targets to be one of the reviewed source identities', () => {
    expect(() =>
      CanonicalBusinessMergeRequestSchema.parse({
        version: '1.0.0',
        requestId: 'merge.1',
        workspaceId: 'workspace.1',
        evidenceIds: ['evidence.1'],
        reasonCodes: ['identity_duplicate_confirmed'],
        requestedByActorId: 'user.1',
        requestedAt: '2026-09-21T00:03:00.000Z',
        reviewState: 'pending',
        reversible: true,
        sourceCanonicalBusinessIds: ['business.1', 'business.2'],
        targetCanonicalBusinessId: 'business.3',
      }),
    ).toThrow(/target must be one of the source/);
  });

  it('requires split requests to anchor prior lineage and restore the current surviving identity', () => {
    const parsed = CanonicalBusinessSplitRequestSchema.parse({
      version: '1.0.0',
      requestId: 'split.1',
      workspaceId: 'workspace.1',
      evidenceIds: ['evidence.2'],
      reasonCodes: ['identity_merge_reversal'],
      requestedByActorId: 'user.1',
      requestedAt: '2026-09-21T00:04:00.000Z',
      reviewState: 'pending',
      reversible: true,
      canonicalBusinessId: 'business.1',
      lineageOperationId: 'lineage.merge.1',
      restoreCanonicalBusinessIds: ['business.1', 'business.2'],
    });

    expect(parsed.reversible).toBe(true);
    expect(parsed.reviewState).toBe('pending');
  });
});
