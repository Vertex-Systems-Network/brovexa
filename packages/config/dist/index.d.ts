import { z } from 'zod';
declare const RuntimeEnvironmentSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<{
        development: "development";
        production: "production";
        staging: "staging";
        test: "test";
    }>>;
    HOST: z.ZodDefault<z.ZodString>;
    PORT: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    DATABASE_URL: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
}, z.core.$strip>;
export type RuntimeEnvironment = z.infer<typeof RuntimeEnvironmentSchema>;
export declare function parseRuntimeEnvironment(source: Record<string, string | undefined>): RuntimeEnvironment;
export {};
