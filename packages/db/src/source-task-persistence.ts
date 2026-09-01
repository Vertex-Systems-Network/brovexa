import type { Pool, PoolClient } from 'pg';
import { withPgTransaction } from './client';
import { claimWorkUnit, recordWorkFailure, requestWorkCancellation, type ClaimedWorkUnit, type WorkFailureResult } from './jobs';
import { getSourceAdmissionSnapshot, type PersistedSourceAdmissionSnapshot } from './source-registry-persistence';
import type { WorkUnitStatus } from './schema';

export const SOURCE_EXECUTION_JOB_TYPE = 'source.execute';
export const SOURCE_EXECUTION_WORK_TYPE = 'source.execute';
export const SOURCE_EXECUTION_QUEUE_NAME = 'brovexa-work-v1';
export const SOURCE_EXECUTION_RESULT_EFFECT = 'source.execution.result';

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/;
const sourceKeyPattern = /^source\.[a-z0-9_.-]+$/;
const connectorKeyPattern = /^connector\.[a-z0-9_.-]+$/;
const sourceOperationValues = new Set(['discover', 'search', 'list', 'lookup', 'fetch', 'detail', 'import', 'sync']);

export interface SourceTaskBudget {
  maxRequests: number;
  maxPages: number;
  maxBytes: number;
  maxCurrencyMicros: number;
  maxRuntimeMs: number;
  maxConcurrency: number;
}

export interface SourceTaskUsage {
  requests: number;
  pages: number;
  bytes: number;
  currencyMicros: number;
  runtimeMs: number;
}

export type SourceTaskPersistenceErrorCode =
  | 'SOURCE_PREFLIGHT_INPUT_INVALID'
  | 'SOURCE_PREFLIGHT_SNAPSHOT_NOT_FOUND'
  | 'SOURCE_PREFLIGHT_SNAPSHOT_IDENTITY_MISMATCH'
  | 'SOURCE_PREFLIGHT_ID_CONFLICT'
  | 'SOURCE_PREFLIGHT_IDEMPOTENCY_CONFLICT'
  | 'SOURCE_TASK_INPUT_INVALID'
  | 'SOURCE_TASK_PREFLIGHT_NOT_FOUND'
  | 'SOURCE_TASK_PREFLIGHT_NOT_ALLOWED'
  | 'SOURCE_TASK_ADMISSION_NOT_FOUND'
  | 'SOURCE_TASK_ADMISSION_NOT_ALLOWED'
  | 'SOURCE_TASK_ADMISSION_EXECUTION_INTENT'
  | 'SOURCE_TASK_ADMISSION_PREFLIGHT_MISMATCH'
  | 'SOURCE_TASK_ID_CONFLICT'
  | 'SOURCE_TASK_NOT_FOUND'
  | 'SOURCE_TASK_STATE_INVALID'
  | 'SOURCE_TASK_USAGE_ID_CONFLICT'
  | 'SOURCE_TASK_BUDGET_EXCEEDED'
  | 'SOURCE_TASK_PROVENANCE_REQUIRED';

export class SourceTaskPersistenceError extends Error {
  readonly code: SourceTaskPersistenceErrorCode;

  constructor(code: SourceTaskPersistenceErrorCode, message: string) {
    super(message);
    this.name = 'SourceTaskPersistenceError';
    this.code = code;
  }
}

export interface PersistResearchJobPreflightInput {
  id: string;
  workspaceId: string;
  researchJobId: string;
  idempotencyKey: string;
  admissionSnapshotIds: readonly string[];
  createdAt: Date;
}

export interface ResearchJobPreflightEnvelope {
  id: string;
  workspaceId: string;
  researchJobId: string;
  idempotencyKey: string;
  decision: 'allow' | 'review_required' | 'blocked';
  admissionSnapshotIds: string[];
  aggregateBudget: SourceTaskBudget;
  createdAt: string;
}

export interface PersistResearchJobPreflightResult {
  id: string;
  created: boolean;
  envelope: ResearchJobPreflightEnvelope;
}

export interface CreateSourceTaskInput {
  workspaceId: string;
  researchJobId: string;
  preflightId: string;
  admissionSnapshotId: string;
  sourceTaskId: string;
  maxAttempts?: number;
}

export interface SourceTaskState {
  sourceTaskId: string;
  workspaceId: string;
  researchJobId: string;
  preflightId: string;
  admissionSnapshotId: string;
  requestId: string;
  sourceKey: string;
  capabilityVersion: string;
  connectorKey: string;
  connectorVersion: string;
  policyId: string;
  policyVersion: string;
  operation: string;
  jobRunId: string;
  workUnitId: string;
  correlationId: string;
  jobStatus: string;
  status: WorkUnitStatus;
  attemptCount: number;
  maxAttempts: number;
  effectiveBudget: SourceTaskBudget;
  consumed: SourceTaskUsage;
}

export interface CreateSourceTaskResult {
  created: boolean;
  state: SourceTaskState;
}

export interface RecordSourceTaskUsageInput {
  eventId: string;
  workspaceId: string;
  sourceTaskId: string;
  usage: SourceTaskUsage;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
}

export interface CompleteSourceTaskInput {
  workspaceId: string;
  sourceTaskId: string;
  sourceReferenceIds: readonly string[];
  provenanceRefs: readonly string[];
  resultRef?: string;
}

export interface ResearchJobPreflightState {
  preflight: ResearchJobPreflightEnvelope;
  tasks: SourceTaskState[];
}

interface SourceTaskRow {
  id: string;
  workspace_id: string;
  research_job_id: string;
  preflight_id: string;
  admission_snapshot_id: string;
  request_id: string;
  source_key: string;
  capability_version: string;
  connector_key: string;
  connector_version: string;
  policy_id: string;
  policy_version: string;
  operation: string;
  job_run_id: string;
  work_unit_id: string;
  max_attempts: number;
  effective_budget: Record<string, unknown>;
  correlation_id: string;
  job_status: string;
  work_status: WorkUnitStatus;
  attempt_count: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertIdentifier(value: string, field: string, code: SourceTaskPersistenceErrorCode): void {
  if (typeof value !== 'string' || !identifierPattern.test(value)) {
    throw new SourceTaskPersistenceError(code, `${field} must use the canonical identifier format.`);
  }
}

function assertDate(value: Date, field: string, code: SourceTaskPersistenceErrorCode): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new SourceTaskPersistenceError(code, `${field} must be a valid Date.`);
  }
}

function readSafeInteger(value: unknown, field: string, positive = false): number {
  if (!Number.isSafeInteger(value) || (positive ? Number(value) < 1 : Number(value) < 0)) {
    throw new SourceTaskPersistenceError('SOURCE_TASK_INPUT_INVALID', `${field} must be a safe ${positive ? 'positive ' : 'non-negative '}integer.`);
  }
  return Number(value);
}

function parseBudget(value: unknown): SourceTaskBudget {
  if (!isRecord(value)) {
    throw new SourceTaskPersistenceError('SOURCE_TASK_INPUT_INVALID', 'Admission effectiveBudget must be an object.');
  }
  return {
    maxRequests: readSafeInteger(value.maxRequests, 'effectiveBudget.maxRequests'),
    maxPages: readSafeInteger(value.maxPages, 'effectiveBudget.maxPages'),
    maxBytes: readSafeInteger(value.maxBytes, 'effectiveBudget.maxBytes'),
    maxCurrencyMicros: readSafeInteger(value.maxCurrencyMicros, 'effectiveBudget.maxCurrencyMicros'),
    maxRuntimeMs: readSafeInteger(value.maxRuntimeMs, 'effectiveBudget.maxRuntimeMs'),
    maxConcurrency: readSafeInteger(value.maxConcurrency, 'effectiveBudget.maxConcurrency', true),
  };
}

function parseUsage(value: SourceTaskUsage): SourceTaskUsage {
  return {
    requests: readSafeInteger(value.requests, 'usage.requests'),
    pages: readSafeInteger(value.pages, 'usage.pages'),
    bytes: readSafeInteger(value.bytes, 'usage.bytes'),
    currencyMicros: readSafeInteger(value.currencyMicros, 'usage.currencyMicros'),
    runtimeMs: readSafeInteger(value.runtimeMs, 'usage.runtimeMs'),
  };
}

function addSafe(left: number, right: number, field: string): number {
  const value = left + right;
  if (!Number.isSafeInteger(value)) {
    throw new SourceTaskPersistenceError('SOURCE_PREFLIGHT_INPUT_INVALID', `${field} aggregate exceeds safe integer range.`);
  }
  return value;
}

function addBudget(left: SourceTaskBudget, right: SourceTaskBudget): SourceTaskBudget {
  return {
    maxRequests: addSafe(left.maxRequests, right.maxRequests, 'maxRequests'),
    maxPages: addSafe(left.maxPages, right.maxPages, 'maxPages'),
    maxBytes: addSafe(left.maxBytes, right.maxBytes, 'maxBytes'),
    maxCurrencyMicros: addSafe(left.maxCurrencyMicros, right.maxCurrencyMicros, 'maxCurrencyMicros'),
    maxRuntimeMs: addSafe(left.maxRuntimeMs, right.maxRuntimeMs, 'maxRuntimeMs'),
    maxConcurrency: addSafe(left.maxConcurrency, right.maxConcurrency, 'maxConcurrency'),
  };
}

function emptyBudget(): SourceTaskBudget {
  return { maxRequests: 0, maxPages: 0, maxBytes: 0, maxCurrencyMicros: 0, maxRuntimeMs: 0, maxConcurrency: 0 };
}

function emptyUsage(): SourceTaskUsage {
  return { requests: 0, pages: 0, bytes: 0, currencyMicros: 0, runtimeMs: 0 };
}

function assertUniqueIdentifiers(values: readonly string[], field: string, code: SourceTaskPersistenceErrorCode): string[] {
  if (values.length === 0 || values.length > 512) {
    throw new SourceTaskPersistenceError(code, `${field} must contain between 1 and 512 identifiers.`);
  }
  const normalized = values.map((value) => {
    assertIdentifier(value, field, code);
    return value;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new SourceTaskPersistenceError(code, `${field} must not contain duplicates.`);
  }
  return normalized;
}

function readAdmissionBudget(snapshot: PersistedSourceAdmissionSnapshot): SourceTaskBudget {
  return parseBudget(snapshot.admission.effectiveBudget);
}

function readResearchJobId(snapshot: PersistedSourceAdmissionSnapshot): string | null {
  const value = snapshot.request.researchJobId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readExecutionIntent(snapshot: PersistedSourceAdmissionSnapshot): string | null {
  return typeof snapshot.request.executionIntent === 'string' ? snapshot.request.executionIntent : null;
}

function decisionRank(decision: PersistedSourceAdmissionSnapshot['decision']): number {
  return decision === 'blocked' ? 2 : decision === 'review_required' ? 1 : 0;
}

export async function persistResearchJobPreflight(
  pool: Pool,
  input: PersistResearchJobPreflightInput,
): Promise<PersistResearchJobPreflightResult> {
  assertIdentifier(input.id, 'id', 'SOURCE_PREFLIGHT_INPUT_INVALID');
  assertIdentifier(input.workspaceId, 'workspaceId', 'SOURCE_PREFLIGHT_INPUT_INVALID');
  assertIdentifier(input.researchJobId, 'researchJobId', 'SOURCE_PREFLIGHT_INPUT_INVALID');
  assertIdentifier(input.idempotencyKey, 'idempotencyKey', 'SOURCE_PREFLIGHT_INPUT_INVALID');
  assertDate(input.createdAt, 'createdAt', 'SOURCE_PREFLIGHT_INPUT_INVALID');
  const snapshotIds = assertUniqueIdentifiers(input.admissionSnapshotIds, 'admissionSnapshotIds', 'SOURCE_PREFLIGHT_INPUT_INVALID');

  const snapshots: PersistedSourceAdmissionSnapshot[] = [];
  for (const snapshotId of snapshotIds) {
    const snapshot = await getSourceAdmissionSnapshot(pool, input.workspaceId, snapshotId);
    if (!snapshot) {
      throw new SourceTaskPersistenceError(
        'SOURCE_PREFLIGHT_SNAPSHOT_NOT_FOUND',
        `Admission snapshot ${snapshotId} is not available in workspace ${input.workspaceId}.`,
      );
    }
    if (readResearchJobId(snapshot) !== input.researchJobId || readExecutionIntent(snapshot) !== 'execute') {
      throw new SourceTaskPersistenceError(
        'SOURCE_PREFLIGHT_SNAPSHOT_IDENTITY_MISMATCH',
        `Admission snapshot ${snapshotId} is not an execute admission for research job ${input.researchJobId}.`,
      );
    }
    snapshots.push(snapshot);
  }

  const aggregateBudget = snapshots.reduce((sum, snapshot) => addBudget(sum, readAdmissionBudget(snapshot)), emptyBudget());
  const decision = snapshots.reduce<PersistedSourceAdmissionSnapshot['decision']>(
    (current, snapshot) => (decisionRank(snapshot.decision) > decisionRank(current) ? snapshot.decision : current),
    'allow',
  );
  const envelope: ResearchJobPreflightEnvelope = {
    id: input.id,
    workspaceId: input.workspaceId,
    researchJobId: input.researchJobId,
    idempotencyKey: input.idempotencyKey,
    decision,
    admissionSnapshotIds: snapshotIds,
    aggregateBudget,
    createdAt: input.createdAt.toISOString(),
  };

  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO research_job_preflights (
       id, workspace_id, research_job_id, idempotency_key, decision,
       admission_snapshot_ids, aggregate_budget, envelope, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      input.id,
      input.workspaceId,
      input.researchJobId,
      input.idempotencyKey,
      decision,
      JSON.stringify(snapshotIds),
      JSON.stringify(aggregateBudget),
      JSON.stringify(envelope),
      input.createdAt,
    ],
  );
  if (inserted.rows[0]?.id) return { id: input.id, created: true, envelope };

  const byId = await pool.query<{ envelope: ResearchJobPreflightEnvelope }>(
    'SELECT envelope FROM research_job_preflights WHERE id = $1',
    [input.id],
  );
  if (byId.rows[0]) {
    if (JSON.stringify(byId.rows[0].envelope) !== JSON.stringify(envelope)) {
      throw new SourceTaskPersistenceError('SOURCE_PREFLIGHT_ID_CONFLICT', `Preflight ${input.id} already exists with different content.`);
    }
    return { id: input.id, created: false, envelope: byId.rows[0].envelope };
  }

  const byIdempotency = await pool.query<{ id: string; envelope: ResearchJobPreflightEnvelope }>(
    `SELECT id, envelope FROM research_job_preflights
     WHERE workspace_id = $1 AND research_job_id = $2 AND idempotency_key = $3`,
    [input.workspaceId, input.researchJobId, input.idempotencyKey],
  );
  const existing = byIdempotency.rows[0];
  if (existing) {
    throw new SourceTaskPersistenceError(
      'SOURCE_PREFLIGHT_IDEMPOTENCY_CONFLICT',
      `Research job ${input.researchJobId} idempotency key ${input.idempotencyKey} is already bound to preflight ${existing.id}.`,
    );
  }
  throw new Error('Research job preflight insert did not return a row or resolvable conflict.');
}

export async function getResearchJobPreflight(
  pool: Pool,
  workspaceId: string,
  preflightId: string,
): Promise<ResearchJobPreflightEnvelope | null> {
  assertIdentifier(workspaceId, 'workspaceId', 'SOURCE_PREFLIGHT_INPUT_INVALID');
  assertIdentifier(preflightId, 'preflightId', 'SOURCE_PREFLIGHT_INPUT_INVALID');
  const result = await pool.query<{ envelope: ResearchJobPreflightEnvelope }>(
    'SELECT envelope FROM research_job_preflights WHERE workspace_id = $1 AND id = $2',
    [workspaceId, preflightId],
  );
  return result.rows[0]?.envelope ?? null;
}

async function createCanonicalSourceWork(
  client: PoolClient,
  input: { workspaceId: string; sourceTaskId: string; payload: Record<string, unknown>; maxAttempts: number },
): Promise<{ jobRunId: string; workUnitId: string; correlationId: string }> {
  const insertedRun = await client.query<{ id: string; correlation_id: string }>(
    `INSERT INTO job_runs (workspace_id, job_type, job_version, idempotency_key)
     VALUES ($1, $2, 1, $3)
     ON CONFLICT (workspace_id, job_type, idempotency_key) DO NOTHING
     RETURNING id, correlation_id`,
    [input.workspaceId, SOURCE_EXECUTION_JOB_TYPE, input.sourceTaskId],
  );
  let jobRunId = insertedRun.rows[0]?.id;
  let correlationId = insertedRun.rows[0]?.correlation_id;
  if (!jobRunId || !correlationId) {
    const existingRun = await client.query<{ id: string; correlation_id: string }>(
      `SELECT id, correlation_id FROM job_runs
       WHERE workspace_id = $1 AND job_type = $2 AND idempotency_key = $3
       FOR UPDATE`,
      [input.workspaceId, SOURCE_EXECUTION_JOB_TYPE, input.sourceTaskId],
    );
    jobRunId = existingRun.rows[0]?.id;
    correlationId = existingRun.rows[0]?.correlation_id;
  }
  if (!jobRunId || !correlationId) throw new Error('Canonical source job identity could not be resolved.');

  const insertedWork = await client.query<{ id: string }>(
    `INSERT INTO job_work_units (
       job_run_id, workspace_id, queue_name, work_type, work_version,
       idempotency_key, correlation_id, payload, max_attempts
     ) VALUES ($1, $2, $3, $4, 1, $5, $6, $7::jsonb, $8)
     ON CONFLICT (job_run_id, work_type, idempotency_key) DO NOTHING
     RETURNING id`,
    [
      jobRunId,
      input.workspaceId,
      SOURCE_EXECUTION_QUEUE_NAME,
      SOURCE_EXECUTION_WORK_TYPE,
      input.sourceTaskId,
      correlationId,
      JSON.stringify(input.payload),
      input.maxAttempts,
    ],
  );
  let workUnitId = insertedWork.rows[0]?.id;
  if (!workUnitId) {
    const existingWork = await client.query<{ id: string; payload: Record<string, unknown>; max_attempts: number }>(
      `SELECT id, payload, max_attempts FROM job_work_units
       WHERE job_run_id = $1 AND work_type = $2 AND idempotency_key = $3
       FOR UPDATE`,
      [jobRunId, SOURCE_EXECUTION_WORK_TYPE, input.sourceTaskId],
    );
    const row = existingWork.rows[0];
    if (!row) throw new Error('Canonical source work identity could not be resolved.');
    if (row.max_attempts !== input.maxAttempts || JSON.stringify(row.payload) !== JSON.stringify(input.payload)) {
      throw new SourceTaskPersistenceError('SOURCE_TASK_ID_CONFLICT', `Source task ${input.sourceTaskId} canonical work binding conflicts with existing content.`);
    }
    workUnitId = row.id;
  }
  return { jobRunId, workUnitId, correlationId };
}

async function loadSourceTaskRow(pool: Pool, workspaceId: string, sourceTaskId: string): Promise<SourceTaskRow | null> {
  const result = await pool.query<SourceTaskRow>(
    `SELECT
       task.id, task.workspace_id, task.research_job_id, task.preflight_id,
       task.admission_snapshot_id, task.request_id, task.source_key, task.capability_version,
       task.connector_key, task.connector_version, task.policy_id, task.policy_version,
       task.operation, task.job_run_id, task.work_unit_id, task.max_attempts, task.effective_budget,
       run.correlation_id, run.status AS job_status,
       work.status AS work_status, work.attempt_count
     FROM source_tasks AS task
     INNER JOIN job_runs AS run ON run.id = task.job_run_id AND run.workspace_id = task.workspace_id
     INNER JOIN job_work_units AS work
       ON work.id = task.work_unit_id AND work.workspace_id = task.workspace_id AND work.job_run_id = task.job_run_id
     WHERE task.workspace_id = $1 AND task.id = $2
     LIMIT 1`,
    [workspaceId, sourceTaskId],
  );
  return result.rows[0] ?? null;
}

async function readConsumedUsage(pool: Pool, workspaceId: string, sourceTaskId: string): Promise<SourceTaskUsage> {
  const result = await pool.query<{
    requests: string;
    pages: string;
    bytes: string;
    currency_micros: string;
    runtime_ms: string;
  }>(
    `SELECT
       COALESCE(sum(requests), 0)::text AS requests,
       COALESCE(sum(pages), 0)::text AS pages,
       COALESCE(sum(bytes), 0)::text AS bytes,
       COALESCE(sum(currency_micros), 0)::text AS currency_micros,
       COALESCE(sum(runtime_ms), 0)::text AS runtime_ms
     FROM source_task_usage_events
     WHERE workspace_id = $1 AND source_task_id = $2`,
    [workspaceId, sourceTaskId],
  );
  const row = result.rows[0];
  return {
    requests: Number(row?.requests ?? 0),
    pages: Number(row?.pages ?? 0),
    bytes: Number(row?.bytes ?? 0),
    currencyMicros: Number(row?.currency_micros ?? 0),
    runtimeMs: Number(row?.runtime_ms ?? 0),
  };
}

function toSourceTaskState(row: SourceTaskRow, consumed: SourceTaskUsage): SourceTaskState {
  return {
    sourceTaskId: row.id,
    workspaceId: row.workspace_id,
    researchJobId: row.research_job_id,
    preflightId: row.preflight_id,
    admissionSnapshotId: row.admission_snapshot_id,
    requestId: row.request_id,
    sourceKey: row.source_key,
    capabilityVersion: row.capability_version,
    connectorKey: row.connector_key,
    connectorVersion: row.connector_version,
    policyId: row.policy_id,
    policyVersion: row.policy_version,
    operation: row.operation,
    jobRunId: row.job_run_id,
    workUnitId: row.work_unit_id,
    correlationId: row.correlation_id,
    jobStatus: row.job_status,
    status: row.work_status,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    effectiveBudget: parseBudget(row.effective_budget),
    consumed,
  };
}

export async function getSourceTaskState(pool: Pool, workspaceId: string, sourceTaskId: string): Promise<SourceTaskState | null> {
  assertIdentifier(workspaceId, 'workspaceId', 'SOURCE_TASK_INPUT_INVALID');
  assertIdentifier(sourceTaskId, 'sourceTaskId', 'SOURCE_TASK_INPUT_INVALID');
  const row = await loadSourceTaskRow(pool, workspaceId, sourceTaskId);
  if (!row) return null;
  return toSourceTaskState(row, await readConsumedUsage(pool, workspaceId, sourceTaskId));
}

export async function createSourceTask(pool: Pool, input: CreateSourceTaskInput): Promise<CreateSourceTaskResult> {
  assertIdentifier(input.workspaceId, 'workspaceId', 'SOURCE_TASK_INPUT_INVALID');
  assertIdentifier(input.researchJobId, 'researchJobId', 'SOURCE_TASK_INPUT_INVALID');
  assertIdentifier(input.preflightId, 'preflightId', 'SOURCE_TASK_INPUT_INVALID');
  assertIdentifier(input.admissionSnapshotId, 'admissionSnapshotId', 'SOURCE_TASK_INPUT_INVALID');
  assertIdentifier(input.sourceTaskId, 'sourceTaskId', 'SOURCE_TASK_INPUT_INVALID');
  const maxAttempts = input.maxAttempts ?? 3;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
    throw new SourceTaskPersistenceError('SOURCE_TASK_INPUT_INVALID', 'maxAttempts must be an integer between 1 and 10.');
  }

  const created = await withPgTransaction(pool, async (client) => {
    const preflightResult = await client.query<{
      research_job_id: string;
      decision: 'allow' | 'review_required' | 'blocked';
      admission_snapshot_ids: string[];
    }>(
      `SELECT research_job_id, decision, admission_snapshot_ids
       FROM research_job_preflights
       WHERE workspace_id = $1 AND id = $2
       FOR SHARE`,
      [input.workspaceId, input.preflightId],
    );
    const preflight = preflightResult.rows[0];
    if (!preflight) throw new SourceTaskPersistenceError('SOURCE_TASK_PREFLIGHT_NOT_FOUND', `Preflight ${input.preflightId} was not found.`);
    if (preflight.research_job_id !== input.researchJobId) {
      throw new SourceTaskPersistenceError('SOURCE_TASK_ADMISSION_PREFLIGHT_MISMATCH', 'Source task researchJobId does not match its preflight.');
    }
    if (preflight.decision !== 'allow') {
      throw new SourceTaskPersistenceError('SOURCE_TASK_PREFLIGHT_NOT_ALLOWED', `Preflight ${input.preflightId} is ${preflight.decision}.`);
    }
    if (!preflight.admission_snapshot_ids.includes(input.admissionSnapshotId)) {
      throw new SourceTaskPersistenceError('SOURCE_TASK_ADMISSION_PREFLIGHT_MISMATCH', 'Admission snapshot is outside the immutable research-job preflight.');
    }

    const snapshotResult = await client.query<{
      id: string;
      source_task_id: string;
      request_id: string;
      source_key: string;
      capability_version: string;
      connector_key: string;
      connector_version: string;
      policy_id: string;
      policy_version: string;
      decision: 'allow' | 'review_required' | 'blocked';
      request: Record<string, unknown>;
      admission: Record<string, unknown>;
    }>(
      `SELECT id, source_task_id, request_id, source_key, capability_version,
              connector_key, connector_version, policy_id, policy_version,
              decision, request, admission
       FROM source_admission_snapshots
       WHERE workspace_id = $1 AND id = $2
       FOR SHARE`,
      [input.workspaceId, input.admissionSnapshotId],
    );
    const snapshot = snapshotResult.rows[0];
    if (!snapshot) throw new SourceTaskPersistenceError('SOURCE_TASK_ADMISSION_NOT_FOUND', `Admission snapshot ${input.admissionSnapshotId} was not found.`);
    if (snapshot.decision !== 'allow') {
      throw new SourceTaskPersistenceError('SOURCE_TASK_ADMISSION_NOT_ALLOWED', `Admission snapshot ${input.admissionSnapshotId} is ${snapshot.decision}.`);
    }
    if (snapshot.source_task_id !== input.sourceTaskId || snapshot.request.researchJobId !== input.researchJobId) {
      throw new SourceTaskPersistenceError('SOURCE_TASK_ADMISSION_PREFLIGHT_MISMATCH', 'Source task identity does not match its admission snapshot.');
    }
    if (snapshot.request.executionIntent !== 'execute') {
      throw new SourceTaskPersistenceError('SOURCE_TASK_ADMISSION_EXECUTION_INTENT', 'SourceTask creation requires an execute admission snapshot.');
    }
    const operation = snapshot.request.operation;
    if (typeof operation !== 'string' || !sourceOperationValues.has(operation)) {
      throw new SourceTaskPersistenceError('SOURCE_TASK_INPUT_INVALID', 'Admission operation is invalid.');
    }
    const effectiveBudget = parseBudget(snapshot.admission.effectiveBudget);
    if (!sourceKeyPattern.test(snapshot.source_key) || !connectorKeyPattern.test(snapshot.connector_key)) {
      throw new SourceTaskPersistenceError('SOURCE_TASK_INPUT_INVALID', 'Admission source/connector identity is invalid.');
    }

    const payload = {
      kind: 'source_task_execution',
      sourceTaskId: input.sourceTaskId,
      researchJobId: input.researchJobId,
      preflightId: input.preflightId,
      admissionSnapshotId: input.admissionSnapshotId,
    };
    const work = await createCanonicalSourceWork(client, {
      workspaceId: input.workspaceId,
      sourceTaskId: input.sourceTaskId,
      payload,
      maxAttempts,
    });

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO source_tasks (
         id, workspace_id, research_job_id, preflight_id, admission_snapshot_id,
         request_id, source_key, capability_version, connector_key, connector_version,
         policy_id, policy_version, operation, job_run_id, work_unit_id,
         max_attempts, effective_budget
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10,
         $11, $12, $13, $14, $15,
         $16, $17::jsonb
       )
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        input.sourceTaskId,
        input.workspaceId,
        input.researchJobId,
        input.preflightId,
        input.admissionSnapshotId,
        snapshot.request_id,
        snapshot.source_key,
        snapshot.capability_version,
        snapshot.connector_key,
        snapshot.connector_version,
        snapshot.policy_id,
        snapshot.policy_version,
        operation,
        work.jobRunId,
        work.workUnitId,
        maxAttempts,
        JSON.stringify(effectiveBudget),
      ],
    );
    if (inserted.rows[0]?.id) return true;

    const existing = await client.query<{
      workspace_id: string;
      research_job_id: string;
      preflight_id: string;
      admission_snapshot_id: string;
      job_run_id: string;
      work_unit_id: string;
      max_attempts: number;
      effective_budget: Record<string, unknown>;
    }>(
      'SELECT workspace_id, research_job_id, preflight_id, admission_snapshot_id, job_run_id, work_unit_id, max_attempts, effective_budget FROM source_tasks WHERE id = $1',
      [input.sourceTaskId],
    );
    const row = existing.rows[0];
    if (
      !row ||
      row.workspace_id !== input.workspaceId ||
      row.research_job_id !== input.researchJobId ||
      row.preflight_id !== input.preflightId ||
      row.admission_snapshot_id !== input.admissionSnapshotId ||
      row.job_run_id !== work.jobRunId ||
      row.work_unit_id !== work.workUnitId ||
      row.max_attempts !== maxAttempts ||
      JSON.stringify(row.effective_budget) !== JSON.stringify(effectiveBudget)
    ) {
      throw new SourceTaskPersistenceError('SOURCE_TASK_ID_CONFLICT', `Source task ${input.sourceTaskId} already exists with different content.`);
    }
    return false;
  });

  const state = await getSourceTaskState(pool, input.workspaceId, input.sourceTaskId);
  if (!state) throw new Error('Source task disappeared after persistence.');
  return { created, state };
}

export async function claimSourceTask(
  pool: Pool,
  input: { workspaceId: string; sourceTaskId: string; workerId: string; expectedAttempt: number; leaseSeconds?: number },
): Promise<ClaimedWorkUnit | null> {
  assertIdentifier(input.workspaceId, 'workspaceId', 'SOURCE_TASK_INPUT_INVALID');
  assertIdentifier(input.sourceTaskId, 'sourceTaskId', 'SOURCE_TASK_INPUT_INVALID');
  assertIdentifier(input.workerId, 'workerId', 'SOURCE_TASK_INPUT_INVALID');
  const state = await getSourceTaskState(pool, input.workspaceId, input.sourceTaskId);
  if (!state) throw new SourceTaskPersistenceError('SOURCE_TASK_NOT_FOUND', `Source task ${input.sourceTaskId} was not found.`);
  return claimWorkUnit(pool, state.workUnitId, input.workerId, input.expectedAttempt, input.leaseSeconds ?? 30);
}

export async function recordSourceTaskUsage(pool: Pool, input: RecordSourceTaskUsageInput): Promise<boolean> {
  assertIdentifier(input.eventId, 'eventId', 'SOURCE_TASK_INPUT_INVALID');
  assertIdentifier(input.workspaceId, 'workspaceId', 'SOURCE_TASK_INPUT_INVALID');
  assertIdentifier(input.sourceTaskId, 'sourceTaskId', 'SOURCE_TASK_INPUT_INVALID');
  assertDate(input.occurredAt, 'occurredAt', 'SOURCE_TASK_INPUT_INVALID');
  const usage = parseUsage(input.usage);
  if (input.metadata !== undefined && !isRecord(input.metadata)) {
    throw new SourceTaskPersistenceError('SOURCE_TASK_INPUT_INVALID', 'metadata must be an object.');
  }
  const metadata = input.metadata ?? {};

  return withPgTransaction(pool, async (client) => {
    const task = await client.query<{
      effective_budget: Record<string, unknown>;
      work_unit_id: string;
    }>(
      'SELECT effective_budget, work_unit_id FROM source_tasks WHERE workspace_id = $1 AND id = $2 FOR UPDATE',
      [input.workspaceId, input.sourceTaskId],
    );
    const row = task.rows[0];
    if (!row) throw new SourceTaskPersistenceError('SOURCE_TASK_NOT_FOUND', `Source task ${input.sourceTaskId} was not found.`);
    const work = await client.query<{ status: WorkUnitStatus }>('SELECT status FROM job_work_units WHERE id = $1 FOR UPDATE', [row.work_unit_id]);
    if (work.rows[0]?.status !== 'running') {
      throw new SourceTaskPersistenceError('SOURCE_TASK_STATE_INVALID', 'Source task usage may be recorded only while the canonical work unit is running.');
    }

    const existing = await client.query<{
      workspace_id: string;
      source_task_id: string;
      requests: string;
      pages: string;
      bytes: string;
      currency_micros: string;
      runtime_ms: string;
      metadata: Record<string, unknown>;
      occurred_at: Date;
    }>('SELECT workspace_id, source_task_id, requests::text, pages::text, bytes::text, currency_micros::text, runtime_ms::text, metadata, occurred_at FROM source_task_usage_events WHERE id = $1', [input.eventId]);
    const existingRow = existing.rows[0];
    if (existingRow) {
      const same =
        existingRow.workspace_id === input.workspaceId &&
        existingRow.source_task_id === input.sourceTaskId &&
        Number(existingRow.requests) === usage.requests &&
        Number(existingRow.pages) === usage.pages &&
        Number(existingRow.bytes) === usage.bytes &&
        Number(existingRow.currency_micros) === usage.currencyMicros &&
        Number(existingRow.runtime_ms) === usage.runtimeMs &&
        JSON.stringify(existingRow.metadata) === JSON.stringify(metadata) &&
        existingRow.occurred_at.getTime() === input.occurredAt.getTime();
      if (!same) {
        throw new SourceTaskPersistenceError('SOURCE_TASK_USAGE_ID_CONFLICT', `Usage event ${input.eventId} already exists with different content.`);
      }
      return false;
    }

    const totals = await client.query<{
      requests: string;
      pages: string;
      bytes: string;
      currency_micros: string;
      runtime_ms: string;
    }>(
      `SELECT COALESCE(sum(requests),0)::text AS requests,
              COALESCE(sum(pages),0)::text AS pages,
              COALESCE(sum(bytes),0)::text AS bytes,
              COALESCE(sum(currency_micros),0)::text AS currency_micros,
              COALESCE(sum(runtime_ms),0)::text AS runtime_ms
       FROM source_task_usage_events
       WHERE workspace_id = $1 AND source_task_id = $2`,
      [input.workspaceId, input.sourceTaskId],
    );
    const current = totals.rows[0];
    const budget = parseBudget(row.effective_budget);
    const next = {
      requests: Number(current?.requests ?? 0) + usage.requests,
      pages: Number(current?.pages ?? 0) + usage.pages,
      bytes: Number(current?.bytes ?? 0) + usage.bytes,
      currencyMicros: Number(current?.currency_micros ?? 0) + usage.currencyMicros,
      runtimeMs: Number(current?.runtime_ms ?? 0) + usage.runtimeMs,
    };
    if (
      !Number.isSafeInteger(next.requests) || next.requests > budget.maxRequests ||
      !Number.isSafeInteger(next.pages) || next.pages > budget.maxPages ||
      !Number.isSafeInteger(next.bytes) || next.bytes > budget.maxBytes ||
      !Number.isSafeInteger(next.currencyMicros) || next.currencyMicros > budget.maxCurrencyMicros ||
      !Number.isSafeInteger(next.runtimeMs) || next.runtimeMs > budget.maxRuntimeMs
    ) {
      throw new SourceTaskPersistenceError('SOURCE_TASK_BUDGET_EXCEEDED', `Usage event ${input.eventId} exceeds the immutable admitted budget.`);
    }

    await client.query(
      `INSERT INTO source_task_usage_events (
         id, workspace_id, source_task_id, requests, pages, bytes,
         currency_micros, runtime_ms, metadata, occurred_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
      [
        input.eventId,
        input.workspaceId,
        input.sourceTaskId,
        usage.requests,
        usage.pages,
        usage.bytes,
        usage.currencyMicros,
        usage.runtimeMs,
        JSON.stringify(metadata),
        input.occurredAt,
      ],
    );
    return true;
  });
}

export async function recordSourceTaskFailure(
  pool: Pool,
  input: { workspaceId: string; sourceTaskId: string; errorClass: 'retryable' | 'permanent' | 'cancelled'; errorCode: string; retryDelayMs?: number },
): Promise<WorkFailureResult> {
  assertIdentifier(input.workspaceId, 'workspaceId', 'SOURCE_TASK_INPUT_INVALID');
  assertIdentifier(input.sourceTaskId, 'sourceTaskId', 'SOURCE_TASK_INPUT_INVALID');
  assertIdentifier(input.errorCode, 'errorCode', 'SOURCE_TASK_INPUT_INVALID');
  const state = await getSourceTaskState(pool, input.workspaceId, input.sourceTaskId);
  if (!state) throw new SourceTaskPersistenceError('SOURCE_TASK_NOT_FOUND', `Source task ${input.sourceTaskId} was not found.`);
  if (state.status !== 'running') {
    throw new SourceTaskPersistenceError('SOURCE_TASK_STATE_INVALID', 'Source task failure may be recorded only while running.');
  }
  return recordWorkFailure(pool, state.workUnitId, input.errorClass, input.errorCode, input.retryDelayMs ?? 0);
}

export async function cancelSourceTask(pool: Pool, workspaceId: string, sourceTaskId: string): Promise<WorkUnitStatus> {
  const state = await getSourceTaskState(pool, workspaceId, sourceTaskId);
  if (!state) throw new SourceTaskPersistenceError('SOURCE_TASK_NOT_FOUND', `Source task ${sourceTaskId} was not found.`);
  if (state.status === 'cancelled') return 'cancelled';
  const status = await requestWorkCancellation(pool, state.workUnitId);
  if (!status) throw new SourceTaskPersistenceError('SOURCE_TASK_STATE_INVALID', `Source task ${sourceTaskId} is already terminal and cannot be cancelled.`);
  return status;
}

export async function completeSourceTask(pool: Pool, input: CompleteSourceTaskInput): Promise<{ effectCreated: boolean }> {
  assertIdentifier(input.workspaceId, 'workspaceId', 'SOURCE_TASK_INPUT_INVALID');
  assertIdentifier(input.sourceTaskId, 'sourceTaskId', 'SOURCE_TASK_INPUT_INVALID');
  const sourceReferenceIds = assertUniqueIdentifiers(input.sourceReferenceIds, 'sourceReferenceIds', 'SOURCE_TASK_PROVENANCE_REQUIRED');
  const provenanceRefs = assertUniqueIdentifiers(input.provenanceRefs, 'provenanceRefs', 'SOURCE_TASK_PROVENANCE_REQUIRED');
  if (input.resultRef !== undefined) assertIdentifier(input.resultRef, 'resultRef', 'SOURCE_TASK_INPUT_INVALID');

  return withPgTransaction(pool, async (client) => {
    const task = await client.query<{
      job_run_id: string;
      work_unit_id: string;
      admission_snapshot_id: string;
      connector_key: string;
      connector_version: string;
      source_key: string;
      policy_id: string;
      policy_version: string;
    }>(
      `SELECT job_run_id, work_unit_id, admission_snapshot_id, connector_key, connector_version,
              source_key, policy_id, policy_version
       FROM source_tasks WHERE workspace_id = $1 AND id = $2 FOR UPDATE`,
      [input.workspaceId, input.sourceTaskId],
    );
    const row = task.rows[0];
    if (!row) throw new SourceTaskPersistenceError('SOURCE_TASK_NOT_FOUND', `Source task ${input.sourceTaskId} was not found.`);

    const effectData = {
      kind: 'source_task_result_reference',
      sourceTaskId: input.sourceTaskId,
      admissionSnapshotId: row.admission_snapshot_id,
      sourceKey: row.source_key,
      connectorKey: row.connector_key,
      connectorVersion: row.connector_version,
      policyId: row.policy_id,
      policyVersion: row.policy_version,
      sourceReferenceIds,
      provenanceRefs,
      ...(input.resultRef ? { resultRef: input.resultRef } : {}),
    };
    const work = await client.query<{ status: WorkUnitStatus }>('SELECT status FROM job_work_units WHERE id = $1 FOR UPDATE', [row.work_unit_id]);
    const status = work.rows[0]?.status;
    if (status === 'succeeded') {
      const existingEffect = await client.query<{ data: Record<string, unknown> }>(
        'SELECT data FROM job_effects WHERE work_unit_id = $1 AND effect_key = $2',
        [row.work_unit_id, SOURCE_EXECUTION_RESULT_EFFECT],
      );
      if (JSON.stringify(existingEffect.rows[0]?.data) !== JSON.stringify(effectData)) {
        throw new SourceTaskPersistenceError('SOURCE_TASK_ID_CONFLICT', `Completed source task ${input.sourceTaskId} has different result provenance.`);
      }
      return { effectCreated: false };
    }
    if (status !== 'running') {
      throw new SourceTaskPersistenceError('SOURCE_TASK_STATE_INVALID', 'Source task completion requires a running canonical work unit.');
    }

    const effect = await client.query<{ id: string }>(
      `INSERT INTO job_effects (work_unit_id, effect_key, data)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (work_unit_id, effect_key) DO NOTHING
       RETURNING id`,
      [row.work_unit_id, SOURCE_EXECUTION_RESULT_EFFECT, JSON.stringify(effectData)],
    );
    await client.query(
      `UPDATE job_work_units
       SET status = 'succeeded', completed_at = now(), lease_expires_at = NULL,
           worker_id = NULL, last_error_code = NULL, last_error_class = NULL,
           updated_at = now()
       WHERE id = $1`,
      [row.work_unit_id],
    );
    const pending = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM job_work_units
       WHERE job_run_id = $1 AND status <> 'succeeded'`,
      [row.job_run_id],
    );
    if ((pending.rows[0]?.count ?? 1) === 0) {
      await client.query(
        `UPDATE job_runs SET status = 'succeeded', completed_at = now(), updated_at = now() WHERE id = $1`,
        [row.job_run_id],
      );
    }
    return { effectCreated: Boolean(effect.rows[0]) };
  });
}

export async function getResearchJobPreflightState(
  pool: Pool,
  workspaceId: string,
  preflightId: string,
): Promise<ResearchJobPreflightState | null> {
  const preflight = await getResearchJobPreflight(pool, workspaceId, preflightId);
  if (!preflight) return null;
  const tasks = await pool.query<{ id: string }>(
    `SELECT id FROM source_tasks
     WHERE workspace_id = $1 AND preflight_id = $2
     ORDER BY created_at ASC, id ASC`,
    [workspaceId, preflightId],
  );
  const states: SourceTaskState[] = [];
  for (const task of tasks.rows) {
    const state = await getSourceTaskState(pool, workspaceId, task.id);
    if (state) states.push(state);
  }
  return { preflight, tasks: states };
}
