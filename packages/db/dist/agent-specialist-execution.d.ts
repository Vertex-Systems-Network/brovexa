import type { Pool } from 'pg';
export interface AgentSpecialistBudget {
    maxTokens: number;
    maxSearches: number;
    maxApiCalls: number;
    maxCredits: number;
    maxCurrencyMicros: number;
    maxRuntimeMs: number;
    maxConcurrency: number;
}
export interface AgentSpecialistWorkPayload {
    version: '1.0.0';
    dispatchId: string;
    handlerRegistryVersion: string;
    planId: string;
    planVersion: number;
    workspaceId: string;
    orchestratorRunId: string;
    contextReceiptId: string;
    maxParallelism: number;
    stepKey: string;
    agentKey: string;
    agentVersion: string;
    dependencies: string[];
    toolKeys: string[];
    commandKeys: string[];
    policyRefs: string[];
    canonicalRefs: string[];
    memoryRefs: string[];
    budget: AgentSpecialistBudget;
}
export interface AgentSpecialistRuntimeDefinition {
    id: string;
    agentKey: string;
    version: string;
    promptVersion: string;
    skillVersions: Record<string, string>;
    outputSchemaId: string;
    allowedTools: readonly string[];
    allowedCommands: readonly string[];
    evidenceRequired: boolean;
    minimumConfidence: number;
    reviewBelowConfidence: number;
    budget: AgentSpecialistBudget;
}
export interface AgentSpecialistAttemptRun {
    runId: string;
    status: 'queued' | 'running';
    updatedAt: Date;
}
export interface PreparedAgentSpecialistAttempt {
    payload: AgentSpecialistWorkPayload;
    userId: string;
    definition: AgentSpecialistRuntimeDefinition;
    runId: string;
    contextReceiptId: string;
    runStatus: 'queued' | 'running';
    runUpdatedAt: Date;
    abandonedRuns: AgentSpecialistAttemptRun[];
    replayResult: AgentSpecialistExecutionResult | null;
}
export interface AgentSpecialistToolSummary {
    toolKey: string;
    status: 'succeeded' | 'failed' | 'blocked' | 'skipped';
    costMicros: number;
}
export interface AgentSpecialistCost {
    inputTokens: number;
    outputTokens: number;
    searches: number;
    apiCalls: number;
    credits: number;
    currencyMicros: number;
}
export interface AgentSpecialistProposedAction {
    commandKey: string;
    payload: Record<string, unknown>;
    evidenceRefs: string[];
}
export interface AgentSpecialistExecutionResult {
    result: Record<string, unknown>;
    confidence: number;
    uncertainty: string[];
    evidenceIds: string[];
    factIds: string[];
    sourceIds: string[];
    assumptions: string[];
    conflicts: string[];
    toolSummary: AgentSpecialistToolSummary[];
    cost: AgentSpecialistCost;
    validationState: 'passed';
    proposedActions: AgentSpecialistProposedAction[];
}
export type AgentSpecialistExecutionErrorCode = 'AGENT_SPECIALIST_INPUT_INVALID' | 'AGENT_SPECIALIST_WORK_NOT_FOUND' | 'AGENT_SPECIALIST_WORK_STATE' | 'AGENT_SPECIALIST_WORK_IDENTITY_MISMATCH' | 'AGENT_SPECIALIST_PLAN_MISMATCH' | 'AGENT_SPECIALIST_AUTHORIZATION_REQUIRED' | 'AGENT_SPECIALIST_DEFINITION_NOT_APPROVED' | 'AGENT_SPECIALIST_DETERMINISTIC_ONLY' | 'AGENT_SPECIALIST_SCOPE_MISMATCH' | 'AGENT_SPECIALIST_CONTEXT_MISMATCH' | 'AGENT_SPECIALIST_EVALUATOR_REQUIRED' | 'AGENT_SPECIALIST_PRIOR_REVIEW_REQUIRED' | 'AGENT_SPECIALIST_RUN_STATE' | 'AGENT_SPECIALIST_RESULT_INVALID' | 'AGENT_SPECIALIST_REVIEW_REQUIRED';
export declare class AgentSpecialistExecutionError extends Error {
    readonly code: AgentSpecialistExecutionErrorCode;
    constructor(code: AgentSpecialistExecutionErrorCode, message: string);
}
export declare function createAgentSpecialistRunId(workUnitId: string, attempt: number): string;
export declare function createAgentSpecialistContextReceiptId(workUnitId: string, attempt: number): string;
export declare function createAgentSpecialistTransitionId(runId: string, phase: string): string;
export declare function prepareAgentSpecialistAttempt(pool: Pool, input: {
    workspaceId: string;
    jobRunId: string;
    workUnitId: string;
    correlationId: string;
    attempt: number;
    workType: string;
    workVersion: number;
    payload: Record<string, unknown>;
}): Promise<PreparedAgentSpecialistAttempt>;
export declare function completeAgentSpecialistAttempt(pool: Pool, input: {
    workspaceId: string;
    jobRunId: string;
    workUnitId: string;
    correlationId: string;
    attempt: number;
    workType: string;
    workVersion: number;
    payload: Record<string, unknown>;
    runId: string;
    result: unknown;
    occurredAt: Date;
}): Promise<{
    created: boolean;
    result: AgentSpecialistExecutionResult;
}>;
export declare function getAgentSpecialistRunsForWorkUnit(pool: Pool, workspaceId: string, workUnitId: string): Promise<Array<{
    runId: string;
    status: string;
    parentRunId: string | null;
    contextReceiptId: string;
    envelope: Record<string, unknown>;
}>>;
