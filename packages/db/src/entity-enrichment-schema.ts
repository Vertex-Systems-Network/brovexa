import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { canonicalBusinesses } from './entity-resolution-schema';
import { workspaces } from './schema';

export const enrichmentStorageClassValues = ['REFERENCE_ONLY', 'NORMALIZED_FACT', 'EVIDENCE_MINIMAL'] as const;
export type EnrichmentStorageClass = (typeof enrichmentStorageClassValues)[number];
export const domainEvidenceKindValues = ['source_claim', 'official_website', 'registry_record', 'dns_control'] as const;
export type PersistedDomainEvidenceKind = (typeof domainEvidenceKindValues)[number];
export const domainEvidenceEffectValues = ['supports_domain', 'contradicts_domain'] as const;
export type PersistedDomainEvidenceEffect = (typeof domainEvidenceEffectValues)[number];
export const domainVerificationDecisionValues = ['verified', 'review_required', 'rejected'] as const;
export type PersistedDomainVerificationDecision = (typeof domainVerificationDecisionValues)[number];
export const domainVerificationMethodValues = ['deterministic', 'human_review'] as const;
export type PersistedDomainVerificationMethod = (typeof domainVerificationMethodValues)[number];
export const contactChannelValues = ['email', 'phone', 'website_form', 'social_profile', 'other_public_business_channel'] as const;
export type PersistedContactChannel = (typeof contactChannelValues)[number];
export const contactDataClassificationValues = ['PUBLIC_BUSINESS', 'PERSONAL_BUSINESS_CONTACT'] as const;
export type PersistedContactDataClassification = (typeof contactDataClassificationValues)[number];
export const contactEligibilityDecisionValues = ['allow', 'review_required', 'blocked'] as const;
export type PersistedContactEligibilityDecision = (typeof contactEligibilityDecisionValues)[number];

const identifierCheck = "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$";
const versionCheck = '^[0-9]+[.][0-9]+[.][0-9]+$';

export const businessDomainEvidence = pgTable(
  'business_domain_evidence',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    canonicalBusinessId: text('canonical_business_id').notNull().references(() => canonicalBusinesses.id, { onDelete: 'restrict' }),
    normalizedDomain: text('normalized_domain'),
    kind: text('kind').$type<PersistedDomainEvidenceKind>().notNull(),
    effect: text('effect').$type<PersistedDomainEvidenceEffect>().notNull(),
    sourceKey: text('source_key').notNull(),
    sourceReferenceIds: jsonb('source_reference_ids').$type<string[]>().notNull(),
    sourcePolicyId: text('source_policy_id').notNull(),
    sourcePolicyVersion: text('source_policy_version').notNull(),
    sourceAdmissionDecisionRef: text('source_admission_decision_ref').notNull(),
    sourceAdmissionDecision: text('source_admission_decision').notNull().default('allow'),
    storageClass: text('storage_class').$type<EnrichmentStorageClass>().notNull(),
    retentionTtlSeconds: bigint('retention_ttl_seconds', { mode: 'number' }),
    deletionRequired: boolean('deletion_required').notNull(),
    refreshAfterSeconds: bigint('refresh_after_seconds', { mode: 'number' }),
    observedAt: timestamp('observed_at', { withTimezone: true, mode: 'date' }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'date' }).notNull(),
    purgedAt: timestamp('purged_at', { withTimezone: true, mode: 'date' }),
    purgeReasonCode: text('purge_reason_code'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('business_domain_evidence_id_workspace_unique').on(table.id, table.workspaceId),
    index('business_domain_evidence_business_domain_idx').on(table.workspaceId, table.canonicalBusinessId, table.normalizedDomain, table.recordedAt, table.id),
    check('business_domain_evidence_id_check', sql`${table.id} ~ ${identifierCheck}`),
    check('business_domain_evidence_kind_check', sql`${table.kind} in ('source_claim','official_website','registry_record','dns_control')`),
    check('business_domain_evidence_effect_check', sql`${table.effect} in ('supports_domain','contradicts_domain')`),
    check('business_domain_evidence_admission_check', sql`${table.sourceAdmissionDecision} = 'allow'`),
    check('business_domain_evidence_storage_check', sql`${table.storageClass} in ('REFERENCE_ONLY','NORMALIZED_FACT','EVIDENCE_MINIMAL')`),
  ],
);

export const businessDomainVerificationDecisions = pgTable(
  'business_domain_verification_decisions',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    canonicalBusinessId: text('canonical_business_id').notNull().references(() => canonicalBusinesses.id, { onDelete: 'restrict' }),
    normalizedDomain: text('normalized_domain').notNull(),
    decision: text('decision').$type<PersistedDomainVerificationDecision>().notNull(),
    method: text('method').$type<PersistedDomainVerificationMethod>().notNull(),
    confidence: doublePrecision('confidence').notNull(),
    evidenceIds: jsonb('evidence_ids').$type<string[]>().notNull(),
    reasonCodes: jsonb('reason_codes').$type<string[]>().notNull(),
    reviewDecisionRef: text('review_decision_ref'),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('business_domain_verification_decisions_id_workspace_unique').on(table.id, table.workspaceId),
    index('business_domain_verification_decisions_business_domain_idx').on(table.workspaceId, table.canonicalBusinessId, table.normalizedDomain, table.evaluatedAt, table.id),
    check('business_domain_verification_decisions_id_check', sql`${table.id} ~ ${identifierCheck}`),
    check('business_domain_verification_decisions_confidence_check', sql`${table.confidence} >= 0 AND ${table.confidence} <= 1`),
  ],
);

export const contactDataEligibilityDecisions = pgTable(
  'contact_data_eligibility_decisions',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    canonicalBusinessId: text('canonical_business_id').notNull().references(() => canonicalBusinesses.id, { onDelete: 'restrict' }),
    channel: text('channel').$type<PersistedContactChannel>().notNull(),
    sourceKey: text('source_key').notNull(),
    connectorKey: text('connector_key').notNull(),
    connectorVersion: text('connector_version').notNull(),
    sourceRequestId: text('source_request_id').notNull(),
    sourceAdmissionDecisionRef: text('source_admission_decision_ref').notNull(),
    sourceAdmissionDecision: text('source_admission_decision').notNull().default('allow'),
    sourceReferenceIds: jsonb('source_reference_ids').$type<string[]>().notNull(),
    sourcePolicyId: text('source_policy_id').notNull(),
    sourcePolicyVersion: text('source_policy_version').notNull(),
    compliancePolicyId: text('compliance_policy_id').notNull(),
    compliancePolicyVersion: text('compliance_policy_version').notNull(),
    purpose: text('purpose').notNull(),
    territoryMode: text('territory_mode').notNull(),
    countryCodes: jsonb('country_codes').$type<string[]>().notNull(),
    fieldName: text('field_name').notNull(),
    dataClassification: text('data_classification').$type<PersistedContactDataClassification>().notNull(),
    storageClass: text('storage_class').$type<EnrichmentStorageClass>().notNull(),
    retentionTtlSeconds: bigint('retention_ttl_seconds', { mode: 'number' }),
    deletionRequired: boolean('deletion_required').notNull(),
    refreshAfterSeconds: bigint('refresh_after_seconds', { mode: 'number' }),
    decision: text('decision').$type<PersistedContactEligibilityDecision>().notNull(),
    displayAllowed: boolean('display_allowed').notNull(),
    exportAllowed: boolean('export_allowed').notNull(),
    reasonCodes: jsonb('reason_codes').$type<string[]>().notNull(),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('contact_data_eligibility_decisions_id_workspace_unique').on(table.id, table.workspaceId),
    index('contact_data_eligibility_decisions_business_time_idx').on(table.workspaceId, table.canonicalBusinessId, table.evaluatedAt, table.id),
    check('contact_data_eligibility_decisions_id_check', sql`${table.id} ~ ${identifierCheck}`),
    check('contact_data_eligibility_decisions_versions_check', sql`${table.connectorVersion} ~ ${versionCheck} AND ${table.sourcePolicyVersion} ~ ${versionCheck} AND ${table.compliancePolicyVersion} ~ ${versionCheck}`),
    check('contact_data_eligibility_decisions_admission_check', sql`${table.sourceAdmissionDecision} = 'allow'`),
    check('contact_data_eligibility_decisions_access_check', sql`${table.decision} = 'allow' OR (${table.displayAllowed} = false AND ${table.exportAllowed} = false)`),
  ],
);

export const approvedBusinessContactEvidence = pgTable(
  'approved_business_contact_evidence',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    canonicalBusinessId: text('canonical_business_id').notNull().references(() => canonicalBusinesses.id, { onDelete: 'restrict' }),
    channel: text('channel').$type<PersistedContactChannel>().notNull(),
    normalizedValue: text('normalized_value'),
    sourceKey: text('source_key').notNull(),
    sourceReferenceIds: jsonb('source_reference_ids').$type<string[]>().notNull(),
    eligibilityId: text('eligibility_id').notNull().references(() => contactDataEligibilityDecisions.id, { onDelete: 'restrict' }),
    outreachAuthorization: text('outreach_authorization').notNull().default('not_evaluated'),
    deletionRequired: boolean('deletion_required').notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true, mode: 'date' }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'date' }).notNull(),
    purgedAt: timestamp('purged_at', { withTimezone: true, mode: 'date' }),
    purgeReasonCode: text('purge_reason_code'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('approved_business_contact_evidence_id_workspace_unique').on(table.id, table.workspaceId),
    index('approved_business_contact_evidence_business_channel_idx').on(table.workspaceId, table.canonicalBusinessId, table.channel, table.recordedAt, table.id),
    check('approved_business_contact_evidence_id_check', sql`${table.id} ~ ${identifierCheck}`),
    check('approved_business_contact_evidence_outreach_check', sql`${table.outreachAuthorization} = 'not_evaluated'`),
  ],
);
