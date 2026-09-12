import type { Pool } from 'pg';
import type { LifecycleActorType } from './agent-lifecycle-schema';
import type { PersistedAgentRunStatus } from './agent-run-schema';
import { type PersistMemoryRecordInput } from './memory-eval-persistence';
import type { PersistedMemoryStatus } from './memory-record-schema';
export interface TransitionAgentRunInput {
    transitionId: string;
    workspaceId: string;
    runId: string;
    fromStatus: PersistedAgentRunStatus;
    toStatus: PersistedAgentRunStatus;
    reasonCode: string;
    actorType: LifecycleActorType;
    actorId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    occurredAt: Date;
}
export interface AgentRunTransitionRecord {
    id: string;
    workspaceId: string;
    runId: string;
    fromStatus: PersistedAgentRunStatus;
    toStatus: PersistedAgentRunStatus;
    reasonCode: string;
    actorType: LifecycleActorType;
    actorId: string | null;
    metadata: Record<string, unknown>;
    occurredAt: Date;
}
interface MemoryLifecycleBaseInput {
    eventId: string;
    workspaceId: string;
    memoryId: string;
    reason: string;
    actorType: LifecycleActorType;
    actorId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    occurredAt: Date;
}
export interface SupersedeMemoryRecordInput extends MemoryLifecycleBaseInput {
    successor: PersistMemoryRecordInput;
}
export type DeleteMemoryRecordInput = MemoryLifecycleBaseInput;
export interface MemoryLifecycleRecord {
    id: string;
    workspaceId: string;
    memoryId: string;
    eventType: 'status_changed' | 'superseded' | 'deleted';
    fromStatus: PersistedMemoryStatus;
    toStatus: PersistedMemoryStatus;
    successorMemoryId: string | null;
    reason: string;
    actorType: LifecycleActorType;
    actorId: string | null;
    metadata: Record<string, unknown>;
    occurredAt: Date;
}
export declare function transitionAgentRun(pool: Pool, input: TransitionAgentRunInput): Promise<string>;
export declare function getAgentRunTransitionHistory(pool: Pool, workspaceId: string, runId: string): Promise<AgentRunTransitionRecord[]>;
export declare function supersedeMemoryRecord(pool: Pool, input: SupersedeMemoryRecordInput): Promise<string>;
export declare function deleteMemoryRecord(pool: Pool, input: DeleteMemoryRecordInput): Promise<string>;
export declare function getMemoryLifecycleHistory(pool: Pool, workspaceId: string, memoryId: string): Promise<MemoryLifecycleRecord[]>;
export {};
