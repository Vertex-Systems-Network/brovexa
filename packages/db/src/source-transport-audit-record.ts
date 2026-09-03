import { URL } from 'node:url';

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/;
const connectorKeyPattern = /^connector\.[a-z0-9_.-]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface SourceTransportAuditRecordInput {
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

export interface SourceTransportAuditRecord {
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
  reasonCodes: string[];
  warnings: string[];
  canonicalUrl: string;
  hostname: string;
  port: number | null;
  maxResponseBytes: number;
  timeoutMs: number;
  evaluatedAt: Date;
  envelope: Readonly<Record<string, unknown>>;
}

export class SourceTransportAuditRecordError extends Error {
  constructor(readonly code: 'SOURCE_TRANSPORT_AUDIT_RECORD_INVALID', message: string) {
    super(message);
    this.name = 'SourceTransportAuditRecordError';
  }
}

function invalid(message: string): never {
  throw new SourceTransportAuditRecordError('SOURCE_TRANSPORT_AUDIT_RECORD_INVALID', message);
}

function assertIdentifier(value: string, field: string, pattern: RegExp = identifierPattern): void {
  if (typeof value !== 'string' || !pattern.test(value)) invalid(`${field} must use the canonical identifier format.`);
}

function assertVersion(value: string, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 64) {
    invalid(`${field} must be a non-empty version no longer than 64 characters.`);
  }
}

function normalizeCodes(values: readonly string[], field: string): string[] {
  if (!Array.isArray(values) || values.length > 128) invalid(`${field} must contain at most 128 values.`);
  const normalized = values.map((value) => {
    assertIdentifier(value, field);
    return value;
  });
  if (new Set(normalized).size !== normalized.length) invalid(`${field} must not contain duplicates.`);
  return normalized;
}

function normalizeHostname(value: string): string {
  const hostname = value.trim().toLowerCase();
  return hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
}

export function buildSourceTransportAuditRecord(input: SourceTransportAuditRecordInput): SourceTransportAuditRecord {
  assertIdentifier(input.id, 'id');
  if (!uuidPattern.test(input.workspaceId)) invalid('workspaceId must be a UUID.');
  assertIdentifier(input.transportRequestId, 'transportRequestId');
  assertIdentifier(input.sourceRequestId, 'sourceRequestId');
  assertIdentifier(input.sourceTaskId, 'sourceTaskId');
  assertIdentifier(input.connectorKey, 'connectorKey', connectorKeyPattern);
  assertVersion(input.connectorVersion, 'connectorVersion');
  assertIdentifier(input.transportPolicyId, 'transportPolicyId');
  assertVersion(input.transportPolicyVersion, 'transportPolicyVersion');
  if (input.decision !== 'allow' && input.decision !== 'blocked') invalid('decision must be allow or blocked.');

  const reasonCodes = normalizeCodes(input.reasonCodes, 'reasonCodes');
  const warnings = normalizeCodes(input.warnings, 'warnings');
  if (input.decision === 'blocked' && reasonCodes.length === 0) invalid('A blocked decision must include at least one reason code.');

  const canonicalUrl = input.canonicalUrl.trim();
  if (canonicalUrl.length === 0 || canonicalUrl.length > 2048) invalid('canonicalUrl must be non-empty and no longer than 2048 characters.');

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(canonicalUrl);
  } catch {
    invalid('canonicalUrl must be a valid absolute URL.');
  }

  const hostname = normalizeHostname(input.hostname);
  if (hostname.length === 0 || hostname.length > 253) invalid('hostname must be non-empty and no longer than 253 characters.');
  if (normalizeHostname(parsedUrl.hostname) !== hostname) invalid('hostname must match the canonicalUrl hostname.');
  if (input.port !== null && (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535)) {
    invalid('port must be null or an integer between 1 and 65535.');
  }
  if (!Number.isSafeInteger(input.maxResponseBytes) || input.maxResponseBytes < 1) {
    invalid('maxResponseBytes must be a positive safe integer.');
  }
  if (!Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 100 || input.timeoutMs > 120000) {
    invalid('timeoutMs must be an integer between 100 and 120000.');
  }
  if (!(input.evaluatedAt instanceof Date) || Number.isNaN(input.evaluatedAt.getTime())) invalid('evaluatedAt must be a valid Date.');

  const envelope = Object.freeze({
    transportRequestId: input.transportRequestId,
    sourceRequestId: input.sourceRequestId,
    sourceTaskId: input.sourceTaskId,
    connectorKey: input.connectorKey,
    connectorVersion: input.connectorVersion,
    transportPolicyId: input.transportPolicyId,
    transportPolicyVersion: input.transportPolicyVersion,
    decision: input.decision,
    reasonCodes: Object.freeze([...reasonCodes]),
    warnings: Object.freeze([...warnings]),
    canonicalUrl,
    hostname,
    port: input.port,
    maxResponseBytes: input.maxResponseBytes,
    timeoutMs: input.timeoutMs,
    evaluatedAt: input.evaluatedAt.toISOString(),
  });

  return {
    ...input,
    reasonCodes,
    warnings,
    canonicalUrl,
    hostname,
    evaluatedAt: new Date(input.evaluatedAt.getTime()),
    envelope,
  };
}
