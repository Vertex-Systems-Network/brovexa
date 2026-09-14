"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectorHealthSnapshots = exports.connectorHealthStatusValues = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const source_schema_1 = require("./source-schema");
exports.connectorHealthStatusValues = [
    'ready',
    'degraded',
    'rate_limited',
    'circuit_open',
    'disabled',
    'unknown',
];
exports.connectorHealthSnapshots = (0, pg_core_1.pgTable)('connector_health_snapshots', {
    id: (0, pg_core_1.text)('id').primaryKey(),
    connectorDefinitionId: (0, pg_core_1.uuid)('connector_definition_id')
        .notNull()
        .references(() => source_schema_1.connectorDefinitions.id, { onDelete: 'restrict' }),
    connectorKey: (0, pg_core_1.text)('connector_key').notNull(),
    connectorVersion: (0, pg_core_1.text)('connector_version').notNull(),
    status: (0, pg_core_1.text)('status').$type().notNull(),
    observedAt: (0, pg_core_1.timestamp)('observed_at', { withTimezone: true, mode: 'date' }).notNull(),
    quotaRemaining: (0, pg_core_1.bigint)('quota_remaining', { mode: 'number' }),
    rollingErrorRate: (0, pg_core_1.doublePrecision)('rolling_error_rate').notNull(),
    p95LatencyMs: (0, pg_core_1.bigint)('p95_latency_ms', { mode: 'number' }),
    reasonCodes: (0, pg_core_1.jsonb)('reason_codes').$type().notNull(),
    envelope: (0, pg_core_1.jsonb)('envelope').$type().notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.index)('connector_health_snapshots_latest_idx').on(table.connectorKey, table.connectorVersion, table.observedAt, table.createdAt, table.id),
    (0, pg_core_1.check)('connector_health_snapshots_id_check', (0, drizzle_orm_1.sql) `${table.id} ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'`),
    (0, pg_core_1.check)('connector_health_snapshots_connector_key_check', (0, drizzle_orm_1.sql) `${table.connectorKey} ~ '^connector\\.[a-z0-9_.-]+$'`),
    (0, pg_core_1.check)('connector_health_snapshots_version_check', (0, drizzle_orm_1.sql) `length(btrim(${table.connectorVersion})) > 0`),
    (0, pg_core_1.check)('connector_health_snapshots_quota_check', (0, drizzle_orm_1.sql) `${table.quotaRemaining} IS NULL OR (${table.quotaRemaining} >= 0 AND ${table.quotaRemaining} <= 9007199254740991)`),
    (0, pg_core_1.check)('connector_health_snapshots_error_rate_check', (0, drizzle_orm_1.sql) `${table.rollingErrorRate} >= 0 AND ${table.rollingErrorRate} <= 1`),
    (0, pg_core_1.check)('connector_health_snapshots_latency_check', (0, drizzle_orm_1.sql) `${table.p95LatencyMs} IS NULL OR (${table.p95LatencyMs} >= 0 AND ${table.p95LatencyMs} <= 9007199254740991)`),
]);
//# sourceMappingURL=connector-health-schema.js.map