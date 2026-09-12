export interface SourceTransportAuditRecordInput {
    id: string;
    workspaceId: string;
    transportRequestId: string;
    sourceRequestId: string;
    sourceTaskId: string;
    connectorKey: string;
    connectorVersion: string;
    transportPolicyId: string;
    transportPolicyVersion: string;
    decision: 'allow' | 'blocked';
    reasonCodes: readonly string[];
    warnings: readonly string[];
    canonicalUrl: string;
    hostname: string;
    port: number | null;
    maxResponseBytes: number;
    timeoutMs: number;
    evaluatedAt: Date;
}
export interface SourceTransportAuditRecord {
    id: string;
    workspaceId: string;
    transportRequestId: string;
    sourceRequestId: string;
    sourceTaskId: string;
    connectorKey: string;
    connectorVersion: string;
    transportPolicyId: string;
    transportPolicyVersion: string;
    decision: 'allow' | 'blocked';
    reasonCodes: string[];
    warnings: string[];
    canonicalUrl: string;
    hostname: string;
    port: number | null;
    maxResponseBytes: number;
    timeoutMs: number;
    evaluatedAt: Date;
    envelope: Readonly<Record<string, unknown>>;
}
export declare class SourceTransportAuditRecordError extends Error {
    readonly code: 'SOURCE_TRANSPORT_AUDIT_RECORD_INVALID';
    constructor(code: 'SOURCE_TRANSPORT_AUDIT_RECORD_INVALID', message: string);
}
export declare function buildSourceTransportAuditRecord(input: SourceTransportAuditRecordInput): SourceTransportAuditRecord;
