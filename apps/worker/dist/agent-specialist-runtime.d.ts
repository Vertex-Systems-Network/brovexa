import { type AgentSpecialistExecutionResult, type AgentSpecialistWorkPayload, type createPgPool } from '@brovexa/db';
import type { WorkHandler } from './runtime';
export interface DeterministicSpecialistResult {
    result: Record<string, unknown>;
    confidence: number;
    validationState: 'passed' | 'failed' | 'review';
    uncertainty?: string[] | undefined;
    evidenceIds?: string[] | undefined;
    factIds?: string[] | undefined;
    sourceIds?: string[] | undefined;
    assumptions?: string[] | undefined;
    conflicts?: string[] | undefined;
    toolSummary?: AgentSpecialistExecutionResult['toolSummary'] | undefined;
    cost?: Partial<AgentSpecialistExecutionResult['cost']> | undefined;
    proposedActions?: AgentSpecialistExecutionResult['proposedActions'] | undefined;
}
export interface DeterministicSpecialistHandlerContext {
    runId: string;
    contextReceiptId: string;
    workUnitId: string;
    jobRunId: string;
    workspaceId: string;
    correlationId: string;
    attempt: number;
    payload: AgentSpecialistWorkPayload;
    isCancellationRequested: () => Promise<boolean>;
    checkpoint(checkpointKey: string, data: Record<string, unknown>): Promise<string>;
    recordUsage(eventId: string, usage: {
        tokens: number;
        searches: number;
        apiCalls: number;
        credits: number;
        currencyMicros: number;
        runtimeMs: number;
    }, metadata?: Record<string, unknown>): Promise<boolean>;
}
export type DeterministicSpecialistHandler = (context: DeterministicSpecialistHandlerContext) => Promise<DeterministicSpecialistResult>;
export interface DeterministicSpecialistRegistration {
    agentVersion: string;
    execute: DeterministicSpecialistHandler;
}
export interface DeterministicSpecialistRegistryOptions {
    pool: ReturnType<typeof createPgPool>;
    registryVersion: string;
    handlers: Readonly<Record<string, DeterministicSpecialistRegistration>>;
}
export declare function createDeterministicSpecialistHandlers(options: DeterministicSpecialistRegistryOptions): Readonly<Record<string, WorkHandler>>;
