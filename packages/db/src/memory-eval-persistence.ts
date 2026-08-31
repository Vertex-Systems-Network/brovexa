import type { Pool } from 'pg';
import { AgentPersistenceConflictError } from './agent-persistence';
import type {
  PersistedDataClassification,
  PersistedMemoryAuthority,
  PersistedMemoryStatus,
  PersistedMemoryType,
  PersistedMemoryWriter,
} from './memory-record-schema';
import type { PersistedEvalDecision, PersistedEvidenceState } from './eval-result-schema';

export interface PersistMemoryRecordInput {
  id: string;
  version: string;
  revisionParentId?: string | undefined;
  namespace: string;
  workspaceId: string;
  userId?: string | undefined;
  runId?: string | undefined;
  entityId?: string | undefined;
  leadId?: string | undefined;
  memoryType: PersistedMemoryType;
  subtype: string;
  writer: PersistedMemoryWriter;
  aiDerived: boolean;
  derivation?: Record<string, unknown> | undefined;
  confidence: number;
  authority: PersistedMemoryAuthority;
  status: PersistedMemoryStatus;
  retentionPolicyId: string;
  deletionReason?: string | undefined;
  dataClassification: PersistedDataClassification;
  envelope: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date | undefined;
}

export interface PersistEvalResultInput {
  id: string;
  workspaceId: string;
  evaluatorRunId: string;
  subjectRunId: string;
  decision: PersistedEvalDecision;
  evidenceState: PersistedEvidenceState;
  reasonCodes: string[];
  evidenceRefs: string[];
  policyRefs: string[];
  confidence: number;
  envelope: Record<string, unknown>;
  createdAt: Date;
}

function assertConfidence(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError('confidence must be a finite number from 0 through 1.');
  }
}

export async function persistMemoryRecord(
  pool: Pool,
  input: PersistMemoryRecordInput,
): Promise<string> {
  assertConfidence(input.confidence);

  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO memory_records (
       id,
       version,
       revision_parent_id,
       namespace,
       workspace_id,
       user_id,
       run_id,
       entity_id,
       lead_id,
       memory_type,
       subtype,
       writer,
       ai_derived,
       derivation,
       confidence,
       authority,
       status,
       retention_policy_id,
       deletion_reason,
       data_classification,
       envelope,
       created_at,
       updated_at,
       expires_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
       $13, $14::jsonb, $15, $16, $17, $18, $19, $20, $21::jsonb, $22, $23, $24
     )
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [
      input.id,
      input.version,
      input.revisionParentId ?? null,
      input.namespace,
      input.workspaceId,
      input.userId ?? null,
      input.runId ?? null,
      input.entityId ?? null,
      input.leadId ?? null,
      input.memoryType,
      input.subtype,
      input.writer,
      input.aiDerived,
      input.derivation ? JSON.stringify(input.derivation) : null,
      input.confidence,
      input.authority,
      input.status,
      input.retentionPolicyId,
      input.deletionReason ?? null,
      input.dataClassification,
      JSON.stringify(input.envelope),
      input.createdAt,
      input.updatedAt,
      input.expiresAt ?? null,
    ],
  );

  if (inserted.rows[0]?.id) return input.id;

  const existing = await pool.query<{ same_memory: boolean }>(
    `SELECT
       version = $2
         AND revision_parent_id IS NOT DISTINCT FROM $3::text
         AND namespace = $4
         AND workspace_id = $5::uuid
         AND user_id IS NOT DISTINCT FROM $6::uuid
         AND run_id IS NOT DISTINCT FROM $7::text
         AND entity_id IS NOT DISTINCT FROM $8::text
         AND lead_id IS NOT DISTINCT FROM $9::text
         AND memory_type = $10
         AND subtype = $11
         AND writer = $12
         AND ai_derived = $13
         AND derivation IS NOT DISTINCT FROM $14::jsonb
         AND confidence = $15
         AND authority = $16
         AND status = $17
         AND retention_policy_id = $18
         AND deletion_reason IS NOT DISTINCT FROM $19::text
         AND data_classification = $20
         AND envelope = $21::jsonb
         AND created_at = $22::timestamptz
         AND updated_at = $23::timestamptz
         AND expires_at IS NOT DISTINCT FROM $24::timestamptz AS same_memory
     FROM memory_records
     WHERE id = $1`,
    [
      input.id,
      input.version,
      input.revisionParentId ?? null,
      input.namespace,
      input.workspaceId,
      input.userId ?? null,
      input.runId ?? null,
      input.entityId ?? null,
      input.leadId ?? null,
      input.memoryType,
      input.subtype,
      input.writer,
      input.aiDerived,
      input.derivation ? JSON.stringify(input.derivation) : null,
      input.confidence,
      input.authority,
      input.status,
      input.retentionPolicyId,
      input.deletionReason ?? null,
      input.dataClassification,
      JSON.stringify(input.envelope),
      input.createdAt,
      input.updatedAt,
      input.expiresAt ?? null,
    ],
  );

  if (!existing.rows[0]?.same_memory) {
    throw new AgentPersistenceConflictError(
      'MEMORY_RECORD_ID_CONFLICT',
      `Memory record ${input.id} already exists with different content, lineage or scope.`,
    );
  }

  return input.id;
}

export async function getMemoryRecordEnvelope(
  pool: Pool,
  workspaceId: string,
  memoryId: string,
): Promise<Record<string, unknown> | null> {
  const result = await pool.query<{ envelope: Record<string, unknown> }>(
    `SELECT envelope
     FROM memory_records
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, memoryId],
  );

  return result.rows[0]?.envelope ?? null;
}

export async function persistEvalResult(
  pool: Pool,
  input: PersistEvalResultInput,
): Promise<string> {
  assertConfidence(input.confidence);

  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO agent_eval_results (
       id,
       workspace_id,
       evaluator_run_id,
       subject_run_id,
       decision,
       evidence_state,
       reason_codes,
       evidence_refs,
       policy_refs,
       confidence,
       envelope,
       created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11::jsonb, $12)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [
      input.id,
      input.workspaceId,
      input.evaluatorRunId,
      input.subjectRunId,
      input.decision,
      input.evidenceState,
      JSON.stringify(input.reasonCodes),
      JSON.stringify(input.evidenceRefs),
      JSON.stringify(input.policyRefs),
      input.confidence,
      JSON.stringify(input.envelope),
      input.createdAt,
    ],
  );

  if (inserted.rows[0]?.id) return input.id;

  const existing = await pool.query<{ same_evaluation: boolean }>(
    `SELECT
       workspace_id = $2::uuid
         AND evaluator_run_id = $3
         AND subject_run_id = $4
         AND decision = $5
         AND evidence_state = $6
         AND reason_codes = $7::jsonb
         AND evidence_refs = $8::jsonb
         AND policy_refs = $9::jsonb
         AND confidence = $10
         AND envelope = $11::jsonb
         AND created_at = $12::timestamptz AS same_evaluation
     FROM agent_eval_results
     WHERE id = $1`,
    [
      input.id,
      input.workspaceId,
      input.evaluatorRunId,
      input.subjectRunId,
      input.decision,
      input.evidenceState,
      JSON.stringify(input.reasonCodes),
      JSON.stringify(input.evidenceRefs),
      JSON.stringify(input.policyRefs),
      input.confidence,
      JSON.stringify(input.envelope),
      input.createdAt,
    ],
  );

  if (!existing.rows[0]?.same_evaluation) {
    throw new AgentPersistenceConflictError(
      'EVAL_RESULT_ID_CONFLICT',
      `Evaluation result ${input.id} already exists with different content or scope.`,
    );
  }

  return input.id;
}

export async function getEvalResultEnvelope(
  pool: Pool,
  workspaceId: string,
  evaluationId: string,
): Promise<Record<string, unknown> | null> {
  const result = await pool.query<{ envelope: Record<string, unknown> }>(
    `SELECT envelope
     FROM agent_eval_results
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, evaluationId],
  );

  return result.rows[0]?.envelope ?? null;
}
