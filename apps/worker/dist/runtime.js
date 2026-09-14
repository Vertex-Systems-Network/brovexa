"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRetryDelayMs = calculateRetryDelayMs;
exports.createCanonicalWorkerRuntime = createCanonicalWorkerRuntime;
const db_1 = require("@brovexa/db");
const queue_1 = require("@brovexa/queue");
const errors_1 = require("./errors");
function calculateRetryDelayMs(workUnitId, attempt, baseDelayMs = 500, maxDelayMs = 30_000) {
    const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
    let hash = 0;
    for (const character of workUnitId)
        hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    const jitterRatio = ((hash % 401) - 200) / 1000;
    return Math.max(0, Math.round(exponential * (1 + jitterRatio)));
}
function classifyWorkError(error) {
    if (error instanceof errors_1.CancelledWorkError)
        return { errorClass: 'cancelled', code: error.code };
    if (error instanceof errors_1.PermanentWorkError)
        return { errorClass: 'permanent', code: error.code };
    if (error instanceof errors_1.RetryableWorkError)
        return { errorClass: 'retryable', code: error.code };
    return { errorClass: 'permanent', code: 'UNCLASSIFIED_WORK_ERROR' };
}
async function createCanonicalWorkerRuntime(options) {
    const queue = (0, queue_1.createWorkQueue)(options.connection);
    const leaseSeconds = options.leaseSeconds ?? 30;
    const retryBaseDelayMs = options.retryBaseDelayMs ?? 500;
    const retryMaxDelayMs = options.retryMaxDelayMs ?? 30_000;
    const worker = (0, queue_1.createWorkWorker)(options.connection, async (job) => {
        if (!(0, queue_1.isWorkDeliveryJob)(job))
            return { status: 'ignored' };
        const envelope = job.data;
        const claimed = await (0, db_1.claimWorkUnit)(options.pool, envelope.workUnitId, options.workerId, envelope.deliveryAttempt, leaseSeconds);
        if (!claimed)
            return { status: 'stale' };
        const cancellationCheck = () => (0, db_1.isWorkCancellationRequested)(options.pool, claimed.id);
        try {
            if (await cancellationCheck())
                throw new errors_1.CancelledWorkError();
            const handler = options.handlers[claimed.workType];
            if (!handler)
                throw new errors_1.PermanentWorkError('UNSUPPORTED_WORK_TYPE');
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
            if (await cancellationCheck())
                throw new errors_1.CancelledWorkError();
            const completion = await (0, db_1.completeWorkUnitWithEffect)(options.pool, claimed.id, result.effectKey, result.effectData ?? {});
            return { status: 'succeeded', effectCreated: completion.effectCreated };
        }
        catch (error) {
            const classified = classifyWorkError(error);
            const retryDelayMs = classified.errorClass === 'retryable'
                ? calculateRetryDelayMs(claimed.id, claimed.attemptCount, retryBaseDelayMs, retryMaxDelayMs)
                : 0;
            const failure = await (0, db_1.recordWorkFailure)(options.pool, claimed.id, classified.errorClass, classified.code, retryDelayMs);
            if (failure.status === 'retry_wait') {
                const deliveryDelayMs = failure.nextAttemptAt
                    ? Math.max(0, failure.nextAttemptAt.getTime() - Date.now())
                    : 0;
                await (0, queue_1.ensureWorkDelivery)(queue, {
                    workUnitId: claimed.id,
                    correlationId: claimed.correlationId,
                    deliveryAttempt: failure.attemptCount + 1,
                }, deliveryDelayMs);
            }
            return { status: failure.status, errorCode: classified.code };
        }
    }, options.concurrency ?? 1);
    async function reconcile() {
        const recoverable = await (0, db_1.listRecoverableWorkUnits)(options.pool);
        let enqueued = 0;
        for (const work of recoverable) {
            const delayMs = work.nextAttemptAt ? Math.max(0, work.nextAttemptAt.getTime() - Date.now()) : 0;
            if (await (0, queue_1.ensureWorkDelivery)(queue, {
                workUnitId: work.id,
                correlationId: work.correlationId,
                deliveryAttempt: work.attemptCount + 1,
            }, delayMs)) {
                enqueued += 1;
            }
        }
        return enqueued;
    }
    async function readiness() {
        const database = await (0, db_1.probeDatabase)(options.pool);
        await queue.waitUntilReady();
        const metrics = await (0, queue_1.getTransportMetrics)(queue);
        return {
            ready: database.serverMajor === 18 && database.schemaReady,
            database,
            queue: { ready: true, metrics },
        };
    }
    async function close() {
        await worker.close();
        await queue.close();
    }
    return { queue, reconcile, readiness, close };
}
//# sourceMappingURL=runtime.js.map