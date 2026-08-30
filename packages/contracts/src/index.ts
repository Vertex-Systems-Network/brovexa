import { z } from 'zod';

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
  requestId: z.string().min(1).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
