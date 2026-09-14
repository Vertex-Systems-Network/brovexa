import type { Pool } from 'pg';
import type { PersistedConnectorActivation, PersistedConnectorCredentialMode, PersistedConnectorDefinitionStatus, PersistedConnectorPolicyState, PersistedSourceAccessMethod, PersistedSourceAdmissionDecision, PersistedSourceClass } from './source-schema';
export type SourceRegistryPersistenceErrorCode = 'SOURCE_REGISTRY_INPUT_INVALID' | 'SOURCE_CAPABILITY_VERSION_CONFLICT' | 'CONNECTOR_POLICY_VERSION_CONFLICT' | 'CONNECTOR_DEFINITION_VERSION_CONFLICT' | 'CONNECTOR_CAPABILITY_NOT_FOUND' | 'CONNECTOR_POLICY_NOT_FOUND' | 'CONNECTOR_REGISTRY_IDENTITY_CONFLICT' | 'SOURCE_ADMISSION_ID_CONFLICT' | 'SOURCE_ADMISSION_REGISTRY_NOT_FOUND' | 'SOURCE_ADMISSION_IDENTITY_MISMATCH' | 'SOURCE_ADMISSION_AUTH_SECRET_FORBIDDEN';
export declare class SourceRegistryPersistenceError extends Error {
    readonly code: SourceRegistryPersistenceErrorCode;
    constructor(code: SourceRegistryPersistenceErrorCode, message: string);
}
export interface PersistSourceCapabilityInput {
    sourceKey: string;
    version: string;
    sourceClass: PersistedSourceClass;
    capability: Record<string, unknown>;
}
export interface PersistConnectorPolicyInput {
    policyId: string;
    version: string;
    sourceKey: string;
    connectorKey: string;
    state: PersistedConnectorPolicyState;
    accessMethod: PersistedSourceAccessMethod;
    reviewedAt: Date;
    nextReviewAt: Date;
    policy: Record<string, unknown>;
}
export interface PersistConnectorDefinitionInput {
    connectorKey: string;
    version: string;
    sourceKey: string;
    capabilityVersion: string;
    policyId: string;
    policyVersion: string;
    accessMethod: PersistedSourceAccessMethod;
    credentialMode: PersistedConnectorCredentialMode;
    status: PersistedConnectorDefinitionStatus;
    activation: PersistedConnectorActivation;
    implementationVersion: string;
    definition: Record<string, unknown>;
}
export interface PersistSourceAdmissionSnapshotInput {
    id: string;
    workspaceId: string;
    sourceTaskId: string;
    requestId: string;
    connectorKey: string;
    connectorVersion: string;
    request: Record<string, unknown>;
    admission: Record<string, unknown>;
    evaluatedAt: Date;
}
export interface ResolvedConnectorRegistryEntry {
    connectorDefinitionId: string;
    sourceCapabilityId: string;
    connectorPolicyDbId: string;
    connectorKey: string;
    connectorVersion: string;
    sourceKey: string;
    capabilityVersion: string;
    policyId: string;
    policyVersion: string;
    status: PersistedConnectorDefinitionStatus;
    activation: PersistedConnectorActivation;
    policyState: PersistedConnectorPolicyState;
    accessMethod: PersistedSourceAccessMethod;
    credentialMode: PersistedConnectorCredentialMode;
    capability: Record<string, unknown>;
    policy: Record<string, unknown>;
    definition: Record<string, unknown>;
    reviewedAt: Date;
    nextReviewAt: Date;
}
export interface PersistedSourceAdmissionSnapshot {
    id: string;
    workspaceId: string;
    sourceTaskId: string;
    requestId: string;
    sourceKey: string;
    capabilityVersion: string;
    connectorKey: string;
    connectorVersion: string;
    policyId: string;
    policyVersion: string;
    decision: PersistedSourceAdmissionDecision;
    reasonCodes: readonly string[];
    warnings: readonly string[];
    request: Record<string, unknown>;
    admission: Record<string, unknown>;
    evaluatedAt: Date;
}
export declare function persistSourceCapability(pool: Pool, input: PersistSourceCapabilityInput): Promise<string>;
export declare function persistConnectorPolicy(pool: Pool, input: PersistConnectorPolicyInput): Promise<string>;
export declare function persistConnectorDefinition(pool: Pool, input: PersistConnectorDefinitionInput): Promise<string>;
export declare function resolveConnectorRegistryEntry(pool: Pool, input: {
    connectorKey: string;
    connectorVersion: string;
}): Promise<ResolvedConnectorRegistryEntry | null>;
export declare function persistSourceAdmissionSnapshot(pool: Pool, input: PersistSourceAdmissionSnapshotInput): Promise<string>;
export declare function getSourceAdmissionSnapshot(pool: Pool, workspaceId: string, snapshotId: string): Promise<PersistedSourceAdmissionSnapshot | null>;
