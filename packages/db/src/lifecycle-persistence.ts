import type { Pool } from 'pg';
import { AgentPersistenceConflictError } from './agent-persistence';
import type { LifecycleActorType } from './agent-lifecycle-schema';
import type { PersistedAgentRunStatus } from './agent-run-schema';
import { withPgTransaction } from './client';
import { persistMemoryRecord, type PersistMemoryRecordInput } from './memory-eval-persistence';
import type { PersistedMemoryStatus } from './memory-record-schema';

const terminalAgentRunStatuses = new Set<PersistedAgentRunStatus>([
  'succeeded',
  'failed',
  'budget_stopped',
  'cancelled',
]);

const supersedableMemoryStatuses = new Set<PersistedMemoryStatus>(['active', 'stale', 'conflicted']);

export interface TransitionAgentRunInput {
  transitionId: string;
  workspaceId: string;
  runId: string;
  fromStatus: PersistedAgentRunStatus;
  toStatus: PersistedAgentRunStatus;
  reasonCode: string;
  actorType: LifecycleActorType;
  actorId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  occurredAt: Date;
}

export interface AgentRunTransitionRecord {
  id: string;
  workspaceId: string;
  runId: string;
  fromStatus: PersistedAgentRunStatus;
  toStatus: PersistedAgentRunStatus;
  reasonCode: string;
  actorType: LifecycleActorType;
  actorId: string | null;
  metadata: Record<string, unknown>;
  occurredAt: Date;
}

interface MemoryLifecycleBaseInput {
  eventId: string;
  workspaceId: string;
  memoryId: string;
  reason: string;
  actorType: LifecycleActorType;
  actorId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  occurredAt: Date;
}

export interface SupersedeMemoryRecordInput extends MemoryLifecycleBaseInput {
  successor: PersistMemoryRecordInput;
}

export type DeleteMemoryRecordInput = MemoryLifecycleBaseInput;

export interface MemoryLifecycleRecord {
  id: string;
  workspaceId: string;
  memoryId: string;
  eventType: 'status_changed' | 'superseded' | 'deleted';
  fromStatus: PersistedMemoryStatus;
  toStatus: PersistedMemoryStatus;
  successorMemoryId: string | null;
  reason: string;
  actorType: LifecycleActorType;
  actorId: string | null;
  metadata: Record<string, unknown>;
  occurredAt: Date;
}

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) throw new RangeError(`${field} must be non-empty.`);
}

function assertValidDate(value: Date, field: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new RangeError(`${field} must be a valid Date.`);
  }
}

function updatedRunEnvelope(
  envelope: Record<string, unknown>,
  status: PersistedAgentRunStatus,
  startedAt: Date | null,
  completedAt: Date | null,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...envelope, status };
  if (startedAt) next.startedAt = startedAt.toISOString();
  if (completedAt) next.completedAt = completedAt.toISOString();
  else delete next.completedAt;
  return next;
}

function updatedMemoryEnvelope(
  envelope: Record<string, unknown>,
  status: PersistedMemoryStatus,
  occurredAt: Date,
  deletionReason?: string,
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...envelope,
    status,
    updatedAt: occurredAt.toISOString(),
  };
  if (status === 'deleted') next.deletionReason = deletionReason;
  else delete next.deletionReason;
  return next;
}

export async function transitionAgentRun(pool: Pool, input: TransitionAgentRunInput): Promise<string> {
  assertNonEmpty(input.transitionId, 'transitionId');
  assertNonEmpty(input.workspaceId, 'workspaceId');
  assertNonEmpty(input.runId, 'runId');
  assertNonEmpty(input.reasonCode, 'reasonCode');
  assertValidDate(input.occurredAt, 'occurredAt');

  if (input.fromStatus === input.toStatus) {
    throw new AgentPersistenceConflictError(
      'AGENT_RUN_NOOP_TRANSITION',
      `Agent run ${input.runId} cannot transition from ${input.fromStatus} to itself.`,
    );
  }

  if (terminalAgentRunStatuses.has(input.fromStatus)) {
    throw new AgentPersistenceConflictError(
      'AGENT_RUN_TERMINAL',
      `Agent run ${input.runId} is terminal in status ${input.fromStatus}.`,
    );
  }

  const metadata = input.metadata ?? {};

  return withPgTransaction(pool, async (client) => {
    const existing = await client.query<{ same_transition: boolean }>(
      `SELECT
         workspace_id = $2::uuid
           AND run_id = $3
           AND from_status = $4
           AND to_status = $5
           AND reason_code = $6
           AND actor_type = $7
           AND actor_id IS NOT DISTINCT FROM $8::text
           AND metadata = $9::jsonb
           AND occurred_at = $10::timestamptz AS same_transition
       FROM agent_run_transitions
       WHERE id = $1`,
      [
        input.transitionId,
        input.workspaceId,
        input.runId,
        input.fromStatus,
        input.toStatus,
        input.reasonCode,
        input.actorType,
        input.actorId ?? null,
        JSON.stringify(metadata),
        input.occurredAt,
      ],
    );

    if (existing.rows[0]) {
      if (!existing.rows[0].same_transition) {
        throw new AgentPersistenceConflictError(
          'AGENT_RUN_TRANSITION_ID_CONFLICT',
          `AgentRun transition ${input.transitionId} already exists with different content or scope.`,
        );
      }

      const projected = await client.query<{ status: PersistedAgentRunStatus; last_transition_id: string | null }>(
        `SELECT status, last_transition_id
         FROM agent_runs
         WHERE workspace_id = $1 AND id = $2`,
        [input.workspaceId, input.runId],
      );
      if (
        projected.rows[0]?.status !== input.toStatus ||
        projected.rows[0]?.last_transition_id !== input.transitionId
      ) {
        throw new AgentPersistenceConflictError(
          'AGENT_RUN_TRANSITION_PROJECTION_MISMATCH',
          `AgentRun transition ${input.transitionId} exists without its canonical projection.`,
        );
      }
      return input.transitionId;
    }

    const current = await client.query<{
      status: PersistedAgentRunStatus;
      envelope: Record<string, unknown>;
      started_at: Date | null;
      completed_at: Date | null;
      updated_at: Date;
    }>(
      `SELECT status, envelope, started_at, completed_at, updated_at
       FROM agent_runs
       WHERE workspace_id = $1 AND id = $2
       FOR UPDATE`,
      [input.workspaceId, input.runId],
    );

    const run = current.rows[0];
    if (!run) {
      throw new AgentPersistenceConflictError(
        'AGENT_RUN_NOT_FOUND',
        `Agent run ${input.runId} does not exist in workspace ${input.workspaceId}.`,
      );
    }
    if (run.status !== input.fromStatus) {
      throw new AgentPersistenceConflictError(
        'AGENT_RUN_STATUS_CONFLICT',
        `Agent run ${input.runId} is ${run.status}, not expected ${input.fromStatus}.`,
      );
    }
    if (terminalAgentRunStatuses.has(run.status)) {
      throw new AgentPersistenceConflictError(
        'AGENT_RUN_TERMINAL',
        `Agent run ${input.runId} is terminal in status ${run.status}.`,
      );
    }
    if (input.occurredAt < run.updated_at) {
      throw new AgentPersistenceConflictError(
        'AGENT_RUN_TRANSITION_TIME_REGRESSION',
        `Agent run ${input.runId} transition time precedes its current projection.`,
      );
    }

    let startedAt = run.started_at;
    if (!startedAt && (input.toStatus === 'running' || terminalAgentRunStatuses.has(input.toStatus))) {
      startedAt = input.occurredAt;
    }
    const completedAt = terminalAgentRunStatuses.has(input.toStatus) ? input.occurredAt : null;
    const envelope = updatedRunEnvelope(run.envelope, input.toStatus, startedAt, completedAt);

    await client.query(
      `INSERT INTO agent_run_transitions (
         id, workspace_id, run_id, from_status, to_status, reason_code,
         actor_type, actor_id, metadata, occurred_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
      [
        input.transitionId,
        input.workspaceId,
        input.runId,
        input.fromStatus,
        input.toStatus,
        input.reasonCode,
        input.actorType,
        input.actorId ?? null,
        JSON.stringify(metadata),
        input.occurredAt,
      ],
    );

    await client.query(
      `UPDATE agent_runs
       SET status = $3,
           last_transition_id = $4,
           envelope = $5::jsonb,
           started_at = $6,
           completed_at = $7,
           updated_at = $8
       WHERE workspace_id = $1 AND id = $2`,
      [
        input.workspaceId,
        input.runId,
        input.toStatus,
        input.transitionId,
        JSON.stringify(envelope),
        startedAt,
        completedAt,
        input.occurredAt,
      ],
    );

    return input.transitionId;
  });
}

export async function getAgentRunTransitionHistory(
  pool: Pool,
  workspaceId: string,
  runId: string,
): Promise<AgentRunTransitionRecord[]> {
  const result = await pool.query<{
    id: string;
    workspace_id: string;
    run_id: string;
    from_status: PersistedAgentRunStatus;
    to_status: PersistedAgentRunStatus;
    reason_code: string;
    actor_type: LifecycleActorType;
    actor_id: string | null;
    metadata: Record<string, unknown>;
    occurred_at: Date;
  }>(
    `SELECT id, workspace_id, run_id, from_status, to_status, reason_code,
            actor_type, actor_id, metadata, occurred_at
     FROM agent_run_transitions
     WHERE workspace_id = $1 AND run_id = $2
     ORDER BY occurred_at ASC, id ASC`,
    [workspaceId, runId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    runId: row.run_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    reasonCode: row.reason_code,
    actorType: row.actor_type,
    actorId: row.actor_id,
    metadata: row.metadata,
    occurredAt: row.occurred_at,
  }));
}

export async function supersedeMemoryRecord(
  pool: Pool,
  input: SupersedeMemoryRecordInput,
): Promise<string> {
  assertNonEmpty(input.eventId, 'eventId');
  assertNonEmpty(input.workspaceId, 'workspaceId');
  assertNonEmpty(input.memoryId, 'memoryId');
  assertNonEmpty(input.reason, 'reason');
  assertValidDate(input.occurredAt, 'occurredAt');

  if (input.successor.workspaceId !== input.workspaceId) {
    throw new AgentPersistenceConflictError(
      'MEMORY_SUCCESSOR_WORKSPACE_CONFLICT',
      'Successor memory must remain in the same workspace.',
    );
  }
  if (input.successor.id === input.memoryId || input.successor.revisionParentId !== input.memoryId) {
    throw new AgentPersistenceConflictError(
      'MEMORY_SUCCESSOR_LINEAGE_CONFLICT',
      'Successor memory must be a distinct direct revision of the memory being superseded.',
    );
  }
  if (input.successor.status !== 'active' || input.successor.deletionReason) {
    throw new AgentPersistenceConflictError(
      'MEMORY_SUCCESSOR_STATE_CONFLICT',
      'Successor memory must enter the lifecycle as active and non-deleted.',
    );
  }

  const metadata = input.metadata ?? {};

  return withPgTransaction(pool, async (client) => {
    const existing = await client.query<{ same_event: boolean }>(
      `SELECT
         workspace_id = $2::uuid
           AND memory_id = $3
           AND event_type = 'superseded'
           AND successor_memory_id = $4
           AND reason = $5
           AND actor_type = $6
           AND actor_id IS NOT DISTINCT FROM $7::text
           AND metadata = $8::jsonb
           AND occurred_at = $9::timestamptz AS same_event
       FROM memory_record_lifecycle_events
       WHERE id = $1`,
      [
        input.eventId,
        input.workspaceId,
        input.memoryId,
        input.successor.id,
        input.reason,
        input.actorType,
        input.actorId ?? null,
        JSON.stringify(metadata),
        input.occurredAt,
      ],
    );

    if (existing.rows[0]) {
      if (!existing.rows[0].same_event) {
        throw new AgentPersistenceConflictError(
          'MEMORY_LIFECYCLE_EVENT_ID_CONFLICT',
          `Memory lifecycle event ${input.eventId} already exists with different content or scope.`,
        );
      }
      const projected = await client.query<{ status: PersistedMemoryStatus; last_lifecycle_event_id: string | null }>(
        `SELECT status, last_lifecycle_event_id
         FROM memory_records
         WHERE workspace_id = $1 AND id = $2`,
        [input.workspaceId, input.memoryId],
      );
      if (
        projected.rows[0]?.status !== 'superseded' ||
        projected.rows[0]?.last_lifecycle_event_id !== input.eventId
      ) {
        throw new AgentPersistenceConflictError(
          'MEMORY_LIFECYCLE_PROJECTION_MISMATCH',
          `Memory lifecycle event ${input.eventId} exists without its canonical projection.`,
        );
      }
      return input.successor.id;
    }

    const current = await client.query<{
      status: PersistedMemoryStatus;
      envelope: Record<string, unknown>;
      updated_at: Date;
    }>(
      `SELECT status, envelope, updated_at
       FROM memory_records
       WHERE workspace_id = $1 AND id = $2
       FOR UPDATE`,
      [input.workspaceId, input.memoryId],
    );

    const memory = current.rows[0];
    if (!memory) {
      throw new AgentPersistenceConflictError(
        'MEMORY_RECORD_NOT_FOUND',
        `Memory record ${input.memoryId} does not exist in workspace ${input.workspaceId}.`,
      );
    }
    if (!supersedableMemoryStatuses.has(memory.status)) {
      throw new AgentPersistenceConflictError(
        'MEMORY_NOT_SUPERSEDABLE',
        `Memory record ${input.memoryId} cannot be superseded from status ${memory.status}.`,
      );
    }
    if (input.occurredAt < memory.updated_at) {
      throw new AgentPersistenceConflictError(
        'MEMORY_LIFECYCLE_TIME_REGRESSION',
        `Memory lifecycle event ${input.eventId} precedes the current memory projection.`,
      );
    }

    await persistMemoryRecord(client, input.successor);

    await client.query(
      `INSERT INTO memory_record_lifecycle_events (
         id, workspace_id, memory_id, event_type, from_status, to_status,
         successor_memory_id, reason, actor_type, actor_id, metadata, occurred_at
       ) VALUES ($1, $2, $3, 'superseded', $4, 'superseded', $5, $6, $7, $8, $9::jsonb, $10)`,
      [
        input.eventId,
        input.workspaceId,
        input.memoryId,
        memory.status,
        input.successor.id,
        input.reason,
        input.actorType,
        input.actorId ?? null,
        JSON.stringify(metadata),
        input.occurredAt,
      ],
    );

    const envelope = updatedMemoryEnvelope(memory.envelope, 'superseded', input.occurredAt);
    await client.query(
      `UPDATE memory_records
       SET status = 'superseded',
           deletion_reason = NULL,
           last_lifecycle_event_id = $3,
           envelope = $4::jsonb,
           updated_at = $5
       WHERE workspace_id = $1 AND id = $2`,
      [input.workspaceId, input.memoryId, input.eventId, JSON.stringify(envelope), input.occurredAt],
    );

    return input.successor.id;
  });
}

export async function deleteMemoryRecord(
  pool: Pool,
  input: DeleteMemoryRecordInput,
): Promise<string> {
  assertNonEmpty(input.eventId, 'eventId');
  assertNonEmpty(input.workspaceId, 'workspaceId');
  assertNonEmpty(input.memoryId, 'memoryId');
  assertNonEmpty(input.reason, 'reason');
  assertValidDate(input.occurredAt, 'occurredAt');
  const metadata = input.metadata ?? {};

  return withPgTransaction(pool, async (client) => {
    const existing = await client.query<{ same_event: boolean }>(
      `SELECT
         workspace_id = $2::uuid
           AND memory_id = $3
           AND event_type = 'deleted'
           AND successor_memory_id IS NULL
           AND reason = $4
           AND actor_type = $5
           AND actor_id IS NOT DISTINCT FROM $6::text
           AND metadata = $7::jsonb
           AND occurred_at = $8::timestamptz AS same_event
       FROM memory_record_lifecycle_events
       WHERE id = $1`,
      [
        input.eventId,
        input.workspaceId,
        input.memoryId,
        input.reason,
        input.actorType,
        input.actorId ?? null,
        JSON.stringify(metadata),
        input.occurredAt,
      ],
    );

    if (existing.rows[0]) {
      if (!existing.rows[0].same_event) {
        throw new AgentPersistenceConflictError(
          'MEMORY_LIFECYCLE_EVENT_ID_CONFLICT',
          `Memory lifecycle event ${input.eventId} already exists with different content or scope.`,
        );
      }
      const projected = await client.query<{ status: PersistedMemoryStatus; last_lifecycle_event_id: string | null }>(
        `SELECT status, last_lifecycle_event_id
         FROM memory_records
         WHERE workspace_id = $1 AND id = $2`,
        [input.workspaceId, input.memoryId],
      );
      if (
        projected.rows[0]?.status !== 'deleted' ||
        projected.rows[0]?.last_lifecycle_event_id !== input.eventId
      ) {
        throw new AgentPersistenceConflictError(
          'MEMORY_LIFECYCLE_PROJECTION_MISMATCH',
          `Memory lifecycle event ${input.eventId} exists without its canonical projection.`,
        );
      }
      return input.memoryId;
    }

    const current = await client.query<{
      status: PersistedMemoryStatus;
      envelope: Record<string, unknown>;
      updated_at: Date;
    }>(
      `SELECT status, envelope, updated_at
       FROM memory_records
       WHERE workspace_id = $1 AND id = $2
       FOR UPDATE`,
      [input.workspaceId, input.memoryId],
    );

    const memory = current.rows[0];
    if (!memory) {
      throw new AgentPersistenceConflictError(
        'MEMORY_RECORD_NOT_FOUND',
        `Memory record ${input.memoryId} does not exist in workspace ${input.workspaceId}.`,
      );
    }
    if (memory.status === 'deleted' || memory.status === 'superseded') {
      throw new AgentPersistenceConflictError(
        'MEMORY_TERMINAL',
        `Memory record ${input.memoryId} is already terminal in status ${memory.status}.`,
      );
    }
    if (input.occurredAt < memory.updated_at) {
      throw new AgentPersistenceConflictError(
        'MEMORY_LIFECYCLE_TIME_REGRESSION',
        `Memory lifecycle event ${input.eventId} precedes the current memory projection.`,
      );
    }

    await client.query(
      `INSERT INTO memory_record_lifecycle_events (
         id, workspace_id, memory_id, event_type, from_status, to_status,
         successor_memory_id, reason, actor_type, actor_id, metadata, occurred_at
       ) VALUES ($1, $2, $3, 'deleted', $4, 'deleted', NULL, $5, $6, $7, $8::jsonb, $9)`,
      [
        input.eventId,
        input.workspaceId,
        input.memoryId,
        memory.status,
        input.reason,
        input.actorType,
        input.actorId ?? null,
        JSON.stringify(metadata),
        input.occurredAt,
      ],
    );

    const envelope = updatedMemoryEnvelope(memory.envelope, 'deleted', input.occurredAt, input.reason);
    await client.query(
      `UPDATE memory_records
       SET status = 'deleted',
           deletion_reason = $3,
           last_lifecycle_event_id = $4,
           envelope = $5::jsonb,
           updated_at = $6
       WHERE workspace_id = $1 AND id = $2`,
      [
        input.workspaceId,
        input.memoryId,
        input.reason,
        input.eventId,
        JSON.stringify(envelope),
        input.occurredAt,
      ],
    );

    return input.memoryId;
  });
}

export async function getMemoryLifecycleHistory(
  pool: Pool,
  workspaceId: string,
  memoryId: string,
): Promise<MemoryLifecycleRecord[]> {
  const result = await pool.query<{
    id: string;
    workspace_id: string;
    memory_id: string;
    event_type: 'status_changed' | 'superseded' | 'deleted';
    from_status: PersistedMemoryStatus;
    to_status: PersistedMemoryStatus;
    successor_memory_id: string | null;
    reason: string;
    actor_type: LifecycleActorType;
    actor_id: string | null;
    metadata: Record<string, unknown>;
    occurred_at: Date;
  }>(
    `SELECT id, workspace_id, memory_id, event_type, from_status, to_status,
            successor_memory_id, reason, actor_type, actor_id, metadata, occurred_at
     FROM memory_record_lifecycle_events
     WHERE workspace_id = $1 AND memory_id = $2
     ORDER BY occurred_at ASC, id ASC`,
    [workspaceId, memoryId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    memoryId: row.memory_id,
    eventType: row.event_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    successorMemoryId: row.successor_memory_id,
    reason: row.reason,
    actorType: row.actor_type,
    actorId: row.actor_id,
    metadata: row.metadata,
    occurredAt: row.occurred_at,
  }));
}
