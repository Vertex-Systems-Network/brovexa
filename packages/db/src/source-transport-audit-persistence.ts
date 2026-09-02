import type { Pool } from 'pg';

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/;
const connectorKeyPattern = /^connector\.[a-z0-9_.-]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SourceTransportAuditPersistenceErrorCode =
  | 'SOURCE_TRANSPORT_AUDIT_INPUT_INVALID'
  | 'SOURCE_TRANSPORT_AUDIT_ID_CONFLICT';

export class SourceTransportAuditPersistenceError extends Error {
  readonly code: SourceTransportAuditPersistenceErrorCode;

  constructor(code: SourceTransportAuditPersistenceErrorCode, message: string) {
    super(message);
    this.name = 'SourceTransportAuditPersistenceError';
    this.code = code;
  }
}

export interface PersistSourceTransportAdmissionAuditInput {
  id: string;
  workspaceId: string;
  transportRequestId: string;
  sourceRequestId: string;
  sourceTaskId: string;
  connectorKey: string;
  connectorVersion: string;
  transportPolicyId: string;
  transportPolicyVersion: string;
  decision: 'allow' | 'blocked';
  reasonCodes: readonly string[];
  warnings: readonly string[];
  canonicalUrl: string;
  hostname: string;
  port: number | null;
  maxResponseBytes: number;
  timeoutMs: number;
  evaluatedAt: Date;
}

export interface PersistedSourceTransportAdmissionAudit extends PersistSourceTransportAdmissionAuditInput {
  reasonCodes: string[];
  warnings: string[];
  envelope: Record<string, unknown>;
  createdAt: Date;
}

export interface PersistSourceTransportAdmissionAuditResult {
  created: boolean;
  audit: PersistedSourceTransportAdmissionAudit;
}

interface AuditRow {
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

function inputError(message: string): SourceTransportAuditPersistenceError {
  return new SourceTransportAuditPersistenceError('SOURCE_TRANSPORT_AUDIT_INPUT_INVALID', message);
}

function assertIdentifier(value: string, field: string, pattern: RegExp = identifierPattern): void {
  if (typeof value !== 'string' || !pattern.test(value)) throw inputError(`${field} must use the canonical identifier format.`);
}

function assertVersion(value: string, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 64) {
    throw inputError(`${field} must be a non-empty version no longer than 64 characters.`);
  }
}

function normalizeCodes(values: readonly string[], field: string): string[] {
  if (!Array.isArray(values) || values.length > 128) throw inputError(`${field} must contain at most 128 values.`);
  const normalized = values.map((value) => {
    assertIdentifier(value, field);
    return value;
  });
  if (new Set(normalized).size !== normalized.length) throw inputError(`${field} must not contain duplicates.`);
  return normalized;
}

function normalizeInput(
  input: PersistSourceTransportAdmissionAuditInput,
): PersistSourceTransportAdmissionAuditInput & { reasonCodes: string[]; warnings: string[] } {
  assertIdentifier(input.id, 'id');
  if (!uuidPattern.test(input.workspaceId)) throw inputError('workspaceId must be a UUID.');
  assertIdentifier(input.transportRequestId, 'transportRequestId');
  assertIdentifier(input.sourceRequestId, 'sourceRequestId');
  assertIdentifier(input.sourceTaskId, 'sourceTaskId');
  assertIdentifier(input.connectorKey, 'connectorKey', connectorKeyPattern);
  assertVersion(input.connectorVersion, 'connectorVersion');
  assertIdentifier(input.transportPolicyId, 'transportPolicyId');
  assertVersion(input.transportPolicyVersion, 'transportPolicyVersion');
  if (input.decision !== 'allow' && input.decision !== 'blocked') throw inputError('decision must be allow or blocked.');
  if (typeof input.canonicalUrl !== 'string' || input.canonicalUrl.trim().length === 0 || input.canonicalUrl.length > 2048) {
    throw inputError('canonicalUrl must be a non-empty URL string no longer than 2048 characters.');
  }
  if (typeof input.hostname !== 'string' || input.hostname.trim().length === 0 || input.hostname.length > 253) {
    throw inputError('hostname must be non-empty and no longer than 253 characters.');
  }
  if (input.port !== null && (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535)) {
    throw inputError('port must be null or an integer between 1 and 65535.');
  }
  if (!Number.isSafeInteger(input.maxResponseBytes) || input.maxResponseBytes < 1) {
    throw inputError('maxResponseBytes must be a positive safe integer.');
  }
  if (!Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 100 || input.timeoutMs > 120000) {
    throw inputError('timeoutMs must be an integer between 100 and 120000.');
  }
  if (!(input.evaluatedAt instanceof Date) || Number.isNaN(input.evaluatedAt.getTime())) {
    throw inputError('evaluatedAt must be a valid Date.');
  }

  return {
    ...input,
    canonicalUrl: input.canonicalUrl.trim(),
    hostname: input.hostname.trim().toLowerCase(),
    reasonCodes: normalizeCodes(input.reasonCodes, 'reasonCodes'),
    warnings: normalizeCodes(input.warnings, 'warnings'),
  };
}

function rowToAudit(row: AuditRow): PersistedSourceTransportAdmissionAudit {
  const maxResponseBytes = Number(row.max_response_bytes);
  const timeoutMs = Number(row.timeout_ms);
  if (!Number.isSafeInteger(maxResponseBytes) || !Number.isSafeInteger(timeoutMs)) {
    throw inputError(`Transport audit ${row.id} contains an integer outside the JavaScript safe range.`);
  }

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
    reasonCodes: row.reason_codes,
    warnings: row.warnings,
    canonicalUrl: row.canonical_url,
    hostname: row.hostname,
    port: row.port,
    maxResponseBytes,
    timeoutMs,
    evaluatedAt: row.evaluated_at,
    envelope: row.envelope,
    createdAt: row.created_at,
  };
}

const returningColumns = `id, workspace_id, transport_request_id, source_request_id, source_task_id,
  connector_key, connector_version, transport_policy_id, transport_policy_version, decision,
  reason_codes, warnings, canonical_url, hostname, port, max_response_bytes::text,
  timeout_ms::text, evaluated_at, envelope, created_at`;

export async function getSourceTransportAdmissionAudit(
  pool: Pool,
  workspaceId: string,
  transportRequestId: string,
): Promise<PersistedSourceTransportAdmissionAudit | null> {
  if (!uuidPattern.test(workspaceId)) throw inputError('workspaceId must be a UUID.');
  assertIdentifier(transportRequestId, 'transportRequestId');

  const result = await pool.query<AuditRow>(
    `SELECT ${returningColumns}
       FROM source_transport_admission_audits
      WHERE workspace_id = $1 AND transport_request_id = $2`,
    [workspaceId, transportRequestId],
  );
  return result.rows[0] ? rowToAudit(result.rows[0]) : null;
}

export async function persistSourceTransportAdmissionAudit(
  pool: Pool,
  rawInput: PersistSourceTransportAdmissionAuditInput,
): Promise<PersistSourceTransportAdmissionAuditResult> {
  const input = normalizeInput(rawInput);
  const envelope = {
    transportRequestId: input.transportRequestId,
    sourceRequestId: input.sourceRequestId,
    sourceTaskId: input.sourceTaskId,
    connectorKey: input.connectorKey,
    connectorVersion: input.connectorVersion,
    transportPolicyId: input.transportPolicyId,
    transportPolicyVersion: input.transportPolicyVersion,
    decision: input.decision,
    reasonCodes: input.reasonCodes,
    warnings: input.warnings,
    canonicalUrl: input.canonicalUrl,
    hostname: input.hostname,
    port: input.port,
    maxResponseBytes: input.maxResponseBytes,
    timeoutMs: input.timeoutMs,
    evaluatedAt: input.evaluatedAt.toISOString(),
  };

  let inserted;
  try {
    inserted = await pool.query<AuditRow>(
      `INSERT INTO source_transport_admission_audits (
         id, workspace_id, transport_request_id, source_request_id, source_task_id,
         connector_key, connector_version, transport_policy_id, transport_policy_version,
         decision, reason_codes, warnings, canonical_url, hostname, port,
         max_response_bytes, timeout_ms, evaluated_at, envelope
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         $11::jsonb, $12::jsonb, $13, $14, $15, $16, $17, $18, $19::jsonb
       )
       ON CONFLICT (workspace_id, transport_request_id) DO NOTHING
       RETURNING ${returningColumns}`,
      [
        input.id,
        input.workspaceId,
        input.transportRequestId,
        input.sourceRequestId,
        input.sourceTaskId,
        input.connectorKey,
        input.connectorVersion,
        input.transportPolicyId,
        input.transportPolicyVersion,
        input.decision,
        JSON.stringify(input.reasonCodes),
        JSON.stringify(input.warnings),
        input.canonicalUrl,
        input.hostname,
        input.port,
        input.maxResponseBytes,
        input.timeoutMs,
        input.evaluatedAt,
        JSON.stringify(envelope),
      ],
    );
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new SourceTransportAuditPersistenceError(
        'SOURCE_TRANSPORT_AUDIT_ID_CONFLICT',
        `Transport audit id ${input.id} is already bound to a different transport request.`,
      );
    }
    throw error;
  }

  if (inserted.rows[0]) return { created: true, audit: rowToAudit(inserted.rows[0]) };

  const existing = await getSourceTransportAdmissionAudit(pool, input.workspaceId, input.transportRequestId);
  if (!existing || existing.id !== input.id || JSON.stringify(existing.envelope) !== JSON.stringify(envelope)) {
    throw new SourceTransportAuditPersistenceError(
      'SOURCE_TRANSPORT_AUDIT_ID_CONFLICT',
      `Transport request ${input.transportRequestId} is already bound to different audit evidence.`,
    );
  }

  return { created: false, audit: existing };
}
