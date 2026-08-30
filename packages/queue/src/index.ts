import {
  Queue,
  Worker,
  type ConnectionOptions,
  type Job,
  type Processor,
} from 'bullmq';

export const BROVEXA_QUEUE_PREFIX = 'brovexa';
export const BROVEXA_WORK_QUEUE = 'brovexa-work-v1';
export const BROVEXA_WORK_JOB = 'execute-work-unit';

export interface WorkDeliveryEnvelope {
  workUnitId: string;
  correlationId: string;
  deliveryAttempt: number;
}

export type QueueConnectionOptions = ConnectionOptions;

export interface TransportMetrics {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
}

export function parseQueueRedisUrl(value: string): ConnectionOptions {
  const url = new URL(value);
  if (url.protocol !== 'redis:') {
    throw new Error('M01 queue transport requires a redis:// URL. TLS/provider configuration is deferred.');
  }
  if (!url.hostname) throw new Error('Queue Redis URL requires a hostname.');

  const rawDb = url.pathname.replace(/^\//, '');
  const db = rawDb === '' ? 0 : Number(rawDb);
  if (!Number.isInteger(db) || db < 0) throw new Error('Queue Redis URL database must be a non-negative integer.');

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    db,
    maxRetriesPerRequest: null,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
  };
}

export function deliveryJobId(workUnitId: string, deliveryAttempt: number): string {
  if (!Number.isInteger(deliveryAttempt) || deliveryAttempt < 1) {
    throw new Error('deliveryAttempt must be a positive integer.');
  }
  return `wu-${workUnitId}-a${deliveryAttempt}`;
}

export function createWorkQueue(connection: ConnectionOptions): Queue<WorkDeliveryEnvelope> {
  return new Queue<WorkDeliveryEnvelope>(BROVEXA_WORK_QUEUE, {
    prefix: BROVEXA_QUEUE_PREFIX,
    connection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: 1000,
    },
  });
}

export function createWorkWorker(
  connection: ConnectionOptions,
  processor: Processor<WorkDeliveryEnvelope>,
  concurrency = 1,
): Worker<WorkDeliveryEnvelope> {
  return new Worker<WorkDeliveryEnvelope>(BROVEXA_WORK_QUEUE, processor, {
    prefix: BROVEXA_QUEUE_PREFIX,
    connection,
    concurrency,
  });
}

export async function ensureWorkDelivery(
  queue: Queue<WorkDeliveryEnvelope>,
  envelope: WorkDeliveryEnvelope,
  delayMs = 0,
): Promise<boolean> {
  const jobId = deliveryJobId(envelope.workUnitId, envelope.deliveryAttempt);
  const existing = await queue.getJob(jobId);

  if (existing) {
    const state = await existing.getState();
    if (state === 'failed' || state === 'completed') {
      await existing.remove();
    } else {
      return false;
    }
  }

  await queue.add(BROVEXA_WORK_JOB, envelope, {
    jobId,
    delay: Math.max(0, Math.floor(delayMs)),
  });
  return true;
}

export function isWorkDeliveryJob(job: Job<WorkDeliveryEnvelope>): boolean {
  return job.name === BROVEXA_WORK_JOB;
}

export async function getTransportMetrics(
  queue: Queue<WorkDeliveryEnvelope>,
): Promise<TransportMetrics> {
  const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
  return {
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    delayed: counts.delayed ?? 0,
    failed: counts.failed ?? 0,
  };
}
