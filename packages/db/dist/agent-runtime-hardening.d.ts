import type { Pool } from 'pg';
import type { PersistedAgentRunStatus } from './agent-run-schema';
import { type WorkspaceAuthorizationContext } from './identity';
import type { JobRunStatus, WorkUnitStatus } from './schema';
export type AgentRuntimeHardeningErrorCode = 'AGENT_ROUTE_INPUT_INVALID' | 'AGENT_ROUTE_POLICY_INVALID' | 'AGENT_ROUTE_DETERMINISTIC_PROVIDER_FORBIDDEN' | 'AGENT_ROUTE_SELECTION_REQUIRED' | 'AGENT_ROUTE_PROVIDER_NOT_APPROVED' | 'AGENT_ROUTE_MODEL_NOT_APPROVED' | 'AGENT_ROUTE_FALLBACK_NOT_ENABLED' | 'AGENT_TRACE_INPUT_INVALID' | 'AGENT_TRACE_PROJECTION_CONFLICT' | 'AGENT_TRACE_LIMIT_EXCEEDED';
export declare class AgentRuntimeHardeningError extends Error {
    readonly code: AgentRuntimeHardeningErrorCode;
    constructor(code: AgentRuntimeHardeningErrorCode, message: string);
}
export interface ResolveAgentExecutionRouteInput {
    agentKey: string;
    agentVersion: string;
    providerId?: string | undefined;
    modelId?: string | undefined;
    allowFallback?: boolean | undefined;
}
export interface ResolvedAgentExecutionRoute {
    definitionId: string;
    agentKey: string;
    agentVersion: string;
    routingMode: 'deterministic_only' | 'approved_models';
    executionMode: 'deterministic' | 'model';
    providerId: string | null;
    modelId: string | null;
    fallbackUsed: boolean;
    allowedProviderIds: readonly string[];
    allowedModelIds: readonly string[];
    fallbackModelIds: readonly string[];
}
export interface GetAgentExecutionTraceInput {
    workspaceId: string;
    userId: string;
    dispatchId: string;
}
export interface AgentExecutionTraceJobRun {
    id: string;
    jobType: string;
    jobVersion: number;
    correlationId: string;
    status: JobRunStatus;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface AgentExecutionTracePlan {
    id: string;
    userId: string;
    runId: string;
    contextReceiptId: string;
    orchestratorDefinitionId: string;
    orchestratorKey: string;
    orchestratorVersion: string;
    planVersion: number;
    maxParallelism: number;
    stepCount: number;
    envelope: Record<string, unknown>;
    createdAt: string;
}
export interface AgentExecutionTraceEffect {
    id: string;
    effectKey: string;
    data: Record<string, unknown>;
    createdAt: string;
}
export interface AgentExecutionTraceCheckpoint {
    id: string;
    checkpointKey: string;
    data: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
export interface AgentExecutionTraceWorkUnit {
    id: string;
    queueName: string;
    workType: string;
    workVersion: number;
    correlationId: string;
    status: WorkUnitStatus;
    attemptCount: number;
    maxAttempts: number;
    nextAttemptAt: string | null;
    cancellationRequestedAt: string | null;
    workerId: string | null;
    leaseExpiresAt: string | null;
    lastErrorCode: string | null;
    lastErrorClass: string | null;
    payload: Record<string, unknown>;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
    effects: readonly AgentExecutionTraceEffect[];
    checkpoints: readonly AgentExecutionTraceCheckpoint[];
}
export interface AgentExecutionTraceAgentRun {
    id: string;
    agentDefinitionId: string;
    agentKey: string;
    agentVersion: string;
    contextReceiptId: string;
    parentRunId: string | null;
    handoffId: string | null;
    executionMode: 'deterministic' | 'model';
    providerId: string | null;
    modelId: string | null;
    status: PersistedAgentRunStatus;
    lastTransitionId: string | null;
    envelope: Record<string, unknown>;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface AgentExecutionTraceTransition {
    id: string;
    runId: string;
    fromStatus: PersistedAgentRunStatus;
    toStatus: PersistedAgentRunStatus;
    reasonCode: string;
    actorType: string;
    actorId: string | null;
    metadata: Record<string, unknown>;
    occurredAt: string;
}
export interface AgentExecutionTraceEvaluation {
    id: string;
    evaluatorRunId: string;
    subjectRunId: string;
    decision: string;
    evidenceState: string;
    reasonCodes: readonly string[];
    evidenceRefs: readonly string[];
    policyRefs: readonly string[];
    confidence: number;
    envelope: Record<string, unknown>;
    createdAt: string;
}
export interface AgentExecutionTrace {
    authorization: WorkspaceAuthorizationContext;
    workspaceId: string;
    dispatchId: string;
    jobRun: AgentExecutionTraceJobRun;
    plan: AgentExecutionTracePlan;
    workUnits: readonly AgentExecutionTraceWorkUnit[];
    agentRuns: readonly AgentExecutionTraceAgentRun[];
    transitions: readonly AgentExecutionTraceTransition[];
    evaluations: readonly AgentExecutionTraceEvaluation[];
}
export declare function resolveAgentExecutionRoute(pool: Pool, input: ResolveAgentExecutionRouteInput): Promise<ResolvedAgentExecutionRoute>;
export declare function getAgentExecutionTrace(pool: Pool, input: GetAgentExecutionTraceInput): Promise<AgentExecutionTrace | null>;
