export interface SourceTransportObservationInput {
  outcome: 'allowed' | 'blocked' | 'failed';
  reasonCode: string;
  transportKind: 'test' | 'network';
  redirectHopCount: number;
  resolvedAddressCount: number;
}

export interface SourceTransportObservation {
  outcome: SourceTransportObservationInput['outcome'];
  reasonCode: string;
  transportKind: SourceTransportObservationInput['transportKind'];
  redirectHopBucket: '0' | '1' | '2_plus';
  resolvedAddressBucket: '0' | '1' | '2_4' | '5_plus';
}

function normalizedReasonCode(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 64);
  return normalized.length === 0 ? 'UNSPECIFIED' : normalized;
}

function redirectHopBucket(value: number): SourceTransportObservation['redirectHopBucket'] {
  if (!Number.isSafeInteger(value) || value <= 0) return '0';
  return value === 1 ? '1' : '2_plus';
}

function resolvedAddressBucket(value: number): SourceTransportObservation['resolvedAddressBucket'] {
  if (!Number.isSafeInteger(value) || value <= 0) return '0';
  if (value === 1) return '1';
  return value <= 4 ? '2_4' : '5_plus';
}

export function toBoundedSourceTransportObservation(
  input: SourceTransportObservationInput,
): SourceTransportObservation {
  return {
    outcome: input.outcome,
    reasonCode: normalizedReasonCode(input.reasonCode),
    transportKind: input.transportKind,
    redirectHopBucket: redirectHopBucket(input.redirectHopCount),
    resolvedAddressBucket: resolvedAddressBucket(input.resolvedAddressCount),
  };
}
