import type { Pool } from 'pg';
import type { WorkErrorClass, WorkUnitStatus } from './schema';
export interface CreateCanonicalWorkInput {
    workspaceId: string;
    jobType: string;
    workType: string;
    idempotencyKey: string;
    queueName: string;
    payload?: Record<string, unknown>;
    jobVersion?: number;
    workVersion?: number;
    maxAttempts?: number;
}
export interface CanonicalWorkIdentity {
    jobRunId: string;
    workUnitId: string;
    correlationId: string;
    created: boolean;
}
export interface ClaimedWorkUnit {
    id: string;
    jobRunId: string;
    workspaceId: string;
    workType: string;
    workVersion: number;
    correlationId: string;
    payload: Record<string, unknown>;
    attemptCount: number;
    maxAttempts: number;
}
export interface RecoverableWorkUnit {
    id: string;
    correlationId: string;
    attemptCount: number;
    nextAttemptAt: Date | null;
}
export interface WorkFailureResult {
    status: WorkUnitStatus;
    attemptCount: number;
    maxAttempts: number;
    nextAttemptAt: Date | null;
}
export declare function createCanonicalWork(pool: Pool, input: CreateCanonicalWorkInput): Promise<CanonicalWorkIdentity>;
export declare function claimWorkUnit(pool: Pool, workUnitId: string, workerId: string, expectedAttempt: number, leaseSeconds?: number): Promise<ClaimedWorkUnit | null>;
export declare function isWorkCancellationRequested(pool: Pool, workUnitId: string): Promise<boolean>;
export declare function requestWorkCancellation(pool: Pool, workUnitId: string): Promise<WorkUnitStatus | null>;
export declare function completeWorkUnitWithEffect(pool: Pool, workUnitId: string, effectKey: string, effectData: Record<string, unknown>): Promise<{
    effectCreated: boolean;
}>;
export declare function recordWorkFailure(pool: Pool, workUnitId: string, errorClass: WorkErrorClass, errorCode: string, retryDelayMs?: number): Promise<WorkFailureResult>;
export declare function listRecoverableWorkUnits(pool: Pool): Promise<RecoverableWorkUnit[]>;
export declare function getWorkUnitStatus(pool: Pool, workUnitId: string): Promise<{
    status: WorkUnitStatus;
    attemptCount: number;
    maxAttempts: number;
} | null>;
export declare function countWorkEffects(pool: Pool, workUnitId: string): Promise<number>;
