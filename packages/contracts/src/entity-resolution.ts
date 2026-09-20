import { z } from 'zod';

const IdentifierSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const DateTimeSchema = z.string().datetime();
const SourceKeySchema = z.string().regex(/^source\.[a-z0-9_.-]+$/);
const VersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const IdentityValueSchema = z.string().trim().min(1).max(2048);

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function addIssue(ctx: z.RefinementCtx, path: (string | number)[], message: string): void {
  ctx.addIssue({ code: 'custom', path, message });
}

export const businessIdentitySignalKindValues = [
  'business_name',
  'domain',
  'address',
  'locality',
  'region',
  'country_code',
  'postal_code',
  'source_external_ref',
] as const;
export const BusinessIdentitySignalKindSchema = z.enum(businessIdentitySignalKindValues);
export type BusinessIdentitySignalKind = z.infer<typeof BusinessIdentitySignalKindSchema>;

export const BusinessIdentitySignalSchema = z
  .object({
    signalId: IdentifierSchema,
    kind: BusinessIdentitySignalKindSchema,
    rawValue: IdentityValueSchema,
    normalizedValue: IdentityValueSchema,
    normalizationVersion: VersionSchema,
    sourceScope: SourceKeySchema.nullable(),
    sourceReferenceIds: z.array(IdentifierSchema).min(1).max(64),
  })
  .strict()
  .superRefine((signal, ctx) => {
    if (!unique(signal.sourceReferenceIds)) {
      addIssue(ctx, ['sourceReferenceIds'], 'Identity signal sourceReferenceIds must be unique.');
    }

    if (signal.kind === 'source_external_ref' && signal.sourceScope === null) {
      addIssue(ctx, ['sourceScope'], 'source_external_ref signals require a source scope.');
    }
    if (signal.kind !== 'source_external_ref' && signal.sourceScope !== null) {
      addIssue(ctx, ['sourceScope'], 'Only source_external_ref signals may declare a source scope.');
    }
  });
export type BusinessIdentitySignal = z.infer<typeof BusinessIdentitySignalSchema>;

export const SourceBusinessObservationSchema = z
  .object({
    version: z.literal('1.0.0'),
    workspaceId: IdentifierSchema,
    sourceObservationId: IdentifierSchema,
    sourceCandidateId: IdentifierSchema,
    sourceKey: SourceKeySchema,
    observedAt: DateTimeSchema,
    sourceReferenceIds: z.array(IdentifierSchema).min(1).max(64),
    identitySignals: z.array(BusinessIdentitySignalSchema).min(1).max(128),
  })
  .strict()
  .superRefine((observation, ctx) => {
    if (!unique(observation.sourceReferenceIds)) {
      addIssue(ctx, ['sourceReferenceIds'], 'Source observation references must be unique.');
    }

    const observationRefs = new Set(observation.sourceReferenceIds);
    const signalIds = observation.identitySignals.map((signal) => signal.signalId);
    if (!unique(signalIds)) {
      addIssue(ctx, ['identitySignals'], 'Identity signal IDs must be unique within one source observation.');
    }

    const identities = new Set<string>();
    observation.identitySignals.forEach((signal, index) => {
      if (signal.sourceReferenceIds.some((referenceId) => !observationRefs.has(referenceId))) {
        addIssue(
          ctx,
          ['identitySignals', index, 'sourceReferenceIds'],
          'Identity signal provenance must be a subset of the enclosing source observation references.',
        );
      }
      if (signal.kind === 'source_external_ref' && signal.sourceScope !== observation.sourceKey) {
        addIssue(
          ctx,
          ['identitySignals', index, 'sourceScope'],
          'Source external references must be scoped to the source that produced the observation.',
        );
      }

      const identity = [signal.kind, signal.sourceScope ?? '', signal.normalizedValue].join('\u0000');
      if (identities.has(identity)) {
        addIssue(ctx, ['identitySignals', index], 'Duplicate normalized identity signals are not allowed.');
      }
      identities.add(identity);
    });
  });
export type SourceBusinessObservation = z.infer<typeof SourceBusinessObservationSchema>;

export const CanonicalBusinessIdentitySchema = z
  .object({
    version: z.literal('1.0.0'),
    workspaceId: IdentifierSchema,
    canonicalBusinessId: IdentifierSchema,
    displayName: z.string().trim().min(1).max(512),
    identityState: z.enum(['active', 'superseded']),
    sourceObservationIds: z.array(IdentifierSchema).min(1).max(4096),
    evidenceIds: z.array(IdentifierSchema).min(1).max(4096),
    supersededByCanonicalBusinessId: IdentifierSchema.nullable(),
  })
  .strict()
  .superRefine((identity, ctx) => {
    if (!unique(identity.sourceObservationIds)) {
      addIssue(ctx, ['sourceObservationIds'], 'Canonical identity sourceObservationIds must be unique.');
    }
    if (!unique(identity.evidenceIds)) {
      addIssue(ctx, ['evidenceIds'], 'Canonical identity evidenceIds must be unique.');
    }

    if (identity.identityState === 'active' && identity.supersededByCanonicalBusinessId !== null) {
      addIssue(ctx, ['supersededByCanonicalBusinessId'], 'An active canonical identity cannot be superseded.');
    }
    if (identity.identityState === 'superseded' && identity.supersededByCanonicalBusinessId === null) {
      addIssue(ctx, ['supersededByCanonicalBusinessId'], 'A superseded canonical identity must name its surviving identity.');
    }
    if (identity.supersededByCanonicalBusinessId === identity.canonicalBusinessId) {
      addIssue(ctx, ['supersededByCanonicalBusinessId'], 'A canonical identity cannot supersede itself.');
    }
  });
export type CanonicalBusinessIdentity = z.infer<typeof CanonicalBusinessIdentitySchema>;

export const businessMatchEvidenceEffectValues = ['supports_match', 'contradicts_match'] as const;
export const BusinessMatchEvidenceEffectSchema = z.enum(businessMatchEvidenceEffectValues);
export type BusinessMatchEvidenceEffect = z.infer<typeof BusinessMatchEvidenceEffectSchema>;

export const businessMatchEvidenceMethodValues = ['deterministic', 'structured_ai'] as const;
export const BusinessMatchEvidenceMethodSchema = z.enum(businessMatchEvidenceMethodValues);
export type BusinessMatchEvidenceMethod = z.infer<typeof BusinessMatchEvidenceMethodSchema>;

export const CandidateBusinessMatchEvidenceSchema = z
  .object({
    evidenceId: IdentifierSchema,
    workspaceId: IdentifierSchema,
    sourceObservationId: IdentifierSchema,
    candidateCanonicalBusinessId: IdentifierSchema,
    observationSignalIds: z.array(IdentifierSchema).min(1).max(128),
    sourceReferenceIds: z.array(IdentifierSchema).min(1).max(64),
    method: BusinessMatchEvidenceMethodSchema,
    inferenceRef: IdentifierSchema.nullable(),
    effect: BusinessMatchEvidenceEffectSchema,
    reasonCode: IdentifierSchema,
    confidence: z.number().min(0).max(1),
    recordedAt: DateTimeSchema,
  })
  .strict()
  .superRefine((evidence, ctx) => {
    if (evidence.sourceObservationId === evidence.candidateCanonicalBusinessId) {
      addIssue(
        ctx,
        ['candidateCanonicalBusinessId'],
        'Source observation IDs and canonical business IDs are distinct identity namespaces.',
      );
    }
    if (!unique(evidence.observationSignalIds)) {
      addIssue(ctx, ['observationSignalIds'], 'Candidate-match observationSignalIds must be unique.');
    }
    if (!unique(evidence.sourceReferenceIds)) {
      addIssue(ctx, ['sourceReferenceIds'], 'Candidate-match sourceReferenceIds must be unique.');
    }
    if (evidence.method === 'structured_ai' && evidence.inferenceRef === null) {
      addIssue(ctx, ['inferenceRef'], 'Structured-AI evidence requires a provider-neutral inference reference.');
    }
    if (evidence.method === 'deterministic' && evidence.inferenceRef !== null) {
      addIssue(ctx, ['inferenceRef'], 'Deterministic evidence must not claim a structured-AI inference reference.');
    }
  });
export type CandidateBusinessMatchEvidence = z.infer<typeof CandidateBusinessMatchEvidenceSchema>;

export const BusinessResolutionThresholdPolicySchema = z
  .object({
    policyId: IdentifierSchema,
    version: VersionSchema,
    reviewMinimum: z.number().min(0).max(1),
    autoMatchMinimum: z.number().min(0).max(1),
  })
  .strict()
  .superRefine((policy, ctx) => {
    if (policy.reviewMinimum >= policy.autoMatchMinimum) {
      addIssue(ctx, ['autoMatchMinimum'], 'autoMatchMinimum must be greater than reviewMinimum.');
    }
  });
export type BusinessResolutionThresholdPolicy = z.infer<typeof BusinessResolutionThresholdPolicySchema>;

export const businessResolutionDecisionValues = ['match_existing', 'create_new', 'review_required'] as const;
export const BusinessResolutionDecisionKindSchema = z.enum(businessResolutionDecisionValues);
export type BusinessResolutionDecisionKind = z.infer<typeof BusinessResolutionDecisionKindSchema>;

export const businessResolutionReviewStateValues = ['not_required', 'pending', 'approved', 'rejected'] as const;
export const BusinessResolutionReviewStateSchema = z.enum(businessResolutionReviewStateValues);
export type BusinessResolutionReviewState = z.infer<typeof BusinessResolutionReviewStateSchema>;

export const BusinessResolutionDecisionSchema = z
  .object({
    decisionId: IdentifierSchema,
    workspaceId: IdentifierSchema,
    sourceObservationId: IdentifierSchema,
    candidateCanonicalBusinessId: IdentifierSchema.nullable(),
    decision: BusinessResolutionDecisionKindSchema,
    confidence: z.number().min(0).max(1),
    reviewState: BusinessResolutionReviewStateSchema,
    reasonCodes: z.array(IdentifierSchema).min(1).max(64),
    evidenceIds: z.array(IdentifierSchema).min(1).max(256),
    evaluatedAt: DateTimeSchema,
  })
  .strict()
  .superRefine((decision, ctx) => {
    if (!unique(decision.reasonCodes)) {
      addIssue(ctx, ['reasonCodes'], 'Resolution reasonCodes must be unique.');
    }
    if (!unique(decision.evidenceIds)) {
      addIssue(ctx, ['evidenceIds'], 'Resolution evidenceIds must be unique.');
    }

    if (decision.decision === 'match_existing' && decision.candidateCanonicalBusinessId === null) {
      addIssue(ctx, ['candidateCanonicalBusinessId'], 'match_existing requires a canonical business candidate.');
    }
    if (decision.decision === 'create_new' && decision.candidateCanonicalBusinessId !== null) {
      addIssue(ctx, ['candidateCanonicalBusinessId'], 'create_new must not pre-bind a canonical business candidate.');
    }
    if (decision.decision === 'review_required' && decision.reviewState !== 'pending') {
      addIssue(ctx, ['reviewState'], 'review_required decisions must remain pending for human/system review.');
    }
    if (decision.decision !== 'review_required' && decision.reviewState === 'pending') {
      addIssue(ctx, ['reviewState'], 'Only review_required decisions may remain pending.');
    }
    if (decision.reviewState === 'rejected' && decision.decision === 'match_existing') {
      addIssue(ctx, ['reviewState'], 'A rejected review cannot produce match_existing.');
    }
  });
export type BusinessResolutionDecision = z.infer<typeof BusinessResolutionDecisionSchema>;

export const BusinessResolutionEvaluationSchema = z
  .object({
    version: z.literal('1.0.0'),
    workspaceId: IdentifierSchema,
    observation: SourceBusinessObservationSchema,
    thresholdPolicy: BusinessResolutionThresholdPolicySchema,
    evidence: z.array(CandidateBusinessMatchEvidenceSchema).min(1).max(1024),
    decision: BusinessResolutionDecisionSchema,
  })
  .strict()
  .superRefine((evaluation, ctx) => {
    if (evaluation.observation.workspaceId !== evaluation.workspaceId) {
      addIssue(ctx, ['observation', 'workspaceId'], 'Observation workspace must match the resolution evaluation workspace.');
    }
    if (evaluation.decision.workspaceId !== evaluation.workspaceId) {
      addIssue(ctx, ['decision', 'workspaceId'], 'Decision workspace must match the resolution evaluation workspace.');
    }
    if (evaluation.decision.sourceObservationId !== evaluation.observation.sourceObservationId) {
      addIssue(ctx, ['decision', 'sourceObservationId'], 'Decision must resolve the enclosed source observation.');
    }

    const signalById = new Map(evaluation.observation.identitySignals.map((signal) => [signal.signalId, signal]));
    const signalIds = new Set(signalById.keys());
    const observationRefs = new Set(evaluation.observation.sourceReferenceIds);
    const evidenceById = new Map<string, CandidateBusinessMatchEvidence>();

    evaluation.evidence.forEach((evidence, index) => {
      if (evidenceById.has(evidence.evidenceId)) {
        addIssue(ctx, ['evidence', index, 'evidenceId'], 'Resolution evidence IDs must be unique.');
      }
      evidenceById.set(evidence.evidenceId, evidence);

      if (evidence.workspaceId !== evaluation.workspaceId) {
        addIssue(ctx, ['evidence', index, 'workspaceId'], 'Candidate evidence workspace must match the evaluation workspace.');
      }
      if (evidence.sourceObservationId !== evaluation.observation.sourceObservationId) {
        addIssue(ctx, ['evidence', index, 'sourceObservationId'], 'Candidate evidence must belong to the enclosed source observation.');
      }
      const hasUnknownSignal = evidence.observationSignalIds.some((signalId) => !signalIds.has(signalId));
      if (hasUnknownSignal) {
        addIssue(ctx, ['evidence', index, 'observationSignalIds'], 'Candidate evidence may reference only enclosed observation signals.');
      }
      if (evidence.sourceReferenceIds.some((referenceId) => !observationRefs.has(referenceId))) {
        addIssue(ctx, ['evidence', index, 'sourceReferenceIds'], 'Candidate evidence provenance must come from the enclosed observation.');
      }

      if (!hasUnknownSignal) {
        const signalReferenceIds = new Set(
          evidence.observationSignalIds.flatMap((signalId) => signalById.get(signalId)?.sourceReferenceIds ?? []),
        );
        if (evidence.sourceReferenceIds.some((referenceId) => !signalReferenceIds.has(referenceId))) {
          addIssue(
            ctx,
            ['evidence', index, 'sourceReferenceIds'],
            'Candidate evidence provenance must be bound to the referenced identity signals.',
          );
        }
      }
    });

    const referencedEvidence = evaluation.decision.evidenceIds
      .map((evidenceId, index) => {
        const evidence = evidenceById.get(evidenceId);
        if (!evidence) {
          addIssue(ctx, ['decision', 'evidenceIds', index], 'Every decision evidence ID must exist in the evaluation.');
        }
        return evidence;
      })
      .filter((evidence): evidence is CandidateBusinessMatchEvidence => evidence !== undefined);

    if (evaluation.decision.decision === 'match_existing') {
      const candidateId = evaluation.decision.candidateCanonicalBusinessId;
      const candidateEvidence = referencedEvidence.filter(
        (evidence) => evidence.candidateCanonicalBusinessId === candidateId,
      );
      if (!candidateEvidence.some((evidence) => evidence.effect === 'supports_match')) {
        addIssue(ctx, ['decision', 'evidenceIds'], 'match_existing requires supporting evidence for the selected canonical business.');
      }

      const requiresReview =
        evaluation.decision.confidence < evaluation.thresholdPolicy.autoMatchMinimum ||
        candidateEvidence.some((evidence) => evidence.effect === 'contradicts_match' || evidence.method === 'structured_ai');

      if (requiresReview && evaluation.decision.reviewState !== 'approved') {
        addIssue(
          ctx,
          ['decision', 'reviewState'],
          'Low-confidence, contradictory, or structured-AI-assisted matches require explicit review approval.',
        );
      }
    }

    if (evaluation.decision.decision === 'create_new') {
      const hasMaterialMatchSupport = referencedEvidence.some(
        (evidence) =>
          evidence.effect === 'supports_match' &&
          evidence.confidence >= evaluation.thresholdPolicy.reviewMinimum,
      );
      if (hasMaterialMatchSupport && evaluation.decision.reviewState !== 'approved') {
        addIssue(
          ctx,
          ['decision', 'reviewState'],
          'Creating a new canonical business despite material match evidence requires explicit review approval.',
        );
      }
    }
  });
export type BusinessResolutionEvaluation = z.infer<typeof BusinessResolutionEvaluationSchema>;

const ReversibleIdentityChangeBaseSchema = z
  .object({
    version: z.literal('1.0.0'),
    requestId: IdentifierSchema,
    workspaceId: IdentifierSchema,
    evidenceIds: z.array(IdentifierSchema).min(1).max(256),
    reasonCodes: z.array(IdentifierSchema).min(1).max(64),
    requestedByActorId: IdentifierSchema,
    requestedAt: DateTimeSchema,
    reviewState: z.literal('pending'),
    reversible: z.literal(true),
  })
  .strict();

export const CanonicalBusinessMergeRequestSchema = ReversibleIdentityChangeBaseSchema.extend({
  sourceCanonicalBusinessIds: z.array(IdentifierSchema).min(2).max(32),
  targetCanonicalBusinessId: IdentifierSchema,
})
  .strict()
  .superRefine((request, ctx) => {
    if (!unique(request.sourceCanonicalBusinessIds)) {
      addIssue(ctx, ['sourceCanonicalBusinessIds'], 'Merge source canonical business IDs must be unique.');
    }
    if (!request.sourceCanonicalBusinessIds.includes(request.targetCanonicalBusinessId)) {
      addIssue(ctx, ['targetCanonicalBusinessId'], 'Merge target must be one of the source canonical business identities.');
    }
    if (!unique(request.evidenceIds)) {
      addIssue(ctx, ['evidenceIds'], 'Merge evidenceIds must be unique.');
    }
    if (!unique(request.reasonCodes)) {
      addIssue(ctx, ['reasonCodes'], 'Merge reasonCodes must be unique.');
    }
  });
export type CanonicalBusinessMergeRequest = z.infer<typeof CanonicalBusinessMergeRequestSchema>;

export const CanonicalBusinessSplitRequestSchema = ReversibleIdentityChangeBaseSchema.extend({
  canonicalBusinessId: IdentifierSchema,
  lineageOperationId: IdentifierSchema,
  restoreCanonicalBusinessIds: z.array(IdentifierSchema).min(2).max(32),
})
  .strict()
  .superRefine((request, ctx) => {
    if (!unique(request.restoreCanonicalBusinessIds)) {
      addIssue(ctx, ['restoreCanonicalBusinessIds'], 'Split restore canonical business IDs must be unique.');
    }
    if (!request.restoreCanonicalBusinessIds.includes(request.canonicalBusinessId)) {
      addIssue(ctx, ['restoreCanonicalBusinessIds'], 'Split restoration must include the currently merged canonical business identity.');
    }
    if (!unique(request.evidenceIds)) {
      addIssue(ctx, ['evidenceIds'], 'Split evidenceIds must be unique.');
    }
    if (!unique(request.reasonCodes)) {
      addIssue(ctx, ['reasonCodes'], 'Split reasonCodes must be unique.');
    }
  });
export type CanonicalBusinessSplitRequest = z.infer<typeof CanonicalBusinessSplitRequestSchema>;
