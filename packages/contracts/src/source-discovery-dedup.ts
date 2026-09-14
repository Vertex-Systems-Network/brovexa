import { z } from 'zod';
import { SourceCandidateSchema } from './source';

const IdentifierSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const DedupValueSchema = z.string().trim().min(1).max(2048);
const DedupScopeSchema = z.string().regex(/^(source|connector)\.[a-z0-9_.-]+$/);

export const sourceDiscoveryDedupKeyKindValues = [
  'source_external_ref',
  'website_origin',
  'normalized_name_location',
  'provider_fingerprint',
] as const;

export const SourceDiscoveryDedupKeyKindSchema = z.enum(sourceDiscoveryDedupKeyKindValues);
export type SourceDiscoveryDedupKeyKind = z.infer<typeof SourceDiscoveryDedupKeyKindSchema>;

type DedupKey = {
  keyKind: SourceDiscoveryDedupKeyKind;
  keyValue: string;
  keyScope: string | null;
};

function validateDedupKey(key: DedupKey, ctx: z.RefinementCtx): void {
  const scoped = key.keyKind === 'source_external_ref' || key.keyKind === 'provider_fingerprint';
  if (scoped && key.keyScope === null) {
    ctx.addIssue({ code: 'custom', path: ['keyScope'], message: `${key.keyKind} requires a source or connector scope.` });
  }
  if (!scoped && key.keyScope !== null) {
    ctx.addIssue({ code: 'custom', path: ['keyScope'], message: `${key.keyKind} must not declare a provider scope.` });
  }
  if (key.keyKind !== 'website_origin') return;

  let url: URL;
  try {
    url = new URL(key.keyValue);
  } catch {
    ctx.addIssue({ code: 'custom', path: ['keyValue'], message: 'website_origin must be a valid HTTP(S) origin.' });
    return;
  }
  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    ctx.addIssue({ code: 'custom', path: ['keyValue'], message: 'website_origin must contain only a credential-free HTTP(S) origin.' });
  }
}

export const SourceDiscoveryDedupEvidenceSchema = z
  .object({
    candidateId: IdentifierSchema,
    keyKind: SourceDiscoveryDedupKeyKindSchema,
    keyValue: DedupValueSchema,
    keyScope: DedupScopeSchema.nullable(),
    sourceReferenceIds: z.array(IdentifierSchema).min(1).max(64),
  })
  .strict()
  .superRefine(validateDedupKey);
export type SourceDiscoveryDedupEvidence = z.infer<typeof SourceDiscoveryDedupEvidenceSchema>;

export const SourceDiscoveryDedupMatchedKeySchema = z
  .object({
    keyKind: SourceDiscoveryDedupKeyKindSchema,
    keyValue: DedupValueSchema,
    keyScope: DedupScopeSchema.nullable(),
  })
  .strict()
  .superRefine(validateDedupKey);
export type SourceDiscoveryDedupMatchedKey = z.infer<typeof SourceDiscoveryDedupMatchedKeySchema>;

export const SourceDiscoveryDedupGroupSchema = z
  .object({
    groupId: IdentifierSchema,
    candidateIds: z.array(IdentifierSchema).min(2).max(256),
    decision: z.enum(['possible_duplicate', 'duplicate']),
    matchedKeys: z.array(SourceDiscoveryDedupMatchedKeySchema).min(1).max(32),
    reasonCodes: z.array(IdentifierSchema).min(1).max(64),
    canonicalizationState: z.literal('unverified_candidates_only'),
  })
  .strict();
export type SourceDiscoveryDedupGroup = z.infer<typeof SourceDiscoveryDedupGroupSchema>;

function normalizedKeyValue(key: DedupKey): string {
  const value = key.keyValue.trim();
  if (key.keyKind === 'website_origin') return new URL(value).origin;
  if (key.keyKind === 'normalized_name_location') return value.toLocaleLowerCase('en-US');
  return value;
}

function keyIdentity(key: DedupKey): string {
  return `${key.keyKind}\u0000${key.keyScope ?? ''}\u0000${normalizedKeyValue(key)}`;
}

function addIssue(ctx: z.RefinementCtx, path: (string | number)[], message: string): void {
  ctx.addIssue({ code: 'custom', path, message });
}

export const SourceDiscoveryDedupBatchSchema = z
  .object({
    version: z.literal('1.0.0'),
    batchId: IdentifierSchema,
    workspaceId: IdentifierSchema,
    researchJobId: IdentifierSchema,
    candidates: z.array(SourceCandidateSchema).min(1).max(2048),
    evidence: z.array(SourceDiscoveryDedupEvidenceSchema).max(8192),
    groups: z.array(SourceDiscoveryDedupGroupSchema).max(2048),
    evaluatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((batch, ctx) => {
    const candidateById = new Map(batch.candidates.map((candidate) => [candidate.candidateId, candidate]));
    if (candidateById.size !== batch.candidates.length) {
      addIssue(ctx, ['candidates'], 'Discovery candidate IDs must be unique within a dedup batch.');
    }

    const evidenceByCandidate = new Map<string, Set<string>>();
    const evidenceIdentity = new Set<string>();
    for (let index = 0; index < batch.evidence.length; index += 1) {
      const evidence = batch.evidence[index];
      if (!evidence) continue;
      const candidate = candidateById.get(evidence.candidateId);
      if (!candidate) {
        addIssue(ctx, ['evidence', index, 'candidateId'], 'Dedup evidence must reference a candidate in the same batch.');
        continue;
      }

      const declaredRefs = new Set(candidate.sourceReferenceIds);
      if (evidence.sourceReferenceIds.some((referenceId) => !declaredRefs.has(referenceId))) {
        addIssue(
          ctx,
          ['evidence', index, 'sourceReferenceIds'],
          'Dedup evidence provenance must be a subset of the candidate source references.',
        );
      }
      if (new Set(evidence.sourceReferenceIds).size !== evidence.sourceReferenceIds.length) {
        addIssue(ctx, ['evidence', index, 'sourceReferenceIds'], 'Dedup evidence source references must be unique.');
      }

      const identity = `${evidence.candidateId}\u0000${keyIdentity(evidence)}`;
      if (evidenceIdentity.has(identity)) {
        addIssue(ctx, ['evidence', index], 'Duplicate dedup evidence for the same candidate and key is not allowed.');
      }
      evidenceIdentity.add(identity);

      const candidateKeys = evidenceByCandidate.get(evidence.candidateId) ?? new Set<string>();
      candidateKeys.add(keyIdentity(evidence));
      evidenceByCandidate.set(evidence.candidateId, candidateKeys);
    }

    const groupIds = new Set<string>();
    const groupedCandidates = new Set<string>();
    for (let index = 0; index < batch.groups.length; index += 1) {
      const group = batch.groups[index];
      if (!group) continue;
      if (groupIds.has(group.groupId)) {
        addIssue(ctx, ['groups', index, 'groupId'], 'Dedup group IDs must be unique.');
      }
      groupIds.add(group.groupId);

      if (new Set(group.candidateIds).size !== group.candidateIds.length) {
        addIssue(ctx, ['groups', index, 'candidateIds'], 'A dedup group cannot repeat a candidate ID.');
      }
      for (const candidateId of group.candidateIds) {
        if (!candidateById.has(candidateId)) {
          addIssue(ctx, ['groups', index, 'candidateIds'], 'Dedup groups may reference only candidates in the same batch.');
        }
        if (groupedCandidates.has(candidateId)) {
          addIssue(ctx, ['groups', index, 'candidateIds'], 'A candidate may belong to at most one dedup group per batch.');
        }
        groupedCandidates.add(candidateId);
      }

      const matchedKeyIdentities = group.matchedKeys.map(keyIdentity);
      if (new Set(matchedKeyIdentities).size !== matchedKeyIdentities.length) {
        addIssue(ctx, ['groups', index, 'matchedKeys'], 'Dedup group matched keys must be unique.');
      }

      for (let keyIndex = 0; keyIndex < group.matchedKeys.length; keyIndex += 1) {
        const matchedKey = group.matchedKeys[keyIndex];
        if (!matchedKey) continue;
        const identity = keyIdentity(matchedKey);
        if (group.candidateIds.some((candidateId) => !evidenceByCandidate.get(candidateId)?.has(identity))) {
          addIssue(
            ctx,
            ['groups', index, 'matchedKeys', keyIndex],
            'Every candidate in a dedup group must carry provenance-bound evidence for every declared matched key.',
          );
        }
      }

      if (
        group.decision === 'duplicate' &&
        !group.matchedKeys.some((key) =>
          key.keyKind === 'source_external_ref' || key.keyKind === 'website_origin' || key.keyKind === 'provider_fingerprint',
        )
      ) {
        addIssue(
          ctx,
          ['groups', index, 'decision'],
          'A duplicate decision requires a deterministic identity key; normalized name/location evidence alone is only suggestive.',
        );
      }
    }
  });
export type SourceDiscoveryDedupBatch = z.infer<typeof SourceDiscoveryDedupBatchSchema>;

export function parseSourceDiscoveryDedupBatch(rawBatch: unknown): SourceDiscoveryDedupBatch {
  return SourceDiscoveryDedupBatchSchema.parse(rawBatch);
}
