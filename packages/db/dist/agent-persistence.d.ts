import type { Pool } from 'pg';
import type { AgentAutonomyTier, AgentDefinitionStatus } from './agent-definition-schema';
import type { AgentExecutionMode, PersistedAgentRunStatus } from './agent-run-schema';
export declare class AgentPersistenceConflictError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface PersistAgentDefinitionInput {
    agentKey: string;
    version: string;
    status: AgentDefinitionStatus;
    autonomyTier: AgentAutonomyTier;
    requiresHumanApproval: boolean;
    specification: Record<string, unknown>;
}
export interface PersistContextReceiptInput {
    id: string;
    workspaceId: string;
    userId?: string | undefined;
    runScopeId?: string | undefined;
    agentDefinitionId: string;
    agentKey: string;
    agentVersion: string;
    receipt: Record<string, unknown>;
    tokenBudget: number;
    maxCurrencyMicros: number;
    createdAt: Date;
}
export interface PersistAgentRunInput {
    id: string;
    workspaceId: string;
    agentDefinitionId: string;
    agentKey: string;
    agentVersion: string;
    contextReceiptId: string;
    parentRunId?: string | undefined;
    handoffId?: string | undefined;
    executionMode: AgentExecutionMode;
    providerId?: string | undefined;
    modelId?: string | undefined;
    status: PersistedAgentRunStatus;
    envelope: Record<string, unknown>;
    startedAt?: Date | undefined;
    completedAt?: Date | undefined;
}
export declare function persistAgentDefinition(pool: Pool, input: PersistAgentDefinitionInput): Promise<string>;
export declare function persistContextReceipt(pool: Pool, input: PersistContextReceiptInput): Promise<string>;
export declare function persistAgentRun(pool: Pool, input: PersistAgentRunInput): Promise<string>;
export declare function getAgentRunEnvelope(pool: Pool, workspaceId: string, runId: string): Promise<Record<string, unknown> | null>;
