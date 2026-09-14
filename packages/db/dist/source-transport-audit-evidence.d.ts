export type SourceTransportAuditDisposition = 'admitted' | 'blocked' | 'failed';
export interface SourceTransportAuditEvidenceInput {
    transportRequestId: string;
    workspaceId: string;
    sourceId: string;
    disposition: SourceTransportAuditDisposition;
    reasonCode: string;
    resolvedAddressCount: number;
    redirectHopCount: number;
}
export interface SourceTransportAuditEvidence extends SourceTransportAuditEvidenceInput {
    version: 1;
}
export declare function buildSourceTransportAuditEvidence(input: SourceTransportAuditEvidenceInput): SourceTransportAuditEvidence;
