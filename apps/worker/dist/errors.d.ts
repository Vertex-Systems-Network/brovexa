export declare class RetryableWorkError extends Error {
    readonly code: string;
    constructor(code: string, message?: string);
}
export declare class PermanentWorkError extends Error {
    readonly code: string;
    constructor(code: string, message?: string);
}
export declare class CancelledWorkError extends Error {
    readonly code: string;
    constructor(code?: string, message?: string);
}
