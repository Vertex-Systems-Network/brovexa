import type { Pool, PoolClient } from 'pg';
import type { PersistedDataClassification, PersistedMemoryAuthority, PersistedMemoryStatus, PersistedMemoryType, PersistedMemoryWriter } from './memory-record-schema';
import type { PersistedEvalDecision, PersistedEvidenceState } from './eval-result-schema';
export interface PersistMemoryRecordInput {
    id: string;
    version: string;
    revisionParentId?: string | undefined;
    namespace: string;
    workspaceId: string;
    userId?: string | undefined;
    runId?: string | undefined;
    entityId?: string | undefined;
    leadId?: string | undefined;
    memoryType: PersistedMemoryType;
    subtype: string;
    writer: PersistedMemoryWriter;
    aiDerived: boolean;
    derivation?: Record<string, unknown> | undefined;
    confidence: number;
    authority: PersistedMemoryAuthority;
    status: PersistedMemoryStatus;
    retentionPolicyId: string;
    deletionReason?: string | undefined;
    dataClassification: PersistedDataClassification;
    envelope: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
    expiresAt?: Date | undefined;
}
export interface PersistEvalResultInput {
    id: string;
    workspaceId: string;
    evaluatorRunId: string;
    subjectRunId: string;
    decision: PersistedEvalDecision;
    evidenceState: PersistedEvidenceState;
    reasonCodes: string[];
    evidenceRefs: string[];
    policyRefs: string[];
    confidence: number;
    envelope: Record<string, unknown>;
    createdAt: Date;
}
export declare function persistMemoryRecord(pool: Pool | PoolClient, input: PersistMemoryRecordInput): Promise<string>;
export declare function getMemoryRecordEnvelope(pool: Pool, workspaceId: string, memoryId: string): Promise<Record<string, unknown> | null>;
export declare function persistEvalResult(pool: Pool | PoolClient, input: PersistEvalResultInput): Promise<string>;
export declare function getEvalResultEnvelope(pool: Pool, workspaceId: string, evaluationId: string): Promise<Record<string, unknown> | null>;
