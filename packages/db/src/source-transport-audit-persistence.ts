import type { Pool } from 'pg';
import {
  buildSourceTransportAuditRecord,
  SourceTransportAuditRecordError,
  type SourceTransportAuditRecord,
  type SourceTransportAuditRecordInput,
} from './source-transport-audit-record';

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SourceTransportAuditPersistenceErrorCode =
  | 'SOURCE_TRANSPORT_AUDIT_INPUT_INVALID'
  | 'SOURCE_TRANSPORT_AUDIT_SOURCE_TASK_NOT_FOUND'
  | 'SOURCE_TRANSPORT_AUDIT_SOURCE_TASK_IDENTITY_MISMATCH'
  | 'SOURCE_TRANSPORT_AUDIT_ID_CONFLICT';

export class SourceTransportAuditPersistenceError extends Error {
  constructor(readonly code: SourceTransportAuditPersistenceErrorCode, message: string) {
    super(message);
    this.name = 'SourceTransportAuditPersistenceError';
  }
}

export interface PersistedSourceTransportAuditRecord extends SourceTransportAuditRecord {
  createdAt: Date;
}

export interface PersistSourceTransportAuditRecordResult {
  created: boolean;
  record: PersistedSourceTransportAuditRecord;
}

interface SourceTaskIdentityRow {
  request_id: string;
  connector_key: string;
  connector_version: string;
}

interface SourceTransportAuditRow {
  id: string;
  workspace_id: string;
  transport_request_id: string;
  source_request_id: string;
  source_task_id: string;
  connector_key: string;
  connector_version: string;
  transport_policy_id: string;
  transport_policy_version: string;
  decision: 'allow' | 'blocked';
  reason_codes: string[];
  warnings: string[];
  canonical_url: string;
  hostname: string;
  port: number | null;
  max_response_bytes: string;
  timeout_ms: string;
  evaluated_at: Date;
  envelope: Record<string, unknown>;
  created_at: Date;
}

function invalid(message: string): SourceTransportAuditPersistenceError {
  return new SourceTransportAuditPersistenceError('SOURCE_TRANSPORT_AUDIT_INPUT_INVALID', message);
}

function normalizeInput(input: SourceTransportAuditRecordInput): SourceTransportAuditRecord {
  try {
    return buildSourceTransportAuditRecord(input);
  } catch (error) {
    if (error instanceof SourceTransportAuditRecordError) throw invalid(error.message);
    throw error;
  }
}

function safeInteger(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw invalid(`${field} is outside the JavaScript safe integer range.`);
  }
  return parsed;
}

function rowToRecord(row: SourceTransportAuditRow): PersistedSourceTransportAuditRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    transportRequestId: row.transport_request_id,
    sourceRequestId: row.source_request_id,
    sourceTaskId: row.source_task_id,
    connectorKey: row.connector_key,
    connectorVersion: row.connector_version,
    transportPolicyId: row.transport_policy_id,
    transportPolicyVersion: row.transport_policy_version,
    decision: row.decision,
    reasonCodes: [...row.reason_codes],
    warnings: [...row.warnings],
    canonicalUrl: row.canonical_url,
    hostname: row.hostname,
    port: row.port,
    maxResponseBytes: safeInteger(row.max_response_bytes, 'maxResponseBytes'),
    timeoutMs: safeInteger(row.timeout_ms, 'timeoutMs'),
    evaluatedAt: new Date(row.evaluated_at.getTime()),
    envelope: Object.freeze({ ...row.envelope }),
    createdAt: new Date(row.created_at.getTime()),
  };
}

function persistenceValues(record: SourceTransportAuditRecord): unknown[] {
  return [
    record.id,
    record.workspaceId,
    record.transportRequestId,
    record.sourceRequestId,
    record.sourceTaskId,
    record.connectorKey,
    record.connectorVersion,
    record.transportPolicyId,
    record.transportPolicyVersion,
    record.decision,
    JSON.stringify(record.reasonCodes),
    JSON.stringify(record.warnings),
    record.canonicalUrl,
    record.hostname,
    record.port,
    record.maxResponseBytes,
    record.timeoutMs,
    record.evaluatedAt,
    JSON.stringify(record.envelope),
  ];
}

export async function persistSourceTransportAuditRecord(
  pool: Pool,
  rawInput: SourceTransportAuditRecordInput,
): Promise<PersistSourceTransportAuditRecordResult> {
  const record = normalizeInput(rawInput);

  const sourceTaskResult = await pool.query<SourceTaskIdentityRow>(
    `SELECT request_id, connector_key, connector_version
     FROM source_tasks
     WHERE workspace_id = $1 AND id = $2`,
    [record.workspaceId, record.sourceTaskId],
  );
  const sourceTask = sourceTaskResult.rows[0];
  if (!sourceTask) {
    throw new SourceTransportAuditPersistenceError(
      'SOURCE_TRANSPORT_AUDIT_SOURCE_TASK_NOT_FOUND',
      `Source task ${record.sourceTaskId} was not found in workspace ${record.workspaceId}.`,
    );
  }
  if (
    sourceTask.request_id !== record.sourceRequestId ||
    sourceTask.connector_key !== record.connectorKey ||
    sourceTask.connector_version !== record.connectorVersion
  ) {
    throw new SourceTransportAuditPersistenceError(
      'SOURCE_TRANSPORT_AUDIT_SOURCE_TASK_IDENTITY_MISMATCH',
      `Source transport audit ${record.id} does not match the immutable source-task request/connector identity.`,
    );
  }

  const values = persistenceValues(record);
  const inserted = await pool.query<SourceTransportAuditRow>(
    `INSERT INTO source_transport_audit_records (
       id, workspace_id, transport_request_id, source_request_id, source_task_id,
       connector_key, connector_version, transport_policy_id, transport_policy_version,
       decision, reason_codes, warnings, canonical_url, hostname, port,
       max_response_bytes, timeout_ms, evaluated_at, envelope
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9,
       $10, $11::jsonb, $12::jsonb, $13, $14, $15,
       $16, $17, $18, $19::jsonb
     )
     ON CONFLICT (id) DO NOTHING
     RETURNING id, workspace_id, transport_request_id, source_request_id, source_task_id,
               connector_key, connector_version, transport_policy_id, transport_policy_version,
               decision, reason_codes, warnings, canonical_url, hostname, port,
               max_response_bytes::text, timeout_ms::text, evaluated_at, envelope, created_at`,
    values,
  );
  const insertedRow = inserted.rows[0];
  if (insertedRow) return { created: true, record: rowToRecord(insertedRow) };

  const existing = await pool.query<SourceTransportAuditRow & { same_record: boolean }>(
    `SELECT id, workspace_id, transport_request_id, source_request_id, source_task_id,
            connector_key, connector_version, transport_policy_id, transport_policy_version,
            decision, reason_codes, warnings, canonical_url, hostname, port,
            max_response_bytes::text, timeout_ms::text, evaluated_at, envelope, created_at,
            workspace_id = $2::uuid
              AND transport_request_id = $3
              AND source_request_id = $4
              AND source_task_id = $5
              AND connector_key = $6
              AND connector_version = $7
              AND transport_policy_id = $8
              AND transport_policy_version = $9
              AND decision = $10
              AND reason_codes = $11::jsonb
              AND warnings = $12::jsonb
              AND canonical_url = $13
              AND hostname = $14
              AND port IS NOT DISTINCT FROM $15::integer
              AND max_response_bytes = $16::bigint
              AND timeout_ms = $17::bigint
              AND evaluated_at = $18::timestamptz
              AND envelope = $19::jsonb AS same_record
     FROM source_transport_audit_records
     WHERE id = $1`,
    values,
  );
  const existingRow = existing.rows[0];
  if (!existingRow?.same_record) {
    throw new SourceTransportAuditPersistenceError(
      'SOURCE_TRANSPORT_AUDIT_ID_CONFLICT',
      `Source transport audit ${record.id} already exists with different content.`,
    );
  }

  return { created: false, record: rowToRecord(existingRow) };
}

export async function getSourceTransportAuditRecord(
  pool: Pool,
  workspaceId: string,
  id: string,
): Promise<PersistedSourceTransportAuditRecord | null> {
  if (!uuidPattern.test(workspaceId)) throw invalid('workspaceId must be a UUID.');
  if (!identifierPattern.test(id)) throw invalid('id must use the canonical identifier format.');

  const result = await pool.query<SourceTransportAuditRow>(
    `SELECT id, workspace_id, transport_request_id, source_request_id, source_task_id,
            connector_key, connector_version, transport_policy_id, transport_policy_version,
            decision, reason_codes, warnings, canonical_url, hostname, port,
            max_response_bytes::text, timeout_ms::text, evaluated_at, envelope, created_at
     FROM source_transport_audit_records
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, id],
  );
  const row = result.rows[0];
  return row ? rowToRecord(row) : null;
}
