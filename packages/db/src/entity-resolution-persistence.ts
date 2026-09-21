import type { Pool } from 'pg';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const sourceKeyPattern = /^source\.[a-z0-9_.-]+$/;

export type EntityResolutionPersistenceErrorCode =
  | 'ENTITY_RESOLUTION_INPUT_INVALID'
  | 'CANONICAL_BUSINESS_ID_CONFLICT'
  | 'SOURCE_OBSERVATION_ID_CONFLICT'
  | 'MATCH_EVIDENCE_ID_CONFLICT'
  | 'RESOLUTION_DECISION_ID_CONFLICT'
  | 'RESOLUTION_DECISION_EVIDENCE_INVALID'
  | 'CANONICAL_ALIAS_CONFLICT'
  | 'CANONICAL_ALIAS_DECISION_INVALID'
  | 'LINEAGE_OPERATION_ID_CONFLICT'
  | 'LINEAGE_ENTITY_NOT_FOUND'
  | 'LINEAGE_PARENT_NOT_FOUND';

export class EntityResolutionPersistenceError extends Error {
  readonly code: EntityResolutionPersistenceErrorCode;

  constructor(code: EntityResolutionPersistenceErrorCode, message: string) {
    super(message);
    this.name = 'EntityResolutionPersistenceError';
    this.code = code;
  }
}

export type PersistedCanonicalBusinessState = 'active' | 'superseded';
export type MatchEvidenceMethod = 'deterministic' | 'structured_ai';
export type MatchEvidenceEffect = 'supports_match' | 'contradicts_match';
export type ResolutionDecisionKind = 'match_existing' | 'create_new' | 'review_required';
export type ResolutionReviewState = 'not_required' | 'pending' | 'approved' | 'rejected';
export type LineageOperationType = 'merge' | 'split';

export interface PersistCanonicalBusinessInput {
  id: string;
  workspaceId: string;
  displayName: string;
  identityState?: PersistedCanonicalBusinessState;
  supersededByCanonicalBusinessId?: string | null;
  originDecisionId?: string | null;
}

export interface PersistedCanonicalBusiness {
  id: string;
  workspaceId: string;
  displayName: string;
  identityState: PersistedCanonicalBusinessState;
  supersededByCanonicalBusinessId: string | null;
  originDecisionId: string | null;
  createdAt: Date;
}

export interface PersistSourceBusinessObservationInput {
  workspaceId: string;
  sourceObservationId: string;
  sourceCandidateId: string;
  sourceKey: string;
  observedAt: Date;
  sourceReferenceIds: readonly string[];
  identitySignals: readonly Record<string, unknown>[];
}

export interface PersistCandidateBusinessMatchEvidenceInput {
  evidenceId: string;
  workspaceId: string;
  sourceObservationId: string;
  candidateCanonicalBusinessId: string;
  observationSignalIds: readonly string[];
  sourceReferenceIds: readonly string[];
  method: MatchEvidenceMethod;
  inferenceRef: string | null;
  effect: MatchEvidenceEffect;
  reasonCode: string;
  confidence: number;
  recordedAt: Date;
}

export interface PersistBusinessResolutionThresholdPolicy {
  policyId: string;
  version: string;
  reviewMinimum: number;
  autoMatchMinimum: number;
}

export interface PersistBusinessResolutionDecisionInput {
  decisionId: string;
  workspaceId: string;
  sourceObservationId: string;
  candidateCanonicalBusinessId: string | null;
  decision: ResolutionDecisionKind;
  confidence: number;
  reviewState: ResolutionReviewState;
  reviewDecisionRef: string | null;
  reasonCodes: readonly string[];
  evidenceIds: readonly string[];
  thresholdPolicy: PersistBusinessResolutionThresholdPolicy;
  evaluatedAt: Date;
}

export interface PersistCanonicalBusinessAliasInput {
  workspaceId: string;
  sourceObservationId: string;
  canonicalBusinessId: string;
  decisionId: string;
  attachedAt: Date;
}

export interface PersistCanonicalBusinessLineageOperationInput {
  operationId: string;
  workspaceId: string;
  operationType: LineageOperationType;
  requestId: string;
  targetCanonicalBusinessId: string;
  sourceCanonicalBusinessIds: readonly string[];
  restoreCanonicalBusinessIds?: readonly string[];
  parentLineageOperationId?: string | null;
  evidenceIds: readonly string[];
  reasonCodes: readonly string[];
  requestedByActorId: string;
  requestedAt: Date;
  reviewRequestId: string;
}

export interface PersistenceResult<T> {
  created: boolean;
  record: T;
}

export interface PersistedSourceBusinessObservation {
  workspaceId: string;
  sourceObservationId: string;
  sourceCandidateId: string;
  sourceKey: string;
  observedAt: Date;
  sourceReferenceIds: readonly string[];
  identitySignals: readonly Record<string, unknown>[];
  createdAt: Date;
}

export interface PersistedCandidateBusinessMatchEvidence extends PersistCandidateBusinessMatchEvidenceInput {
  createdAt: Date;
}

export interface PersistedResolutionDecisionRecord extends PersistBusinessResolutionDecisionInput {
  createdAt: Date;
}

export interface PersistedCanonicalBusinessAlias extends PersistCanonicalBusinessAliasInput {
  createdAt: Date;
}

export interface PersistedCanonicalBusinessLineageOperation {
  operationId: string;
  workspaceId: string;
  operationType: LineageOperationType;
  requestId: string;
  targetCanonicalBusinessId: string;
  sourceCanonicalBusinessIds: readonly string[];
  restoreCanonicalBusinessIds: readonly string[];
  parentLineageOperationId: string | null;
  evidenceIds: readonly string[];
  reasonCodes: readonly string[];
  requestedByActorId: string;
  requestedAt: Date;
  reviewRequestId: string;
  reviewState: 'pending';
  reversible: true;
  createdAt: Date;
}

interface CanonicalBusinessRow {
  id: string;
  workspace_id: string;
  display_name: string;
  identity_state: PersistedCanonicalBusinessState;
  superseded_by_canonical_business_id: string | null;
  origin_decision_id: string | null;
  created_at: Date;
}

interface ObservationRow {
  id: string;
  workspace_id: string;
  source_candidate_id: string;
  source_key: string;
  observed_at: Date;
  source_reference_ids: string[];
  identity_signals: Record<string, unknown>[];
  created_at: Date;
}

interface EvidenceRow {
  id: string;
  workspace_id: string;
  source_observation_id: string;
  candidate_canonical_business_id: string;
  observation_signal_ids: string[];
  source_reference_ids: string[];
  method: MatchEvidenceMethod;
  inference_ref: string | null;
  effect: MatchEvidenceEffect;
  reason_code: string;
  confidence: number;
  recorded_at: Date;
  created_at: Date;
}

interface DecisionRow {
  id: string;
  workspace_id: string;
  source_observation_id: string;
  candidate_canonical_business_id: string | null;
  decision: ResolutionDecisionKind;
  confidence: number;
  review_state: ResolutionReviewState;
  review_decision_ref: string | null;
  reason_codes: string[];
  evidence_ids: string[];
  threshold_policy_id: string;
  threshold_policy_version: string;
  review_minimum: number;
  auto_match_minimum: number;
  evaluated_at: Date;
  created_at: Date;
}

interface AliasRow {
  source_observation_id: string;
  workspace_id: string;
  canonical_business_id: string;
  decision_id: string;
  attached_at: Date;
  created_at: Date;
}

interface LineageRow {
  id: string;
  workspace_id: string;
  operation_type: LineageOperationType;
  request_id: string;
  target_canonical_business_id: string;
  source_canonical_business_ids: string[];
  restore_canonical_business_ids: string[];
  parent_lineage_operation_id: string | null;
  evidence_ids: string[];
  reason_codes: string[];
  requested_by_actor_id: string;
  requested_at: Date;
  review_request_id: string;
  review_state: 'pending';
  reversible: boolean;
  created_at: Date;
}

function fail(code: EntityResolutionPersistenceErrorCode, message: string): never {
  throw new EntityResolutionPersistenceError(code, message);
}

function assertWorkspaceId(value: string): void {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    fail('ENTITY_RESOLUTION_INPUT_INVALID', 'workspaceId must be a canonical UUID.');
  }
}

function assertIdentifier(value: string, field: string): void {
  if (typeof value !== 'string' || !identifierPattern.test(value)) {
    fail('ENTITY_RESOLUTION_INPUT_INVALID', `${field} must use the canonical identifier format.`);
  }
}

function assertDate(value: Date, field: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail('ENTITY_RESOLUTION_INPUT_INVALID', `${field} must be a valid Date.`);
  }
}

function assertConfidence(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    fail('ENTITY_RESOLUTION_INPUT_INVALID', 'confidence must be between 0 and 1.');
  }
}

function normalizeStringArray(
  values: readonly string[],
  field: string,
  { min = 1, max = 4096 }: { min?: number; max?: number } = {},
): string[] {
  if (!Array.isArray(values) || values.length < min || values.length > max) {
    fail('ENTITY_RESOLUTION_INPUT_INVALID', `${field} must contain between ${min} and ${max} values.`);
  }
  const normalized = values.map((value) => {
    if (typeof value !== 'string' || !identifierPattern.test(value)) {
      fail('ENTITY_RESOLUTION_INPUT_INVALID', `${field} contains an invalid identifier.`);
    }
    return value;
  });
  if (new Set(normalized).size !== normalized.length) {
    fail('ENTITY_RESOLUTION_INPUT_INVALID', `${field} must not contain duplicates.`);
  }
  return normalized;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function sameJson(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function toCanonicalBusiness(row: CanonicalBusinessRow): PersistedCanonicalBusiness {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    displayName: row.display_name,
    identityState: row.identity_state,
    supersededByCanonicalBusinessId: row.superseded_by_canonical_business_id,
    originDecisionId: row.origin_decision_id,
    createdAt: row.created_at,
  };
}

function toObservation(row: ObservationRow): PersistedSourceBusinessObservation {
  return {
    workspaceId: row.workspace_id,
    sourceObservationId: row.id,
    sourceCandidateId: row.source_candidate_id,
    sourceKey: row.source_key,
    observedAt: row.observed_at,
    sourceReferenceIds: Object.freeze([...row.source_reference_ids]),
    identitySignals: Object.freeze(row.identity_signals.map((signal) => Object.freeze({ ...signal }))),
    createdAt: row.created_at,
  };
}

function toEvidence(row: EvidenceRow): PersistedCandidateBusinessMatchEvidence {
  return {
    evidenceId: row.id,
    workspaceId: row.workspace_id,
    sourceObservationId: row.source_observation_id,
    candidateCanonicalBusinessId: row.candidate_canonical_business_id,
    observationSignalIds: Object.freeze([...row.observation_signal_ids]),
    sourceReferenceIds: Object.freeze([...row.source_reference_ids]),
    method: row.method,
    inferenceRef: row.inference_ref,
    effect: row.effect,
    reasonCode: row.reason_code,
    confidence: row.confidence,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
  };
}

function toDecision(row: DecisionRow): PersistedResolutionDecisionRecord {
  return {
    decisionId: row.id,
    workspaceId: row.workspace_id,
    sourceObservationId: row.source_observation_id,
    candidateCanonicalBusinessId: row.candidate_canonical_business_id,
    decision: row.decision,
    confidence: row.confidence,
    reviewState: row.review_state,
    reviewDecisionRef: row.review_decision_ref,
    reasonCodes: Object.freeze([...row.reason_codes]),
    evidenceIds: Object.freeze([...row.evidence_ids]),
    thresholdPolicy: Object.freeze({
      policyId: row.threshold_policy_id,
      version: row.threshold_policy_version,
      reviewMinimum: row.review_minimum,
      autoMatchMinimum: row.auto_match_minimum,
    }),
    evaluatedAt: row.evaluated_at,
    createdAt: row.created_at,
  };
}

function toAlias(row: AliasRow): PersistedCanonicalBusinessAlias {
  return {
    workspaceId: row.workspace_id,
    sourceObservationId: row.source_observation_id,
    canonicalBusinessId: row.canonical_business_id,
    decisionId: row.decision_id,
    attachedAt: row.attached_at,
    createdAt: row.created_at,
  };
}

function toLineage(row: LineageRow): PersistedCanonicalBusinessLineageOperation {
  if (!row.reversible || row.review_state !== 'pending') {
    throw new Error('Persisted lineage operation violates the reversible pending-request invariant.');
  }
  return {
    operationId: row.id,
    workspaceId: row.workspace_id,
    operationType: row.operation_type,
    requestId: row.request_id,
    targetCanonicalBusinessId: row.target_canonical_business_id,
    sourceCanonicalBusinessIds: Object.freeze([...row.source_canonical_business_ids]),
    restoreCanonicalBusinessIds: Object.freeze([...row.restore_canonical_business_ids]),
    parentLineageOperationId: row.parent_lineage_operation_id,
    evidenceIds: Object.freeze([...row.evidence_ids]),
    reasonCodes: Object.freeze([...row.reason_codes]),
    requestedByActorId: row.requested_by_actor_id,
    requestedAt: row.requested_at,
    reviewRequestId: row.review_request_id,
    reviewState: 'pending',
    reversible: true,
    createdAt: row.created_at,
  };
}

export async function persistCanonicalBusiness(
  pool: Pool,
  input: PersistCanonicalBusinessInput,
): Promise<PersistenceResult<PersistedCanonicalBusiness>> {
  assertWorkspaceId(input.workspaceId);
  assertIdentifier(input.id, 'id');
  if (typeof input.displayName !== 'string' || input.displayName.trim().length < 1 || input.displayName.trim().length > 512) {
    fail('ENTITY_RESOLUTION_INPUT_INVALID', 'displayName must contain between 1 and 512 trimmed characters.');
  }
  const identityState = input.identityState ?? 'active';
  const supersededBy = input.supersededByCanonicalBusinessId ?? null;
  const originDecisionId = input.originDecisionId ?? null;
  if (!['active', 'superseded'].includes(identityState)) fail('ENTITY_RESOLUTION_INPUT_INVALID', 'identityState is invalid.');
  if (identityState === 'active' && supersededBy !== null) {
    fail('ENTITY_RESOLUTION_INPUT_INVALID', 'An active canonical business cannot declare supersession.');
  }
  if (originDecisionId !== null) assertIdentifier(originDecisionId, 'originDecisionId');
  if (identityState === 'superseded' && originDecisionId !== null) {
    fail('ENTITY_RESOLUTION_INPUT_INVALID', 'A superseded canonical business cannot declare a create_new origin decision.');
  }
  if (identityState === 'superseded') {
    if (supersededBy === null) fail('ENTITY_RESOLUTION_INPUT_INVALID', 'A superseded canonical business requires a surviving identity.');
    assertIdentifier(supersededBy, 'supersededByCanonicalBusinessId');
    if (supersededBy === input.id) fail('ENTITY_RESOLUTION_INPUT_INVALID', 'A canonical business cannot supersede itself.');
  }

  const inserted = await pool.query<CanonicalBusinessRow>(
    `INSERT INTO canonical_businesses
       (id, workspace_id, display_name, identity_state, superseded_by_canonical_business_id, origin_decision_id)
     VALUES ($1, $2::uuid, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING
     RETURNING id, workspace_id, display_name, identity_state, superseded_by_canonical_business_id, origin_decision_id, created_at`,
    [input.id, input.workspaceId, input.displayName.trim(), identityState, supersededBy, originDecisionId],
  );
  if (inserted.rows[0]) return { created: true, record: toCanonicalBusiness(inserted.rows[0]) };

  const existing = await pool.query<CanonicalBusinessRow>(
    `SELECT id, workspace_id, display_name, identity_state, superseded_by_canonical_business_id, origin_decision_id, created_at
     FROM canonical_businesses WHERE id = $1 AND workspace_id = $2::uuid`,
    [input.id, input.workspaceId],
  );
  const row = existing.rows[0];
  if (
    !row ||
    row.workspace_id !== input.workspaceId ||
    row.display_name !== input.displayName.trim() ||
    row.identity_state !== identityState ||
    row.superseded_by_canonical_business_id !== supersededBy ||
    row.origin_decision_id !== originDecisionId
  ) {
    fail('CANONICAL_BUSINESS_ID_CONFLICT', `Canonical business ${input.id} already exists with different durable identity.`);
  }
  return { created: false, record: toCanonicalBusiness(row) };
}

export async function persistSourceBusinessObservation(
  pool: Pool,
  input: PersistSourceBusinessObservationInput,
): Promise<PersistenceResult<PersistedSourceBusinessObservation>> {
  assertWorkspaceId(input.workspaceId);
  assertIdentifier(input.sourceObservationId, 'sourceObservationId');
  assertIdentifier(input.sourceCandidateId, 'sourceCandidateId');
  if (!sourceKeyPattern.test(input.sourceKey)) fail('ENTITY_RESOLUTION_INPUT_INVALID', 'sourceKey is invalid.');
  assertDate(input.observedAt, 'observedAt');
  const refs = normalizeStringArray(input.sourceReferenceIds, 'sourceReferenceIds', { max: 64 });
  if (!Array.isArray(input.identitySignals) || input.identitySignals.length < 1 || input.identitySignals.length > 128) {
    fail('ENTITY_RESOLUTION_INPUT_INVALID', 'identitySignals must contain between 1 and 128 values.');
  }
  const signalIds = input.identitySignals.map((signal, index) => {
    if (!signal || typeof signal !== 'object' || Array.isArray(signal)) {
      fail('ENTITY_RESOLUTION_INPUT_INVALID', `identitySignals[${index}] must be an object.`);
    }
    const signalId = signal.signalId;
    if (typeof signalId !== 'string' || !identifierPattern.test(signalId)) {
      fail('ENTITY_RESOLUTION_INPUT_INVALID', `identitySignals[${index}].signalId is invalid.`);
    }
    const signalRefs = signal.sourceReferenceIds;
    if (!Array.isArray(signalRefs) || signalRefs.length < 1 || signalRefs.some((value) => typeof value !== 'string' || !refs.includes(value))) {
      fail('ENTITY_RESOLUTION_INPUT_INVALID', `identitySignals[${index}] provenance must be a non-empty subset of sourceReferenceIds.`);
    }
    return signalId;
  });
  if (new Set(signalIds).size !== signalIds.length) fail('ENTITY_RESOLUTION_INPUT_INVALID', 'identity signal IDs must be unique.');

  const signals = input.identitySignals.map((signal) => ({ ...signal }));
  const envelope = {
    version: '1.0.0',
    workspaceId: input.workspaceId,
    sourceObservationId: input.sourceObservationId,
    sourceCandidateId: input.sourceCandidateId,
    sourceKey: input.sourceKey,
    observedAt: input.observedAt.toISOString(),
    sourceReferenceIds: refs,
    identitySignals: signals,
  };

  const inserted = await pool.query<ObservationRow>(
    `INSERT INTO source_business_observations
       (id, workspace_id, source_candidate_id, source_key, observed_at, source_reference_ids, identity_signals, envelope)
     VALUES ($1, $2::uuid, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)
     ON CONFLICT (id) DO NOTHING
     RETURNING id, workspace_id, source_candidate_id, source_key, observed_at,
               source_reference_ids, identity_signals, created_at`,
    [
      input.sourceObservationId,
      input.workspaceId,
      input.sourceCandidateId,
      input.sourceKey,
      input.observedAt,
      JSON.stringify(refs),
      JSON.stringify(signals),
      JSON.stringify(envelope),
    ],
  );
  if (inserted.rows[0]) return { created: true, record: toObservation(inserted.rows[0]) };

  const existing = await pool.query<ObservationRow & { envelope: Record<string, unknown> }>(
    `SELECT id, workspace_id, source_candidate_id, source_key, observed_at,
            source_reference_ids, identity_signals, envelope, created_at
     FROM source_business_observations WHERE id = $1 AND workspace_id = $2::uuid`,
    [input.sourceObservationId, input.workspaceId],
  );
  const row = existing.rows[0];
  if (
    !row ||
    row.workspace_id !== input.workspaceId ||
    row.source_candidate_id !== input.sourceCandidateId ||
    row.source_key !== input.sourceKey ||
    row.observed_at.getTime() !== input.observedAt.getTime() ||
    !sameJson(row.source_reference_ids, refs) ||
    !sameJson(row.identity_signals, signals) ||
    !sameJson(row.envelope, envelope)
  ) {
    fail('SOURCE_OBSERVATION_ID_CONFLICT', `Source observation ${input.sourceObservationId} already exists with different durable content.`);
  }
  return { created: false, record: toObservation(row) };
}

export async function persistCandidateBusinessMatchEvidence(
  pool: Pool,
  input: PersistCandidateBusinessMatchEvidenceInput,
): Promise<PersistenceResult<PersistedCandidateBusinessMatchEvidence>> {
  assertWorkspaceId(input.workspaceId);
  assertIdentifier(input.evidenceId, 'evidenceId');
  assertIdentifier(input.sourceObservationId, 'sourceObservationId');
  assertIdentifier(input.candidateCanonicalBusinessId, 'candidateCanonicalBusinessId');
  const signalIds = normalizeStringArray(input.observationSignalIds, 'observationSignalIds', { max: 128 });
  const refs = normalizeStringArray(input.sourceReferenceIds, 'sourceReferenceIds', { max: 64 });
  if (input.method !== 'deterministic' && input.method !== 'structured_ai') fail('ENTITY_RESOLUTION_INPUT_INVALID', 'method is invalid.');
  if (input.effect !== 'supports_match' && input.effect !== 'contradicts_match') fail('ENTITY_RESOLUTION_INPUT_INVALID', 'effect is invalid.');
  if (input.method === 'deterministic' && input.inferenceRef !== null) fail('ENTITY_RESOLUTION_INPUT_INVALID', 'Deterministic evidence cannot declare inferenceRef.');
  if (input.method === 'structured_ai') {
    if (input.inferenceRef === null) fail('ENTITY_RESOLUTION_INPUT_INVALID', 'Structured-AI evidence requires inferenceRef.');
    assertIdentifier(input.inferenceRef, 'inferenceRef');
  }
  assertIdentifier(input.reasonCode, 'reasonCode');
  assertConfidence(input.confidence);
  assertDate(input.recordedAt, 'recordedAt');

  const observation = await pool.query<{ source_reference_ids: string[]; identity_signals: Record<string, unknown>[] }>(
    `SELECT source_reference_ids, identity_signals
     FROM source_business_observations
     WHERE id = $1 AND workspace_id = $2::uuid`,
    [input.sourceObservationId, input.workspaceId],
  );
  const observationRow = observation.rows[0];
  if (!observationRow) {
    fail('MATCH_EVIDENCE_ID_CONFLICT', 'Candidate evidence requires an existing source observation in the same workspace.');
  }
  const signalById = new Map(
    observationRow.identity_signals.map((signal) => [
      typeof signal.signalId === 'string' ? signal.signalId : '',
      signal,
    ]),
  );
  if (signalIds.some((signalId) => !signalById.has(signalId))) {
    fail('MATCH_EVIDENCE_ID_CONFLICT', 'Candidate evidence may reference only persisted observation signals.');
  }
  const observationRefs = new Set(observationRow.source_reference_ids);
  const referencedSignalRefs = new Set(
    signalIds.flatMap((signalId) => {
      const signal = signalById.get(signalId);
      return Array.isArray(signal?.sourceReferenceIds)
        ? signal.sourceReferenceIds.filter((value): value is string => typeof value === 'string')
        : [];
    }),
  );
  if (refs.some((referenceId) => !observationRefs.has(referenceId) || !referencedSignalRefs.has(referenceId))) {
    fail('MATCH_EVIDENCE_ID_CONFLICT', 'Candidate evidence provenance must be bound to the referenced observation signals.');
  }

  const envelope = {
    evidenceId: input.evidenceId,
    workspaceId: input.workspaceId,
    sourceObservationId: input.sourceObservationId,
    candidateCanonicalBusinessId: input.candidateCanonicalBusinessId,
    observationSignalIds: signalIds,
    sourceReferenceIds: refs,
    method: input.method,
    inferenceRef: input.inferenceRef,
    effect: input.effect,
    reasonCode: input.reasonCode,
    confidence: input.confidence,
    recordedAt: input.recordedAt.toISOString(),
  };

  const inserted = await pool.query<EvidenceRow>(
    `INSERT INTO candidate_business_match_evidence
       (id, workspace_id, source_observation_id, candidate_canonical_business_id,
        observation_signal_ids, source_reference_ids, method, inference_ref, effect,
        reason_code, confidence, recorded_at, envelope)
     VALUES ($1, $2::uuid, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12, $13::jsonb)
     ON CONFLICT (id) DO NOTHING
     RETURNING id, workspace_id, source_observation_id, candidate_canonical_business_id,
               observation_signal_ids, source_reference_ids, method, inference_ref, effect,
               reason_code, confidence, recorded_at, created_at`,
    [
      input.evidenceId,
      input.workspaceId,
      input.sourceObservationId,
      input.candidateCanonicalBusinessId,
      JSON.stringify(signalIds),
      JSON.stringify(refs),
      input.method,
      input.inferenceRef,
      input.effect,
      input.reasonCode,
      input.confidence,
      input.recordedAt,
      JSON.stringify(envelope),
    ],
  );
  if (inserted.rows[0]) return { created: true, record: toEvidence(inserted.rows[0]) };

  const existing = await pool.query<EvidenceRow & { envelope: Record<string, unknown> }>(
    `SELECT id, workspace_id, source_observation_id, candidate_canonical_business_id,
            observation_signal_ids, source_reference_ids, method, inference_ref, effect,
            reason_code, confidence, recorded_at, envelope, created_at
     FROM candidate_business_match_evidence WHERE id = $1 AND workspace_id = $2::uuid`,
    [input.evidenceId, input.workspaceId],
  );
  const row = existing.rows[0];
  if (
    !row ||
    row.workspace_id !== input.workspaceId ||
    row.source_observation_id !== input.sourceObservationId ||
    row.candidate_canonical_business_id !== input.candidateCanonicalBusinessId ||
    !sameJson(row.observation_signal_ids, signalIds) ||
    !sameJson(row.source_reference_ids, refs) ||
    row.method !== input.method ||
    row.inference_ref !== input.inferenceRef ||
    row.effect !== input.effect ||
    row.reason_code !== input.reasonCode ||
    row.confidence !== input.confidence ||
    row.recorded_at.getTime() !== input.recordedAt.getTime() ||
    !sameJson(row.envelope, envelope)
  ) {
    fail('MATCH_EVIDENCE_ID_CONFLICT', `Match evidence ${input.evidenceId} already exists with different durable content.`);
  }
  return { created: false, record: toEvidence(row) };
}

export async function persistBusinessResolutionDecision(
  pool: Pool,
  input: PersistBusinessResolutionDecisionInput,
): Promise<PersistenceResult<PersistedResolutionDecisionRecord>> {
  assertWorkspaceId(input.workspaceId);
  assertIdentifier(input.decisionId, 'decisionId');
  assertIdentifier(input.sourceObservationId, 'sourceObservationId');
  if (input.candidateCanonicalBusinessId !== null) assertIdentifier(input.candidateCanonicalBusinessId, 'candidateCanonicalBusinessId');
  if (!['match_existing', 'create_new', 'review_required'].includes(input.decision)) fail('ENTITY_RESOLUTION_INPUT_INVALID', 'decision is invalid.');
  if (!['not_required', 'pending', 'approved', 'rejected'].includes(input.reviewState)) fail('ENTITY_RESOLUTION_INPUT_INVALID', 'reviewState is invalid.');
  if (input.decision === 'match_existing' && input.candidateCanonicalBusinessId === null) fail('ENTITY_RESOLUTION_INPUT_INVALID', 'match_existing requires candidateCanonicalBusinessId.');
  if (input.decision === 'create_new' && input.candidateCanonicalBusinessId !== null) fail('ENTITY_RESOLUTION_INPUT_INVALID', 'create_new cannot pre-bind a canonical candidate.');
  if (input.decision === 'review_required' && input.reviewState !== 'pending') fail('ENTITY_RESOLUTION_INPUT_INVALID', 'review_required decisions must remain pending.');
  if (input.decision !== 'review_required' && input.reviewState === 'pending') fail('ENTITY_RESOLUTION_INPUT_INVALID', 'Only review_required decisions may remain pending.');
  if (input.reviewState === 'rejected' && input.decision === 'match_existing') fail('ENTITY_RESOLUTION_INPUT_INVALID', 'Rejected review cannot produce match_existing.');
  const reviewWasDecided = input.reviewState === 'approved' || input.reviewState === 'rejected';
  if (reviewWasDecided && input.reviewDecisionRef === null) fail('ENTITY_RESOLUTION_INPUT_INVALID', 'Approved/rejected review requires reviewDecisionRef.');
  if (!reviewWasDecided && input.reviewDecisionRef !== null) fail('ENTITY_RESOLUTION_INPUT_INVALID', 'reviewDecisionRef is valid only for approved/rejected review.');
  if (input.reviewDecisionRef !== null) assertIdentifier(input.reviewDecisionRef, 'reviewDecisionRef');
  assertConfidence(input.confidence);
  assertIdentifier(input.thresholdPolicy.policyId, 'thresholdPolicy.policyId');
  if (!/^\d+\.\d+\.\d+$/.test(input.thresholdPolicy.version)) {
    fail('ENTITY_RESOLUTION_INPUT_INVALID', 'thresholdPolicy.version must use semantic version format.');
  }
  assertConfidence(input.thresholdPolicy.reviewMinimum);
  assertConfidence(input.thresholdPolicy.autoMatchMinimum);
  if (input.thresholdPolicy.reviewMinimum >= input.thresholdPolicy.autoMatchMinimum) {
    fail('ENTITY_RESOLUTION_INPUT_INVALID', 'thresholdPolicy.autoMatchMinimum must be greater than reviewMinimum.');
  }
  const reasons = normalizeStringArray(input.reasonCodes, 'reasonCodes', { max: 64 });
  const evidenceIds = normalizeStringArray(input.evidenceIds, 'evidenceIds', { max: 256 });
  assertDate(input.evaluatedAt, 'evaluatedAt');

  const evidence = await pool.query<{
    id: string;
    candidate_canonical_business_id: string;
    effect: MatchEvidenceEffect;
    method: MatchEvidenceMethod;
    confidence: number;
  }>(
    `SELECT id, candidate_canonical_business_id, effect, method, confidence
     FROM candidate_business_match_evidence
     WHERE workspace_id = $1::uuid
       AND source_observation_id = $2
       AND id = ANY($3::text[])`,
    [input.workspaceId, input.sourceObservationId, evidenceIds],
  );
  if (evidence.rows.length !== evidenceIds.length || new Set(evidence.rows.map((row) => row.id)).size !== evidenceIds.length) {
    fail('RESOLUTION_DECISION_EVIDENCE_INVALID', 'Decision evidence must exist in the same workspace and source observation.');
  }
  if (
    input.decision === 'match_existing' &&
    !evidence.rows.some(
      (row) =>
        row.candidate_canonical_business_id === input.candidateCanonicalBusinessId &&
        row.effect === 'supports_match',
    )
  ) {
    fail('RESOLUTION_DECISION_EVIDENCE_INVALID', 'match_existing requires supporting evidence for the selected candidate.');
  }

  const observationEvidence = await pool.query<{
    candidate_canonical_business_id: string;
    effect: MatchEvidenceEffect;
    method: MatchEvidenceMethod;
    confidence: number;
  }>(
    `SELECT candidate_canonical_business_id, effect, method, confidence
     FROM candidate_business_match_evidence
     WHERE workspace_id = $1::uuid AND source_observation_id = $2`,
    [input.workspaceId, input.sourceObservationId],
  );

  let requiresReview = false;
  if (input.decision === 'match_existing') {
    requiresReview =
      input.confidence < input.thresholdPolicy.autoMatchMinimum ||
      observationEvidence.rows.some(
        (row) =>
          row.candidate_canonical_business_id === input.candidateCanonicalBusinessId &&
          row.effect === 'contradicts_match',
      ) ||
      evidence.rows.some(
        (row) =>
          row.candidate_canonical_business_id === input.candidateCanonicalBusinessId &&
          row.method === 'structured_ai',
      );
  } else if (input.decision === 'create_new') {
    requiresReview = observationEvidence.rows.some(
      (row) =>
        row.effect === 'supports_match' &&
        row.confidence >= input.thresholdPolicy.reviewMinimum,
    );
  }
  if (requiresReview && input.reviewState !== 'approved') {
    fail('RESOLUTION_DECISION_EVIDENCE_INVALID', 'Resolution policy requires explicit review approval.');
  }

  const envelope = {
    decisionId: input.decisionId,
    workspaceId: input.workspaceId,
    sourceObservationId: input.sourceObservationId,
    candidateCanonicalBusinessId: input.candidateCanonicalBusinessId,
    decision: input.decision,
    confidence: input.confidence,
    reviewState: input.reviewState,
    reviewDecisionRef: input.reviewDecisionRef,
    reasonCodes: reasons,
    evidenceIds,
    thresholdPolicy: { ...input.thresholdPolicy },
    evaluatedAt: input.evaluatedAt.toISOString(),
  };

  const inserted = await pool.query<DecisionRow>(
    `INSERT INTO business_resolution_decisions
       (id, workspace_id, source_observation_id, candidate_canonical_business_id,
        decision, confidence, review_state, review_decision_ref, reason_codes,
        evidence_ids, threshold_policy_id, threshold_policy_version, review_minimum,
        auto_match_minimum, evaluated_at, envelope)
     VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15, $16::jsonb)
     ON CONFLICT (id) DO NOTHING
     RETURNING id, workspace_id, source_observation_id, candidate_canonical_business_id,
               decision, confidence, review_state, review_decision_ref, reason_codes,
               evidence_ids, threshold_policy_id, threshold_policy_version, review_minimum,
               auto_match_minimum, evaluated_at, created_at`,
    [
      input.decisionId,
      input.workspaceId,
      input.sourceObservationId,
      input.candidateCanonicalBusinessId,
      input.decision,
      input.confidence,
      input.reviewState,
      input.reviewDecisionRef,
      JSON.stringify(reasons),
      JSON.stringify(evidenceIds),
      input.thresholdPolicy.policyId,
      input.thresholdPolicy.version,
      input.thresholdPolicy.reviewMinimum,
      input.thresholdPolicy.autoMatchMinimum,
      input.evaluatedAt,
      JSON.stringify(envelope),
    ],
  );
  if (inserted.rows[0]) return { created: true, record: toDecision(inserted.rows[0]) };

  const existing = await pool.query<DecisionRow & { envelope: Record<string, unknown> }>(
    `SELECT id, workspace_id, source_observation_id, candidate_canonical_business_id,
            decision, confidence, review_state, review_decision_ref, reason_codes,
            evidence_ids, threshold_policy_id, threshold_policy_version, review_minimum,
            auto_match_minimum, evaluated_at, envelope, created_at
     FROM business_resolution_decisions WHERE id = $1 AND workspace_id = $2::uuid`,
    [input.decisionId, input.workspaceId],
  );
  const row = existing.rows[0];
  if (
    !row ||
    row.workspace_id !== input.workspaceId ||
    row.source_observation_id !== input.sourceObservationId ||
    row.candidate_canonical_business_id !== input.candidateCanonicalBusinessId ||
    row.decision !== input.decision ||
    row.confidence !== input.confidence ||
    row.review_state !== input.reviewState ||
    row.review_decision_ref !== input.reviewDecisionRef ||
    !sameJson(row.reason_codes, reasons) ||
    !sameJson(row.evidence_ids, evidenceIds) ||
    row.threshold_policy_id !== input.thresholdPolicy.policyId ||
    row.threshold_policy_version !== input.thresholdPolicy.version ||
    row.review_minimum !== input.thresholdPolicy.reviewMinimum ||
    row.auto_match_minimum !== input.thresholdPolicy.autoMatchMinimum ||
    row.evaluated_at.getTime() !== input.evaluatedAt.getTime() ||
    !sameJson(row.envelope, envelope)
  ) {
    fail('RESOLUTION_DECISION_ID_CONFLICT', `Resolution decision ${input.decisionId} already exists with different durable content.`);
  }
  return { created: false, record: toDecision(row) };
}

export async function persistCanonicalBusinessAlias(
  pool: Pool,
  input: PersistCanonicalBusinessAliasInput,
): Promise<PersistenceResult<PersistedCanonicalBusinessAlias>> {
  assertWorkspaceId(input.workspaceId);
  assertIdentifier(input.sourceObservationId, 'sourceObservationId');
  assertIdentifier(input.canonicalBusinessId, 'canonicalBusinessId');
  assertIdentifier(input.decisionId, 'decisionId');
  assertDate(input.attachedAt, 'attachedAt');

  const decision = await pool.query<{
    source_observation_id: string;
    candidate_canonical_business_id: string | null;
    decision: ResolutionDecisionKind;
    review_state: ResolutionReviewState;
    origin_decision_id: string | null;
  }>(
    `SELECT decision.source_observation_id, decision.candidate_canonical_business_id,
            decision.decision, decision.review_state, business.origin_decision_id
     FROM business_resolution_decisions AS decision
     LEFT JOIN canonical_businesses AS business
       ON business.id = $3 AND business.workspace_id = decision.workspace_id
     WHERE decision.id = $1 AND decision.workspace_id = $2::uuid`,
    [input.decisionId, input.workspaceId, input.canonicalBusinessId],
  );
  const decisionRow = decision.rows[0];
  if (
    !decisionRow ||
    decisionRow.source_observation_id !== input.sourceObservationId ||
    decisionRow.decision === 'review_required' ||
    decisionRow.review_state === 'pending' ||
    decisionRow.review_state === 'rejected' ||
    (decisionRow.decision === 'match_existing' &&
      decisionRow.candidate_canonical_business_id !== input.canonicalBusinessId) ||
    (decisionRow.decision === 'create_new' &&
      decisionRow.origin_decision_id !== input.decisionId)
  ) {
    fail('CANONICAL_ALIAS_DECISION_INVALID', 'Alias attachment requires a finalized decision bound to the same observation and canonical identity.');
  }

  const inserted = await pool.query<AliasRow>(
    `INSERT INTO canonical_business_aliases
       (source_observation_id, workspace_id, canonical_business_id, decision_id, attached_at)
     VALUES ($1, $2::uuid, $3, $4, $5)
     ON CONFLICT (source_observation_id) DO NOTHING
     RETURNING source_observation_id, workspace_id, canonical_business_id, decision_id, attached_at, created_at`,
    [input.sourceObservationId, input.workspaceId, input.canonicalBusinessId, input.decisionId, input.attachedAt],
  );
  if (inserted.rows[0]) return { created: true, record: toAlias(inserted.rows[0]) };

  const existing = await pool.query<AliasRow>(
    `SELECT source_observation_id, workspace_id, canonical_business_id, decision_id, attached_at, created_at
     FROM canonical_business_aliases WHERE source_observation_id = $1 AND workspace_id = $2::uuid`,
    [input.sourceObservationId, input.workspaceId],
  );
  const row = existing.rows[0];
  if (
    !row ||
    row.workspace_id !== input.workspaceId ||
    row.canonical_business_id !== input.canonicalBusinessId ||
    row.decision_id !== input.decisionId ||
    row.attached_at.getTime() !== input.attachedAt.getTime()
  ) {
    fail('CANONICAL_ALIAS_CONFLICT', `Source observation ${input.sourceObservationId} is already bound to a different canonical alias.`);
  }
  return { created: false, record: toAlias(row) };
}

export async function persistCanonicalBusinessLineageOperation(
  pool: Pool,
  input: PersistCanonicalBusinessLineageOperationInput,
): Promise<PersistenceResult<PersistedCanonicalBusinessLineageOperation>> {
  assertWorkspaceId(input.workspaceId);
  assertIdentifier(input.operationId, 'operationId');
  assertIdentifier(input.requestId, 'requestId');
  assertIdentifier(input.targetCanonicalBusinessId, 'targetCanonicalBusinessId');
  assertIdentifier(input.requestedByActorId, 'requestedByActorId');
  assertIdentifier(input.reviewRequestId, 'reviewRequestId');
  assertDate(input.requestedAt, 'requestedAt');
  if (input.operationType !== 'merge' && input.operationType !== 'split') {
    fail('ENTITY_RESOLUTION_INPUT_INVALID', 'operationType is invalid.');
  }

  const sources = normalizeStringArray(input.sourceCanonicalBusinessIds, 'sourceCanonicalBusinessIds', {
    min: input.operationType === 'merge' ? 2 : 1,
    max: 32,
  });
  const restore = normalizeStringArray(input.restoreCanonicalBusinessIds ?? [], 'restoreCanonicalBusinessIds', {
    min: input.operationType === 'split' ? 2 : 0,
    max: 32,
  });
  const evidenceIds = normalizeStringArray(input.evidenceIds, 'evidenceIds', { max: 256 });
  const reasonCodes = normalizeStringArray(input.reasonCodes, 'reasonCodes', { max: 64 });
  const parentId = input.parentLineageOperationId ?? null;

  if (input.operationType === 'merge') {
    if (!sources.includes(input.targetCanonicalBusinessId)) {
      fail('ENTITY_RESOLUTION_INPUT_INVALID', 'Merge target must be one of sourceCanonicalBusinessIds.');
    }
    if (parentId !== null || restore.length !== 0) {
      fail('ENTITY_RESOLUTION_INPUT_INVALID', 'Merge lineage cannot declare parentLineageOperationId or restoreCanonicalBusinessIds.');
    }
  } else {
    if (parentId === null) fail('ENTITY_RESOLUTION_INPUT_INVALID', 'Split lineage requires parentLineageOperationId.');
    assertIdentifier(parentId, 'parentLineageOperationId');
    if (!restore.includes(input.targetCanonicalBusinessId)) {
      fail('ENTITY_RESOLUTION_INPUT_INVALID', 'Split restoration must include the current canonical business identity.');
    }
  }

  const idsToVerify = [...new Set([...sources, ...restore, input.targetCanonicalBusinessId])];
  const entities = await pool.query<{ id: string }>(
    `SELECT id FROM canonical_businesses
     WHERE workspace_id = $1::uuid AND id = ANY($2::text[])`,
    [input.workspaceId, idsToVerify],
  );
  if (new Set(entities.rows.map((row) => row.id)).size !== idsToVerify.length) {
    fail('LINEAGE_ENTITY_NOT_FOUND', 'Every lineage identity must exist in the same workspace.');
  }

  const lineageEvidence = await pool.query<{ id: string }>(
    `SELECT id FROM candidate_business_match_evidence
     WHERE workspace_id = $1::uuid AND id = ANY($2::text[])`,
    [input.workspaceId, evidenceIds],
  );
  if (new Set(lineageEvidence.rows.map((row) => row.id)).size !== evidenceIds.length) {
    fail('LINEAGE_ENTITY_NOT_FOUND', 'Every lineage evidence ID must exist in the same workspace.');
  }

  if (parentId !== null) {
    const parent = await pool.query<{ id: string; operation_type: LineageOperationType }>(
      `SELECT id, operation_type FROM canonical_business_lineage_operations
       WHERE id = $1 AND workspace_id = $2::uuid`,
      [parentId, input.workspaceId],
    );
    if (!parent.rows[0] || parent.rows[0].operation_type !== 'merge') {
      fail('LINEAGE_PARENT_NOT_FOUND', 'Split lineage must reference an existing merge operation in the same workspace.');
    }
  }

  const envelope = {
    version: '1.0.0',
    requestId: input.requestId,
    workspaceId: input.workspaceId,
    evidenceIds,
    reasonCodes,
    requestedByActorId: input.requestedByActorId,
    requestedAt: input.requestedAt.toISOString(),
    reviewRequestId: input.reviewRequestId,
    reviewState: 'pending',
    reversible: true,
    operationId: input.operationId,
    operationType: input.operationType,
    targetCanonicalBusinessId: input.targetCanonicalBusinessId,
    sourceCanonicalBusinessIds: sources,
    restoreCanonicalBusinessIds: restore,
    parentLineageOperationId: parentId,
  };

  const inserted = await pool.query<LineageRow>(
    `INSERT INTO canonical_business_lineage_operations
       (id, workspace_id, operation_type, request_id, target_canonical_business_id,
        source_canonical_business_ids, restore_canonical_business_ids, parent_lineage_operation_id,
        evidence_ids, reason_codes, requested_by_actor_id, requested_at, review_request_id,
        review_state, reversible, envelope)
     VALUES ($1, $2::uuid, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9::jsonb, $10::jsonb,
             $11, $12, $13, 'pending', true, $14::jsonb)
     ON CONFLICT (id) DO NOTHING
     RETURNING id, workspace_id, operation_type, request_id, target_canonical_business_id,
               source_canonical_business_ids, restore_canonical_business_ids, parent_lineage_operation_id,
               evidence_ids, reason_codes, requested_by_actor_id, requested_at, review_request_id,
               review_state, reversible, created_at`,
    [
      input.operationId,
      input.workspaceId,
      input.operationType,
      input.requestId,
      input.targetCanonicalBusinessId,
      JSON.stringify(sources),
      JSON.stringify(restore),
      parentId,
      JSON.stringify(evidenceIds),
      JSON.stringify(reasonCodes),
      input.requestedByActorId,
      input.requestedAt,
      input.reviewRequestId,
      JSON.stringify(envelope),
    ],
  );
  if (inserted.rows[0]) return { created: true, record: toLineage(inserted.rows[0]) };

  const existing = await pool.query<LineageRow & { envelope: Record<string, unknown> }>(
    `SELECT id, workspace_id, operation_type, request_id, target_canonical_business_id,
            source_canonical_business_ids, restore_canonical_business_ids, parent_lineage_operation_id,
            evidence_ids, reason_codes, requested_by_actor_id, requested_at, review_request_id,
            review_state, reversible, envelope, created_at
     FROM canonical_business_lineage_operations WHERE id = $1 AND workspace_id = $2::uuid`,
    [input.operationId, input.workspaceId],
  );
  const row = existing.rows[0];
  if (
    !row ||
    row.workspace_id !== input.workspaceId ||
    row.operation_type !== input.operationType ||
    row.request_id !== input.requestId ||
    row.target_canonical_business_id !== input.targetCanonicalBusinessId ||
    !sameJson(row.source_canonical_business_ids, sources) ||
    !sameJson(row.restore_canonical_business_ids, restore) ||
    row.parent_lineage_operation_id !== parentId ||
    !sameJson(row.evidence_ids, evidenceIds) ||
    !sameJson(row.reason_codes, reasonCodes) ||
    row.requested_by_actor_id !== input.requestedByActorId ||
    row.requested_at.getTime() !== input.requestedAt.getTime() ||
    row.review_request_id !== input.reviewRequestId ||
    row.review_state !== 'pending' ||
    row.reversible !== true ||
    !sameJson(row.envelope, envelope)
  ) {
    fail('LINEAGE_OPERATION_ID_CONFLICT', `Lineage operation ${input.operationId} already exists with different durable content.`);
  }
  return { created: false, record: toLineage(row) };
}

export async function getCanonicalBusiness(
  pool: Pool,
  workspaceId: string,
  canonicalBusinessId: string,
): Promise<PersistedCanonicalBusiness | null> {
  assertWorkspaceId(workspaceId);
  assertIdentifier(canonicalBusinessId, 'canonicalBusinessId');
  const result = await pool.query<CanonicalBusinessRow>(
    `SELECT id, workspace_id, display_name, identity_state, superseded_by_canonical_business_id, origin_decision_id, created_at
     FROM canonical_businesses
     WHERE workspace_id = $1::uuid AND id = $2`,
    [workspaceId, canonicalBusinessId],
  );
  return result.rows[0] ? toCanonicalBusiness(result.rows[0]) : null;
}

export async function getSourceBusinessObservation(
  pool: Pool,
  workspaceId: string,
  sourceObservationId: string,
): Promise<PersistedSourceBusinessObservation | null> {
  assertWorkspaceId(workspaceId);
  assertIdentifier(sourceObservationId, 'sourceObservationId');
  const result = await pool.query<ObservationRow>(
    `SELECT id, workspace_id, source_candidate_id, source_key, observed_at,
            source_reference_ids, identity_signals, created_at
     FROM source_business_observations
     WHERE workspace_id = $1::uuid AND id = $2`,
    [workspaceId, sourceObservationId],
  );
  return result.rows[0] ? toObservation(result.rows[0]) : null;
}

export async function listCanonicalBusinessLineage(
  pool: Pool,
  workspaceId: string,
  canonicalBusinessId: string,
): Promise<readonly PersistedCanonicalBusinessLineageOperation[]> {
  assertWorkspaceId(workspaceId);
  assertIdentifier(canonicalBusinessId, 'canonicalBusinessId');
  const result = await pool.query<LineageRow>(
    `SELECT id, workspace_id, operation_type, request_id, target_canonical_business_id,
            source_canonical_business_ids, restore_canonical_business_ids, parent_lineage_operation_id,
            evidence_ids, reason_codes, requested_by_actor_id, requested_at, review_request_id,
            review_state, reversible, created_at
     FROM canonical_business_lineage_operations
     WHERE workspace_id = $1::uuid
       AND (
         target_canonical_business_id = $2
         OR source_canonical_business_ids ? $2
         OR restore_canonical_business_ids ? $2
       )
     ORDER BY requested_at ASC, id ASC`,
    [workspaceId, canonicalBusinessId],
  );
  return Object.freeze(result.rows.map(toLineage));
}
