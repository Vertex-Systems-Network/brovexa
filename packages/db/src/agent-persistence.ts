import type { Pool } from 'pg';
import type { AgentAutonomyTier, AgentDefinitionStatus } from './agent-definition-schema';
import type { AgentExecutionMode, PersistedAgentRunStatus } from './agent-run-schema';

export class AgentPersistenceConflictError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AgentPersistenceConflictError';
    this.code = code;
  }
}

export interface PersistAgentDefinitionInput {
  agentKey: string;
  version: string;
  status: AgentDefinitionStatus;
  autonomyTier: AgentAutonomyTier;
  requiresHumanApproval: boolean;
  specification: Record<string, unknown>;
}

export interface PersistContextReceiptInput {
  id: string;
  workspaceId: string;
  userId?: string | undefined;
  runScopeId?: string | undefined;
  agentDefinitionId: string;
  agentKey: string;
  agentVersion: string;
  receipt: Record<string, unknown>;
  tokenBudget: number;
  maxCurrencyMicros: number;
  createdAt: Date;
}

export interface PersistAgentRunInput {
  id: string;
  workspaceId: string;
  agentDefinitionId: string;
  agentKey: string;
  agentVersion: string;
  contextReceiptId: string;
  parentRunId?: string | undefined;
  handoffId?: string | undefined;
  executionMode: AgentExecutionMode;
  providerId?: string | undefined;
  modelId?: string | undefined;
  status: PersistedAgentRunStatus;
  envelope: Record<string, unknown>;
  startedAt?: Date | undefined;
  completedAt?: Date | undefined;
}

function assertSafeIntegerBudget(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer.`);
  }
}

export async function persistAgentDefinition(
  pool: Pool,
  input: PersistAgentDefinitionInput,
): Promise<string> {
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO agent_definitions (
       agent_key,
       version,
       status,
       autonomy_tier,
       requires_human_approval,
       specification
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (agent_key, version) DO NOTHING
     RETURNING id`,
    [
      input.agentKey,
      input.version,
      input.status,
      input.autonomyTier,
      input.requiresHumanApproval,
      JSON.stringify(input.specification),
    ],
  );

  const insertedId = inserted.rows[0]?.id;
  if (insertedId) return insertedId;

  const existing = await pool.query<{ id: string; same_definition: boolean }>(
    `SELECT
       id,
       status = $3
         AND autonomy_tier = $4
         AND requires_human_approval = $5
         AND specification = $6::jsonb AS same_definition
     FROM agent_definitions
     WHERE agent_key = $1 AND version = $2`,
    [
      input.agentKey,
      input.version,
      input.status,
      input.autonomyTier,
      input.requiresHumanApproval,
      JSON.stringify(input.specification),
    ],
  );

  const row = existing.rows[0];
  if (!row) throw new Error('Agent definition disappeared during idempotent persistence check.');
  if (!row.same_definition) {
    throw new AgentPersistenceConflictError(
      'AGENT_DEFINITION_VERSION_CONFLICT',
      `Agent definition ${input.agentKey}@${input.version} already exists with different content.`,
    );
  }

  return row.id;
}

export async function persistContextReceipt(
  pool: Pool,
  input: PersistContextReceiptInput,
): Promise<string> {
  assertSafeIntegerBudget(input.tokenBudget, 'tokenBudget');
  assertSafeIntegerBudget(input.maxCurrencyMicros, 'maxCurrencyMicros');

  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO agent_context_receipts (
       id,
       workspace_id,
       user_id,
       run_scope_id,
       agent_definition_id,
       agent_key,
       agent_version,
       receipt,
       token_budget,
       max_currency_micros,
       created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [
      input.id,
      input.workspaceId,
      input.userId ?? null,
      input.runScopeId ?? null,
      input.agentDefinitionId,
      input.agentKey,
      input.agentVersion,
      JSON.stringify(input.receipt),
      String(input.tokenBudget),
      String(input.maxCurrencyMicros),
      input.createdAt,
    ],
  );

  if (inserted.rows[0]?.id) return input.id;

  const existing = await pool.query<{ same_receipt: boolean }>(
    `SELECT
       workspace_id = $2::uuid
         AND user_id IS NOT DISTINCT FROM $3::uuid
         AND run_scope_id IS NOT DISTINCT FROM $4::text
         AND agent_definition_id = $5::uuid
         AND agent_key = $6
         AND agent_version = $7
         AND receipt = $8::jsonb
         AND token_budget = $9::bigint
         AND max_currency_micros = $10::bigint
         AND created_at = $11::timestamptz AS same_receipt
     FROM agent_context_receipts
     WHERE id = $1`,
    [
      input.id,
      input.workspaceId,
      input.userId ?? null,
      input.runScopeId ?? null,
      input.agentDefinitionId,
      input.agentKey,
      input.agentVersion,
      JSON.stringify(input.receipt),
      String(input.tokenBudget),
      String(input.maxCurrencyMicros),
      input.createdAt,
    ],
  );

  if (!existing.rows[0]?.same_receipt) {
    throw new AgentPersistenceConflictError(
      'CONTEXT_RECEIPT_ID_CONFLICT',
      `Context receipt ${input.id} already exists with different content or scope.`,
    );
  }

  return input.id;
}

export async function persistAgentRun(pool: Pool, input: PersistAgentRunInput): Promise<string> {
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO agent_runs (
       id,
       workspace_id,
       agent_definition_id,
       agent_key,
       agent_version,
       context_receipt_id,
       parent_run_id,
       handoff_id,
       execution_mode,
       provider_id,
       model_id,
       status,
       envelope,
       started_at,
       completed_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [
      input.id,
      input.workspaceId,
      input.agentDefinitionId,
      input.agentKey,
      input.agentVersion,
      input.contextReceiptId,
      input.parentRunId ?? null,
      input.handoffId ?? null,
      input.executionMode,
      input.providerId ?? null,
      input.modelId ?? null,
      input.status,
      JSON.stringify(input.envelope),
      input.startedAt ?? null,
      input.completedAt ?? null,
    ],
  );

  if (inserted.rows[0]?.id) return input.id;

  const existing = await pool.query<{ same_run: boolean }>(
    `SELECT
       workspace_id = $2::uuid
         AND agent_definition_id = $3::uuid
         AND agent_key = $4
         AND agent_version = $5
         AND context_receipt_id = $6
         AND parent_run_id IS NOT DISTINCT FROM $7::text
         AND handoff_id IS NOT DISTINCT FROM $8::text
         AND execution_mode = $9
         AND provider_id IS NOT DISTINCT FROM $10::text
         AND model_id IS NOT DISTINCT FROM $11::text
         AND status = $12
         AND envelope = $13::jsonb
         AND started_at IS NOT DISTINCT FROM $14::timestamptz
         AND completed_at IS NOT DISTINCT FROM $15::timestamptz AS same_run
     FROM agent_runs
     WHERE id = $1`,
    [
      input.id,
      input.workspaceId,
      input.agentDefinitionId,
      input.agentKey,
      input.agentVersion,
      input.contextReceiptId,
      input.parentRunId ?? null,
      input.handoffId ?? null,
      input.executionMode,
      input.providerId ?? null,
      input.modelId ?? null,
      input.status,
      JSON.stringify(input.envelope),
      input.startedAt ?? null,
      input.completedAt ?? null,
    ],
  );

  if (!existing.rows[0]?.same_run) {
    throw new AgentPersistenceConflictError(
      'AGENT_RUN_ID_CONFLICT',
      `Agent run ${input.id} already exists with different content or scope.`,
    );
  }

  return input.id;
}

export async function getAgentRunEnvelope(
  pool: Pool,
  workspaceId: string,
  runId: string,
): Promise<Record<string, unknown> | null> {
  const result = await pool.query<{ envelope: Record<string, unknown> }>(
    `SELECT envelope
     FROM agent_runs
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, runId],
  );

  return result.rows[0]?.envelope ?? null;
}
