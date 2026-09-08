import { createHash } from 'node:crypto';
import {
  SourceDiscoveryDedupBatchSchema,
  type SourceDiscoveryDedupBatch,
  type SourceDiscoveryDedupEvidence,
  type SourceDiscoveryDedupGroup,
  type SourceDiscoveryDedupMatchedKey,
} from './source-discovery-dedup';

export type SourceDiscoveryDedupEvaluationInput = Pick<SourceDiscoveryDedupBatch, 'candidates' | 'evidence'>;

type DedupBucket = {
  identity: string;
  key: SourceDiscoveryDedupMatchedKey;
  candidateIds: Set<string>;
};

const hardDuplicateKinds = new Set<SourceDiscoveryDedupMatchedKey['keyKind']>([
  'source_external_ref',
  'website_origin',
  'provider_fingerprint',
]);

const keyKindPriority: Record<SourceDiscoveryDedupMatchedKey['keyKind'], number> = {
  source_external_ref: 0,
  website_origin: 1,
  provider_fingerprint: 2,
  normalized_name_location: 3,
};

function normalizedKeyValue(key: SourceDiscoveryDedupMatchedKey): string {
  const value = key.keyValue.trim();
  if (key.keyKind === 'website_origin') return new URL(value).origin;
  if (key.keyKind === 'normalized_name_location') return value.toLocaleLowerCase('en-US');
  return value;
}

function normalizedKey(key: SourceDiscoveryDedupMatchedKey): SourceDiscoveryDedupMatchedKey {
  return {
    keyKind: key.keyKind,
    keyValue: normalizedKeyValue(key),
    keyScope: key.keyScope,
  };
}

function keyIdentity(key: SourceDiscoveryDedupMatchedKey): string {
  const normalized = normalizedKey(key);
  return `${normalized.keyKind}\u0000${normalized.keyScope ?? ''}\u0000${normalized.keyValue}`;
}

function reasonCode(keyKind: SourceDiscoveryDedupMatchedKey['keyKind']): string {
  return `dedup.${keyKind}_match`;
}

function groupId(
  decision: SourceDiscoveryDedupGroup['decision'],
  candidateIds: readonly string[],
  matchedKeys: readonly SourceDiscoveryDedupMatchedKey[],
): string {
  const fingerprint = createHash('sha256')
    .update(decision)
    .update('\u0000')
    .update(candidateIds.join('\u0000'))
    .update('\u0000')
    .update(matchedKeys.map(keyIdentity).join('\u0000'))
    .digest('hex')
    .slice(0, 24);

  return `dedup-${fingerprint}`;
}

function validationBatch(input: SourceDiscoveryDedupEvaluationInput, groups: SourceDiscoveryDedupGroup[] = []) {
  return {
    version: '1.0.0' as const,
    batchId: 'dedup-evaluator',
    workspaceId: 'dedup-evaluator',
    researchJobId: 'dedup-evaluator',
    candidates: input.candidates,
    evidence: input.evidence,
    groups,
    evaluatedAt: '1970-01-01T00:00:00.000Z',
  };
}

export function evaluateSourceDiscoveryDedup(input: SourceDiscoveryDedupEvaluationInput): SourceDiscoveryDedupGroup[] {
  const validated = SourceDiscoveryDedupBatchSchema.parse(validationBatch(input));
  const buckets = new Map<string, DedupBucket>();

  for (const evidence of validated.evidence) {
    const key = normalizedKey(evidence);
    const identity = keyIdentity(key);
    const bucket = buckets.get(identity) ?? { identity, key, candidateIds: new Set<string>() };
    bucket.candidateIds.add(evidence.candidateId);
    buckets.set(identity, bucket);
  }

  const repeatedBuckets = [...buckets.values()]
    .filter((bucket) => bucket.candidateIds.size >= 2)
    .sort((left, right) => {
      const leftHard = hardDuplicateKinds.has(left.key.keyKind) ? 0 : 1;
      const rightHard = hardDuplicateKinds.has(right.key.keyKind) ? 0 : 1;
      if (leftHard !== rightHard) return leftHard - rightHard;
      if (left.candidateIds.size !== right.candidateIds.size) return right.candidateIds.size - left.candidateIds.size;
      const priority = keyKindPriority[left.key.keyKind] - keyKindPriority[right.key.keyKind];
      if (priority !== 0) return priority;
      return left.identity.localeCompare(right.identity, 'en-US');
    });

  const claimed = new Set<string>();
  const groups: SourceDiscoveryDedupGroup[] = [];

  for (const bucket of repeatedBuckets) {
    const candidateIds = [...bucket.candidateIds].filter((candidateId) => !claimed.has(candidateId)).sort();
    if (candidateIds.length < 2) continue;

    const decision: SourceDiscoveryDedupGroup['decision'] = hardDuplicateKinds.has(bucket.key.keyKind)
      ? 'duplicate'
      : 'possible_duplicate';

    const matchedKeys = repeatedBuckets
      .filter((candidateBucket) => candidateIds.every((candidateId) => candidateBucket.candidateIds.has(candidateId)))
      .filter((candidateBucket) => decision === 'duplicate' || !hardDuplicateKinds.has(candidateBucket.key.keyKind))
      .map((candidateBucket) => candidateBucket.key)
      .sort((left, right) => {
        const priority = keyKindPriority[left.keyKind] - keyKindPriority[right.keyKind];
        return priority !== 0 ? priority : keyIdentity(left).localeCompare(keyIdentity(right), 'en-US');
      })
      .slice(0, 32);

    const reasonCodes = [...new Set(matchedKeys.map((key) => reasonCode(key.keyKind)))].sort();
    const group: SourceDiscoveryDedupGroup = {
      groupId: groupId(decision, candidateIds, matchedKeys),
      candidateIds,
      decision,
      matchedKeys,
      reasonCodes,
      canonicalizationState: 'unverified_candidates_only',
    };

    groups.push(group);
    candidateIds.forEach((candidateId) => claimed.add(candidateId));
  }

  return SourceDiscoveryDedupBatchSchema.parse(validationBatch(input, groups)).groups;
}
