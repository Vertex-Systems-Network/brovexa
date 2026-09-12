import type { Pool } from 'pg';
import type { PersistedAgentRunStatus } from './agent-run-schema';
export type AgentExecutionAggregationState = 'succeeded' | 'evaluation_pending' | 'review_required' | 'failed' | 'cancelled';
export interface AggregateAgentExecutionInput {
    workspaceId: string;
    dispatchId: string;
    evaluatorAgentVersion?: string | undefined;
    occurredAt: Date;
}
export interface AgentExecutionAggregateStep {
    stepKey: string;
    workUnitId: string;
    specialistRunId: string;
    agentKey: string;
    agentVersion: string;
    attempt: number;
    confidence: number;
    result: Record<string, unknown>;
    evidenceIds: string[];
    factIds: string[];
    sourceIds: string[];
}
export interface AgentEvaluatorHandoff {
    handoffId: string;
    evaluatorRunId: string;
    contextReceiptId: string;
    agentKey: string;
    agentVersion: string;
    subjectRunId: string;
    evalSuiteId: string;
    evalThreshold: number;
}
export interface AgentExecutionAggregationResult {
    workspaceId: string;
    dispatchId: string;
    planId: string;
    planVersion: number;
    jobRunId: string;
    orchestratorRunId: string;
    state: AgentExecutionAggregationState;
    orchestratorStatus: PersistedAgentRunStatus;
    aggregate: Record<string, unknown> | null;
    evaluatorHandoff: AgentEvaluatorHandoff | null;
    issues: string[];
}
export type AgentExecutionAggregationErrorCode = 'AGENT_AGGREGATION_INPUT_INVALID' | 'AGENT_AGGREGATION_DISPATCH_NOT_FOUND' | 'AGENT_AGGREGATION_PROJECTION_CONFLICT' | 'AGENT_AGGREGATION_AUTHORIZATION_REQUIRED' | 'AGENT_AGGREGATION_NOT_READY' | 'AGENT_AGGREGATION_ORCHESTRATOR_STATE' | 'AGENT_AGGREGATION_DEFINITION_INVALID' | 'AGENT_AGGREGATION_EVALUATOR_VERSION_REQUIRED' | 'AGENT_AGGREGATION_EVALUATOR_NOT_APPROVED' | 'AGENT_AGGREGATION_EVALUATOR_ROUTE_UNAVAILABLE';
export declare class AgentExecutionAggregationError extends Error {
    readonly code: AgentExecutionAggregationErrorCode;
    constructor(code: AgentExecutionAggregationErrorCode, message: string);
}
export declare function aggregateAgentExecutionPlan(pool: Pool, input: AggregateAgentExecutionInput): Promise<AgentExecutionAggregationResult>;
export declare function getAgentExecutionAggregationState(pool: Pool, workspaceId: string, dispatchId: string): Promise<AgentExecutionAggregationResult | null>;
