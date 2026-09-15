import type { Pool, PoolClient } from 'pg';
import { withPgTransaction } from './client';
import {
  researchJobControlStateValues,
  type ResearchJobControlState,
} from './research-job-control-schema';

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/;
const reasonCodePattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/;
const controlStates = new Set<ResearchJobControlState>(researchJobControlStateValues);

export interface PersistedResearchJobControl {
  researchJobId: string;
  workspaceId: string;
  version: number;
  state: ResearchJobControlState;
  reasonCode: string | null;
  changedAt: Date;
  createdAt: Date;
}

export interface TransitionResearchJobControlInput {
  workspaceId: string;
  researchJobId: string;
  expectedVersion: number;
  targetState: ResearchJobControlState;
  reasonCode?: string | null;
  changedAt: Date;
}

export type ResearchJobControlPersistenceErrorCode =
  | 'RESEARCH_JOB_CONTROL_INPUT_INVALID'
  | 'RESEARCH_JOB_CONTROL_NOT_FOUND'
  | 'RESEARCH_JOB_CONTROL_VERSION_CONFLICT'
  | 'RESEARCH_JOB_CONTROL_INVALID_TRANSITION'
  | 'RESEARCH_JOB_CONTROL_TIME_REGRESSION';

export class ResearchJobControlPersistenceError extends Error {
  constructor(
    readonly code: ResearchJobControlPersistenceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ResearchJobControlPersistenceError';
  }
}

interface ResearchJobControlRow {
  research_job_id: string;
  workspace_id: string;
  version: number;
  state: ResearchJobControlState;
  reason_code: string | null;
  changed_at: Date;
  created_at: Date;
}

function error(
  code: ResearchJobControlPersistenceErrorCode,
  message: string,
): ResearchJobControlPersistenceError {
  return new ResearchJobControlPersistenceError(code, message);
}

function assertIdentifier(value: string, field: string): void {
  if (typeof value !== 'string' || !identifierPattern.test(value)) {
    throw error(
      'RESEARCH_JOB_CONTROL_INPUT_INVALID',
      `${field} must use the canonical identifier format.`,
    );
  }
}

function assertVersion(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw error(
      'RESEARCH_JOB_CONTROL_INPUT_INVALID',
      'expectedVersion must be a positive safe integer.',
    );
  }
}

function assertChangedAt(value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw error('RESEARCH_JOB_CONTROL_INPUT_INVALID', 'changedAt must be a valid Date.');
  }
}

function normalizeReasonCode(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !reasonCodePattern.test(value)) {
    throw error(
      'RESEARCH_JOB_CONTROL_INPUT_INVALID',
      'reasonCode must use the canonical identifier format when provided.',
    );
  }
  return value;
}

function assertState(value: ResearchJobControlState): void {
  if (!controlStates.has(value)) {
    throw error('RESEARCH_JOB_CONTROL_INPUT_INVALID', `Unsupported control state: ${value}.`);
  }
}

function rowToControl(row: ResearchJobControlRow): PersistedResearchJobControl {
  return {
    researchJobId: row.research_job_id,
    workspaceId: row.workspace_id,
    version: row.version,
    state: row.state,
    reasonCode: row.reason_code,
    changedAt: row.changed_at,
    createdAt: row.created_at,
  };
}

function transitionAllowed(
  current: ResearchJobControlState,
  target: ResearchJobControlState,
): boolean {
  if (current === 'active') {
    return target === 'paused' || target === 'cancelled' || target === 'killed';
  }
  if (current === 'paused') {
    return target === 'active' || target === 'cancelled' || target === 'killed';
  }
  return false;
}

async function getControlWithClient(
  client: PoolClient,
  workspaceId: string,
  researchJobId: string,
  forUpdate = false,
): Promise<PersistedResearchJobControl | null> {
  const result = await client.query<ResearchJobControlRow>(
    `SELECT research_job_id, workspace_id, version, state, reason_code, changed_at, created_at
     FROM research_job_controls
     WHERE workspace_id = $1::uuid AND research_job_id = $2
     ${forUpdate ? 'FOR UPDATE' : ''}`,
    [workspaceId, researchJobId],
  );
  return result.rows[0] ? rowToControl(result.rows[0]) : null;
}

export async function getResearchJobControl(
  pool: Pool,
  workspaceId: string,
  researchJobId: string,
): Promise<PersistedResearchJobControl | null> {
  assertIdentifier(workspaceId, 'workspaceId');
  assertIdentifier(researchJobId, 'researchJobId');
  const result = await pool.query<ResearchJobControlRow>(
    `SELECT research_job_id, workspace_id, version, state, reason_code, changed_at, created_at
     FROM research_job_controls
     WHERE workspace_id = $1::uuid AND research_job_id = $2`,
    [workspaceId, researchJobId],
  );
  return result.rows[0] ? rowToControl(result.rows[0]) : null;
}

export async function transitionResearchJobControl(
  pool: Pool,
  input: TransitionResearchJobControlInput,
): Promise<PersistedResearchJobControl> {
  assertIdentifier(input.workspaceId, 'workspaceId');
  assertIdentifier(input.researchJobId, 'researchJobId');
  assertVersion(input.expectedVersion);
  assertState(input.targetState);
  assertChangedAt(input.changedAt);
  const reasonCode = normalizeReasonCode(input.reasonCode);

  return withPgTransaction(pool, async (client) => {
    const current = await getControlWithClient(
      client,
      input.workspaceId,
      input.researchJobId,
      true,
    );
    if (!current) {
      throw error(
        'RESEARCH_JOB_CONTROL_NOT_FOUND',
        `Research job control ${input.researchJobId} was not found.`,
      );
    }
    if (current.version !== input.expectedVersion) {
      throw error(
        'RESEARCH_JOB_CONTROL_VERSION_CONFLICT',
        `Research job control ${input.researchJobId} changed; reload before retrying.`,
      );
    }
    if (!transitionAllowed(current.state, input.targetState)) {
      throw error(
        'RESEARCH_JOB_CONTROL_INVALID_TRANSITION',
        `Research job control cannot transition from ${current.state} to ${input.targetState}.`,
      );
    }
    if (input.changedAt.getTime() < current.changedAt.getTime()) {
      throw error(
        'RESEARCH_JOB_CONTROL_TIME_REGRESSION',
        `Research job control ${input.researchJobId} changedAt cannot regress.`,
      );
    }

    const updated = await client.query<ResearchJobControlRow>(
      `UPDATE research_job_controls
       SET version = version + 1,
           state = $4,
           reason_code = $5,
           changed_at = $6
       WHERE workspace_id = $1::uuid
         AND research_job_id = $2
         AND version = $3
       RETURNING research_job_id, workspace_id, version, state, reason_code, changed_at, created_at`,
      [
        input.workspaceId,
        input.researchJobId,
        input.expectedVersion,
        input.targetState,
        reasonCode,
        input.changedAt,
      ],
    );
    const row = updated.rows[0];
    if (!row) {
      throw error(
        'RESEARCH_JOB_CONTROL_VERSION_CONFLICT',
        `Research job control ${input.researchJobId} changed; reload before retrying.`,
      );
    }
    return rowToControl(row);
  });
}
