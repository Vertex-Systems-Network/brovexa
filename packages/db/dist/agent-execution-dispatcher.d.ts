import type { Pool } from 'pg';
export declare const AGENT_EXECUTION_JOB_TYPE = "agent.execution.plan";
export declare const AGENT_EXECUTION_QUEUE_NAME = "brovexa-work-v1";
export interface AgentExecutionDispatchInput {
    dispatchId: string;
    workspaceId: string;
    planId: string;
    handlerRegistryVersion: string;
    supportedAgentKeys: readonly string[];
    createdAt: Date;
}
export interface AgentExecutionBudgetUsage {
    tokens: number;
    searches: number;
    apiCalls: number;
    credits: number;
    currencyMicros: number;
    runtimeMs: number;
}
export interface RecordAgentExecutionBudgetUsageInput {
    eventId: string;
    workspaceId: string;
    dispatchId: string;
    stepKey: string;
    usage: AgentExecutionBudgetUsage;
    metadata?: Record<string, unknown> | undefined;
    occurredAt: Date;
}
export interface WriteAgentExecutionCheckpointInput {
    workspaceId: string;
    dispatchId: string;
    stepKey: string;
    checkpointKey: string;
    data: Record<string, unknown>;
}
export interface AgentExecutionDispatchWorkState {
    stepKey: string;
    workUnitId: string;
    status: 'blocked' | 'runnable' | 'running' | 'retry_wait' | 'succeeded' | 'cancelled' | 'dead_letter' | 'review';
    attemptCount: number;
    maxAttempts: number;
    reserved: AgentExecutionBudgetUsage & {
        concurrency: number;
    };
    consumed: AgentExecutionBudgetUsage;
}
export interface AgentExecutionDispatchState {
    dispatchId: string;
    planId: string;
    orchestratorRunId: string;
    jobRunId: string;
    jobRunStatus: string;
    maxParallelism: number;
    workUnits: AgentExecutionDispatchWorkState[];
}
export interface AgentExecutionDispatchResult extends AgentExecutionDispatchState {
    created: boolean;
    newlyRunnableWorkUnitIds: string[];
}
export type AgentExecutionDispatchErrorCode = 'AGENT_DISPATCH_INPUT_INVALID' | 'AGENT_DISPATCH_PLAN_NOT_FOUND' | 'AGENT_DISPATCH_PLAN_INVALID' | 'AGENT_DISPATCH_AUTHORIZATION_REQUIRED' | 'AGENT_DISPATCH_HANDLER_UNAVAILABLE' | 'AGENT_DISPATCH_DEFINITION_NOT_APPROVED' | 'AGENT_DISPATCH_ORCHESTRATOR_RUN_STATE' | 'AGENT_DISPATCH_ID_CONFLICT' | 'AGENT_DISPATCH_PROJECTION_CONFLICT' | 'AGENT_DISPATCH_NOT_FOUND' | 'AGENT_DISPATCH_CHECKPOINT_STATE' | 'AGENT_DISPATCH_BUDGET_EXCEEDED';
export declare class AgentExecutionDispatchError extends Error {
    readonly code: AgentExecutionDispatchErrorCode;
    constructor(code: AgentExecutionDispatchErrorCode, message: string);
}
export declare function dispatchAgentExecutionPlan(pool: Pool, input: AgentExecutionDispatchInput): Promise<AgentExecutionDispatchResult>;
export declare function reconcileAgentExecutionDispatch(pool: Pool, workspaceId: string, dispatchId: string): Promise<AgentExecutionDispatchResult>;
export declare function cancelAgentExecutionDispatch(pool: Pool, workspaceId: string, dispatchId: string): Promise<AgentExecutionDispatchState>;
export declare function writeAgentExecutionCheckpoint(pool: Pool, input: WriteAgentExecutionCheckpointInput): Promise<string>;
export declare function recordAgentExecutionBudgetUsage(pool: Pool, input: RecordAgentExecutionBudgetUsageInput): Promise<boolean>;
export declare function getAgentExecutionDispatchState(pool: Pool, workspaceId: string, dispatchId: string): Promise<AgentExecutionDispatchState | null>;
