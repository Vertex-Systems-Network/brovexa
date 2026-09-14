import type { Pool } from 'pg';

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/;
const safeIntegerMax = Number.MAX_SAFE_INTEGER;

export type SourceDiscoveryCheckpointMode = 'cursor' | 'page';
export type SourceDiscoveryCoverageState = 'complete' | 'partial' | 'unknown';

export interface SourceDiscoveryCheckpointUsage {
  requests: number;
  pages: number;
  bytes: number;
  currencyMicros: number;
  runtimeMs: number;
}

export interface SaveSourceDiscoveryCheckpointInput {
  id: string;
  workspaceId: string;
  sourceTaskId: string;
  mode: SourceDiscoveryCheckpointMode;
  pageIndex: number;
  nextCursor: string | null;
  nextPage: number | null;
  cumulativeUsage: SourceDiscoveryCheckpointUsage;
  coverageState: SourceDiscoveryCoverageState;
  returnedRecords: number;
  terminal: boolean;
  observedAt: Date;
  expectedVersion: number | null;
}

export interface PersistedSourceDiscoveryCheckpoint {
  id: string;
  workspaceId: string;
  sourceTaskId: string;
  mode: SourceDiscoveryCheckpointMode;
  pageIndex: number;
  nextCursor: string | null;
  nextPage: number | null;
  cumulativeUsage: SourceDiscoveryCheckpointUsage;
  coverageState: SourceDiscoveryCoverageState;
  returnedRecords: number;
  terminal: boolean;
  version: number;
  observedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type SourceDiscoveryCheckpointPersistenceErrorCode =
  | 'SOURCE_DISCOVERY_CHECKPOINT_INPUT_INVALID'
  | 'SOURCE_DISCOVERY_CHECKPOINT_CONFLICT'
  | 'SOURCE_DISCOVERY_CHECKPOINT_NOT_FOUND';

export class SourceDiscoveryCheckpointPersistenceError extends Error {
  constructor(readonly code: SourceDiscoveryCheckpointPersistenceErrorCode, message: string) {
    super(message);
    this.name = 'SourceDiscoveryCheckpointPersistenceError';
  }
}

interface CheckpointRow {
  id: string;
  workspace_id: string;
  source_task_id: string;
  mode: SourceDiscoveryCheckpointMode;
  page_index: string;
  next_cursor: string | null;
  next_page: string | null;
  cumulative_requests: string;
  cumulative_pages: string;
  cumulative_bytes: string;
  cumulative_currency_micros: string;
  cumulative_runtime_ms: string;
  coverage_state: SourceDiscoveryCoverageState;
  returned_records: string;
  terminal: boolean;
  version: string;
  observed_at: Date;
  created_at: Date;
  updated_at: Date;
}

function inputError(message: string): SourceDiscoveryCheckpointPersistenceError {
  return new SourceDiscoveryCheckpointPersistenceError('SOURCE_DISCOVERY_CHECKPOINT_INPUT_INVALID', message);
}

function assertIdentifier(value: string, field: string): void {
  if (typeof value !== 'string' || !identifierPattern.test(value)) throw inputError(`${field} must use the canonical identifier format.`);
}

function assertSafeInteger(value: number, field: string, positive = false): void {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > safeIntegerMax) {
    throw inputError(`${field} must be a ${positive ? 'positive' : 'non-negative'} safe integer.`);
  }
}

function validateInput(input: SaveSourceDiscoveryCheckpointInput): void {
  assertIdentifier(input.id, 'id');
  assertIdentifier(input.sourceTaskId, 'sourceTaskId');
  if (typeof input.workspaceId !== 'string' || input.workspaceId.length === 0) throw inputError('workspaceId is required.');
  if (input.mode !== 'cursor' && input.mode !== 'page') throw inputError('mode must be cursor or page.');
  assertSafeInteger(input.pageIndex, 'pageIndex');
  if (
    input.nextCursor !== null &&
    (typeof input.nextCursor !== 'string' || input.nextCursor.trim().length === 0 || input.nextCursor.length > 4096)
  ) {
    throw inputError('nextCursor must be null or a non-empty value of at most 4096 characters.');
  }
  if (input.nextPage !== null) assertSafeInteger(input.nextPage, 'nextPage', true);
  if (input.mode === 'cursor' && input.nextPage !== null) throw inputError('cursor checkpoints cannot declare nextPage.');
  if (input.mode === 'page' && input.nextCursor !== null) throw inputError('page checkpoints cannot declare nextCursor.');
  if (input.terminal && (input.nextCursor !== null || input.nextPage !== null)) {
    throw inputError('terminal checkpoints cannot retain continuation state.');
  }
  if (!input.terminal && input.mode === 'cursor' && input.nextCursor === null) {
    throw inputError('non-terminal cursor checkpoints require nextCursor.');
  }
  if (!input.terminal && input.mode === 'page' && input.nextPage === null) {
    throw inputError('non-terminal page checkpoints require nextPage.');
  }
  if (input.coverageState === 'complete' && !input.terminal) {
    throw inputError('complete coverage requires a terminal checkpoint.');
  }
  for (const [field, value] of Object.entries(input.cumulativeUsage)) assertSafeInteger(value, `cumulativeUsage.${field}`);
  if (!['complete', 'partial', 'unknown'].includes(input.coverageState)) throw inputError('coverageState is invalid.');
  assertSafeInteger(input.returnedRecords, 'returnedRecords');
  if (!(input.observedAt instanceof Date) || Number.isNaN(input.observedAt.getTime())) throw inputError('observedAt must be a valid Date.');
  if (input.expectedVersion !== null) assertSafeInteger(input.expectedVersion, 'expectedVersion', true);
}

function readSafeInteger(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new SourceDiscoveryCheckpointPersistenceError(
      'SOURCE_DISCOVERY_CHECKPOINT_INPUT_INVALID',
      `${field} is outside the JavaScript safe integer range.`,
    );
  }
  return parsed;
}

function rowToCheckpoint(row: CheckpointRow): PersistedSourceDiscoveryCheckpoint {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    sourceTaskId: row.source_task_id,
    mode: row.mode,
    pageIndex: readSafeInteger(row.page_index, 'pageIndex'),
    nextCursor: row.next_cursor,
    nextPage: row.next_page === null ? null : readSafeInteger(row.next_page, 'nextPage'),
    cumulativeUsage: {
      requests: readSafeInteger(row.cumulative_requests, 'cumulativeUsage.requests'),
      pages: readSafeInteger(row.cumulative_pages, 'cumulativeUsage.pages'),
      bytes: readSafeInteger(row.cumulative_bytes, 'cumulativeUsage.bytes'),
      currencyMicros: readSafeInteger(row.cumulative_currency_micros, 'cumulativeUsage.currencyMicros'),
      runtimeMs: readSafeInteger(row.cumulative_runtime_ms, 'cumulativeUsage.runtimeMs'),
    },
    coverageState: row.coverage_state,
    returnedRecords: readSafeInteger(row.returned_records, 'returnedRecords'),
    terminal: row.terminal,
    version: readSafeInteger(row.version, 'version'),
    observedAt: row.observed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const returningColumns = `id, workspace_id, source_task_id, mode, page_index::text, next_cursor, next_page::text,
  cumulative_requests::text, cumulative_pages::text, cumulative_bytes::text,
  cumulative_currency_micros::text, cumulative_runtime_ms::text, coverage_state,
  returned_records::text, terminal, version::text, observed_at, created_at, updated_at`;

export async function saveSourceDiscoveryCheckpoint(
  pool: Pool,
  input: SaveSourceDiscoveryCheckpointInput,
): Promise<PersistedSourceDiscoveryCheckpoint> {
  validateInput(input);
  const values = [
    input.id,
    input.workspaceId,
    input.sourceTaskId,
    input.mode,
    input.pageIndex,
    input.nextCursor,
    input.nextPage,
    input.cumulativeUsage.requests,
    input.cumulativeUsage.pages,
    input.cumulativeUsage.bytes,
    input.cumulativeUsage.currencyMicros,
    input.cumulativeUsage.runtimeMs,
    input.coverageState,
    input.returnedRecords,
    input.terminal,
    input.observedAt,
  ];

  if (input.expectedVersion === null) {
    const inserted = await pool.query<CheckpointRow>(
      `INSERT INTO source_discovery_checkpoints (
         id, workspace_id, source_task_id, mode, page_index, next_cursor, next_page,
         cumulative_requests, cumulative_pages, cumulative_bytes, cumulative_currency_micros,
         cumulative_runtime_ms, coverage_state, returned_records, terminal, observed_at
       ) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT DO NOTHING
       RETURNING ${returningColumns}`,
      values,
    );
    const row = inserted.rows[0];
    if (row) return rowToCheckpoint(row);
  } else {
    const updated = await pool.query<CheckpointRow>(
      `UPDATE source_discovery_checkpoints
       SET page_index = $5, next_cursor = $6, next_page = $7,
           cumulative_requests = $8, cumulative_pages = $9, cumulative_bytes = $10,
           cumulative_currency_micros = $11, cumulative_runtime_ms = $12,
           coverage_state = $13, returned_records = $14, terminal = $15, observed_at = $16,
           version = version + 1, updated_at = now()
       WHERE id = $1
         AND workspace_id = $2::uuid
         AND source_task_id = $3
         AND mode = $4
         AND version = $17
         AND terminal = false
         AND page_index <= $5
         AND cumulative_requests <= $8
         AND cumulative_pages <= $9
         AND cumulative_bytes <= $10
         AND cumulative_currency_micros <= $11
         AND cumulative_runtime_ms <= $12
         AND returned_records <= $14
         AND observed_at <= $16
       RETURNING ${returningColumns}`,
      [...values, input.expectedVersion],
    );
    const row = updated.rows[0];
    if (row) return rowToCheckpoint(row);
  }

  throw new SourceDiscoveryCheckpointPersistenceError(
    'SOURCE_DISCOVERY_CHECKPOINT_CONFLICT',
    `Checkpoint for source task ${input.sourceTaskId} changed, regressed or already exists; reload before retrying.`,
  );
}

export async function getSourceDiscoveryCheckpoint(
  pool: Pool,
  input: { workspaceId: string; sourceTaskId: string },
): Promise<PersistedSourceDiscoveryCheckpoint | null> {
  if (typeof input.workspaceId !== 'string' || input.workspaceId.length === 0) throw inputError('workspaceId is required.');
  assertIdentifier(input.sourceTaskId, 'sourceTaskId');
  const result = await pool.query<CheckpointRow>(
    `SELECT ${returningColumns}
     FROM source_discovery_checkpoints
     WHERE workspace_id = $1::uuid AND source_task_id = $2`,
    [input.workspaceId, input.sourceTaskId],
  );
  const row = result.rows[0];
  return row ? rowToCheckpoint(row) : null;
}

export async function requireSourceDiscoveryCheckpoint(
  pool: Pool,
  input: { workspaceId: string; sourceTaskId: string },
): Promise<PersistedSourceDiscoveryCheckpoint> {
  const checkpoint = await getSourceDiscoveryCheckpoint(pool, input);
  if (!checkpoint) {
    throw new SourceDiscoveryCheckpointPersistenceError(
      'SOURCE_DISCOVERY_CHECKPOINT_NOT_FOUND',
      `No discovery checkpoint exists for source task ${input.sourceTaskId}.`,
    );
  }
  return checkpoint;
}
