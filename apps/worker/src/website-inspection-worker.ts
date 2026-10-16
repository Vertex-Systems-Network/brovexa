import { createHash } from 'node:crypto';
import type { WebsiteInspectionRequest, WebsiteInspectionResult } from '@brovexa/contracts';
import { CancelledWorkError, PermanentWorkError, RetryableWorkError } from './errors';
import type { WorkHandler, WorkHandlerContext, WorkHandlerResult } from './runtime';
import { WebsiteInspectionRuntimeError } from './website-inspection-runtime';
import type { WebsiteFixtureRunOptions } from './website-inspection-pipeline';

/**
 * WEB-023: M04 fixture-only worker handoff, intentionally NOT registered by
 * default. Native queue registration and DB ownership need the module gate.
 * No HTTP, DNS, production fetch or real-web crawling is authorized here.
 */
export const M04_WEBSITE_INSPECTION_WORK_TYPE = 'website_inspection_fixture';
export const M04_WEBSITE_INSPECTION_WORK_VERSION = 1;

const identifier = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

export interface WebsiteInspectionWorkerDependencies {
  /** Parse with the actual frozen WEB-001 request schema (Zod). */
  parseRequest(value: unknown): WebsiteInspectionRequest;
  /** Reject fabricated or malformed result evidence before queue effect creation. */
  parseResult(value: unknown): WebsiteInspectionResult;
  /** Trusted workspace-scoped DB read; NEVER derive approval from queue payload. */
  loadRequest(key: Readonly<{
    workspaceId: string;
    inspectionId: string;
  }>): Promise<unknown>;
  /** Inject the fixture-only pipeline from createWebsiteFixturePipeline(). */
  runInspection(
    request: WebsiteInspectionRequest,
    options: WebsiteFixtureRunOptions,
  ): Promise<WebsiteInspectionResult>;
  /** Bounded polling cadence; not a lease-heartbeat or transaction timeout. */
  cancellationPollMs?: number;
}

function payloadInspectionId(context: WorkHandlerContext): string {
  const invalid = (): never => { throw new PermanentWorkError('M04_WORK_PAYLOAD_INVALID'); };
  if (context.workType !== M04_WEBSITE_INSPECTION_WORK_TYPE ||
      context.workVersion !== M04_WEBSITE_INSPECTION_WORK_VERSION ||
      !identifier.test(context.workspaceId) || !identifier.test(context.workUnitId) ||
      !identifier.test(context.jobRunId) || !identifier.test(context.correlationId) ||
      !Number.isSafeInteger(context.attempt) || context.attempt < 1) invalid();
  const raw: unknown = context.payload;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) invalid();
  let keys: PropertyKey[];
  try { keys = Reflect.ownKeys(raw); } catch { return invalid(); }
  if (keys.length !== 2 || !keys.includes('kind') || !keys.includes('inspectionId')) invalid();
  const own = (name: string): unknown => {
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(raw, name); } catch { invalid(); }
    if (!descriptor || !('value' in descriptor)) invalid();
    return descriptor.value;
  };
  if (own('kind') !== 'website_inspection_fixture') invalid();
  const id = own('inspectionId');
  if (typeof id !== 'string' || !identifier.test(id)) invalid();
  return id;
}

/**
 * Translate an async DB cancellation check into an AbortSignal. Each handler
 * invocation owns its own controller/timer, and a slow check never overlaps
 * with the next poll. A transient DB failure aborts the local pipeline but
 * classifies work as retryable rather than falsely reporting user cancellation.
 */
async function runWithWorkerCancellation<T>(
  context: WorkHandlerContext,
  pollMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let stopped = false;
  let pendingPoll: Promise<void> | null = null;
  let monitorError: RetryableWorkError | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  const poll = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    // Serialize polling: the final work check must await any in-flight poll.
    if (pendingPoll) return pendingPoll;
    pendingPoll = (async () => {
      try {
        if (await context.isCancellationRequested() && !stopped) controller.abort();
      } catch {
        if (!stopped) {
          monitorError = new RetryableWorkError('M04_CANCELLATION_CHECK_FAILED');
          controller.abort();
        }
      }
    })().finally(() => { pendingPoll = null; });
    return pendingPoll;
  };
  const assertMonitor = (): void => {
    if (monitorError !== null) throw monitorError;
    if (controller.signal.aborted) throw new CancelledWorkError('M04_WORK_CANCELLED');
  };
  try {
    await poll();
    assertMonitor();
    timer = setInterval(() => { void poll(); }, pollMs);
    const result = await run(controller.signal);
    // The worker runtime also checks cancellation before writing job effects.
    await poll();
    assertMonitor();
    return result;
  } catch (error) {
    if (monitorError !== null) throw monitorError;
    if (controller.signal.aborted ||
        (error instanceof WebsiteInspectionRuntimeError && error.code === 'M04_FIXTURE_CANCELLED')) {
      throw new CancelledWorkError('M04_WORK_CANCELLED');
    }
    throw error;
  } finally {
    stopped = true;
    if (timer !== undefined) clearInterval(timer);
  }
}

function effectFromResult(
  workspace: string,
  inspectionId: string,
  result: WebsiteInspectionResult,
): WorkHandlerResult {
  if (!result || result.bodyIncluded !== false ||
      result.request?.workspaceId !== workspace ||
      result.request?.inspectionId !== inspectionId ||
      !['assessed', 'review_required', 'unavailable'].includes(result.status) ||
      !['bounded', 'partial', 'none'].includes(result.coverage) ||
      !Array.isArray(result.reasonCodes) || !Array.isArray(result.transportReceiptIds) ||
      !Array.isArray(result.observations)) {
    throw new PermanentWorkError('M04_WORK_RESULT_BINDING_INVALID');
  }
  // An identical inspection gets an identical effect key across retries.
  // Never place HTML bytes, credentials, or fixture bodies into effectData.
  const identity = createHash('sha256')
    .update(JSON.stringify([workspace, inspectionId])).digest('hex');
  return {
    effectKey: `m04.website_inspection.${identity}`,
    effectData: {
      inspectionId,
      status: result.status,
      coverage: result.coverage,
      observationCount: result.observations.length,
      reasonCodes: [...result.reasonCodes],
      receiptCount: result.transportReceiptIds.length,
      bodyIncluded: false,
    },
  };
}

export function createWebsiteInspectionWorkHandler(
  dependencies: WebsiteInspectionWorkerDependencies,
): WorkHandler {
  const pollMs = dependencies.cancellationPollMs ?? 1_000;
  if (!Number.isSafeInteger(pollMs) || pollMs < 100 || pollMs > 30_000) {
    throw new RangeError('M04 cancellationPollMs must be 100-30000 milliseconds.');
  }
  return async (context) => {
    const inspectionId = payloadInspectionId(context);
    const key = Object.freeze({ workspaceId: context.workspaceId, inspectionId });
    return runWithWorkerCancellation(context, pollMs, async (signal) => {
      // Pending trusted DB lookup must be interruptible for the WORKER. This
      // cancels waiting, not an uncooperative DB query already in progress.
      const loaded = await new Promise<unknown>((resolve, reject) => {
        if (signal.aborted) {
          reject(new CancelledWorkError('M04_WORK_CANCELLED'));
          return;
        }
        const cancel = (): void => { cleanup(); reject(new CancelledWorkError('M04_WORK_CANCELLED')); };
        const cleanup = (): void => signal.removeEventListener('abort', cancel);
        signal.addEventListener('abort', cancel, { once: true });
        void Promise.resolve().then(() => {
          if (signal.aborted) throw new CancelledWorkError('M04_WORK_CANCELLED');
          return dependencies.loadRequest(key);
        }).then(
          (value) => { cleanup(); resolve(value); },
          (error: unknown) => { cleanup(); reject(error); },
        );
      });
      if (signal.aborted) throw new CancelledWorkError('M04_WORK_CANCELLED');
      if (loaded == null) throw new PermanentWorkError('M04_WORK_REQUEST_MISSING');
      let request: WebsiteInspectionRequest;
      try { request = structuredClone(dependencies.parseRequest(loaded)); }
      catch { throw new PermanentWorkError('M04_WORK_REQUEST_INVALID'); }
      if (request.workspaceId !== key.workspaceId || request.inspectionId !== key.inspectionId ||
          request.executionMode !== 'test_only' || request.networkRequested !== false ||
          request.credentialedFetchRequested !== false || request.rawPayloadRequested !== false ||
          request.outreachRequested !== false || request.sourceAdmissionDecision !== 'allow') {
        throw new PermanentWorkError('M04_WORK_REQUEST_SCOPE_MISMATCH');
      }
      if (signal.aborted) throw new CancelledWorkError('M04_WORK_CANCELLED');
      const rawResult = await dependencies.runInspection(request, { cancellationSignal: signal });
      let result: WebsiteInspectionResult;
      try { result = dependencies.parseResult(rawResult); }
      catch { throw new PermanentWorkError('M04_WORK_RESULT_INVALID'); }
      return effectFromResult(key.workspaceId, key.inspectionId, result);
    });
  };
}