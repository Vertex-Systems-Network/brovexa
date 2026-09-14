import { type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
export interface CorrelatedRequest {
    headers: Record<string, string | string[] | undefined>;
    method?: string;
    originalUrl?: string;
    url?: string;
    requestId?: string;
    traceId?: string;
}
interface CorrelationResponse {
    statusCode: number;
    setHeader(name: string, value: string): void;
    once(event: 'finish', listener: () => void): void;
}
export declare function normalizeRequestId(value: string | string[] | undefined): string;
export declare function createTraceId(): string;
export declare function extractTraceId(value: string | string[] | undefined): string | null;
export declare function sanitizeRequestPath(request: Pick<CorrelatedRequest, 'originalUrl' | 'url'>): string;
export declare function requestContextMiddleware(request: CorrelatedRequest, response: CorrelationResponse, next: () => void): void;
interface PublicErrorDetails {
    code: string;
    message: string;
}
export declare function resolvePublicErrorDetails(exception: unknown, statusCode: number): PublicErrorDetails;
export declare class ApiExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void;
}
export {};
