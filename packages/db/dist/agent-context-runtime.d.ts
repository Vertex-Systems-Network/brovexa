import type { Pool } from 'pg';
import { type WorkspaceAuthorizationContext } from './identity';
import { type PersistedDataClassification, type PersistedMemoryAuthority, type PersistedMemoryType } from './memory-record-schema';
export type AgentContextRuntimeErrorCode = 'AGENT_DEFINITION_NOT_FOUND' | 'AGENT_DEFINITION_NOT_APPROVED' | 'AGENT_DEFINITION_SPEC_INVALID' | 'CONTEXT_INPUT_INVALID' | 'CONTEXT_POLICY_REQUIRED' | 'CONTEXT_BUDGET_EXCEEDS_AGENT_LIMIT';
export declare class AgentContextRuntimeError extends Error {
    readonly code: AgentContextRuntimeErrorCode;
    constructor(code: AgentContextRuntimeErrorCode, message: string);
}
export interface ResolvedApprovedAgentDefinition {
    id: string;
    agentKey: string;
    version: string;
    autonomyTier: string;
    requiresHumanApproval: boolean;
    specification: Record<string, unknown>;
    memoryReadScopes: readonly string[];
    dataClassifications: readonly PersistedDataClassification[];
    maxTokens: number;
    maxCurrencyMicros: number;
}
export interface BuildAgentContextInput {
    receiptId: string;
    taskId: string;
    workspaceId: string;
    userId: string;
    runId?: string | undefined;
    agentKey: string;
    agentVersion: string;
    policyRefs: readonly string[];
    canonicalRefs?: readonly string[] | undefined;
    targetEntityIds?: readonly string[] | undefined;
    targetLeadIds?: readonly string[] | undefined;
    tokenBudget: number;
    maxCurrencyMicros: number;
    maxMemoryRefs?: number | undefined;
    candidateLimit?: number | undefined;
    createdAt: Date;
}
export interface SelectedContextMemory {
    id: string;
    version: string;
    namespace: string;
    memoryType: PersistedMemoryType;
    subtype: string;
    authority: PersistedMemoryAuthority;
    confidence: number;
    dataClassification: PersistedDataClassification;
    estimatedTokens: number;
    envelope: Record<string, unknown>;
}
export interface BuiltAgentContext {
    authorization: WorkspaceAuthorizationContext;
    definition: ResolvedApprovedAgentDefinition;
    receipt: Record<string, unknown>;
    selectedMemory: readonly SelectedContextMemory[];
    estimatedMemoryTokens: number;
}
export declare function resolveApprovedAgentDefinition(pool: Pool, input: {
    agentKey: string;
    version: string;
}): Promise<ResolvedApprovedAgentDefinition>;
export declare function buildAndPersistAgentContext(pool: Pool, input: BuildAgentContextInput): Promise<BuiltAgentContext>;
export declare function getContextReceiptEnvelope(pool: Pool, workspaceId: string, receiptId: string): Promise<Record<string, unknown> | null>;
