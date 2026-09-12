import { z } from 'zod';
export * from './agent-execution';
export * from './ai';
export * from './identity';
export * from './source-adapter';
export * from './source-adapter-module';
export * from './source-discovery-dedup';
export * from './source-discovery-dedup-evaluator';
export * from './source-discovery-plan';
export * from './source-network-safety';
export * from './source-pagination-coverage';
export * from './source-transport';
export * from './source-transport-hop-chain';
export * from './source-transport-result';
export * from './source-transport-observability';
export declare const HealthResponseSchema: z.ZodObject<{
    status: z.ZodLiteral<"ok">;
    service: z.ZodLiteral<"brovexa-api">;
    version: z.ZodString;
    timestamp: z.ZodString;
}, z.core.$strip>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export declare const ReadinessResponseSchema: z.ZodObject<{
    status: z.ZodLiteral<"ready">;
    database: z.ZodObject<{
        serverVersion: z.ZodString;
        serverMajor: z.ZodLiteral<18>;
        schemaReady: z.ZodLiteral<true>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;
export declare const ApiErrorSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    requestId: z.ZodString;
    traceId: z.ZodString;
}, z.core.$strip>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
