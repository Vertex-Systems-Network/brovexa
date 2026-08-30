import {
  claimWorkUnit,
  completeWorkUnitWithEffect,
  isWorkCancellationRequested,
  listRecoverableWorkUnits,
  probeDatabase,
  recordWorkFailure,
  type createPgPool,
} from '@brovexa/db';
import {
  createWorkQueue,
  createWorkWorker,
  ensureWorkDelivery,
  getTransportMetrics,
  isWorkDeliveryJob,
  type QueueConnectionOptions,
  type WorkDeliveryEnvelope,
} from '@brovexa/queue';
import { CancelledWorkError, PermanentWorkError, RetryableWorkError } from './errors';

export interface WorkHandlerContext {
  workUnitId: string;
  jobRunId: string;
  workspaceId: string;
  workType: string;
  workVersion: number;
  correlationId: string;
  payload: Record<string, unknown>;
  attempt: number;
  isCancellationRequested: () => Promise<boolean>;
}

export interface WorkHandlerResult {
  effectKey: string;
  effectData?: Record<string, unknown>;
}

export type WorkHandler = (context: WorkHandlerContext) => Promise<WorkHandlerResult>;

export interface CanonicalWorkerOptions {
  pool: ReturnType<typeof createPgPool>;
  connection: QueueConnectionOptions;
  handlers: Readonly<Record<string, WorkHandler>>;
  workerId: string;
  leaseSeconds?: number;
  concurrency?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
}

export function calculateRetryDelayMs(
  workUnitId: string,
  attempt: number,
  baseDelayMs = 500,
  maxDelayMs = 30_000,
): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
  let hash = 0;
  for (const character of workUnitId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const jitterRatio = ((hash % 401) - 200) / 1000;
  return Math.max(0, Math.round(exponential * (1 + jitterRatio)));
}

function classifyWorkError(error: unknown): {
  errorClass: 'retryable' | 'permanent' | 'cancelled';
  code: string;
} {
  if (error instanceof CancelledWorkError) return { errorClass: 'cancelled', code: error.code };
  if (error instanceof PermanentWorkError) return { errorClass: 'permanent', code: error.code };
  if (error instanceof RetryableWorkError) return { errorClass: 'retryable', code: error.code };
  return { errorClass: 'permanent', code: 'UNCLASSIFIED_WORK_ERROR' };
}

export async function createCanonicalWorkerRuntime(options: CanonicalWorkerOptions) {
  const queue = createWorkQueue(options.connection);
  const leaseSeconds = options.leaseSeconds ?? 30;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? 500;
  const retryMaxDelayMs = options.retryMaxDelayMs ?? 30_000;

  const worker = createWorkWorker(
    options.connection,
    async (job) => {
      if (!isWorkDeliveryJob(job)) return { status: 'ignored' };

      const envelope: WorkDeliveryEnvelope = job.data;
      const claimed = await claimWorkUnit(
        options.pool,
        envelope.workUnitId,
        options.workerId,
        envelope.deliveryAttempt,
        leaseSeconds,
      );

      if (!claimed) return { status: 'stale' };

      const cancellationCheck = () => isWorkCancellationRequested(options.pool, claimed.id);

      try {
        if (await cancellationCheck()) throw new CancelledWorkError();

        const handler = options.handlers[claimed.workType];
        if (!handler) throw new PermanentWorkError('UNSUPPORTED_WORK_TYPE');

        const result = await handler({
          workUnitId: claimed.id,
          jobRunId: claimed.jobRunId,
          workspaceId: claimed.workspaceId,
          workType: claimed.workType,
          workVersion: claimed.workVersion,
          correlationId: claimed.correlationId,
          payload: claimed.payload,
          attempt: claimed.attemptCount,
          isCancellationRequested: cancellationCheck,
        });

        if (await cancellationCheck()) throw new CancelledWorkError();

        const completion = await completeWorkUnitWithEffect(
          options.pool,
          claimed.id,
          result.effectKey,
          result.effectData ?? {},
        );
        return { status: 'succeeded', effectCreated: completion.effectCreated };
      } catch (error) {
        const classified = classifyWorkError(error);
        const retryDelayMs =
          classified.errorClass === 'retryable'
            ? calculateRetryDelayMs(
                claimed.id,
                claimed.attemptCount,
                retryBaseDelayMs,
                retryMaxDelayMs,
              )
            : 0;
        const failure = await recordWorkFailure(
          options.pool,
          claimed.id,
          classified.errorClass,
          classified.code,
          retryDelayMs,
        );

        if (failure.status === 'retry_wait') {
          const deliveryDelayMs = failure.nextAttemptAt
            ? Math.max(0, failure.nextAttemptAt.getTime() - Date.now())
            : 0;
          await ensureWorkDelivery(
            queue,
            {
              workUnitId: claimed.id,
              correlationId: claimed.correlationId,
              deliveryAttempt: failure.attemptCount + 1,
            },
            deliveryDelayMs,
          );
        }

        return { status: failure.status, errorCode: classified.code };
      }
    },
    options.concurrency ?? 1,
  );

  async function reconcile(): Promise<number> {
    const recoverable = await listRecoverableWorkUnits(options.pool);
    let enqueued = 0;

    for (const work of recoverable) {
      const delayMs = work.nextAttemptAt ? Math.max(0, work.nextAttemptAt.getTime() - Date.now()) : 0;
      if (
        await ensureWorkDelivery(
          queue,
          {
            workUnitId: work.id,
            correlationId: work.correlationId,
            deliveryAttempt: work.attemptCount + 1,
          },
          delayMs,
        )
      ) {
        enqueued += 1;
      }
    }

    return enqueued;
  }

  async function readiness() {
    const database = await probeDatabase(options.pool);
    await queue.waitUntilReady();
    const metrics = await getTransportMetrics(queue);
    return {
      ready: database.serverMajor === 18 && database.schemaReady,
      database,
      queue: { ready: true, metrics },
    };
  }

  async function close(): Promise<void> {
    await worker.close();
    await queue.close();
  }

  return { queue, worker, reconcile, readiness, close };
}
