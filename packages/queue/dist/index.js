"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BROVEXA_WORK_JOB = exports.BROVEXA_WORK_QUEUE = exports.BROVEXA_QUEUE_PREFIX = void 0;
exports.parseQueueRedisUrl = parseQueueRedisUrl;
exports.deliveryJobId = deliveryJobId;
exports.createWorkQueue = createWorkQueue;
exports.createWorkWorker = createWorkWorker;
exports.ensureWorkDelivery = ensureWorkDelivery;
exports.isWorkDeliveryJob = isWorkDeliveryJob;
exports.getTransportMetrics = getTransportMetrics;
const bullmq_1 = require("bullmq");
exports.BROVEXA_QUEUE_PREFIX = 'brovexa';
exports.BROVEXA_WORK_QUEUE = 'brovexa-work-v1';
exports.BROVEXA_WORK_JOB = 'execute-work-unit';
function parseQueueRedisUrl(value) {
    const url = new URL(value);
    if (url.protocol !== 'redis:') {
        throw new Error('M01 queue transport requires a redis:// URL. TLS/provider configuration is deferred.');
    }
    if (!url.hostname)
        throw new Error('Queue Redis URL requires a hostname.');
    const rawDb = url.pathname.replace(/^\//, '');
    const db = rawDb === '' ? 0 : Number(rawDb);
    if (!Number.isInteger(db) || db < 0)
        throw new Error('Queue Redis URL database must be a non-negative integer.');
    return {
        host: url.hostname,
        port: url.port ? Number(url.port) : 6379,
        db,
        maxRetriesPerRequest: null,
        ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
        ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    };
}
function deliveryJobId(workUnitId, deliveryAttempt) {
    if (!Number.isInteger(deliveryAttempt) || deliveryAttempt < 1) {
        throw new Error('deliveryAttempt must be a positive integer.');
    }
    return `wu-${workUnitId}-a${deliveryAttempt}`;
}
function createWorkQueue(connection) {
    return new bullmq_1.Queue(exports.BROVEXA_WORK_QUEUE, {
        prefix: exports.BROVEXA_QUEUE_PREFIX,
        connection,
        defaultJobOptions: {
            attempts: 1,
            removeOnComplete: true,
            removeOnFail: 1000,
        },
    });
}
function createWorkWorker(connection, processor, concurrency = 1) {
    return new bullmq_1.Worker(exports.BROVEXA_WORK_QUEUE, processor, {
        prefix: exports.BROVEXA_QUEUE_PREFIX,
        connection,
        concurrency,
    });
}
async function ensureWorkDelivery(queue, envelope, delayMs = 0) {
    const jobId = deliveryJobId(envelope.workUnitId, envelope.deliveryAttempt);
    const existing = await queue.getJob(jobId);
    if (existing) {
        const state = await existing.getState();
        if (state === 'failed' || state === 'completed') {
            await existing.remove();
        }
        else {
            return false;
        }
    }
    await queue.add(exports.BROVEXA_WORK_JOB, envelope, {
        jobId,
        delay: Math.max(0, Math.floor(delayMs)),
    });
    return true;
}
function isWorkDeliveryJob(job) {
    return job.name === exports.BROVEXA_WORK_JOB;
}
async function getTransportMetrics(queue) {
    const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
    return {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
    };
}
//# sourceMappingURL=index.js.map