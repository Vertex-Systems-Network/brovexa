import { describe, expect, it, vi } from 'vitest';
import {
  createTransportObservabilityEvent,
  createTransportObservabilityTrace,
  appendTransportObservabilityEvent,
  finalizeTransportObservabilityTrace,
  calculateTransportMetrics,
  serializeTransportObservabilityTrace,
  parseTransportObservabilityEvent,
} from './source-transport-observability';

const transportRequestId = 'transport.req.obs.1';

describe('createTransportObservabilityEvent', () => {
  it('creates a valid event with required fields', () => {
    const event = createTransportObservabilityEvent({
      transportRequestId,
      phase: 'admission_check',
      status: 'success',
    });

    expect(event.eventId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(event.transportRequestId).toBe(transportRequestId);
    expect(event.phase).toBe('admission_check');
    expect(event.status).toBe('success');
    expect(event.timestampMs).toBeGreaterThan(0);
    expect(event.durationMs).toBeUndefined();
  });

  it('creates an event with optional duration and metadata', () => {
    const event = createTransportObservabilityEvent({
      transportRequestId,
      phase: 'exchange_execute',
      status: 'success',
      durationMs: 45.5,
      metadata: { bytesTransferred: 1024, statusCode: 200 },
    });

    expect(event.durationMs).toBe(45.5);
    expect(event.metadata).toEqual({ bytesTransferred: 1024, statusCode: 200 });
  });

  it('throws for invalid phase', () => {
    expect(() =>
      createTransportObservabilityEvent({
        transportRequestId,
        phase: 'invalid_phase' as any,
        status: 'success',
      }),
    ).toThrow('INVALID_TRANSPORT_OBSERVABILITY_PHASE');
  });

  it('throws for invalid status', () => {
    expect(() =>
      createTransportObservabilityEvent({
        transportRequestId,
        phase: 'admission_check',
        status: 'invalid_status' as any,
      }),
    ).toThrow('INVALID_TRANSPORT_OBSERVABILITY_STATUS');
  });

  it('throws for invalid transport request ID format', () => {
    expect(() =>
      createTransportObservabilityEvent({
        transportRequestId: 'invalid id!',
        phase: 'admission_check',
        status: 'success',
      }),
    ).toThrow('INVALID_TRANSPORT_REQUEST_ID_FORMAT');
  });

  it('throws for negative duration', () => {
    expect(() =>
      createTransportObservabilityEvent({
        transportRequestId,
        phase: 'admission_check',
        status: 'success',
        durationMs: -1,
      }),
    ).toThrow('INVALID_DURATION_MS');
  });
});

describe('createTransportObservabilityTrace', () => {
  it('creates a new trace with empty events', () => {
    const trace = createTransportObservabilityTrace(transportRequestId);

    expect(trace.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(trace.transportRequestId).toBe(transportRequestId);
    expect(trace.startedAtMs).toBeGreaterThan(0);
    expect(trace.events).toEqual([]);
    expect(trace.completedAtMs).toBeUndefined();
    expect(trace.finalStatus).toBeUndefined();
    expect(trace.totalDurationMs).toBeUndefined();
  });

  it('throws for invalid transport request ID', () => {
    expect(() => createTransportObservabilityTrace('bad id!')).toThrow(
      'INVALID_TRANSPORT_REQUEST_ID_FORMAT',
    );
  });
});

describe('appendTransportObservabilityEvent', () => {
  it('appends an event to the trace', () => {
    const trace = createTransportObservabilityTrace(transportRequestId);
    const event = createTransportObservabilityEvent({
      transportRequestId,
      phase: 'admission_check',
      status: 'success',
    });

    appendTransportObservabilityEvent(trace, event);

    expect(trace.events).toHaveLength(1);
    expect(trace.events[0]).toBe(event);
  });

  it('throws when event transportRequestId does not match trace', () => {
    const trace = createTransportObservabilityTrace(transportRequestId);
    const event = createTransportObservabilityEvent({
      transportRequestId: 'transport.req.other',
      phase: 'admission_check',
      status: 'success',
    });

    expect(() => appendTransportObservabilityEvent(trace, event)).toThrow(
      'TRANSPORT_OBSERVABILITY_TRACE_REQUEST_ID_MISMATCH',
    );
  });
});

describe('finalizeTransportObservabilityTrace', () => {
  it('sets completion fields on the trace', () => {
    const trace = createTransportObservabilityTrace(transportRequestId);
    const beforeMs = Date.now();

    const finalized = finalizeTransportObservabilityTrace(trace, 'success');

    expect(finalized.completedAtMs).toBeGreaterThanOrEqual(beforeMs);
    expect(finalized.completedAtMs).toBeLessThanOrEqual(Date.now());
    expect(finalized.finalStatus).toBe('success');
    expect(finalized.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(finalized.totalDurationMs).toBeLessThan(10000);
  });
});

describe('calculateTransportMetrics', () => {
  it('calculates metrics from a set of events', () => {
    const now = Date.now();
    const events: ReturnType<typeof createTransportObservabilityEvent>[] = [
      createTransportObservabilityEvent({
        transportRequestId: 'req.1',
        phase: 'admission_check',
        status: 'success',
        durationMs: 10,
      }),
      createTransportObservabilityEvent({
        transportRequestId: 'req.2',
        phase: 'admission_check',
        status: 'blocked',
        durationMs: 5,
        metadata: { reason: 'SOURCE_POLICY_BLOCKED' },
      }),
      createTransportObservabilityEvent({
        transportRequestId: 'req.3',
        phase: 'destination_classify',
        status: 'success',
        durationMs: 2,
        metadata: { isPublic: true },
      }),
      createTransportObservabilityEvent({
        transportRequestId: 'req.4',
        phase: 'destination_classify',
        status: 'success',
        durationMs: 3,
        metadata: { isPublic: false },
      }),
      createTransportObservabilityEvent({
        transportRequestId: 'req.5',
        phase: 'exchange_execute',
        status: 'success',
        durationMs: 50,
      }),
      createTransportObservabilityEvent({
        transportRequestId: 'req.6',
        phase: 'exchange_execute',
        status: 'failed',
        durationMs: 100,
      }),
    ];

    // Adjust timestamps to be within the window
    events.forEach((e) => {
      e.timestampMs = now - 1000;
    });

    const metrics = calculateTransportMetrics(events, now - 2000, now);

    expect(metrics.admissionAttempts).toBe(2);
    expect(metrics.admissionAllowed).toBe(1);
    expect(metrics.admissionBlockedPolicy).toBe(1);
    expect(metrics.destinationsClassified).toBe(2);
    expect(metrics.destinationsPublic).toBe(1);
    expect(metrics.destinationsNonPublic).toBe(1);
    expect(metrics.exchangesExecuted).toBe(2);
    expect(metrics.exchangesSucceeded).toBe(1);
    expect(metrics.exchangesFailed).toBe(1);
    expect(metrics.averageLatencyMs).toBeCloseTo(28.333, 1);
  });

  it('returns zero metrics for empty events', () => {
    const metrics = calculateTransportMetrics([], Date.now() - 3600_000, Date.now());

    expect(metrics.admissionAttempts).toBe(0);
    expect(metrics.exchangesExecuted).toBe(0);
    expect(metrics.averageLatencyMs).toBe(0);
  });

  it('filters events by time window', () => {
    const now = Date.now();
    const oldEvent = createTransportObservabilityEvent({
      transportRequestId: 'req.old',
      phase: 'admission_check',
      status: 'success',
    });
    oldEvent.timestampMs = now - 7200_000; // 2 hours ago

    const newEvent = createTransportObservabilityEvent({
      transportRequestId: 'req.new',
      phase: 'admission_check',
      status: 'success',
    });
    newEvent.timestampMs = now - 1000; // 1 second ago

    const metrics = calculateTransportMetrics([oldEvent, newEvent], now - 3600_000, now);

    expect(metrics.admissionAttempts).toBe(1);
  });

  it('calculates percentile latencies correctly', () => {
    const now = Date.now();
    const events = Array.from({ length: 100 }, (_, i) => {
      const event = createTransportObservabilityEvent({
        transportRequestId: `req.${i}`,
        phase: 'exchange_execute',
        status: 'success',
        durationMs: i + 1,
      });
      event.timestampMs = now - 1000;
      return event;
    });

    const metrics = calculateTransportMetrics(events, now - 2000, now);

    expect(metrics.p95LatencyMs).toBeCloseTo(95, 0);
    expect(metrics.p99LatencyMs).toBeCloseTo(99, 0);
  });
});

describe('serializeTransportObservabilityTrace', () => {
  it('serializes a trace to JSON string', () => {
    const trace = createTransportObservabilityTrace(transportRequestId);
    const event = createTransportObservabilityEvent({
      transportRequestId,
      phase: 'admission_check',
      status: 'success',
      durationMs: 10,
    });
    appendTransportObservabilityEvent(trace, event);
    finalizeTransportObservabilityTrace(trace, 'success');

    const serialized = serializeTransportObservabilityTrace(trace);
    const parsed = JSON.parse(serialized);

    expect(parsed.traceId).toBe(trace.traceId);
    expect(parsed.transportRequestId).toBe(transportRequestId);
    expect(parsed.eventCount).toBe(1);
    expect(parsed.finalStatus).toBe('success');
    expect(parsed.totalDurationMs).toBeDefined();
  });
});

describe('parseTransportObservabilityEvent', () => {
  it('parses a valid event object', () => {
    const raw = {
      eventId: 'event-123',
      transportRequestId: 'transport.req.test',
      phase: 'admission_check' as const,
      status: 'success' as const,
      timestampMs: Date.now(),
      durationMs: 25,
      errorCode: undefined,
      metadata: { test: true },
    };

    const parsed = parseTransportObservabilityEvent(raw);

    expect(parsed.eventId).toBe('event-123');
    expect(parsed.transportRequestId).toBe('transport.req.test');
    expect(parsed.phase).toBe('admission_check');
    expect(parsed.status).toBe('success');
    expect(parsed.durationMs).toBe(25);
    expect(parsed.metadata).toEqual({ test: true });
  });

  it('throws for non-object input', () => {
    expect(() => parseTransportObservabilityEvent(null)).toThrow(
      'INVALID_TRANSPORT_OBSERVABILITY_EVENT_FORMAT',
    );
    expect(() => parseTransportObservabilityEvent('string')).toThrow(
      'INVALID_TRANSPORT_OBSERVABILITY_EVENT_FORMAT',
    );
    expect(() => parseTransportObservabilityEvent([])).toThrow(
      'INVALID_TRANSPORT_OBSERVABILITY_EVENT_FORMAT',
    );
  });

  it('throws for missing required fields', () => {
    expect(() =>
      parseTransportObservabilityEvent({ transportRequestId: 'test', phase: 'admission_check' }),
    ).toThrow('INVALID_EVENT_ID');

    expect(() =>
      parseTransportObservabilityEvent({ eventId: 'e1', phase: 'admission_check', status: 'success', timestampMs: 123 }),
    ).toThrow('INVALID_TRANSPORT_REQUEST_ID');
  });

  it('throws for invalid phase/status', () => {
    expect(() =>
      parseTransportObservabilityEvent({
        eventId: 'e1',
        transportRequestId: 'test',
        phase: 'bad_phase',
        status: 'success',
        timestampMs: 123,
      }),
    ).toThrow('INVALID_PHASE');

    expect(() =>
      parseTransportObservabilityEvent({
        eventId: 'e1',
        transportRequestId: 'test',
        phase: 'admission_check',
        status: 'bad_status',
        timestampMs: 123,
      }),
    ).toThrow('INVALID_STATUS');
  });
});
