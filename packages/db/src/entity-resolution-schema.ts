import { sql } from 'drizzle-orm';
import {
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
import { workspaces } from './schema';

export const canonicalBusinessIdentityStateValues = ['active', 'superseded'] as const;
export type CanonicalBusinessIdentityState = (typeof canonicalBusinessIdentityStateValues)[number];

export const businessMatchEvidenceMethodValues = ['deterministic', 'structured_ai'] as const;
export type PersistedBusinessMatchEvidenceMethod = (typeof businessMatchEvidenceMethodValues)[number];

export const businessMatchEvidenceEffectValues = ['supports_match', 'contradicts_match'] as const;
export type PersistedBusinessMatchEvidenceEffect = (typeof businessMatchEvidenceEffectValues)[number];

export const businessResolutionDecisionValues = ['match_existing', 'create_new', 'review_required'] as const;
export type PersistedBusinessResolutionDecision = (typeof businessResolutionDecisionValues)[number];

export const businessResolutionReviewStateValues = ['not_required', 'pending', 'approved', 'rejected'] as const;
export type PersistedBusinessResolutionReviewState = (typeof businessResolutionReviewStateValues)[number];

export const canonicalBusinessLineageOperationValues = ['merge', 'split'] as const;
export type CanonicalBusinessLineageOperationType = (typeof canonicalBusinessLineageOperationValues)[number];

const identifierCheck = "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$";

export const canonicalBusinesses = pgTable(
  'canonical_businesses',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    identityState: text('identity_state').$type<CanonicalBusinessIdentityState>().notNull().default('active'),
    supersededByCanonicalBusinessId: text('superseded_by_canonical_business_id'),
    originDecisionId: text('origin_decision_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('canonical_businesses_id_workspace_unique').on(table.id, table.workspaceId),
    index('canonical_businesses_workspace_state_idx').on(table.workspaceId, table.identityState, table.id),
    check('canonical_businesses_id_check', sql`${table.id} ~ ${identifierCheck}`),
    check('canonical_businesses_display_name_check', sql`length(btrim(${table.displayName})) BETWEEN 1 AND 512`),
    check('canonical_businesses_state_check', sql`${table.identityState} in ('active', 'superseded')`),
    check(
      'canonical_businesses_supersession_shape_check',
      sql`(${table.identityState} = 'active' AND ${table.supersededByCanonicalBusinessId} IS NULL)
          OR (${table.identityState} = 'superseded' AND ${table.supersededByCanonicalBusinessId} IS NOT NULL
              AND ${table.supersededByCanonicalBusinessId} <> ${table.id})`,
    ),
  ],
);

export const sourceBusinessObservations = pgTable(
  'source_business_observations',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sourceCandidateId: text('source_candidate_id').notNull(),
    sourceKey: text('source_key').notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true, mode: 'date' }).notNull(),
    sourceReferenceIds: jsonb('source_reference_ids').$type<string[]>().notNull(),
    identitySignals: jsonb('identity_signals').$type<Record<string, unknown>[]>().notNull(),
    envelope: jsonb('envelope').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('source_business_observations_id_workspace_unique').on(table.id, table.workspaceId),
    index('source_business_observations_workspace_source_time_idx').on(
      table.workspaceId,
      table.sourceKey,
      table.observedAt,
      table.id,
    ),
    check('source_business_observations_id_check', sql`${table.id} ~ ${identifierCheck}`),
    check('source_business_observations_candidate_id_check', sql`${table.sourceCandidateId} ~ ${identifierCheck}`),
    check('source_business_observations_source_key_check', sql`${table.sourceKey} ~ '^source\\.[a-z0-9_.-]+$'`),
    check('source_business_observations_refs_array_check', sql`jsonb_typeof(${table.sourceReferenceIds}) = 'array'`),
    check('source_business_observations_refs_nonempty_check', sql`jsonb_array_length(${table.sourceReferenceIds}) > 0`),
    check('source_business_observations_signals_array_check', sql`jsonb_typeof(${table.identitySignals}) = 'array'`),
    check('source_business_observations_signals_nonempty_check', sql`jsonb_array_length(${table.identitySignals}) > 0`),
    check('source_business_observations_envelope_object_check', sql`jsonb_typeof(${table.envelope}) = 'object'`),
  ],
);

export const candidateBusinessMatchEvidence = pgTable(
  'candidate_business_match_evidence',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sourceObservationId: text('source_observation_id').notNull(),
    candidateCanonicalBusinessId: text('candidate_canonical_business_id').notNull(),
    observationSignalIds: jsonb('observation_signal_ids').$type<string[]>().notNull(),
    sourceReferenceIds: jsonb('source_reference_ids').$type<string[]>().notNull(),
    method: text('method').$type<PersistedBusinessMatchEvidenceMethod>().notNull(),
    inferenceRef: text('inference_ref'),
    effect: text('effect').$type<PersistedBusinessMatchEvidenceEffect>().notNull(),
    reasonCode: text('reason_code').notNull(),
    confidence: doublePrecision('confidence').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'date' }).notNull(),
    envelope: jsonb('envelope').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('candidate_business_match_evidence_id_workspace_unique').on(table.id, table.workspaceId),
    index('candidate_business_match_evidence_candidate_idx').on(
      table.workspaceId,
      table.candidateCanonicalBusinessId,
      table.recordedAt,
      table.id,
    ),
    index('candidate_business_match_evidence_observation_idx').on(
      table.workspaceId,
      table.sourceObservationId,
      table.recordedAt,
      table.id,
    ),
    check('candidate_business_match_evidence_id_check', sql`${table.id} ~ ${identifierCheck}`),
    check('candidate_business_match_evidence_method_check', sql`${table.method} in ('deterministic', 'structured_ai')`),
    check('candidate_business_match_evidence_effect_check', sql`${table.effect} in ('supports_match', 'contradicts_match')`),
    check('candidate_business_match_evidence_confidence_check', sql`${table.confidence} >= 0 AND ${table.confidence} <= 1`),
    check(
      'candidate_business_match_evidence_inference_check',
      sql`(${table.method} = 'deterministic' AND ${table.inferenceRef} IS NULL)
          OR (${table.method} = 'structured_ai' AND ${table.inferenceRef} IS NOT NULL)`,
    ),
    check(
      'candidate_business_match_evidence_signal_array_check',
      sql`jsonb_typeof(${table.observationSignalIds}) = 'array' AND jsonb_array_length(${table.observationSignalIds}) > 0`,
    ),
    check(
      'candidate_business_match_evidence_refs_array_check',
      sql`jsonb_typeof(${table.sourceReferenceIds}) = 'array' AND jsonb_array_length(${table.sourceReferenceIds}) > 0`,
    ),
  ],
);

export const businessResolutionDecisions = pgTable(
  'business_resolution_decisions',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sourceObservationId: text('source_observation_id').notNull(),
    candidateCanonicalBusinessId: text('candidate_canonical_business_id'),
    decision: text('decision').$type<PersistedBusinessResolutionDecision>().notNull(),
    confidence: doublePrecision('confidence').notNull(),
    reviewState: text('review_state').$type<PersistedBusinessResolutionReviewState>().notNull(),
    reviewDecisionRef: text('review_decision_ref'),
    reasonCodes: jsonb('reason_codes').$type<string[]>().notNull(),
    evidenceIds: jsonb('evidence_ids').$type<string[]>().notNull(),
    thresholdPolicyId: text('threshold_policy_id').notNull(),
    thresholdPolicyVersion: text('threshold_policy_version').notNull(),
    reviewMinimum: doublePrecision('review_minimum').notNull(),
    autoMatchMinimum: doublePrecision('auto_match_minimum').notNull(),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true, mode: 'date' }).notNull(),
    envelope: jsonb('envelope').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('business_resolution_decisions_id_workspace_unique').on(table.id, table.workspaceId),
    index('business_resolution_decisions_observation_idx').on(
      table.workspaceId,
      table.sourceObservationId,
      table.evaluatedAt,
      table.id,
    ),
    check('business_resolution_decisions_id_check', sql`${table.id} ~ ${identifierCheck}`),
    check(
      'business_resolution_decisions_decision_check',
      sql`${table.decision} in ('match_existing', 'create_new', 'review_required')`,
    ),
    check(
      'business_resolution_decisions_review_state_check',
      sql`${table.reviewState} in ('not_required', 'pending', 'approved', 'rejected')`,
    ),
    check('business_resolution_decisions_confidence_check', sql`${table.confidence} >= 0 AND ${table.confidence} <= 1`),
    check('business_resolution_decisions_reasons_array_check', sql`jsonb_typeof(${table.reasonCodes}) = 'array' AND jsonb_array_length(${table.reasonCodes}) > 0`),
    check('business_resolution_decisions_evidence_array_check', sql`jsonb_typeof(${table.evidenceIds}) = 'array' AND jsonb_array_length(${table.evidenceIds}) > 0`),
    check('business_resolution_decisions_threshold_policy_id_check', sql`${table.thresholdPolicyId} ~ ${identifierCheck}`),
    check(
      'business_resolution_decisions_threshold_policy_version_check',
      sql`${table.thresholdPolicyVersion} ~ '^[0-9]+[.][0-9]+[.][0-9]+$'`,
    ),
    check(
      'business_resolution_decisions_review_minimum_check',
      sql`${table.reviewMinimum} >= 0 AND ${table.reviewMinimum} <= 1`,
    ),
    check(
      'business_resolution_decisions_auto_match_minimum_check',
      sql`${table.autoMatchMinimum} >= 0 AND ${table.autoMatchMinimum} <= 1`,
    ),
    check(
      'business_resolution_decisions_threshold_order_check',
      sql`${table.reviewMinimum} < ${table.autoMatchMinimum}`,
    ),
    check(
      'business_resolution_decisions_candidate_shape_check',
      sql`(${table.decision} = 'match_existing' AND ${table.candidateCanonicalBusinessId} IS NOT NULL)
          OR (${table.decision} = 'create_new' AND ${table.candidateCanonicalBusinessId} IS NULL)
          OR ${table.decision} = 'review_required'`,
    ),
  ],
);

export const canonicalBusinessAliases = pgTable(
  'canonical_business_aliases',
  {
    sourceObservationId: text('source_observation_id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    canonicalBusinessId: text('canonical_business_id').notNull(),
    decisionId: text('decision_id').notNull(),
    attachedAt: timestamp('attached_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('canonical_business_aliases_observation_workspace_unique').on(table.sourceObservationId, table.workspaceId),
    uniqueIndex('canonical_business_aliases_decision_workspace_unique').on(table.decisionId, table.workspaceId),
    index('canonical_business_aliases_business_idx').on(table.workspaceId, table.canonicalBusinessId, table.attachedAt),
  ],
);

export const canonicalBusinessLineageOperations = pgTable(
  'canonical_business_lineage_operations',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    operationType: text('operation_type').$type<CanonicalBusinessLineageOperationType>().notNull(),
    requestId: text('request_id').notNull(),
    targetCanonicalBusinessId: text('target_canonical_business_id').notNull(),
    sourceCanonicalBusinessIds: jsonb('source_canonical_business_ids').$type<string[]>().notNull(),
    restoreCanonicalBusinessIds: jsonb('restore_canonical_business_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    parentLineageOperationId: text('parent_lineage_operation_id'),
    evidenceIds: jsonb('evidence_ids').$type<string[]>().notNull(),
    reasonCodes: jsonb('reason_codes').$type<string[]>().notNull(),
    requestedByActorId: text('requested_by_actor_id').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true, mode: 'date' }).notNull(),
    reviewRequestId: text('review_request_id').notNull(),
    reviewState: text('review_state').notNull().default('pending'),
    reversible: boolean('reversible').notNull().default(true),
    envelope: jsonb('envelope').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('canonical_business_lineage_operations_id_workspace_unique').on(table.id, table.workspaceId),
    uniqueIndex('canonical_business_lineage_operations_request_workspace_unique').on(table.requestId, table.workspaceId),
    index('canonical_business_lineage_operations_target_idx').on(
      table.workspaceId,
      table.targetCanonicalBusinessId,
      table.requestedAt,
      table.id,
    ),
    check('canonical_business_lineage_operations_id_check', sql`${table.id} ~ ${identifierCheck}`),
    check('canonical_business_lineage_operations_type_check', sql`${table.operationType} in ('merge', 'split')`),
    check('canonical_business_lineage_operations_review_check', sql`${table.reviewState} = 'pending'`),
    check('canonical_business_lineage_operations_reversible_check', sql`${table.reversible} = true`),
    check('canonical_business_lineage_operations_source_array_check', sql`jsonb_typeof(${table.sourceCanonicalBusinessIds}) = 'array'`),
    check('canonical_business_lineage_operations_source_nonempty_check', sql`jsonb_array_length(${table.sourceCanonicalBusinessIds}) >= 1`),
    check('canonical_business_lineage_operations_restore_array_check', sql`jsonb_typeof(${table.restoreCanonicalBusinessIds}) = 'array'`),
    check('canonical_business_lineage_operations_evidence_array_check', sql`jsonb_typeof(${table.evidenceIds}) = 'array' AND jsonb_array_length(${table.evidenceIds}) > 0`),
    check('canonical_business_lineage_operations_reason_array_check', sql`jsonb_typeof(${table.reasonCodes}) = 'array' AND jsonb_array_length(${table.reasonCodes}) > 0`),
  ],
);
