import type { Pool, PoolClient } from 'pg';
import { withPgTransaction } from './client';

export const RESEARCH_ACQUISITION_JOB_TYPE = 'research.acquire';
export const RESEARCH_ACQUISITION_SHARD_WORK_TYPE = 'research.acquire.shard';
export const RESEARCH_ACQUISITION_QUEUE = 'brovexa-work-v1';
export const ACQUISITION_PROGRESS_CHECKPOINT_KEY = 'acquisition.progress';

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/;
const sourceKeyPattern = /^source\.[a-z0-9_.-]+$/;

export interface ResearchAcquisitionBudget {
  maxBusinesses: number;
  maxRequests: number;
  maxPages: number;
  maxBytes: number;
  maxCurrencyMicros: number;
  maxRuntimeMs: number;
  maxConcurrency: number;
}

export interface CreateResearchJobInput {
  id: string;
  workspaceId: string;
  preflightId: string;
  idempotencyKey: string;
  spec: Record<string, unknown>;
  approvedSourceKeys: readonly string[];
  budget: ResearchAcquisitionBudget;
}

export interface PersistedResearchJob {
  id: string;
  workspaceId: string;
  preflightId: string;
  jobRunId: string;
  correlationId: string;
  spec: Record<string, unknown>;
  approvedSourceKeys: string[];
  budget: ResearchAcquisitionBudget;
  createdAt: Date;
}

export interface CreateResearchJobResult {
  created: boolean;
  researchJob: PersistedResearchJob;
}

export interface CreateAcquisitionShardInput {
  id: string;
  workspaceId: string;
  researchJobId: string;
  shardKey: string;
  ordinal: number;
  sourceKeys: readonly string[];
  budget: ResearchAcquisitionBudget;
  maxAttempts?: number;
}

export interface PersistedAcquisitionShard {
  id: string;
  workspaceId: string;
  researchJobId: string;
  jobRunId: string;
  workUnitId: string;
  correlationId: string;
  shardKey: string;
  ordinal: number;
  sourceKeys: string[];
  budget: ResearchAcquisitionBudget;
  createdAt: Date;
}

export interface CreateAcquisitionShardResult {
  created: boolean;
  shard: PersistedAcquisitionShard;
}

export interface AcquisitionProgressCounters {
  completedUnits: number;
  failedUnits: number;
  returnedRecords: number;
  requests: number;
  pages: number;
  bytes: number;
  currencyMicros: number;
  runtimeMs: number;
}

export interface AcquisitionProgressCheckpoint extends AcquisitionProgressCounters {
  version: number;
  terminal: boolean;
  observedAt: string;
}

export interface SaveAcquisitionProgressInput {
  workspaceId: string;
  shardId: string;
  expectedVersion: number | null;
  counters: AcquisitionProgressCounters;
  terminal: boolean;
  observedAt: Date;
}

export type ResearchJobPersistenceErrorCode =
  | 'RESEARCH_JOB_INPUT_INVALID'
  | 'RESEARCH_JOB_PREFLIGHT_NOT_FOUND'
  | 'RESEARCH_JOB_PREFLIGHT_NOT_ALLOWED'
  | 'RESEARCH_JOB_IDEMPOTENCY_CONFLICT'
  | 'RESEARCH_JOB_ID_CONFLICT'
  | 'RESEARCH_JOB_NOT_FOUND'
  | 'ACQUISITION_SHARD_INPUT_INVALID'
  | 'ACQUISITION_SHARD_SOURCE_NOT_APPROVED'
  | 'ACQUISITION_SHARD_IDEMPOTENCY_CONFLICT'
  | 'ACQUISITION_SHARD_ID_CONFLICT'
  | 'ACQUISITION_SHARD_NOT_FOUND'
  | 'ACQUISITION_PROGRESS_CONFLICT';

export class ResearchJobPersistenceError extends Error {
  constructor(readonly code: ResearchJobPersistenceErrorCode, message: string) {
    super(message);
    this.name = 'ResearchJobPersistenceError';
  }
}

interface ResearchJobRow {
  id: string;
  workspace_id: string;
  preflight_id: string;
  job_run_id: string;
  correlation_id: string;
  spec: Record<string, unknown>;
  approved_source_keys: string[];
  budget: Record<string, unknown>;
  created_at: Date;
}

interface AcquisitionShardRow {
  id: string;
  workspace_id: string;
  research_job_id: string;
  job_run_id: string;
  work_unit_id: string;
  correlation_id: string;
  shard_key: string;
  ordinal: number;
  source_keys: string[];
  budget: Record<string, unknown>;
  created_at: Date;
}

function error(code: ResearchJobPersistenceErrorCode, message: string): ResearchJobPersistenceError {
  return new ResearchJobPersistenceError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function semanticallyEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function assertIdentifier(value: string, field: string, code: ResearchJobPersistenceErrorCode): void {
  if (typeof value !== 'string' || !identifierPattern.test(value)) throw error(code, `${field} must use the canonical identifier format.`);
}

function assertSafeInteger(value: number, field: string, code: ResearchJobPersistenceErrorCode, positive = false): void {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    throw error(code, `${field} must be a ${positive ? 'positive' : 'non-negative'} safe integer.`);
  }
}

function validateBudget(budget: ResearchAcquisitionBudget, code: ResearchJobPersistenceErrorCode): void {
  if (!isRecord(budget)) throw error(code, 'budget must be an object.');
  assertSafeInteger(budget.maxBusinesses, 'budget.maxBusinesses', code);
  assertSafeInteger(budget.maxRequests, 'budget.maxRequests', code);
  assertSafeInteger(budget.maxPages, 'budget.maxPages', code);
  assertSafeInteger(budget.maxBytes, 'budget.maxBytes', code);
  assertSafeInteger(budget.maxCurrencyMicros, 'budget.maxCurrencyMicros', code);
  assertSafeInteger(budget.maxRuntimeMs, 'budget.maxRuntimeMs', code);
  assertSafeInteger(budget.maxConcurrency, 'budget.maxConcurrency', code, true);
}

function parseBudget(value: unknown, code: ResearchJobPersistenceErrorCode): ResearchAcquisitionBudget {
  if (!isRecord(value)) throw error(code, 'persisted budget must be an object.');
  const budget = {
    maxBusinesses: Number(value.maxBusinesses),
    maxRequests: Number(value.maxRequests),
    maxPages: Number(value.maxPages),
    maxBytes: Number(value.maxBytes),
    maxCurrencyMicros: Number(value.maxCurrencyMicros),
    maxRuntimeMs: Number(value.maxRuntimeMs),
    maxConcurrency: Number(value.maxConcurrency),
  };
  validateBudget(budget, code);
  return budget;
}

function normalizeSourceKeys(values: readonly string[], field: string, code: ResearchJobPersistenceErrorCode): string[] {
  if (!Array.isArray(values) || values.length === 0 || values.length > 512) {
    throw error(code, `${field} must contain between 1 and 512 source keys.`);
  }
  const normalized = values.map((value) => {
    if (typeof value !== 'string' || !sourceKeyPattern.test(value)) throw error(code, `${field} contains an invalid source key.`);
    return value;
  });
  if (new Set(normalized).size !== normalized.length) throw error(code, `${field} must not contain duplicates.`);
  return normalized;
}

function rowToResearchJob(row: ResearchJobRow): PersistedResearchJob {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    preflightId: row.preflight_id,
    jobRunId: row.job_run_id,
    correlationId: row.correlation_id,
    spec: row.spec,
    approvedSourceKeys: row.approved_source_keys,
    budget: parseBudget(row.budget, 'RESEARCH_JOB_INPUT_INVALID'),
    createdAt: row.created_at,
  };
}

function rowToShard(row: AcquisitionShardRow): PersistedAcquisitionShard {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    researchJobId: row.research_job_id,
    jobRunId: row.job_run_id,
    workUnitId: row.work_unit_id,
    correlationId: row.correlation_id,
    shardKey: row.shard_key,
    ordinal: row.ordinal,
    sourceKeys: row.source_keys,
    budget: parseBudget(row.budget, 'ACQUISITION_SHARD_INPUT_INVALID'),
    createdAt: row.created_at,
  };
}

const researchJobSelect = `
  SELECT rj.id, rj.workspace_id, rj.preflight_id, rj.job_run_id,
         jr.correlation_id, rj.spec, rj.approved_source_keys, rj.budget, rj.created_at
  FROM research_jobs rj
  JOIN job_runs jr ON jr.id = rj.job_run_id AND jr.workspace_id = rj.workspace_id`;

const shardSelect = `
  SELECT ash.id, ash.workspace_id, ash.research_job_id, ash.job_run_id, ash.work_unit_id,
         jwu.correlation_id, ash.shard_key, ash.ordinal, ash.source_keys, ash.budget, ash.created_at
  FROM acquisition_shards ash
  JOIN job_work_units jwu ON jwu.id = ash.work_unit_id
    AND jwu.workspace_id = ash.workspace_id
    AND jwu.job_run_id = ash.job_run_id`;

async function getResearchJobWithClient(client: PoolClient, workspaceId: string, id: string): Promise<PersistedResearchJob | null> {
  const result = await client.query<ResearchJobRow>(`${researchJobSelect} WHERE rj.workspace_id = $1 AND rj.id = $2`, [workspaceId, id]);
  return result.rows[0] ? rowToResearchJob(result.rows[0]) : null;
}

export async function getResearchJob(pool: Pool, workspaceId: string, id: string): Promise<PersistedResearchJob | null> {
  assertIdentifier(workspaceId, 'workspaceId', 'RESEARCH_JOB_INPUT_INVALID');
  assertIdentifier(id, 'id', 'RESEARCH_JOB_INPUT_INVALID');
  const result = await pool.query<ResearchJobRow>(`${researchJobSelect} WHERE rj.workspace_id = $1 AND rj.id = $2`, [workspaceId, id]);
  return result.rows[0] ? rowToResearchJob(result.rows[0]) : null;
}

export async function createResearchJob(pool: Pool, input: CreateResearchJobInput): Promise<CreateResearchJobResult> {
  assertIdentifier(input.id, 'id', 'RESEARCH_JOB_INPUT_INVALID');
  assertIdentifier(input.workspaceId, 'workspaceId', 'RESEARCH_JOB_INPUT_INVALID');
  assertIdentifier(input.preflightId, 'preflightId', 'RESEARCH_JOB_INPUT_INVALID');
  assertIdentifier(input.idempotencyKey, 'idempotencyKey', 'RESEARCH_JOB_INPUT_INVALID');
  if (!isRecord(input.spec)) throw error('RESEARCH_JOB_INPUT_INVALID', 'spec must be an object.');
  const approvedSourceKeys = normalizeSourceKeys(input.approvedSourceKeys, 'approvedSourceKeys', 'RESEARCH_JOB_INPUT_INVALID');
  validateBudget(input.budget, 'RESEARCH_JOB_INPUT_INVALID');

  return withPgTransaction(pool, async (client) => {
    const preflight = await client.query<{ decision: string }>(
      `SELECT decision FROM research_job_preflights
       WHERE id = $1 AND workspace_id = $2::uuid AND research_job_id = $3`,
      [input.preflightId, input.workspaceId, input.id],
    );
    const preflightRow = preflight.rows[0];
    if (!preflightRow) {
      throw error('RESEARCH_JOB_PREFLIGHT_NOT_FOUND', `Preflight ${input.preflightId} is not bound to research job ${input.id}.`);
    }
    if (preflightRow.decision !== 'allow') {
      throw error('RESEARCH_JOB_PREFLIGHT_NOT_ALLOWED', `Preflight ${input.preflightId} is ${preflightRow.decision}; execution remains fail-closed.`);
    }

    const insertedRun = await client.query<{ id: string; correlation_id: string }>(
      `INSERT INTO job_runs (workspace_id, job_type, job_version, idempotency_key)
       VALUES ($1::uuid, $2, 1, $3)
       ON CONFLICT (workspace_id, job_type, idempotency_key) DO NOTHING
       RETURNING id, correlation_id`,
      [input.workspaceId, RESEARCH_ACQUISITION_JOB_TYPE, input.idempotencyKey],
    );

    let jobRunId = insertedRun.rows[0]?.id;
    if (!jobRunId) {
      const existingRun = await client.query<{ id: string }>(
        `SELECT id FROM job_runs
         WHERE workspace_id = $1::uuid AND job_type = $2 AND idempotency_key = $3`,
        [input.workspaceId, RESEARCH_ACQUISITION_JOB_TYPE, input.idempotencyKey],
      );
      jobRunId = existingRun.rows[0]?.id;
      if (!jobRunId) throw error('RESEARCH_JOB_IDEMPOTENCY_CONFLICT', 'Research job idempotency lookup failed.');

      const existing = await getResearchJobWithClient(client, input.workspaceId, input.id);
      if (!existing || existing.jobRunId !== jobRunId) {
        throw error('RESEARCH_JOB_IDEMPOTENCY_CONFLICT', `Idempotency key ${input.idempotencyKey} is already bound to another research job.`);
      }
      if (
        existing.preflightId !== input.preflightId ||
        !semanticallyEqual(existing.spec, input.spec) ||
        !semanticallyEqual(existing.approvedSourceKeys, approvedSourceKeys) ||
        !semanticallyEqual(existing.budget, input.budget)
      ) {
        throw error('RESEARCH_JOB_IDEMPOTENCY_CONFLICT', `Research job ${input.id} idempotency replay changed immutable content.`);
      }
      return { created: false, researchJob: existing };
    }

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO research_jobs (
         id, workspace_id, preflight_id, job_run_id, spec, approved_source_keys, budget
       ) VALUES ($1, $2::uuid, $3, $4::uuid, $5::jsonb, $6::jsonb, $7::jsonb)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        input.id,
        input.workspaceId,
        input.preflightId,
        jobRunId,
        JSON.stringify(input.spec),
        JSON.stringify(approvedSourceKeys),
        JSON.stringify(input.budget),
      ],
    );
    if (!inserted.rows[0]) {
      throw error('RESEARCH_JOB_ID_CONFLICT', `Research job ${input.id} already exists with different identity.`);
    }

    const researchJob = await getResearchJobWithClient(client, input.workspaceId, input.id);
    if (!researchJob) throw error('RESEARCH_JOB_NOT_FOUND', `Research job ${input.id} disappeared after insert.`);
    return { created: true, researchJob };
  });
}

async function getShardWithClient(client: PoolClient, workspaceId: string, shardId: string): Promise<PersistedAcquisitionShard | null> {
  const result = await client.query<AcquisitionShardRow>(`${shardSelect} WHERE ash.workspace_id = $1 AND ash.id = $2`, [workspaceId, shardId]);
  return result.rows[0] ? rowToShard(result.rows[0]) : null;
}

export async function getAcquisitionShard(pool: Pool, workspaceId: string, shardId: string): Promise<PersistedAcquisitionShard | null> {
  assertIdentifier(workspaceId, 'workspaceId', 'ACQUISITION_SHARD_INPUT_INVALID');
  assertIdentifier(shardId, 'shardId', 'ACQUISITION_SHARD_INPUT_INVALID');
  const result = await pool.query<AcquisitionShardRow>(`${shardSelect} WHERE ash.workspace_id = $1 AND ash.id = $2`, [workspaceId, shardId]);
  return result.rows[0] ? rowToShard(result.rows[0]) : null;
}

export async function createAcquisitionShard(pool: Pool, input: CreateAcquisitionShardInput): Promise<CreateAcquisitionShardResult> {
  assertIdentifier(input.id, 'id', 'ACQUISITION_SHARD_INPUT_INVALID');
  assertIdentifier(input.workspaceId, 'workspaceId', 'ACQUISITION_SHARD_INPUT_INVALID');
  assertIdentifier(input.researchJobId, 'researchJobId', 'ACQUISITION_SHARD_INPUT_INVALID');
  assertIdentifier(input.shardKey, 'shardKey', 'ACQUISITION_SHARD_INPUT_INVALID');
  assertSafeInteger(input.ordinal, 'ordinal', 'ACQUISITION_SHARD_INPUT_INVALID');
  const sourceKeys = normalizeSourceKeys(input.sourceKeys, 'sourceKeys', 'ACQUISITION_SHARD_INPUT_INVALID');
  validateBudget(input.budget, 'ACQUISITION_SHARD_INPUT_INVALID');
  const maxAttempts = input.maxAttempts ?? 3;
  assertSafeInteger(maxAttempts, 'maxAttempts', 'ACQUISITION_SHARD_INPUT_INVALID', true);
  if (maxAttempts > 10) throw error('ACQUISITION_SHARD_INPUT_INVALID', 'maxAttempts must not exceed 10.');

  return withPgTransaction(pool, async (client) => {
    const parent = await client.query<{
      job_run_id: string;
      correlation_id: string;
      approved_source_keys: string[];
    }>(
      `SELECT rj.job_run_id, jr.correlation_id, rj.approved_source_keys
       FROM research_jobs rj
       JOIN job_runs jr ON jr.id = rj.job_run_id AND jr.workspace_id = rj.workspace_id
       WHERE rj.workspace_id = $1::uuid AND rj.id = $2
       FOR UPDATE OF rj`,
      [input.workspaceId, input.researchJobId],
    );
    const parentRow = parent.rows[0];
    if (!parentRow) throw error('RESEARCH_JOB_NOT_FOUND', `Research job ${input.researchJobId} was not found.`);
    const approved = new Set(parentRow.approved_source_keys);
    const unapproved = sourceKeys.find((key) => !approved.has(key));
    if (unapproved) {
      throw error('ACQUISITION_SHARD_SOURCE_NOT_APPROVED', `Source ${unapproved} is not approved for research job ${input.researchJobId}.`);
    }

    const payload = {
      researchJobId: input.researchJobId,
      shardId: input.id,
      shardKey: input.shardKey,
      ordinal: input.ordinal,
      sourceKeys,
      budget: input.budget,
    };
    const insertedWork = await client.query<{ id: string }>(
      `INSERT INTO job_work_units (
         job_run_id, workspace_id, queue_name, work_type, work_version,
         idempotency_key, correlation_id, payload, max_attempts
       ) VALUES ($1::uuid, $2::uuid, $3, $4, 1, $5, $6::uuid, $7::jsonb, $8)
       ON CONFLICT (job_run_id, work_type, idempotency_key) DO NOTHING
       RETURNING id`,
      [
        parentRow.job_run_id,
        input.workspaceId,
        RESEARCH_ACQUISITION_QUEUE,
        RESEARCH_ACQUISITION_SHARD_WORK_TYPE,
        input.shardKey,
        parentRow.correlation_id,
        JSON.stringify(payload),
        maxAttempts,
      ],
    );

    let workUnitId = insertedWork.rows[0]?.id;
    if (!workUnitId) {
      const existingWork = await client.query<{ id: string }>(
        `SELECT id FROM job_work_units
         WHERE job_run_id = $1::uuid AND work_type = $2 AND idempotency_key = $3`,
        [parentRow.job_run_id, RESEARCH_ACQUISITION_SHARD_WORK_TYPE, input.shardKey],
      );
      workUnitId = existingWork.rows[0]?.id;
      if (!workUnitId) throw error('ACQUISITION_SHARD_IDEMPOTENCY_CONFLICT', 'Acquisition shard idempotency lookup failed.');

      const existing = await getShardWithClient(client, input.workspaceId, input.id);
      if (!existing || existing.workUnitId !== workUnitId) {
        throw error('ACQUISITION_SHARD_IDEMPOTENCY_CONFLICT', `Shard key ${input.shardKey} is already bound to another acquisition shard.`);
      }
      if (
        existing.researchJobId !== input.researchJobId ||
        existing.shardKey !== input.shardKey ||
        existing.ordinal !== input.ordinal ||
        !semanticallyEqual(existing.sourceKeys, sourceKeys) ||
        !semanticallyEqual(existing.budget, input.budget)
      ) {
        throw error('ACQUISITION_SHARD_IDEMPOTENCY_CONFLICT', `Acquisition shard ${input.id} idempotency replay changed immutable content.`);
      }
      return { created: false, shard: existing };
    }

    const envelope = {
      id: input.id,
      workspaceId: input.workspaceId,
      researchJobId: input.researchJobId,
      jobRunId: parentRow.job_run_id,
      workUnitId,
      shardKey: input.shardKey,
      ordinal: input.ordinal,
      sourceKeys,
      budget: input.budget,
    };
    const insertedShard = await client.query<{ id: string }>(
      `INSERT INTO acquisition_shards (
         id, workspace_id, research_job_id, job_run_id, work_unit_id,
         shard_key, ordinal, source_keys, budget, envelope
       ) VALUES ($1, $2::uuid, $3, $4::uuid, $5::uuid, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        input.id,
        input.workspaceId,
        input.researchJobId,
        parentRow.job_run_id,
        workUnitId,
        input.shardKey,
        input.ordinal,
        JSON.stringify(sourceKeys),
        JSON.stringify(input.budget),
        JSON.stringify(envelope),
      ],
    );
    if (!insertedShard.rows[0]) {
      throw error('ACQUISITION_SHARD_ID_CONFLICT', `Acquisition shard ${input.id} already exists with different identity.`);
    }

    const shard = await getShardWithClient(client, input.workspaceId, input.id);
    if (!shard) throw error('ACQUISITION_SHARD_NOT_FOUND', `Acquisition shard ${input.id} disappeared after insert.`);
    return { created: true, shard };
  });
}

function validateCounters(counters: AcquisitionProgressCounters): void {
  for (const [field, value] of Object.entries(counters)) {
    assertSafeInteger(value, `counters.${field}`, 'ACQUISITION_SHARD_INPUT_INVALID');
  }
}

function parseCheckpoint(value: unknown): AcquisitionProgressCheckpoint {
  if (!isRecord(value)) throw error('ACQUISITION_PROGRESS_CONFLICT', 'Persisted acquisition progress is not an object.');
  const checkpoint: AcquisitionProgressCheckpoint = {
    version: Number(value.version),
    completedUnits: Number(value.completedUnits),
    failedUnits: Number(value.failedUnits),
    returnedRecords: Number(value.returnedRecords),
    requests: Number(value.requests),
    pages: Number(value.pages),
    bytes: Number(value.bytes),
    currencyMicros: Number(value.currencyMicros),
    runtimeMs: Number(value.runtimeMs),
    terminal: value.terminal === true,
    observedAt: String(value.observedAt ?? ''),
  };
  assertSafeInteger(checkpoint.version, 'checkpoint.version', 'ACQUISITION_PROGRESS_CONFLICT', true);
  validateCounters(checkpoint);
  if (!checkpoint.observedAt || Number.isNaN(Date.parse(checkpoint.observedAt))) {
    throw error('ACQUISITION_PROGRESS_CONFLICT', 'Persisted acquisition progress observedAt is invalid.');
  }
  return checkpoint;
}

export async function saveAcquisitionProgress(
  pool: Pool,
  input: SaveAcquisitionProgressInput,
): Promise<AcquisitionProgressCheckpoint> {
  assertIdentifier(input.workspaceId, 'workspaceId', 'ACQUISITION_SHARD_INPUT_INVALID');
  assertIdentifier(input.shardId, 'shardId', 'ACQUISITION_SHARD_INPUT_INVALID');
  validateCounters(input.counters);
  if (!(input.observedAt instanceof Date) || Number.isNaN(input.observedAt.getTime())) {
    throw error('ACQUISITION_SHARD_INPUT_INVALID', 'observedAt must be a valid Date.');
  }
  if (input.expectedVersion !== null) {
    assertSafeInteger(input.expectedVersion, 'expectedVersion', 'ACQUISITION_SHARD_INPUT_INVALID', true);
  }

  return withPgTransaction(pool, async (client) => {
    const shard = await client.query<{ work_unit_id: string }>(
      `SELECT work_unit_id FROM acquisition_shards
       WHERE workspace_id = $1::uuid AND id = $2`,
      [input.workspaceId, input.shardId],
    );
    const workUnitId = shard.rows[0]?.work_unit_id;
    if (!workUnitId) throw error('ACQUISITION_SHARD_NOT_FOUND', `Acquisition shard ${input.shardId} was not found.`);

    const data: AcquisitionProgressCheckpoint = {
      version: input.expectedVersion === null ? 1 : input.expectedVersion + 1,
      ...input.counters,
      terminal: input.terminal,
      observedAt: input.observedAt.toISOString(),
    };

    if (input.expectedVersion === null) {
      const inserted = await client.query<{ data: unknown }>(
        `INSERT INTO job_checkpoints (work_unit_id, checkpoint_key, data)
         VALUES ($1::uuid, $2, $3::jsonb)
         ON CONFLICT (work_unit_id, checkpoint_key) DO NOTHING
         RETURNING data`,
        [workUnitId, ACQUISITION_PROGRESS_CHECKPOINT_KEY, JSON.stringify(data)],
      );
      if (inserted.rows[0]) return parseCheckpoint(inserted.rows[0].data);
    } else {
      const updated = await client.query<{ data: unknown }>(
        `UPDATE job_checkpoints
         SET data = $3::jsonb, updated_at = now()
         WHERE work_unit_id = $1::uuid
           AND checkpoint_key = $2
           AND (data->>'version')::bigint = $4
           AND COALESCE((data->>'terminal')::boolean, false) = false
           AND (data->>'observedAt')::timestamptz <= $5::timestamptz
         RETURNING data`,
        [workUnitId, ACQUISITION_PROGRESS_CHECKPOINT_KEY, JSON.stringify(data), input.expectedVersion, input.observedAt],
      );
      if (updated.rows[0]) return parseCheckpoint(updated.rows[0].data);
    }

    throw error(
      'ACQUISITION_PROGRESS_CONFLICT',
      `Acquisition progress for shard ${input.shardId} changed, is terminal, regressed in time, or already exists; reload before retrying.`,
    );
  });
}

export async function getAcquisitionProgress(
  pool: Pool,
  workspaceId: string,
  shardId: string,
): Promise<AcquisitionProgressCheckpoint | null> {
  assertIdentifier(workspaceId, 'workspaceId', 'ACQUISITION_SHARD_INPUT_INVALID');
  assertIdentifier(shardId, 'shardId', 'ACQUISITION_SHARD_INPUT_INVALID');
  const result = await pool.query<{ data: unknown }>(
    `SELECT jc.data
     FROM acquisition_shards ash
     JOIN job_checkpoints jc ON jc.work_unit_id = ash.work_unit_id
     WHERE ash.workspace_id = $1::uuid
       AND ash.id = $2
       AND jc.checkpoint_key = $3`,
    [workspaceId, shardId, ACQUISITION_PROGRESS_CHECKPOINT_KEY],
  );
  return result.rows[0] ? parseCheckpoint(result.rows[0].data) : null;
}
