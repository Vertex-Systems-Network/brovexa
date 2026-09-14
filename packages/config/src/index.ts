import { z } from 'zod';

const OptionalPostgresUrlSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z
    .string()
    .regex(/^postgres(?:ql)?:\/\//, 'DATABASE_URL must use the postgres:// or postgresql:// scheme.')
    .optional(),
);

const RuntimeEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: OptionalPostgresUrlSchema,
});

export type RuntimeEnvironment = z.infer<typeof RuntimeEnvironmentSchema>;

export function parseRuntimeEnvironment(
  source: Record<string, string | undefined>,
): RuntimeEnvironment {
  return RuntimeEnvironmentSchema.parse(source);
}
