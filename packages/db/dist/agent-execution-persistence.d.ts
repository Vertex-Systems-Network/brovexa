import type { Pool } from 'pg';
export interface AgentExecutionBudgetInput {
    maxTokens: number;
    maxSearches: number;
    maxApiCalls: number;
    maxCredits: number;
    maxCurrencyMicros: number;
    maxRuntimeMs: number;
    maxConcurrency: number;
}
export interface AgentExecutionStepInput {
    key: string;
    agentKey: string;
    agentVersion: string;
    dependencies: readonly string[];
    toolKeys: readonly string[];
    commandKeys: readonly string[];
    policyRefs: readonly string[];
    canonicalRefs: readonly string[];
    memoryRefs: readonly string[];
    budget: AgentExecutionBudgetInput;
}
export interface PersistAgentExecutionPlanInput {
    id: string;
    workspaceId: string;
    userId: string;
    runId: string;
    contextReceiptId: string;
    orchestratorKey: string;
    orchestratorVersion: string;
    planVersion: number;
    maxParallelism: number;
    steps: readonly AgentExecutionStepInput[];
    parentRunId?: string | undefined;
    handoffId?: string | undefined;
    createdAt: Date;
}
export interface PersistedAgentExecutionPlanResult {
    planId: string;
    runId: string;
    created: boolean;
    runEnvelope: Record<string, unknown>;
    planEnvelope: Record<string, unknown>;
}
export type AgentExecutionPlanErrorCode = 'AGENT_EXECUTION_INPUT_INVALID' | 'AGENT_EXECUTION_AUTHORIZATION_REQUIRED' | 'AGENT_EXECUTION_CONTEXT_NOT_FOUND' | 'AGENT_EXECUTION_CONTEXT_MISMATCH' | 'AGENT_EXECUTION_DEFINITION_NOT_APPROVED' | 'AGENT_EXECUTION_DEFINITION_INVALID' | 'AGENT_EXECUTION_SCOPE_BROADENED' | 'AGENT_EXECUTION_TOOL_NOT_ALLOWED' | 'AGENT_EXECUTION_COMMAND_NOT_ALLOWED' | 'AGENT_EXECUTION_MEMORY_SCOPE_NOT_ALLOWED' | 'AGENT_EXECUTION_BUDGET_EXCEEDED' | 'AGENT_EXECUTION_REVIEW_REQUIRED';
export declare class AgentExecutionPlanError extends Error {
    readonly code: AgentExecutionPlanErrorCode;
    constructor(code: AgentExecutionPlanErrorCode, message: string);
}
export declare function persistAgentExecutionPlan(pool: Pool, input: PersistAgentExecutionPlanInput): Promise<PersistedAgentExecutionPlanResult>;
export declare function getAgentExecutionPlanEnvelope(pool: Pool, workspaceId: string, planId: string): Promise<Record<string, unknown> | null>;
