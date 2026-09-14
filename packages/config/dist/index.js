"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRuntimeEnvironment = parseRuntimeEnvironment;
const zod_1 = require("zod");
const OptionalPostgresUrlSchema = zod_1.z.preprocess((value) => (value === '' ? undefined : value), zod_1.z
    .string()
    .regex(/^postgres(?:ql)?:\/\//, 'DATABASE_URL must use the postgres:// or postgresql:// scheme.')
    .optional());
const RuntimeEnvironmentSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'staging', 'production']).default('development'),
    HOST: zod_1.z.string().min(1).default('0.0.0.0'),
    PORT: zod_1.z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_URL: OptionalPostgresUrlSchema,
});
function parseRuntimeEnvironment(source) {
    return RuntimeEnvironmentSchema.parse(source);
}
//# sourceMappingURL=index.js.map