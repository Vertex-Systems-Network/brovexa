import { describe, expect, it } from 'vitest';
import type {
  EntityResolutionPersistenceAdapter,
  ResolveBusinessEntityInput,
} from './entity-resolution-runtime';
import { resolveBusinessEntityDeterministically } from './entity-resolution-runtime';

function recorder() {
  const evidence: unknown[] = [];
  const decisions: unknown[] = [];
  const aliases: unknown[] = [];
  const adapter: EntityResolutionPersistenceAdapter = {
    async persistObservation() {},
    async persistEvidence(value) { evidence.push(value); },
    async persistDecision(value) { decisions.push(value); },
    async persistAlias(value) { aliases.push(value); },
  };
  return { adapter, evidence, decisions, aliases };
}

function suggestiveInput(persistence: EntityResolutionPersistenceAdapter): Omit<ResolveBusinessEntityInput, 'candidateLookup'> {
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
      sourceObservationId: 'observation.adversarial.1',
      sourceCandidateId: 'candidate.adversarial.1',
      sourceKey: 'source.registry',
      observedAt: new Date('2026-09-22T00:00:00.000Z'),
      sourceReferenceIds: ['ref.name', 'ref.locality'],
      identitySignals: [
        {
          signalId: 'signal.name',
          kind: 'business_name',
          rawValue: 'Same Name Trading',
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
    evaluatedAt: new Date('2026-09-22T00:01:00.000Z'),
  };
}

describe('M03-ER-006 runtime collision and bypass resistance', () => {
  it('never auto-matches a suggestive-only name/locality collision even at confidence 1', async () => {
    const state = recorder();
    const result = await resolveBusinessEntityDeterministically({
      ...suggestiveInput(state.adapter),
      candidateLookup: async ({ keys }) => {
        const suggestive = keys.find((key) => key.keyKind === 'name_locality');
        if (!suggestive) throw new Error('expected name/locality key');
        return [{
          candidateCanonicalBusinessId: 'business.attacker-collision',
          keyKind: suggestive.keyKind,
          keyValue: suggestive.keyValue,
          keyScope: suggestive.keyScope,
          confidence: 1,
        }];
      },
    });

    expect(result.status).toBe('review_required');
    expect(result.reasonCodes).toContain('identity_suggestive_only');
    expect(state.aliases).toHaveLength(0);
    expect(state.decisions).toHaveLength(1);
  });

  it('rejects duplicate candidate/key replay before durable evidence or decisions are emitted', async () => {
    const state = recorder();

    await expect(
      resolveBusinessEntityDeterministically({
        ...suggestiveInput(state.adapter),
        candidateLookup: async ({ keys }) => {
          const suggestive = keys.find((key) => key.keyKind === 'name_locality');
          if (!suggestive) throw new Error('expected name/locality key');
          const duplicate = {
            candidateCanonicalBusinessId: 'business.1',
            keyKind: suggestive.keyKind,
            keyValue: suggestive.keyValue,
            keyScope: suggestive.keyScope,
            confidence: 0.99,
          };
          return [duplicate, duplicate];
        },
      }),
    ).rejects.toThrow(/duplicate candidate\/key match/);

    expect(state.evidence).toHaveLength(0);
    expect(state.decisions).toHaveLength(0);
    expect(state.aliases).toHaveLength(0);
  });
});
