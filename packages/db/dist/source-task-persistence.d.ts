import type { Pool } from 'pg';
import { type ClaimedWorkUnit, type WorkFailureResult } from './jobs';
import type { WorkUnitStatus } from './schema';
export declare const SOURCE_EXECUTION_JOB_TYPE = "source.execute";
export declare const SOURCE_EXECUTION_WORK_TYPE = "source.execute";
export declare const SOURCE_EXECUTION_QUEUE_NAME = "brovexa-work-v1";
export declare const SOURCE_EXECUTION_RESULT_EFFECT = "source.execution.result";
export interface SourceTaskBudget {
    maxRequests: number;
    maxPages: number;
    maxBytes: number;
    maxCurrencyMicros: number;
    maxRuntimeMs: number;
    maxConcurrency: number;
}
export interface SourceTaskUsage {
    requests: number;
    pages: number;
    bytes: number;
    currencyMicros: number;
    runtimeMs: number;
}
export type SourceTaskPersistenceErrorCode = 'SOURCE_PREFLIGHT_INPUT_INVALID' | 'SOURCE_PREFLIGHT_SNAPSHOT_NOT_FOUND' | 'SOURCE_PREFLIGHT_SNAPSHOT_IDENTITY_MISMATCH' | 'SOURCE_PREFLIGHT_ID_CONFLICT' | 'SOURCE_PREFLIGHT_IDEMPOTENCY_CONFLICT' | 'SOURCE_TASK_INPUT_INVALID' | 'SOURCE_TASK_PREFLIGHT_NOT_FOUND' | 'SOURCE_TASK_PREFLIGHT_NOT_ALLOWED' | 'SOURCE_TASK_ADMISSION_NOT_FOUND' | 'SOURCE_TASK_ADMISSION_NOT_ALLOWED' | 'SOURCE_TASK_ADMISSION_EXECUTION_INTENT' | 'SOURCE_TASK_ADMISSION_PREFLIGHT_MISMATCH' | 'SOURCE_TASK_ID_CONFLICT' | 'SOURCE_TASK_NOT_FOUND' | 'SOURCE_TASK_STATE_INVALID' | 'SOURCE_TASK_USAGE_ID_CONFLICT' | 'SOURCE_TASK_BUDGET_EXCEEDED' | 'SOURCE_TASK_PROVENANCE_REQUIRED';
export declare class SourceTaskPersistenceError extends Error {
    readonly code: SourceTaskPersistenceErrorCode;
    constructor(code: SourceTaskPersistenceErrorCode, message: string);
}
export interface PersistResearchJobPreflightInput {
    id: string;
    workspaceId: string;
    researchJobId: string;
    idempotencyKey: string;
    admissionSnapshotIds: readonly string[];
    createdAt: Date;
}
export interface ResearchJobPreflightEnvelope {
    id: string;
    workspaceId: string;
    researchJobId: string;
    idempotencyKey: string;
    decision: 'allow' | 'review_required' | 'blocked';
    admissionSnapshotIds: string[];
    aggregateBudget: SourceTaskBudget;
    createdAt: string;
}
export interface PersistResearchJobPreflightResult {
    id: string;
    created: boolean;
    envelope: ResearchJobPreflightEnvelope;
}
export interface CreateSourceTaskInput {
    workspaceId: string;
    researchJobId: string;
    preflightId: string;
    admissionSnapshotId: string;
    sourceTaskId: string;
    maxAttempts?: number;
}
export interface SourceTaskState {
    sourceTaskId: string;
    workspaceId: string;
    researchJobId: string;
    preflightId: string;
    admissionSnapshotId: string;
    requestId: string;
    sourceKey: string;
    capabilityVersion: string;
    connectorKey: string;
    connectorVersion: string;
    policyId: string;
    policyVersion: string;
    operation: string;
    jobRunId: string;
    workUnitId: string;
    correlationId: string;
    jobStatus: string;
    status: WorkUnitStatus;
    attemptCount: number;
    maxAttempts: number;
    effectiveBudget: SourceTaskBudget;
    consumed: SourceTaskUsage;
}
export interface CreateSourceTaskResult {
    created: boolean;
    state: SourceTaskState;
}
export interface RecordSourceTaskUsageInput {
    eventId: string;
    workspaceId: string;
    sourceTaskId: string;
    usage: SourceTaskUsage;
    metadata?: Record<string, unknown>;
    occurredAt: Date;
}
export interface CompleteSourceTaskInput {
    workspaceId: string;
    sourceTaskId: string;
    sourceReferenceIds: readonly string[];
    provenanceRefs: readonly string[];
    resultRef?: string;
}
export interface ResearchJobPreflightState {
    preflight: ResearchJobPreflightEnvelope;
    tasks: SourceTaskState[];
}
export declare function persistResearchJobPreflight(pool: Pool, input: PersistResearchJobPreflightInput): Promise<PersistResearchJobPreflightResult>;
export declare function getResearchJobPreflight(pool: Pool, workspaceId: string, preflightId: string): Promise<ResearchJobPreflightEnvelope | null>;
export declare function getSourceTaskState(pool: Pool, workspaceId: string, sourceTaskId: string): Promise<SourceTaskState | null>;
export declare function createSourceTask(pool: Pool, input: CreateSourceTaskInput): Promise<CreateSourceTaskResult>;
export declare function claimSourceTask(pool: Pool, input: {
    workspaceId: string;
    sourceTaskId: string;
    workerId: string;
    expectedAttempt: number;
    leaseSeconds?: number;
}): Promise<ClaimedWorkUnit | null>;
export declare function recordSourceTaskUsage(pool: Pool, input: RecordSourceTaskUsageInput): Promise<boolean>;
export declare function recordSourceTaskFailure(pool: Pool, input: {
    workspaceId: string;
    sourceTaskId: string;
    errorClass: 'retryable' | 'permanent' | 'cancelled';
    errorCode: string;
    retryDelayMs?: number;
}): Promise<WorkFailureResult>;
export declare function cancelSourceTask(pool: Pool, workspaceId: string, sourceTaskId: string): Promise<WorkUnitStatus>;
export declare function completeSourceTask(pool: Pool, input: CompleteSourceTaskInput): Promise<{
    effectCreated: boolean;
}>;
export declare function getResearchJobPreflightState(pool: Pool, workspaceId: string, preflightId: string): Promise<ResearchJobPreflightState | null>;
