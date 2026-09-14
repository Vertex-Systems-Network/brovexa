import { Queue, Worker, type ConnectionOptions, type Job, type Processor } from 'bullmq';
export declare const BROVEXA_QUEUE_PREFIX = "brovexa";
export declare const BROVEXA_WORK_QUEUE = "brovexa-work-v1";
export declare const BROVEXA_WORK_JOB = "execute-work-unit";
export interface WorkDeliveryEnvelope {
    workUnitId: string;
    correlationId: string;
    deliveryAttempt: number;
}
export type QueueConnectionOptions = ConnectionOptions;
export type WorkQueue = Queue<WorkDeliveryEnvelope>;
export interface TransportMetrics {
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
}
export declare function parseQueueRedisUrl(value: string): ConnectionOptions;
export declare function deliveryJobId(workUnitId: string, deliveryAttempt: number): string;
export declare function createWorkQueue(connection: ConnectionOptions): WorkQueue;
export declare function createWorkWorker(connection: ConnectionOptions, processor: Processor<WorkDeliveryEnvelope>, concurrency?: number): Worker<WorkDeliveryEnvelope>;
export declare function ensureWorkDelivery(queue: WorkQueue, envelope: WorkDeliveryEnvelope, delayMs?: number): Promise<boolean>;
export declare function isWorkDeliveryJob(job: Job<WorkDeliveryEnvelope>): boolean;
export declare function getTransportMetrics(queue: WorkQueue): Promise<TransportMetrics>;
