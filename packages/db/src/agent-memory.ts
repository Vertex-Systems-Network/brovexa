import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { withPgTransaction } from './client';
import type { AgentRunStatus, MemoryType } from './agent-schema';

export type AgentMemoryErrorCode =
  | 'WORKSPACE_NOT_ACTIVE'
  | 'REQUESTER_NOT_ACTIVE'
  | 'AGENT_RUN_NOT_FOUND'
  | 'INVALID_RUN_TRANSITION'
  | 'INVALID_NAMESPACE_PREFIX';

export class AgentMemoryError extends Error {
  readonly code: AgentMemoryErrorCode;

  constructor(code: AgentMemoryErrorCode, message: string) {
    super(message);
    this.name = 'AgentMemoryError';
    this.code = code;
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function hashStructuredValue(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

export interface CreateAgentRunInput {
  workspaceId: string;
  requestedByMembershipId: string | null;
  parentRunId: string | null;
  agentKey: string;
  agentVersion: number;
  definitionHash: string;
  correlationId?: string;
  input: Record<string, unknown>;
}

export interface AgentRunRecord {
  id: string;
  workspaceId: string;
  agentKey: string;
  agentVersion: number;
  definitionHash: string;
  status: AgentRunStatus;
  correlationId: string;
}

async function assertRunRequester(
  client: PoolClient,
  workspaceId: string,
  membershipId: string | null,
): Promise<void> {
  const workspace = await client.query<{ active: boolean }>(
    `SELECT status = 'active' AS active FROM workspaces WHERE id = $1`,
    [workspaceId],
  );
  if (workspace.rows[0]?.active !== true) {
    throw new AgentMemoryError('WORKSPACE_NOT_ACTIVE', 'Agent runs require an active workspace.');
  }

  if (!membershipId) return;

  const requester = await client.query<{ active: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM workspace_memberships AS wm
       INNER JOIN users AS u ON u.id = wm.user_id
       WHERE wm.id = $1
         AND wm.workspace_id = $2
         AND wm.status = 'active'
         AND u.status = 'active'
     ) AS active`,
    [membershipId, workspaceId],
  );
  if (requester.rows[0]?.active !== true) {
    throw new AgentMemoryError(
      'REQUESTER_NOT_ACTIVE',
      'Agent runs require an active requester membership when a requester is supplied.',
    );
  }
}

export async function createAgentRun(pool: Pool, input: CreateAgentRunInput): Promise<AgentRunRecord> {
  return withPgTransaction(pool, async (client) => {
    await assertRunRequester(client, input.workspaceId, input.requestedByMembershipId);

    const result = await client.query<{
      id: string;
      workspace_id: string;
      agent_key: string;
      agent_version: number;
      definition_hash: string;
      status: AgentRunStatus;
      correlation_id: string;
    }>(
      `INSERT INTO agent_runs (
         workspace_id,
         parent_run_id,
         requested_by_membership_id,
         agent_key,
         agent_version,
         definition_hash,
         correlation_id,
         input
       ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::uuid, gen_random_uuid()), $8::jsonb)
       RETURNING id, workspace_id, agent_key, agent_version, definition_hash, status, correlation_id`,
      [
        input.workspaceId,
        input.parentRunId,
        input.requestedByMembershipId,
        input.agentKey,
        input.agentVersion,
        input.definitionHash,
        input.correlationId ?? null,
        JSON.stringify(input.input),
      ],
    );

    const row = result.rows[0];
    if (!row) throw new Error('Agent run insert returned no row.');
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      agentKey: row.agent_key,
      agentVersion: row.agent_version,
      definitionHash: row.definition_hash,
      status: row.status,
      correlationId: row.correlation_id,
    };
  });
}

const runTransitions: Readonly<Record<AgentRunStatus, readonly AgentRunStatus[]>> = {
  pending: ['running', 'cancelled'],
  running: ['paused', 'review', 'succeeded', 'failed', 'cancelled'],
  paused: ['running', 'cancelled'],
  review: ['running', 'succeeded', 'failed', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export async function transitionAgentRunStatus(
  pool: Pool,
  input: { workspaceId: string; agentRunId: string; nextStatus: AgentRunStatus },
): Promise<AgentRunStatus> {
  return withPgTransaction(pool, async (client) => {
    const current = await client.query<{ status: AgentRunStatus }>(
      `SELECT status FROM agent_runs WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
      [input.agentRunId, input.workspaceId],
    );
    const status = current.rows[0]?.status;
    if (!status) throw new AgentMemoryError('AGENT_RUN_NOT_FOUND', 'Agent run not found in workspace.');
    if (!runTransitions[status].includes(input.nextStatus)) {
      throw new AgentMemoryError(
        'INVALID_RUN_TRANSITION',
        `Agent run cannot transition from ${status} to ${input.nextStatus}.`,
      );
    }

    const startedAt = input.nextStatus === 'running' && status === 'pending' ? 'now()' : 'started_at';
    const completedAt = ['succeeded', 'failed', 'cancelled'].includes(input.nextStatus)
      ? 'now()'
      : 'completed_at';
    await client.query(
      `UPDATE agent_runs
       SET status = $3,
           started_at = ${startedAt},
           completed_at = ${completedAt},
           updated_at = now()
       WHERE id = $1 AND workspace_id = $2`,
      [input.agentRunId, input.workspaceId, input.nextStatus],
    );
    return input.nextStatus;
  });
}

export interface AgentCheckpointRecord {
  id: string;
  sequence: number;
  checkpointKey: string;
  stateHash: string;
}

export async function appendAgentCheckpoint(
  pool: Pool,
  input: {
    workspaceId: string;
    agentRunId: string;
    checkpointKey: string;
    state: Record<string, unknown>;
  },
): Promise<AgentCheckpointRecord> {
  return withPgTransaction(pool, async (client) => {
    const run = await client.query<{ id: string }>(
      `SELECT id FROM agent_runs WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
      [input.agentRunId, input.workspaceId],
    );
    if (!run.rows[0]) throw new AgentMemoryError('AGENT_RUN_NOT_FOUND', 'Agent run not found in workspace.');

    const stateHash = hashStructuredValue(input.state);
    const existing = await client.query<{
      id: string;
      sequence: number;
      checkpoint_key: string;
      state_hash: string;
    }>(
      `SELECT id, sequence, checkpoint_key, state_hash
       FROM agent_checkpoints
       WHERE agent_run_id = $1 AND checkpoint_key = $2 AND state_hash = $3`,
      [input.agentRunId, input.checkpointKey, stateHash],
    );
    const existingRow = existing.rows[0];
    if (existingRow) {
      return {
        id: existingRow.id,
        sequence: existingRow.sequence,
        checkpointKey: existingRow.checkpoint_key,
        stateHash: existingRow.state_hash,
      };
    }

    const sequenceResult = await client.query<{ next_sequence: number }>(
      `SELECT COALESCE(MAX(sequence), 0)::int + 1 AS next_sequence
       FROM agent_checkpoints
       WHERE agent_run_id = $1`,
      [input.agentRunId],
    );
    const sequence = sequenceResult.rows[0]?.next_sequence;
    if (!sequence) throw new Error('Unable to allocate agent checkpoint sequence.');

    const inserted = await client.query<{
      id: string;
      sequence: number;
      checkpoint_key: string;
      state_hash: string;
    }>(
      `INSERT INTO agent_checkpoints (
         workspace_id, agent_run_id, sequence, checkpoint_key, state, state_hash
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING id, sequence, checkpoint_key, state_hash`,
      [
        input.workspaceId,
        input.agentRunId,
        sequence,
        input.checkpointKey,
        JSON.stringify(input.state),
        stateHash,
      ],
    );
    const row = inserted.rows[0];
    if (!row) throw new Error('Agent checkpoint insert returned no row.');
    return {
      id: row.id,
      sequence: row.sequence,
      checkpointKey: row.checkpoint_key,
      stateHash: row.state_hash,
    };
  });
}

export interface ProposeMemoryRecordInput {
  workspaceId: string;
  userId: string | null;
  agentRunId: string | null;
  revisionParentId: string | null;
  namespace: string;
  memoryType: MemoryType;
  subtype: string;
  authorityClass: number;
  content: Record<string, unknown>;
  provenance: Record<string, unknown>;
  writerKind: 'user' | 'agent' | 'curator';
  writerAgentKey: string | null;
  writerAgentVersion: number | null;
  confidenceBps: number;
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  observedAt: Date | null;
  refreshAfter: Date | null;
  expiresAt: Date | null;
}

export async function proposeMemoryRecord(
  pool: Pool,
  input: ProposeMemoryRecordInput,
): Promise<{ id: string; status: 'proposed' }> {
  const result = await pool.query<{ id: string; status: 'proposed' }>(
    `INSERT INTO memory_records (
       workspace_id,
       user_id,
       agent_run_id,
       revision_parent_id,
       namespace,
       memory_type,
       subtype,
       status,
       authority_class,
       content,
       provenance,
       writer_kind,
       writer_agent_key,
       writer_agent_version,
       confidence_bps,
       data_classification,
       observed_at,
       refresh_after,
       expires_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, 'proposed', $8, $9::jsonb, $10::jsonb,
       $11, $12, $13, $14, $15, $16, $17, $18
     ) RETURNING id, status`,
    [
      input.workspaceId,
      input.userId,
      input.agentRunId,
      input.revisionParentId,
      input.namespace,
      input.memoryType,
      input.subtype,
      input.authorityClass,
      JSON.stringify(input.content),
      JSON.stringify(input.provenance),
      input.writerKind,
      input.writerAgentKey,
      input.writerAgentVersion,
      input.confidenceBps,
      input.dataClassification,
      input.observedAt,
      input.refreshAfter,
      input.expiresAt,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Memory proposal insert returned no row.');
  return row;
}

const namespacePrefixPattern = /^[a-z0-9._/-]+$/;

export interface ActiveMemoryContextRow {
  id: string;
  namespace: string;
  memoryType: MemoryType;
  subtype: string;
  authorityClass: number;
  confidenceBps: number;
  observedAt: Date | null;
  expiresAt: Date | null;
}

export async function listActiveMemoryForContext(
  pool: Pool,
  input: {
    workspaceId: string;
    userId: string | null;
    namespacePrefixes: readonly string[];
    memoryTypes: readonly MemoryType[];
    limit?: number;
    now?: Date;
  },
): Promise<readonly ActiveMemoryContextRow[]> {
  for (const prefix of input.namespacePrefixes) {
    if (!namespacePrefixPattern.test(prefix) || prefix.includes('..')) {
      throw new AgentMemoryError('INVALID_NAMESPACE_PREFIX', `Unsafe memory namespace prefix: ${prefix}`);
    }
  }

  const limit = Math.min(Math.max(input.limit ?? 128, 1), 256);
  const now = input.now ?? new Date();
  const result = await pool.query<{
    id: string;
    namespace: string;
    memory_type: MemoryType;
    subtype: string;
    authority_class: number;
    confidence_bps: number;
    observed_at: Date | null;
    expires_at: Date | null;
  }>(
    `SELECT
       mr.id,
       mr.namespace,
       mr.memory_type,
       mr.subtype,
       mr.authority_class,
       mr.confidence_bps,
       mr.observed_at,
       mr.expires_at
     FROM memory_records AS mr
     WHERE mr.workspace_id = $1
       AND mr.status = 'active'
       AND (mr.user_id IS NULL OR mr.user_id = $2::uuid)
       AND (mr.expires_at IS NULL OR mr.expires_at > $3)
       AND mr.memory_type = ANY($4::text[])
       AND (
         cardinality($5::text[]) = 0
         OR EXISTS (
           SELECT 1 FROM unnest($5::text[]) AS prefix
           WHERE mr.namespace LIKE prefix || '%'
         )
       )
       AND NOT EXISTS (
         SELECT 1
         FROM memory_conflicts AS mc
         WHERE mc.workspace_id = mr.workspace_id
           AND mc.status = 'open'
           AND (mc.left_memory_id = mr.id OR mc.right_memory_id = mr.id)
       )
     ORDER BY mr.authority_class ASC, mr.confidence_bps DESC, mr.updated_at DESC, mr.id ASC
     LIMIT $6`,
    [
      input.workspaceId,
      input.userId,
      now,
      [...input.memoryTypes],
      [...input.namespacePrefixes],
      limit,
    ],
  );

  return result.rows.map((row) => ({
    id: row.id,
    namespace: row.namespace,
    memoryType: row.memory_type,
    subtype: row.subtype,
    authorityClass: row.authority_class,
    confidenceBps: row.confidence_bps,
    observedAt: row.observed_at,
    expiresAt: row.expires_at,
  }));
}

export async function persistContextReceipt(
  pool: Pool,
  input: {
    workspaceId: string;
    agentRunId: string;
    agentKey: string;
    agentVersion: number;
    contextVersion: number;
    tokenBudget: number;
    selectedTokenCost: number;
    selectedItems: readonly Record<string, unknown>[];
    selectionDigest: string;
  },
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO context_receipts (
       workspace_id,
       agent_run_id,
       agent_key,
       agent_version,
       context_version,
       token_budget,
       selected_token_cost,
       selected_items,
       selection_digest
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
     RETURNING id`,
    [
      input.workspaceId,
      input.agentRunId,
      input.agentKey,
      input.agentVersion,
      input.contextVersion,
      input.tokenBudget,
      input.selectedTokenCost,
      JSON.stringify(input.selectedItems),
      input.selectionDigest,
    ],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error('Context receipt insert returned no row.');
  return id;
}
