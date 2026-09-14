import type { Pool } from 'pg';
export type SourceDiscoveryCheckpointMode = 'cursor' | 'page';
export type SourceDiscoveryCoverageState = 'complete' | 'partial' | 'unknown';
export interface SourceDiscoveryCheckpointUsage {
    requests: number;
    pages: number;
    bytes: number;
    currencyMicros: number;
    runtimeMs: number;
}
export interface SaveSourceDiscoveryCheckpointInput {
    id: string;
    workspaceId: string;
    sourceTaskId: string;
    mode: SourceDiscoveryCheckpointMode;
    pageIndex: number;
    nextCursor: string | null;
    nextPage: number | null;
    cumulativeUsage: SourceDiscoveryCheckpointUsage;
    coverageState: SourceDiscoveryCoverageState;
    returnedRecords: number;
    terminal: boolean;
    observedAt: Date;
    expectedVersion: number | null;
}
export interface PersistedSourceDiscoveryCheckpoint {
    id: string;
    workspaceId: string;
    sourceTaskId: string;
    mode: SourceDiscoveryCheckpointMode;
    pageIndex: number;
    nextCursor: string | null;
    nextPage: number | null;
    cumulativeUsage: SourceDiscoveryCheckpointUsage;
    coverageState: SourceDiscoveryCoverageState;
    returnedRecords: number;
    terminal: boolean;
    version: number;
    observedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export type SourceDiscoveryCheckpointPersistenceErrorCode = 'SOURCE_DISCOVERY_CHECKPOINT_INPUT_INVALID' | 'SOURCE_DISCOVERY_CHECKPOINT_CONFLICT' | 'SOURCE_DISCOVERY_CHECKPOINT_NOT_FOUND';
export declare class SourceDiscoveryCheckpointPersistenceError extends Error {
    readonly code: SourceDiscoveryCheckpointPersistenceErrorCode;
    constructor(code: SourceDiscoveryCheckpointPersistenceErrorCode, message: string);
}
export declare function saveSourceDiscoveryCheckpoint(pool: Pool, input: SaveSourceDiscoveryCheckpointInput): Promise<PersistedSourceDiscoveryCheckpoint>;
export declare function getSourceDiscoveryCheckpoint(pool: Pool, input: {
    workspaceId: string;
    sourceTaskId: string;
}): Promise<PersistedSourceDiscoveryCheckpoint | null>;
export declare function requireSourceDiscoveryCheckpoint(pool: Pool, input: {
    workspaceId: string;
    sourceTaskId: string;
}): Promise<PersistedSourceDiscoveryCheckpoint>;
