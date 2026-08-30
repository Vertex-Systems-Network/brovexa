import { z } from 'zod';

const RuntimeEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
});

export type RuntimeEnvironment = z.infer<typeof RuntimeEnvironmentSchema>;

export function parseRuntimeEnvironment(
  source: Record<string, string | undefined>,
): RuntimeEnvironment {
  return RuntimeEnvironmentSchema.parse(source);
}
