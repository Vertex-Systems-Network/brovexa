import type { Pool } from 'pg';
import type { PersistedAgentRunStatus } from './agent-run-schema';
import type { PersistedEvalDecision, PersistedEvidenceState } from './eval-result-schema';
export interface ApplyAgentEvaluatorDecisionInput {
    workspaceId: string;
    dispatchId: string;
    evaluatorRunId: string;
    evaluationId: string;
    decision: PersistedEvalDecision;
    evidenceState: PersistedEvidenceState;
    reasonCodes: string[];
    evidenceRefs: string[];
    policyRefs: string[];
    confidence: number;
    occurredAt: Date;
}
export type AgentEvaluatorDecisionState = 'accepted' | 'rejected' | 'review_required';
export interface AgentEvaluatorDecisionResult {
    workspaceId: string;
    dispatchId: string;
    planId: string;
    subjectRunId: string;
    evaluatorRunId: string;
    evaluationId: string;
    requestedDecision: PersistedEvalDecision;
    decision: PersistedEvalDecision;
    state: AgentEvaluatorDecisionState;
    subjectStatus: PersistedAgentRunStatus;
    evaluatorStatus: PersistedAgentRunStatus;
    evidenceState: PersistedEvidenceState;
    confidence: number;
    reasonCodes: string[];
    evidenceRefs: string[];
    policyRefs: string[];
    issues: string[];
}
export interface ResolveAgentExecutionReviewInput {
    workspaceId: string;
    orchestratorRunId: string;
    resolutionId: string;
    actorUserId: string;
    decision: 'approve' | 'reject';
    reason: string;
    occurredAt: Date;
}
export interface AgentExecutionReviewResolutionResult {
    workspaceId: string;
    orchestratorRunId: string;
    resolutionId: string;
    decision: 'approve' | 'reject';
    status: 'succeeded' | 'failed';
    actorUserId: string;
    reason: string;
}
export type AgentEvaluatorDecisionErrorCode = 'AGENT_EVALUATOR_INPUT_INVALID' | 'AGENT_EVALUATOR_DISPATCH_NOT_FOUND' | 'AGENT_EVALUATOR_AGGREGATION_NOT_PENDING' | 'AGENT_EVALUATOR_HANDOFF_MISMATCH' | 'AGENT_EVALUATOR_AUTHORIZATION_REQUIRED' | 'AGENT_EVALUATOR_DEFINITION_INVALID' | 'AGENT_EVALUATOR_RUN_STATE' | 'AGENT_EVALUATOR_CONTEXT_INVALID' | 'AGENT_EVALUATOR_EVIDENCE_SCOPE' | 'AGENT_EVALUATOR_POLICY_SCOPE' | 'AGENT_EVALUATOR_TIME_REGRESSION' | 'AGENT_REVIEW_OWNER_REQUIRED' | 'AGENT_REVIEW_STATE_INVALID' | 'AGENT_REVIEW_RESULT_REQUIRED';
export declare class AgentEvaluatorDecisionError extends Error {
    readonly code: AgentEvaluatorDecisionErrorCode;
    constructor(code: AgentEvaluatorDecisionErrorCode, message: string);
}
export declare function applyAgentEvaluatorDecision(pool: Pool, input: ApplyAgentEvaluatorDecisionInput): Promise<AgentEvaluatorDecisionResult>;
export declare function getAgentEvaluatorDecisionState(pool: Pool, workspaceId: string, dispatchId: string): Promise<AgentEvaluatorDecisionResult | null>;
export declare function resolveAgentExecutionReview(pool: Pool, input: ResolveAgentExecutionReviewInput): Promise<AgentExecutionReviewResolutionResult>;
