export type SourcePaginationResumeMode = 'cursor' | 'page';
export type SourcePaginationResumeCoverage = 'complete' | 'partial' | 'unknown';
export interface SourcePaginationResumeUsage {
    requests: number;
    pages: number;
    bytes: number;
    currencyMicros: number;
    runtimeMs: number;
}
export interface SourcePaginationResumeState {
    mode: SourcePaginationResumeMode;
    pageIndex: number;
    nextCursor: string | null;
    nextPage: number | null;
    usage: SourcePaginationResumeUsage;
    coverage: SourcePaginationResumeCoverage;
    returnedRecords: number;
    terminal: boolean;
}
export interface SourcePaginationPageEvidence {
    pageIndex: number;
    requestedCursor?: string;
    requestedPage?: number;
    nextCursor?: string;
    hasMore?: boolean;
    usage: SourcePaginationResumeUsage;
    coverage: SourcePaginationResumeCoverage;
    returnedRecords: number;
}
export declare class SourcePaginationResumeError extends Error {
    readonly code: string;
    constructor(code: string);
}
export declare function createSourcePaginationResumeState(mode: SourcePaginationResumeMode): SourcePaginationResumeState;
export declare function applySourcePaginationPage(state: SourcePaginationResumeState, page: SourcePaginationPageEvidence): SourcePaginationResumeState;
export declare function sourcePaginationResumeToken(state: SourcePaginationResumeState): string | number | null;
