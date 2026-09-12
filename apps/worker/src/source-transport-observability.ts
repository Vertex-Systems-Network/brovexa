import { randomUUID } from 'node:crypto';

export type TransportObservabilityPhase =
  | 'admission_check'
  | 'resolution_evidence_verify'
  | 'redirect_hop_validate'
  | 'destination_classify'
  | 'exchange_execute'
  | 'response_verify'
  | 'audit_persist';

export type TransportObservabilityStatus = 'pending' | 'success' | 'blocked' | 'failed' | 'timeout';

export interface TransportObservabilityEvent {
  eventId: string;
  transportRequestId: string;
  phase: TransportObservabilityPhase;
  status: TransportObservabilityStatus;
  timestampMs: number;
  durationMs?: number;
  errorCode?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface TransportObservabilityTrace {
  traceId: string;
  transportRequestId: string;
  startedAtMs: number;
  completedAtMs?: number;
  events: TransportObservabilityEvent[];
  finalStatus?: TransportObservabilityStatus;
  totalDurationMs?: number;
}

export interface TransportMetricsSnapshot {
  snapshotId: string;
  capturedAtMs: number;
  windowStartMs: number;
  windowEndMs: number;
  admissionAttempts: number;
  admissionAllowed: number;
  admissionBlockedPolicy: number;
  admissionBlockedEvidence: number;
  admissionBlockedNetwork: number;
  resolutionVerifications: number;
  resolutionFresh: number;
  resolutionStale: number;
  redirectHopsValidated: number;
  redirectRejections: number;
  destinationsClassified: number;
  destinationsPublic: number;
  destinationsNonPublic: number;
  exchangesExecuted: number;
  exchangesSucceeded: number;
  exchangesFailed: number;
  responsesVerified: number;
  auditRecordsPersisted: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
}

const eventPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const phaseSet: ReadonlySet<TransportObservabilityPhase> = new Set([
  'admission_check',
  'resolution_evidence_verify',
  'redirect_hop_validate',
  'destination_classify',
  'exchange_execute',
  'response_verify',
  'audit_persist',
]);
const statusSet: ReadonlySet<TransportObservabilityStatus> = new Set([
  'pending',
  'success',
  'blocked',
  'failed',
  'timeout',
]);

function validEventId(value: unknown): value is string {
  return typeof value === 'string' && eventPattern.test(value);
}

function validPhase(value: unknown): value is TransportObservabilityPhase {
  return typeof value === 'string' && phaseSet.has(value as TransportObservabilityPhase);
}

function validStatus(value: unknown): value is TransportObservabilityStatus {
  return typeof value === 'string' && statusSet.has(value as TransportObservabilityStatus);
}

function safeNumber(value: unknown, fallback: number = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return value;
}

export function createTransportObservabilityEvent(
  input: Omit<TransportObservabilityEvent, 'eventId' | 'timestampMs'>,
): TransportObservabilityEvent {
  if (!validPhase(input.phase)) {
    throw new Error('INVALID_TRANSPORT_OBSERVABILITY_PHASE');
  }
  if (!validStatus(input.status)) {
    throw new Error('INVALID_TRANSPORT_OBSERVABILITY_STATUS');
  }
  if (!eventPattern.test(input.transportRequestId)) {
    throw new Error('INVALID_TRANSPORT_REQUEST_ID_FORMAT');
  }
  if (input.durationMs !== undefined && (input.durationMs < 0 || !Number.isFinite(input.durationMs))) {
    throw new Error('INVALID_DURATION_MS');
  }

  return {
    eventId: randomUUID(),
    transportRequestId: input.transportRequestId,
    phase: input.phase,
    status: input.status,
    timestampMs: Date.now(),
    durationMs: input.durationMs,
    errorCode: input.errorCode,
    metadata: input.metadata ? { ...input.metadata } : undefined,
  };
}

export function createTransportObservabilityTrace(
  transportRequestId: string,
): TransportObservabilityTrace {
  if (!eventPattern.test(transportRequestId)) {
    throw new Error('INVALID_TRANSPORT_REQUEST_ID_FORMAT');
  }

  return {
    traceId: randomUUID(),
    transportRequestId,
    startedAtMs: Date.now(),
    events: [],
  };
}

export function appendTransportObservabilityEvent(
  trace: TransportObservabilityTrace,
  event: TransportObservabilityEvent,
): void {
  if (event.transportRequestId !== trace.transportRequestId) {
    throw new Error('TRANSPORT_OBSERVABILITY_TRACE_REQUEST_ID_MISMATCH');
  }
  trace.events.push(event);
}

export function finalizeTransportObservabilityTrace(
  trace: TransportObservabilityTrace,
  finalStatus: TransportObservabilityStatus,
): TransportObservabilityTrace {
  trace.completedAtMs = Date.now();
  trace.finalStatus = finalStatus;
  trace.totalDurationMs = trace.completedAtMs - trace.startedAtMs;
  return trace;
}

export function calculateTransportMetrics(
  events: readonly TransportObservabilityEvent[],
  windowStartMs: number,
  windowEndMs: number,
): TransportMetricsSnapshot {
  const now = Date.now();
  const start = safeNumber(windowStartMs, now - 3600_000);
  const end = safeNumber(windowEndMs, now);

  const filtered = events.filter(
    (e) => e.timestampMs >= start && e.timestampMs <= end,
  );

  let admissionAttempts = 0;
  let admissionAllowed = 0;
  let admissionBlockedPolicy = 0;
  let admissionBlockedEvidence = 0;
  let admissionBlockedNetwork = 0;
  let resolutionVerifications = 0;
  let resolutionFresh = 0;
  let resolutionStale = 0;
  let redirectHopsValidated = 0;
  let redirectRejections = 0;
  let destinationsClassified = 0;
  let destinationsPublic = 0;
  let destinationsNonPublic = 0;
  let exchangesExecuted = 0;
  let exchangesSucceeded = 0;
  let exchangesFailed = 0;
  let responsesVerified = 0;
  let auditRecordsPersisted = 0;

  const latencies: number[] = [];

  for (const event of filtered) {
    if (event.durationMs !== undefined && event.durationMs >= 0) {
      latencies.push(event.durationMs);
    }

    switch (event.phase) {
      case 'admission_check':
        admissionAttempts++;
        if (event.status === 'success') admissionAllowed++;
        else if (event.status === 'blocked') {
          const reason = event.metadata?.reason as string | undefined;
          if (reason === 'SOURCE_POLICY_BLOCKED') admissionBlockedPolicy++;
          else if (reason === 'RESOLUTION_EVIDENCE_STALE') admissionBlockedEvidence++;
          else if (reason === 'PRODUCTION_NETWORK_DISABLED') admissionBlockedNetwork++;
        }
        break;
      case 'resolution_evidence_verify':
        resolutionVerifications++;
        if (event.status === 'success') resolutionFresh++;
        else if (event.status === 'blocked' || event.status === 'failed') resolutionStale++;
        break;
      case 'redirect_hop_validate':
        redirectHopsValidated++;
        if (event.status === 'blocked' || event.status === 'failed') redirectRejections++;
        break;
      case 'destination_classify':
        destinationsClassified++;
        if (event.metadata?.isPublic === true) destinationsPublic++;
        else if (event.metadata?.isPublic === false) destinationsNonPublic++;
        break;
      case 'exchange_execute':
        exchangesExecuted++;
        if (event.status === 'success') exchangesSucceeded++;
        else if (event.status === 'failed' || event.status === 'timeout') exchangesFailed++;
        break;
      case 'response_verify':
        responsesVerified++;
        break;
      case 'audit_persist':
        if (event.status === 'success') auditRecordsPersisted++;
        break;
    }
  }

  latencies.sort((a, b) => a - b);
  const averageLatencyMs =
    latencies.length > 0 ? latencies.reduce((sum, val) => sum + val, 0) / latencies.length : 0;
  const p95Index = Math.max(0, Math.floor(latencies.length * 0.95) - 1);
  const p99Index = Math.max(0, Math.floor(latencies.length * 0.99) - 1);
  const p95LatencyMs = latencies.length > 0 ? latencies[p95Index] ?? 0 : 0;
  const p99LatencyMs = latencies.length > 0 ? latencies[p99Index] ?? 0 : 0;

  return {
    snapshotId: randomUUID(),
    capturedAtMs: now,
    windowStartMs: start,
    windowEndMs: end,
    admissionAttempts,
    admissionAllowed,
    admissionBlockedPolicy,
    admissionBlockedEvidence,
    admissionBlockedNetwork,
    resolutionVerifications,
    resolutionFresh,
    resolutionStale,
    redirectHopsValidated,
    redirectRejections,
    destinationsClassified,
    destinationsPublic,
    destinationsNonPublic,
    exchangesExecuted,
    exchangesSucceeded,
    exchangesFailed,
    responsesVerified,
    auditRecordsPersisted,
    averageLatencyMs: Number(averageLatencyMs.toFixed(3)),
    p95LatencyMs: Number(p95LatencyMs.toFixed(3)),
    p99LatencyMs: Number(p99LatencyMs.toFixed(3)),
  };
}

export function serializeTransportObservabilityTrace(
  trace: TransportObservabilityTrace,
): string {
  return JSON.stringify({
    traceId: trace.traceId,
    transportRequestId: trace.transportRequestId,
    startedAtMs: trace.startedAtMs,
    completedAtMs: trace.completedAtMs,
    finalStatus: trace.finalStatus,
    totalDurationMs: trace.totalDurationMs,
    eventCount: trace.events.length,
    events: trace.events.map((e) => ({
      eventId: e.eventId,
      phase: e.phase,
      status: e.status,
      timestampMs: e.timestampMs,
      durationMs: e.durationMs,
      errorCode: e.errorCode,
    })),
  });
}

export function parseTransportObservabilityEvent(
  raw: unknown,
): TransportObservabilityEvent {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('INVALID_TRANSPORT_OBSERVABILITY_EVENT_FORMAT');
  }

  const obj = raw as Record<string, unknown>;

  if (!validEventId(obj.eventId)) {
    throw new Error('INVALID_EVENT_ID');
  }
  if (!eventPattern.test(String(obj.transportRequestId ?? ''))) {
    throw new Error('INVALID_TRANSPORT_REQUEST_ID');
  }
  if (!validPhase(obj.phase)) {
    throw new Error('INVALID_PHASE');
  }
  if (!validStatus(obj.status)) {
    throw new Error('INVALID_STATUS');
  }
  if (typeof obj.timestampMs !== 'number' || !Number.isFinite(obj.timestampMs)) {
    throw new Error('INVALID_TIMESTAMP_MS');
  }

  const durationMs =
    obj.durationMs !== undefined
      ? safeNumber(obj.durationMs, undefined)
      : undefined;
  if (durationMs !== undefined && (durationMs < 0 || !Number.isFinite(durationMs))) {
    throw new Error('INVALID_DURATION_MS');
  }

  const metadata =
    obj.metadata !== undefined && obj.metadata !== null && typeof obj.metadata === 'object'
      ? { ...(obj.metadata as Record<string, string | number | boolean>) }
      : undefined;

  return {
    eventId: obj.eventId,
    transportRequestId: String(obj.transportRequestId),
    phase: obj.phase as TransportObservabilityPhase,
    status: obj.status as TransportObservabilityStatus,
    timestampMs: obj.timestampMs,
    durationMs,
    errorCode: typeof obj.errorCode === 'string' ? obj.errorCode : undefined,
    metadata,
  };
}
