import { probeDatabase, type createPgPool } from '@brovexa/db';
import { type QueueConnectionOptions, type TransportMetrics, type WorkQueue } from '@brovexa/queue';
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
export interface CanonicalWorkerReadiness {
    ready: boolean;
    database: Awaited<ReturnType<typeof probeDatabase>>;
    queue: {
        ready: true;
        metrics: TransportMetrics;
    };
}
export interface CanonicalWorkerRuntime {
    queue: WorkQueue;
    reconcile(): Promise<number>;
    readiness(): Promise<CanonicalWorkerReadiness>;
    close(): Promise<void>;
}
export declare function calculateRetryDelayMs(workUnitId: string, attempt: number, baseDelayMs?: number, maxDelayMs?: number): number;
export declare function createCanonicalWorkerRuntime(options: CanonicalWorkerOptions): Promise<CanonicalWorkerRuntime>;
