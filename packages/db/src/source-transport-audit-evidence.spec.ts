import { describe, expect, it } from 'vitest';
import { buildSourceTransportAuditEvidence } from './source-transport-audit-evidence';

const validInput = {
  transportRequestId: 'transport-1',
  workspaceId: 'workspace-1',
  sourceId: 'source-1',
  disposition: 'blocked' as const,
  reasonCode: 'NON_PUBLIC_ADDRESS',
  resolvedAddressCount: 2,
  redirectHopCount: 1,
};

describe('buildSourceTransportAuditEvidence', () => {
  it('normalizes bounded identifiers without storing payload data', () => {
    expect(buildSourceTransportAuditEvidence({ ...validInput, sourceId: ' source-1 ' })).toEqual({
      version: 1,
      ...validInput,
    });
  });

  it('rejects empty identifiers and reason codes', () => {
    expect(() => buildSourceTransportAuditEvidence({ ...validInput, workspaceId: ' ' })).toThrow(
      'SOURCE_TRANSPORT_AUDIT_INVALID_WORKSPACE_ID',
    );
    expect(() => buildSourceTransportAuditEvidence({ ...validInput, reasonCode: '' })).toThrow(
      'SOURCE_TRANSPORT_AUDIT_INVALID_REASON_CODE',
    );
  });

  it('rejects negative and unbounded counters', () => {
    expect(() => buildSourceTransportAuditEvidence({ ...validInput, resolvedAddressCount: -1 })).toThrow(
      'SOURCE_TRANSPORT_AUDIT_INVALID_RESOLVED_ADDRESS_COUNT',
    );
    expect(() => buildSourceTransportAuditEvidence({ ...validInput, redirectHopCount: 65 })).toThrow(
      'SOURCE_TRANSPORT_AUDIT_INVALID_REDIRECT_HOP_COUNT',
    );
  });
});
