import type { Pool } from 'pg';
import type { PersistedConnectorHealthStatus } from './connector-health-schema';
export type ConnectorHealthPersistenceErrorCode = 'CONNECTOR_HEALTH_INPUT_INVALID' | 'CONNECTOR_HEALTH_REGISTRY_NOT_FOUND' | 'CONNECTOR_HEALTH_ID_CONFLICT';
export declare class ConnectorHealthPersistenceError extends Error {
    readonly code: ConnectorHealthPersistenceErrorCode;
    constructor(code: ConnectorHealthPersistenceErrorCode, message: string);
}
export interface PersistConnectorHealthSnapshotInput {
    id: string;
    connectorKey: string;
    connectorVersion: string;
    status: PersistedConnectorHealthStatus;
    observedAt: Date;
    quotaRemaining: number | null;
    rollingErrorRate: number;
    p95LatencyMs: number | null;
    reasonCodes: readonly string[];
}
export interface PersistedConnectorHealthSnapshot {
    id: string;
    connectorDefinitionId: string;
    connectorKey: string;
    connectorVersion: string;
    status: PersistedConnectorHealthStatus;
    observedAt: Date;
    quotaRemaining: number | null;
    rollingErrorRate: number;
    p95LatencyMs: number | null;
    reasonCodes: readonly string[];
    envelope: Record<string, unknown>;
    createdAt: Date;
}
export interface PersistConnectorHealthSnapshotResult {
    created: boolean;
    snapshot: PersistedConnectorHealthSnapshot;
}
export declare function persistConnectorHealthSnapshot(pool: Pool, rawInput: PersistConnectorHealthSnapshotInput): Promise<PersistConnectorHealthSnapshotResult>;
export declare function getLatestConnectorHealthSnapshot(pool: Pool, input: {
    connectorKey: string;
    connectorVersion: string;
}): Promise<PersistedConnectorHealthSnapshot | null>;
