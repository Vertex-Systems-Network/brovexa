import { type PersistedConnectorHealthSnapshot, type createPgPool } from '@brovexa/db';
import type { WorkHandler } from './runtime';
export interface ParsedSourceRequest extends Record<string, unknown> {
    executionIntent: 'execute';
    workspaceId: string;
    sourceTaskId: string;
    requestId: string;
    sourceKey: string;
    connectorKey: string;
    connectorVersion: string;
    policySnapshot: {
        policyId: string;
        policyVersion: string;
    };
}
export interface ParsedSourceAdmission extends Record<string, unknown> {
    decision: 'allow' | 'review_required' | 'blocked';
}
export interface ParsedSourceCapability extends Record<string, unknown> {
    sourceKey: string;
    version: string;
}
export interface ParsedConnectorPolicy extends Record<string, unknown> {
    policyId: string;
    version: string;
    sourceKey: string;
    connectorKey: string;
    state: 'APPROVED' | 'APPROVED_WITH_LIMITS' | 'TRANSIENT_ONLY' | 'REVIEW_REQUIRED' | 'BLOCKED' | 'EXPIRED';
    reviewedAt: string;
    nextReviewAt: string;
}
export interface ParsedConnectorDefinition extends Record<string, unknown> {
    connectorKey: string;
    version: string;
    sourceKey: string;
    capabilityVersion: string;
    policyId: string;
    policyVersion: string;
    implementationVersion: string;
}
export interface ParsedSourceResult extends Record<string, unknown> {
    status: 'complete' | 'partial' | 'empty' | 'blocked' | 'failed';
    sourceReferences: readonly {
        referenceId: string;
    }[];
    usage: {
        requests: number;
        pages: number;
        bytes: number;
        currencyMicros: number;
        runtimeMs: number;
    };
    errors: readonly {
        code: string;
        classification: 'retryable' | 'permanent' | 'policy' | 'quota' | 'partial';
        message: string;
    }[];
    completedAt: string;
}
export interface SourceExecutionContractValidation {
    valid: boolean;
    issues: readonly string[];
}
export interface SourceExecutionContractAdapter {
    parseRequest(value: unknown): ParsedSourceRequest;
    parseAdmission(value: unknown): ParsedSourceAdmission;
    parseCapability(value: unknown): ParsedSourceCapability;
    parsePolicy(value: unknown): ParsedConnectorPolicy;
    parseDefinition(value: unknown): ParsedConnectorDefinition;
    parseResult(value: unknown): ParsedSourceResult;
    validateResult(input: {
        result: ParsedSourceResult;
        request: ParsedSourceRequest;
        capability: ParsedSourceCapability;
        policy: ParsedConnectorPolicy;
        admission: ParsedSourceAdmission;
    }): SourceExecutionContractValidation;
}
export interface SourceExecutorOutcome {
    result: unknown;
    resultRef: string;
    provenanceRefs: readonly string[];
}
export interface SourceExecutorContext {
    workspaceId: string;
    sourceTaskId: string;
    researchJobId: string;
    workUnitId: string;
    jobRunId: string;
    correlationId: string;
    attempt: number;
    request: ParsedSourceRequest;
    admission: ParsedSourceAdmission;
    capability: ParsedSourceCapability;
    policy: ParsedConnectorPolicy;
    definition: ParsedConnectorDefinition;
    health: PersistedConnectorHealthSnapshot;
    isCancellationRequested: () => Promise<boolean>;
}
export type SourceExecutor = (context: SourceExecutorContext) => Promise<SourceExecutorOutcome>;
export interface SourceExecutorRegistration {
    connectorVersion: string;
    implementationVersion: string;
    /**
     * This bounded M02 slice has no built-in network transport. Registrations are
     * intentionally limited to injected no-network executors used by tests and
     * future higher-level adapters after their own security gate.
     */
    networkAccess: 'none';
    execute: SourceExecutor;
}
export interface SourceExecutionRegistryOptions {
    pool: ReturnType<typeof createPgPool>;
    registryVersion: string;
    maxHealthAgeSeconds: number;
    now?: () => Date;
    contracts: SourceExecutionContractAdapter;
    executors: Readonly<Record<string, SourceExecutorRegistration>>;
}
export declare function createSourceExecutionHandlers(options: SourceExecutionRegistryOptions): Readonly<Record<string, WorkHandler>>;
