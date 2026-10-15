import { createHash } from 'node:crypto';
import {
  persistBusinessResolutionDecision,
  persistCandidateBusinessMatchEvidence,
  persistCanonicalBusinessAlias,
  persistSourceBusinessObservation,
  type createPgPool,
  type PersistBusinessResolutionDecisionInput,
  type PersistCandidateBusinessMatchEvidenceInput,
  type PersistCanonicalBusinessAliasInput,
  type PersistSourceBusinessObservationInput,
} from '@brovexa/db';
import {
  BusinessResolutionEvaluationSchema,
  BusinessResolutionThresholdPolicySchema,
  CandidateBusinessMatchEvidenceSchema,
  SourceBusinessObservationSchema,
  generateDeterministicEntityCandidateKeys,
  type BusinessResolutionDecision,
  type BusinessResolutionThresholdPolicy,
  type CandidateBusinessMatchEvidence,
  type DeterministicEntityCandidateKey,
  type DeterministicCandidateKeyKind,
  type RawBusinessIdentitySignal,
} from '@brovexa/contracts';

// BusinessResolutionDecisionSchema permits at most 256 decision evidence IDs.
// Reject larger lookup batches before allocating or persisting match evidence.
export const MAX_ENTITY_RESOLUTION_LOOKUP_MATCHES = 256;

type WorkerPool = ReturnType<typeof createPgPool>;

export interface EntityResolutionObservationInput {
  workspaceId: string;
  sourceObservationId: string;
  sourceCandidateId: string;
  sourceKey: string;
  observedAt: Date;
  sourceReferenceIds: readonly string[];
  identitySignals: readonly RawBusinessIdentitySignal[];
}

export interface DeterministicCandidateLookupMatch {
  candidateCanonicalBusinessId: string;
  keyKind: DeterministicCandidateKeyKind;
  keyValue: string;
  keyScope: string | null;
  confidence: number;
}

export interface DeterministicCandidateLookupInput {
  workspaceId: string;
  keys: readonly DeterministicEntityCandidateKey[];
}

export type DeterministicCandidateLookup = (
  input: DeterministicCandidateLookupInput,
) => Promise<readonly DeterministicCandidateLookupMatch[]>;

export interface StructuredAiResolutionSeam {
  enabled: boolean;
}

export interface EntityResolutionPersistenceAdapter {
  persistObservation(input: PersistSourceBusinessObservationInput): Promise<unknown>;
  persistEvidence(input: PersistCandidateBusinessMatchEvidenceInput): Promise<unknown>;
  persistDecision(input: PersistBusinessResolutionDecisionInput): Promise<unknown>;
  persistAlias(input: PersistCanonicalBusinessAliasInput): Promise<unknown>;
}

export interface ResolveBusinessEntityInput {
  pool: WorkerPool;
  observation: EntityResolutionObservationInput;
  thresholdPolicy: BusinessResolutionThresholdPolicy;
  candidateLookup: DeterministicCandidateLookup;
  structuredAi?: StructuredAiResolutionSeam;
  evaluatedAt?: Date;
  persistence?: EntityResolutionPersistenceAdapter;
}

export interface EntityResolutionRuntimeResult {
  status: 'matched_existing' | 'review_required';
  sourceObservationId: string;
  candidateCanonicalBusinessId: string | null;
  evidence: CandidateBusinessMatchEvidence[];
  decision: BusinessResolutionDecision | null;
  reasonCodes: string[];
  aliasAttached: boolean;
}

function stableIdentifier(prefix: 'evidence' | 'decision', parts: readonly string[]): string {
  const hash = createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 40);
  return `${prefix}.${hash}`;
}

function keyIdentity(key: Pick<DeterministicEntityCandidateKey, 'keyKind' | 'keyScope' | 'keyValue'>): string {
  return [key.keyKind, key.keyScope ?? '', key.keyValue].join('\u0000');
}

/** Compare only own data properties: adapter-owned toJSON/getters are not trustworthy. */
function lookupKeysUnchanged(
  actual: readonly DeterministicEntityCandidateKey[],
  expected: readonly DeterministicEntityCandidateKey[],
): boolean {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  if (Reflect.ownKeys(actual).length !== expected.length + 1) return false;
  const fields = ['keyKind', 'keyValue', 'keyScope', 'strength', 'reasonCode'] as const;
  for (let i = 0; i < expected.length; i += 1) {
    const itemDescriptor = Object.getOwnPropertyDescriptor(actual, i);
    if (!itemDescriptor || !('value' in itemDescriptor)) return false;
    const item: unknown = itemDescriptor.value;
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    if (Reflect.ownKeys(item).length !== 7) return false;
    const original = expected[i]!;
    for (const field of fields) {
      const descriptor = Object.getOwnPropertyDescriptor(item, field);
      if (!descriptor || !('value' in descriptor) || descriptor.value !== original[field]) return false;
    }
    for (const field of ['signalIds', 'sourceReferenceIds'] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(item, field);
      if (!descriptor || !('value' in descriptor)) return false;
      const ids: unknown = descriptor.value;
      const previous = original[field];
      if (!Array.isArray(ids) || ids.length !== previous.length) return false;
      if (Reflect.ownKeys(ids).length !== previous.length + 1) return false;
      for (let k = 0; k < previous.length; k += 1) {
        const value = Object.getOwnPropertyDescriptor(ids, k);
        if (!value || !('value' in value) || value.value !== previous[k]) return false;
      }
    }
  }
  return true;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function assertDate(value: Date, field: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${field} must be a valid Date.`);
  }
}

function defaultPersistence(pool: WorkerPool): EntityResolutionPersistenceAdapter {
  return {
    persistObservation: (input) => persistSourceBusinessObservation(pool, input),
    persistEvidence: (input) => persistCandidateBusinessMatchEvidence(pool, input),
    persistDecision: (input) => persistBusinessResolutionDecision(pool, input),
    persistAlias: (input) => persistCanonicalBusinessAlias(pool, input),
  };
}

function reviewReasons(
  generation: ReturnType<typeof generateDeterministicEntityCandidateKeys>,
  candidateIds: readonly string[],
  candidateExactKeyIds: ReadonlySet<string>,
  generatedExactKeyIds: readonly string[],
  confidence: number,
  policy: BusinessResolutionThresholdPolicy,
): string[] {
  const reasons = new Set(generation.conflictReasonCodes);

  if (candidateIds.length > 1) reasons.add('identity_multiple_candidates');
  if (generatedExactKeyIds.length === 0) reasons.add('identity_suggestive_only');

  if (
    candidateIds.length === 1 &&
    generatedExactKeyIds.some((keyId) => !candidateExactKeyIds.has(keyId))
  ) {
    reasons.add('identity_exact_key_coverage_incomplete');
  }

  if (candidateIds.length === 1 && confidence < policy.autoMatchMinimum) {
    reasons.add('identity_below_auto_match_threshold');
  }

  if (reasons.size === 0) reasons.add('identity_review_required');
  return [...reasons].sort();
}

export async function resolveBusinessEntityDeterministically(
  input: ResolveBusinessEntityInput,
): Promise<EntityResolutionRuntimeResult> {
  if (input.structuredAi?.enabled) {
    throw new Error('Structured-AI entity matching is inactive and requires separate authorization.');
  }

  assertDate(input.observation.observedAt, 'observation.observedAt');
  const evaluatedAt = input.evaluatedAt ?? input.observation.observedAt;
  assertDate(evaluatedAt, 'evaluatedAt');
  const thresholdPolicy = BusinessResolutionThresholdPolicySchema.parse(input.thresholdPolicy);

  const generation = generateDeterministicEntityCandidateKeys(input.observation.identitySignals);
  const observation = SourceBusinessObservationSchema.parse({
    version: '1.0.0',
    workspaceId: input.observation.workspaceId,
    sourceObservationId: input.observation.sourceObservationId,
    sourceCandidateId: input.observation.sourceCandidateId,
    sourceKey: input.observation.sourceKey,
    observedAt: input.observation.observedAt.toISOString(),
    sourceReferenceIds: [...input.observation.sourceReferenceIds],
    identitySignals: generation.normalizedSignals,
  });

  const persistence = input.persistence ?? defaultPersistence(input.pool);
  await persistence.persistObservation({
    workspaceId: observation.workspaceId,
    sourceObservationId: observation.sourceObservationId,
    sourceCandidateId: observation.sourceCandidateId,
    sourceKey: observation.sourceKey,
    observedAt: new Date(observation.observedAt),
    sourceReferenceIds: observation.sourceReferenceIds,
    identitySignals: observation.identitySignals,
  });

  const keyByIdentity = new Map(generation.keys.map((key) => [keyIdentity(key), key]));
  // The injected lookup must not receive references to the canonical matching
  // keys: their evidence, strength and provenance remain worker-authoritative.
  const lookupKeys = generation.keys.map((key) => ({
    ...key,
    signalIds: [...key.signalIds],
    sourceReferenceIds: [...key.sourceReferenceIds],
  }));
  const expectedLookupKeys = lookupKeys.map((key) => ({
    ...key,
    signalIds: [...key.signalIds],
    sourceReferenceIds: [...key.sourceReferenceIds],
  }));
  const rawMatches = await input.candidateLookup({
    workspaceId: observation.workspaceId,
    keys: lookupKeys,
  });

  if (!lookupKeysUnchanged(lookupKeys, expectedLookupKeys)) {
    throw new Error('Deterministic candidate lookup must not mutate generated identity keys.');
  }

  if (!Array.isArray(rawMatches) || rawMatches.length > MAX_ENTITY_RESOLUTION_LOOKUP_MATCHES) {
    throw new Error(
      `Deterministic candidate lookup must return an array containing at most ${MAX_ENTITY_RESOLUTION_LOOKUP_MATCHES} matches.`,
    );
  }

  // Index-based admission avoids a callback-owned Symbol.iterator or sparse
  // array silently dropping candidates. Snapshot match fields exactly once.
  const seenMatches = new Set<string>();
  const matches: {
    match: DeterministicCandidateLookupMatch;
    key: DeterministicEntityCandidateKey;
    identity: string;
  }[] = [];
  for (let i = 0; i < rawMatches.length; i += 1) {
    if (!Object.prototype.hasOwnProperty.call(rawMatches, i)) {
      throw new Error('Deterministic candidate lookup returned a sparse matches array.');
    }
    const raw = rawMatches[i];
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('Deterministic candidate lookup returned a malformed candidate match.');
    }
    const { candidateCanonicalBusinessId, keyKind, keyValue, keyScope, confidence } = raw;
    if (
      typeof candidateCanonicalBusinessId !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(candidateCanonicalBusinessId)
    ) {
      throw new Error('Deterministic candidate lookup returned an invalid canonical business ID.');
    }
    if (
      typeof keyKind !== 'string' ||
      typeof keyValue !== 'string' ||
      (keyScope !== null && typeof keyScope !== 'string')
    ) {
      throw new Error('Deterministic candidate lookup returned a malformed candidate key.');
    }
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      throw new Error('Deterministic candidate lookup confidence must be between 0 and 1.');
    }
    const match: DeterministicCandidateLookupMatch = {
      candidateCanonicalBusinessId,
      keyKind,
      keyValue,
      keyScope,
      confidence,
    };
    const identity = keyIdentity(match);
    const key = keyByIdentity.get(identity);
    // Legacy NUL-joined identities are retained for deterministic evidence IDs,
    // but exact field equality prevents null/empty-scope tuple impersonation.
    if (
      !key || key.keyKind !== match.keyKind ||
      key.keyScope !== match.keyScope || key.keyValue !== match.keyValue
    ) {
      throw new Error('Deterministic candidate lookup returned a key outside the generated candidate set.');
    }
    const pair = JSON.stringify([candidateCanonicalBusinessId, keyKind, keyScope, keyValue]);
    if (seenMatches.has(pair)) {
      throw new Error('Deterministic candidate lookup returned a duplicate candidate/key match.');
    }
    seenMatches.add(pair);
    matches.push({ match, key, identity });
  }

  // A hostile result getter may tamper with key provenance after the first
  // check. Reject it before decision/evidence/alias persistence.
  if (!lookupKeysUnchanged(lookupKeys, expectedLookupKeys)) {
    throw new Error('Deterministic candidate lookup must not mutate generated identity keys.');
  }
  matches.sort((left, right) => {
    const a = `${left.match.candidateCanonicalBusinessId}\u0000${left.identity}`;
    const b = `${right.match.candidateCanonicalBusinessId}\u0000${right.identity}`;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  if (matches.length === 0) {
    return {
      status: 'review_required',
      sourceObservationId: observation.sourceObservationId,
      candidateCanonicalBusinessId: null,
      evidence: [],
      decision: null,
      reasonCodes: ['identity_no_candidate_evidence'],
      aliasAttached: false,
    };
  }

  const evidence = matches.map(({ match, key }) =>
    CandidateBusinessMatchEvidenceSchema.parse({
      evidenceId: stableIdentifier('evidence', [
        observation.workspaceId,
        observation.sourceObservationId,
        match.candidateCanonicalBusinessId,
        keyIdentity(key),
        String(match.confidence),
      ]),
      workspaceId: observation.workspaceId,
      sourceObservationId: observation.sourceObservationId,
      candidateCanonicalBusinessId: match.candidateCanonicalBusinessId,
      observationSignalIds: [...key.signalIds],
      sourceReferenceIds: [...key.sourceReferenceIds],
      method: 'deterministic' as const,
      inferenceRef: null,
      effect: 'supports_match' as const,
      reasonCode: key.reasonCode,
      confidence: match.confidence,
      recordedAt: evaluatedAt.toISOString(),
    }),
  );

  const candidateIds = sortedUnique(evidence.map((item) => item.candidateCanonicalBusinessId));
  const generatedExactKeyIds = generation.keys
    .filter((key) => key.strength === 'exact')
    .map(keyIdentity)
    .sort();

  const selectedCandidateId = candidateIds.length === 1 ? candidateIds[0] ?? null : null;
  const selectedMatches =
    selectedCandidateId === null
      ? []
      : matches.filter((item) => item.match.candidateCanonicalBusinessId === selectedCandidateId);
  const selectedExactMatches = selectedMatches.filter((item) => item.key.strength === 'exact');
  const selectedExactKeyIds = new Set(selectedExactMatches.map((item) => item.identity));
  const selectedConfidence =
    selectedExactMatches.length === 0
      ? Math.max(...selectedMatches.map((item) => item.match.confidence), 0)
      : Math.min(...selectedExactMatches.map((item) => item.match.confidence));

  const autoMatch =
    selectedCandidateId !== null &&
    candidateIds.length === 1 &&
    !generation.requiresReviewBeforeMatch &&
    generatedExactKeyIds.length > 0 &&
    generatedExactKeyIds.every((keyId) => selectedExactKeyIds.has(keyId)) &&
    selectedConfidence >= thresholdPolicy.autoMatchMinimum;

  const evidenceIds = evidence.map((item) => item.evidenceId);
  const decisionId = stableIdentifier('decision', [
    observation.workspaceId,
    observation.sourceObservationId,
    thresholdPolicy.policyId,
    thresholdPolicy.version,
    autoMatch ? 'match_existing' : 'review_required',
    selectedCandidateId ?? '',
    ...evidenceIds,
  ]);

  const decision = autoMatch
    ? ({
        decisionId,
        workspaceId: observation.workspaceId,
        sourceObservationId: observation.sourceObservationId,
        candidateCanonicalBusinessId: selectedCandidateId,
        decision: 'match_existing' as const,
        confidence: selectedConfidence,
        reviewState: 'not_required' as const,
        reviewDecisionRef: null,
        reasonCodes: sortedUnique([
          'identity_deterministic_auto_match',
          ...selectedMatches.map((item) => item.key.reasonCode),
        ]),
        evidenceIds: evidenceIds.filter((evidenceId) =>
          evidence.some(
            (item) =>
              item.evidenceId === evidenceId &&
              item.candidateCanonicalBusinessId === selectedCandidateId,
          ),
        ),
        evaluatedAt: evaluatedAt.toISOString(),
      }) satisfies BusinessResolutionDecision
    : ({
        decisionId,
        workspaceId: observation.workspaceId,
        sourceObservationId: observation.sourceObservationId,
        candidateCanonicalBusinessId: selectedCandidateId,
        decision: 'review_required' as const,
        confidence: selectedConfidence,
        reviewState: 'pending' as const,
        reviewDecisionRef: null,
        reasonCodes: reviewReasons(
          generation,
          candidateIds,
          selectedExactKeyIds,
          generatedExactKeyIds,
          selectedConfidence,
          thresholdPolicy,
        ),
        evidenceIds,
        evaluatedAt: evaluatedAt.toISOString(),
      }) satisfies BusinessResolutionDecision;

  BusinessResolutionEvaluationSchema.parse({
    version: '1.0.0',
    workspaceId: observation.workspaceId,
    observation,
    thresholdPolicy,
    evidence,
    decision,
  });

  for (const item of evidence) {
    await persistence.persistEvidence({
      ...item,
      recordedAt: new Date(item.recordedAt),
    });
  }

  await persistence.persistDecision({
    ...decision,
    thresholdPolicy,
    evaluatedAt: new Date(decision.evaluatedAt),
  });

  if (decision.decision === 'match_existing' && decision.candidateCanonicalBusinessId !== null) {
    await persistence.persistAlias({
      workspaceId: observation.workspaceId,
      sourceObservationId: observation.sourceObservationId,
      canonicalBusinessId: decision.candidateCanonicalBusinessId,
      decisionId: decision.decisionId,
      attachedAt: new Date(decision.evaluatedAt),
    });
  }

  return {
    status: decision.decision === 'match_existing' ? 'matched_existing' : 'review_required',
    sourceObservationId: observation.sourceObservationId,
    candidateCanonicalBusinessId: decision.candidateCanonicalBusinessId,
    evidence,
    decision,
    reasonCodes: decision.reasonCodes,
    aliasAttached: decision.decision === 'match_existing',
  };
}
