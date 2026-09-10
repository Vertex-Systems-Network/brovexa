export type SourceTransportAuditDisposition = 'admitted' | 'blocked' | 'failed';

export interface SourceTransportAuditEvidenceInput {
  transportRequestId: string;
  workspaceId: string;
  sourceId: string;
  disposition: SourceTransportAuditDisposition;
  reasonCode: string;
  resolvedAddressCount: number;
  redirectHopCount: number;
}

export interface SourceTransportAuditEvidence extends SourceTransportAuditEvidenceInput {
  version: 1;
}

function requireIdentifier(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 128) {
    throw new Error(`SOURCE_TRANSPORT_AUDIT_INVALID_${field.toUpperCase()}`);
  }
  return normalized;
}

function requireCount(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 64) {
    throw new Error(`SOURCE_TRANSPORT_AUDIT_INVALID_${field.toUpperCase()}`);
  }
  return value;
}

export function buildSourceTransportAuditEvidence(
  input: SourceTransportAuditEvidenceInput,
): SourceTransportAuditEvidence {
  return {
    version: 1,
    transportRequestId: requireIdentifier(input.transportRequestId, 'transport_request_id'),
    workspaceId: requireIdentifier(input.workspaceId, 'workspace_id'),
    sourceId: requireIdentifier(input.sourceId, 'source_id'),
    disposition: input.disposition,
    reasonCode: requireIdentifier(input.reasonCode, 'reason_code'),
    resolvedAddressCount: requireCount(input.resolvedAddressCount, 'resolved_address_count'),
    redirectHopCount: requireCount(input.redirectHopCount, 'redirect_hop_count'),
  };
}
