import { type InjectedTestExchange, type TestTransportAdmission } from './source-test-transport';
export interface TestDiscoveryQuery {
    countryCode: string;
    locality: string;
    niche: string;
    limit: number;
}
export interface TestDiscoveryCandidate {
    externalRef: string;
    name: string;
    website: string | null;
}
export interface ExecuteTestDiscoveryInput {
    transportRequestId: string;
    endpoint: string;
    query: TestDiscoveryQuery;
    maxResponseBytes: number;
    timeoutMs: number;
}
export declare class TestDiscoveryError extends Error {
    readonly code: string;
    constructor(code: string);
}
export declare function buildTestDiscoveryUrl(endpoint: string, query: TestDiscoveryQuery): string;
export declare function executeInjectedTestDiscovery(input: ExecuteTestDiscoveryInput, admission: TestTransportAdmission, exchange: InjectedTestExchange): Promise<TestDiscoveryCandidate[]>;
