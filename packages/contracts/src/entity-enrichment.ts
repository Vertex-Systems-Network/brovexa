import { z } from 'zod';

const IdentifierSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const DateTimeSchema = z.string().datetime();
const VersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const SourceKeySchema = z.string().regex(/^source\.[a-z0-9_.-]+$/);
const ConnectorKeySchema = z.string().regex(/^connector\.[a-z0-9_.-]+$/);
const CountryCodeSchema = z.string().regex(/^[A-Z]{2}$/);
const SafeIntegerSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const NormalizedDomainSchema = z
  .string()
  .trim()
  .min(3)
  .max(253)
  .regex(
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
  );

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function addIssue(ctx: z.RefinementCtx, path: (string | number)[], message: string): void {
  ctx.addIssue({ code: 'custom', path, message });
}

function isCredentialFreeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      parsed.username.length === 0 &&
      parsed.password.length === 0
    );
  } catch {
    return false;
  }
}

export const domainEvidenceKindValues = [
  'source_claim',
  'official_website',
  'registry_record',
  'dns_control',
] as const;
export const DomainEvidenceKindSchema = z.enum(domainEvidenceKindValues);
export type DomainEvidenceKind = z.infer<typeof DomainEvidenceKindSchema>;

export const domainEvidenceEffectValues = ['supports_domain', 'contradicts_domain'] as const;
export const DomainEvidenceEffectSchema = z.enum(domainEvidenceEffectValues);
export type DomainEvidenceEffect = z.infer<typeof DomainEvidenceEffectSchema>;

export const durableEvidenceStorageClassValues = ['REFERENCE_ONLY', 'NORMALIZED_FACT', 'EVIDENCE_MINIMAL'] as const;
export const DurableEvidenceStorageClassSchema = z.enum(durableEvidenceStorageClassValues);
export type DurableEvidenceStorageClass = z.infer<typeof DurableEvidenceStorageClassSchema>;

export const EvidenceRetentionPolicySchema = z.object({
  retentionTtlSeconds: SafeIntegerSchema.nullable(),
  deletionRequired: z.boolean(),
  refreshAfterSeconds: SafeIntegerSchema.nullable(),
});
export type EvidenceRetentionPolicy = z.infer<typeof EvidenceRetentionPolicySchema>;

export const BusinessDomainEvidenceSchema = z
  .object({
    version: z.literal('1.0.0'),
    evidenceId: IdentifierSchema,
    workspaceId: IdentifierSchema,
    canonicalBusinessId: IdentifierSchema,
    normalizedDomain: NormalizedDomainSchema,
    kind: DomainEvidenceKindSchema,
    effect: DomainEvidenceEffectSchema,
    sourceKey: SourceKeySchema,
    sourceReferenceIds: z.array(IdentifierSchema).min(1).max(64),
    sourcePolicySnapshot: z.object({
      policyId: IdentifierSchema,
      policyVersion: VersionSchema,
    }),
    sourceAdmissionDecisionRef: IdentifierSchema,
    sourceAdmissionDecision: z.literal('allow'),
    storageClass: DurableEvidenceStorageClassSchema,
    retention: EvidenceRetentionPolicySchema,
    observedAt: DateTimeSchema,
    recordedAt: DateTimeSchema,
  })
  .strict()
  .superRefine((evidence, ctx) => {
    if (!unique(evidence.sourceReferenceIds)) {
      addIssue(ctx, ['sourceReferenceIds'], 'Domain evidence sourceReferenceIds must be unique.');
    }
    if (Date.parse(evidence.recordedAt) < Date.parse(evidence.observedAt)) {
      addIssue(ctx, ['recordedAt'], 'Domain evidence cannot be recorded before it was observed.');
    }
  });
export type BusinessDomainEvidence = z.infer<typeof BusinessDomainEvidenceSchema>;

export const businessDomainVerificationDecisionValues = ['verified', 'review_required', 'rejected'] as const;
export const BusinessDomainVerificationDecisionKindSchema = z.enum(businessDomainVerificationDecisionValues);
export type BusinessDomainVerificationDecisionKind = z.infer<typeof BusinessDomainVerificationDecisionKindSchema>;

export const businessDomainVerificationMethodValues = ['deterministic', 'human_review'] as const;
export const BusinessDomainVerificationMethodSchema = z.enum(businessDomainVerificationMethodValues);
export type BusinessDomainVerificationMethod = z.infer<typeof BusinessDomainVerificationMethodSchema>;

export const BusinessDomainVerificationDecisionSchema = z
  .object({
    verificationId: IdentifierSchema,
    workspaceId: IdentifierSchema,
    canonicalBusinessId: IdentifierSchema,
    normalizedDomain: NormalizedDomainSchema,
    decision: BusinessDomainVerificationDecisionKindSchema,
    method: BusinessDomainVerificationMethodSchema,
    confidence: z.number().min(0).max(1),
    evidenceIds: z.array(IdentifierSchema).min(1).max(256),
    reasonCodes: z.array(IdentifierSchema).min(1).max(64),
    reviewDecisionRef: IdentifierSchema.nullable(),
    evaluatedAt: DateTimeSchema,
  })
  .strict()
  .superRefine((decision, ctx) => {
    if (!unique(decision.evidenceIds)) {
      addIssue(ctx, ['evidenceIds'], 'Domain verification evidenceIds must be unique.');
    }
    if (!unique(decision.reasonCodes)) {
      addIssue(ctx, ['reasonCodes'], 'Domain verification reasonCodes must be unique.');
    }
    if (decision.method === 'human_review' && decision.reviewDecisionRef === null) {
      addIssue(ctx, ['reviewDecisionRef'], 'Human-reviewed domain verification requires a durable review decision reference.');
    }
    if (decision.method === 'deterministic' && decision.reviewDecisionRef !== null) {
      addIssue(ctx, ['reviewDecisionRef'], 'Deterministic domain verification must not claim a human review reference.');
    }
    if (decision.decision === 'review_required' && decision.method !== 'deterministic') {
      addIssue(ctx, ['method'], 'A review_required domain decision must remain deterministic until review is completed.');
    }
  });
export type BusinessDomainVerificationDecision = z.infer<typeof BusinessDomainVerificationDecisionSchema>;

export const BusinessDomainVerificationEvaluationSchema = z
  .object({
    version: z.literal('1.0.0'),
    workspaceId: IdentifierSchema,
    canonicalBusinessId: IdentifierSchema,
    normalizedDomain: NormalizedDomainSchema,
    evidence: z.array(BusinessDomainEvidenceSchema).min(1).max(256),
    decision: BusinessDomainVerificationDecisionSchema,
  })
  .strict()
  .superRefine((evaluation, ctx) => {
    const evidenceById = new Map<string, BusinessDomainEvidence>();
    evaluation.evidence.forEach((evidence, index) => {
      if (evidenceById.has(evidence.evidenceId)) {
        addIssue(ctx, ['evidence', index, 'evidenceId'], 'Domain evidence IDs must be unique within one evaluation.');
      }
      evidenceById.set(evidence.evidenceId, evidence);
      if (evidence.workspaceId !== evaluation.workspaceId) {
        addIssue(ctx, ['evidence', index, 'workspaceId'], 'Domain evidence workspace must match the evaluation workspace.');
      }
      if (evidence.canonicalBusinessId !== evaluation.canonicalBusinessId) {
        addIssue(
          ctx,
          ['evidence', index, 'canonicalBusinessId'],
          'Domain evidence canonical business must match the evaluation canonical business.',
        );
      }
      if (evidence.normalizedDomain !== evaluation.normalizedDomain) {
        addIssue(ctx, ['evidence', index, 'normalizedDomain'], 'Domain evidence must target the evaluated domain.');
      }
    });

    if (evaluation.decision.workspaceId !== evaluation.workspaceId) {
      addIssue(ctx, ['decision', 'workspaceId'], 'Domain decision workspace must match the evaluation workspace.');
    }
    if (evaluation.decision.canonicalBusinessId !== evaluation.canonicalBusinessId) {
      addIssue(
        ctx,
        ['decision', 'canonicalBusinessId'],
        'Domain decision canonical business must match the evaluation canonical business.',
      );
    }
    if (evaluation.decision.normalizedDomain !== evaluation.normalizedDomain) {
      addIssue(ctx, ['decision', 'normalizedDomain'], 'Domain decision must target the evaluated domain.');
    }

    const referencedEvidence = evaluation.decision.evidenceIds
      .map((evidenceId, index) => {
        const evidence = evidenceById.get(evidenceId);
        if (!evidence) {
          addIssue(ctx, ['decision', 'evidenceIds', index], 'Every domain decision evidence ID must exist in the evaluation.');
        }
        return evidence;
      })
      .filter((evidence): evidence is BusinessDomainEvidence => evidence !== undefined);

    if (evaluation.decision.decision === 'verified') {
      const evaluatedAtMs = Date.parse(evaluation.decision.evaluatedAt);
      const staleReferencedEvidence = referencedEvidence.filter((evidence) => {
        const observedAtMs = Date.parse(evidence.observedAt);
        if (evaluatedAtMs < observedAtMs) {
          addIssue(
            ctx,
            ['decision', 'evaluatedAt'],
            'Domain verification cannot be evaluated before referenced evidence was observed.',
          );
          return false;
        }
        return (
          evidence.retention.refreshAfterSeconds !== null &&
          (evaluatedAtMs - observedAtMs) / 1000 > evidence.retention.refreshAfterSeconds
        );
      });
      if (
        evaluation.decision.method === 'deterministic' &&
        staleReferencedEvidence.length > 0
      ) {
        addIssue(
          ctx,
          ['decision', 'evidenceIds'],
          'Deterministic domain verification cannot reuse stale evidence beyond its refresh window; fresh evidence or explicit human review is required.',
        );
      }

      const hasSupport = referencedEvidence.some((evidence) => evidence.effect === 'supports_domain');
      if (!hasSupport) {
        addIssue(ctx, ['decision', 'evidenceIds'], 'A verified domain requires supporting evidence.');
      }

      if (evaluation.decision.method === 'deterministic') {
        const hasIndependentSupport = referencedEvidence.some(
          (evidence) =>
            evidence.effect === 'supports_domain' &&
            evidence.kind !== 'source_claim',
        );
        if (!hasIndependentSupport) {
          addIssue(
            ctx,
            ['decision', 'evidenceIds'],
            'Deterministic domain verification requires independently verifiable evidence beyond a source claim.',
          );
        }
        if (referencedEvidence.some((evidence) => evidence.effect === 'contradicts_domain')) {
          addIssue(
            ctx,
            ['decision', 'evidenceIds'],
            'Contradictory domain evidence requires explicit human review before verification.',
          );
        }
      }
    }
  });
export type BusinessDomainVerificationEvaluation = z.infer<typeof BusinessDomainVerificationEvaluationSchema>;

export const businessContactChannelValues = [
  'email',
  'phone',
  'website_form',
  'social_profile',
  'other_public_business_channel',
] as const;
export const BusinessContactChannelSchema = z.enum(businessContactChannelValues);
export type BusinessContactChannel = z.infer<typeof BusinessContactChannelSchema>;

export const contactDataClassificationValues = ['PUBLIC_BUSINESS', 'PERSONAL_BUSINESS_CONTACT'] as const;
export const ContactDataClassificationSchema = z.enum(contactDataClassificationValues);
export type ContactDataClassification = z.infer<typeof ContactDataClassificationSchema>;

export const contactDataEligibilityDecisionValues = ['allow', 'review_required', 'blocked'] as const;
export const ContactDataEligibilityDecisionKindSchema = z.enum(contactDataEligibilityDecisionValues);
export type ContactDataEligibilityDecisionKind = z.infer<typeof ContactDataEligibilityDecisionKindSchema>;

export const ContactDataEligibilityDecisionSchema = z
  .object({
    version: z.literal('1.0.0'),
    eligibilityId: IdentifierSchema,
    workspaceId: IdentifierSchema,
    canonicalBusinessId: IdentifierSchema,
    channel: BusinessContactChannelSchema,
    sourceKey: SourceKeySchema,
    connectorKey: ConnectorKeySchema,
    connectorVersion: VersionSchema,
    sourceRequestId: IdentifierSchema,
    sourceAdmissionDecisionRef: IdentifierSchema,
    sourceAdmissionDecision: z.literal('allow'),
    sourceReferenceIds: z.array(IdentifierSchema).min(1).max(64),
    sourcePolicySnapshot: z.object({
      policyId: IdentifierSchema,
      policyVersion: VersionSchema,
    }),
    compliancePolicySnapshot: z.object({
      policyId: IdentifierSchema,
      policyVersion: VersionSchema,
    }),
    purpose: IdentifierSchema,
    territory: z.object({
      mode: z.enum(['global', 'country_allowlist', 'provider_defined']),
      countryCodes: z.array(CountryCodeSchema).max(249),
    }),
    fieldName: IdentifierSchema,
    dataClassification: ContactDataClassificationSchema,
    storageClass: DurableEvidenceStorageClassSchema,
    retention: EvidenceRetentionPolicySchema,
    decision: ContactDataEligibilityDecisionKindSchema,
    displayAllowed: z.boolean(),
    exportAllowed: z.boolean(),
    reasonCodes: z.array(IdentifierSchema).min(1).max(64),
    evaluatedAt: DateTimeSchema,
  })
  .strict()
  .superRefine((eligibility, ctx) => {
    if (!unique(eligibility.sourceReferenceIds)) {
      addIssue(ctx, ['sourceReferenceIds'], 'Contact-data eligibility sourceReferenceIds must be unique.');
    }
    if (!unique(eligibility.territory.countryCodes)) {
      addIssue(ctx, ['territory', 'countryCodes'], 'Contact-data eligibility countryCodes must be unique.');
    }
    if (!unique(eligibility.reasonCodes)) {
      addIssue(ctx, ['reasonCodes'], 'Contact-data eligibility reasonCodes must be unique.');
    }
    if (eligibility.territory.mode === 'country_allowlist' && eligibility.territory.countryCodes.length === 0) {
      addIssue(ctx, ['territory', 'countryCodes'], 'country_allowlist contact eligibility requires at least one country.');
    }
    if (eligibility.territory.mode === 'global' && eligibility.territory.countryCodes.length > 0) {
      addIssue(ctx, ['territory', 'countryCodes'], 'global contact eligibility must not declare country codes.');
    }
    if (eligibility.decision !== 'allow' && eligibility.displayAllowed) {
      addIssue(ctx, ['displayAllowed'], 'Blocked or review-required contact data cannot be display-authorized.');
    }
    if (eligibility.decision !== 'allow' && eligibility.exportAllowed) {
      addIssue(ctx, ['exportAllowed'], 'Blocked or review-required contact data cannot be export-authorized.');
    }
  });
export type ContactDataEligibilityDecision = z.infer<typeof ContactDataEligibilityDecisionSchema>;

export const ApprovedBusinessContactEvidenceSchema = z
  .object({
    version: z.literal('1.0.0'),
    contactEvidenceId: IdentifierSchema,
    workspaceId: IdentifierSchema,
    canonicalBusinessId: IdentifierSchema,
    channel: BusinessContactChannelSchema,
    normalizedValue: z.string().trim().min(1).max(2048),
    sourceKey: SourceKeySchema,
    sourceReferenceIds: z.array(IdentifierSchema).min(1).max(64),
    observedAt: DateTimeSchema,
    recordedAt: DateTimeSchema,
    dataEligibility: ContactDataEligibilityDecisionSchema,
    outreachAuthorization: z.literal('not_evaluated'),
  })
  .strict()
  .superRefine((evidence, ctx) => {
    if (!unique(evidence.sourceReferenceIds)) {
      addIssue(ctx, ['sourceReferenceIds'], 'Contact evidence sourceReferenceIds must be unique.');
    }
    if (evidence.dataEligibility.decision !== 'allow') {
      addIssue(ctx, ['dataEligibility', 'decision'], 'Persisted contact evidence requires an allowed ContactDataEligibility decision.');
    }
    if (evidence.dataEligibility.workspaceId !== evidence.workspaceId) {
      addIssue(ctx, ['dataEligibility', 'workspaceId'], 'Contact-data eligibility workspace must match the evidence workspace.');
    }
    if (evidence.dataEligibility.canonicalBusinessId !== evidence.canonicalBusinessId) {
      addIssue(
        ctx,
        ['dataEligibility', 'canonicalBusinessId'],
        'Contact-data eligibility canonical business must match the contact evidence.',
      );
    }
    if (evidence.dataEligibility.channel !== evidence.channel) {
      addIssue(ctx, ['dataEligibility', 'channel'], 'Contact-data eligibility channel must match the contact evidence channel.');
    }
    if (evidence.dataEligibility.sourceKey !== evidence.sourceKey) {
      addIssue(ctx, ['dataEligibility', 'sourceKey'], 'Contact-data eligibility source must match the contact evidence source.');
    }

    const eligibleReferences = new Set(evidence.dataEligibility.sourceReferenceIds);
    if (evidence.sourceReferenceIds.some((referenceId) => !eligibleReferences.has(referenceId))) {
      addIssue(
        ctx,
        ['sourceReferenceIds'],
        'Contact evidence provenance must be a subset of the references approved by ContactDataEligibility.',
      );
    }
    if (Date.parse(evidence.recordedAt) < Date.parse(evidence.observedAt)) {
      addIssue(ctx, ['recordedAt'], 'Contact evidence cannot be recorded before it was observed.');
    }

    if (evidence.channel === 'email') {
      const email = evidence.normalizedValue;
      if (email !== email.toLowerCase() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        addIssue(ctx, ['normalizedValue'], 'Email contact evidence must be a normalized lowercase email address.');
      }
    }
    if (evidence.channel === 'phone' && !/^\+[1-9]\d{7,14}$/.test(evidence.normalizedValue)) {
      addIssue(ctx, ['normalizedValue'], 'Phone contact evidence must use normalized E.164 form.');
    }
    if (
      (evidence.channel === 'website_form' || evidence.channel === 'social_profile') &&
      !isCredentialFreeHttpUrl(evidence.normalizedValue)
    ) {
      addIssue(
        ctx,
        ['normalizedValue'],
        'Website-form and social-profile contact evidence must use a credential-free HTTP(S) URL.',
      );
    }
  });
export type ApprovedBusinessContactEvidence = z.infer<typeof ApprovedBusinessContactEvidenceSchema>;
