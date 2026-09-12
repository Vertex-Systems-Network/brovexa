import type { Pool } from 'pg';
import { type SourceTransportAuditRecord, type SourceTransportAuditRecordInput } from './source-transport-audit-record';
export type SourceTransportAuditPersistenceErrorCode = 'SOURCE_TRANSPORT_AUDIT_INPUT_INVALID' | 'SOURCE_TRANSPORT_AUDIT_SOURCE_TASK_NOT_FOUND' | 'SOURCE_TRANSPORT_AUDIT_SOURCE_TASK_IDENTITY_MISMATCH' | 'SOURCE_TRANSPORT_AUDIT_ID_CONFLICT';
export declare class SourceTransportAuditPersistenceError extends Error {
    readonly code: SourceTransportAuditPersistenceErrorCode;
    constructor(code: SourceTransportAuditPersistenceErrorCode, message: string);
}
export interface PersistedSourceTransportAuditRecord extends SourceTransportAuditRecord {
    createdAt: Date;
}
export interface PersistSourceTransportAuditRecordResult {
    created: boolean;
    record: PersistedSourceTransportAuditRecord;
}
export declare function persistSourceTransportAuditRecord(pool: Pool, rawInput: SourceTransportAuditRecordInput): Promise<PersistSourceTransportAuditRecordResult>;
export declare function getSourceTransportAuditRecord(pool: Pool, workspaceId: string, id: string): Promise<PersistedSourceTransportAuditRecord | null>;
