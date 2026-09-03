import { z } from 'zod';

export * from './agent-execution';
export * from './ai';
export * from './identity';
export * from './source-adapter';
export * from './source-pagination-coverage';
export * from './source-transport';
export * from './source-transport-hop-chain';
export * from './source-transport-result';

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('brovexa-api'),
  version: z.string().min(1),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ReadinessResponseSchema = z.object({
  status: z.literal('ready'),
  database: z.object({
    serverVersion: z.string().min(1),
    serverMajor: z.literal(18),
    schemaReady: z.literal(true),
  }),
});

export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;

export const ApiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  requestId: z.string().min(1).max(128),
  traceId: z.string().regex(/^[0-9a-f]{32}$/),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
