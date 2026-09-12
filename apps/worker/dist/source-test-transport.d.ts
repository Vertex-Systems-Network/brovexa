export interface TestTransportRequest {
    transportRequestId: string;
    transportKind: 'test' | 'network';
    url: string;
    maxResponseBytes: number;
    timeoutMs: number;
    acceptedContentTypes: readonly string[];
}
export interface TestTransportAdmission {
    decision: 'allow' | 'blocked';
    transportRequestId: string;
    canonicalUrl: string;
    maxResponseBytes: number;
    timeoutMs: number;
}
export interface InjectedTestExchangeInput {
    transportRequestId: string;
    url: string;
    maxResponseBytes: number;
    timeoutMs: number;
}
export interface InjectedTestExchangeResult {
    status: number;
    finalUrl: string;
    contentType: string;
    body: Uint8Array;
    elapsedMs: number;
}
export type InjectedTestExchange = (input: InjectedTestExchangeInput) => Promise<InjectedTestExchangeResult>;
export declare class TestSourceTransportError extends Error {
    readonly code: string;
    constructor(code: string);
}
export declare function executeInjectedTestTransport(request: TestTransportRequest, admission: TestTransportAdmission, exchange: InjectedTestExchange): Promise<InjectedTestExchangeResult>;
