"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiErrorSchema = exports.ReadinessResponseSchema = exports.HealthResponseSchema = void 0;
const zod_1 = require("zod");
__exportStar(require("./agent-execution"), exports);
__exportStar(require("./ai"), exports);
__exportStar(require("./identity"), exports);
__exportStar(require("./source-adapter"), exports);
__exportStar(require("./source-adapter-module"), exports);
__exportStar(require("./source-discovery-dedup"), exports);
__exportStar(require("./source-discovery-dedup-evaluator"), exports);
__exportStar(require("./source-discovery-plan"), exports);
__exportStar(require("./source-pagination-coverage"), exports);
__exportStar(require("./source-transport"), exports);
__exportStar(require("./source-transport-hop-chain"), exports);
__exportStar(require("./source-transport-result"), exports);
__exportStar(require("./source-transport-observability"), exports);
exports.HealthResponseSchema = zod_1.z.object({
    status: zod_1.z.literal('ok'),
    service: zod_1.z.literal('brovexa-api'),
    version: zod_1.z.string().min(1),
    timestamp: zod_1.z.string().datetime(),
});
exports.ReadinessResponseSchema = zod_1.z.object({
    status: zod_1.z.literal('ready'),
    database: zod_1.z.object({
        serverVersion: zod_1.z.string().min(1),
        serverMajor: zod_1.z.literal(18),
        schemaReady: zod_1.z.literal(true),
    }),
});
exports.ApiErrorSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
    message: zod_1.z.string().min(1),
    requestId: zod_1.z.string().min(1).max(128),
    traceId: zod_1.z.string().regex(/^[0-9a-f]{32}$/),
});
//# sourceMappingURL=index.js.map