"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sourceTransportAuditRecords = exports.sourceTransportAuditDecisionValues = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const schema_1 = require("./schema");
const source_task_schema_1 = require("./source-task-schema");
exports.sourceTransportAuditDecisionValues = ['allow', 'blocked'];
exports.sourceTransportAuditRecords = (0, pg_core_1.pgTable)('source_transport_audit_records', {
    id: (0, pg_core_1.text)('id').primaryKey(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => schema_1.workspaces.id, { onDelete: 'cascade' }),
    transportRequestId: (0, pg_core_1.text)('transport_request_id').notNull(),
    sourceRequestId: (0, pg_core_1.text)('source_request_id').notNull(),
    sourceTaskId: (0, pg_core_1.text)('source_task_id').notNull(),
    connectorKey: (0, pg_core_1.text)('connector_key').notNull(),
    connectorVersion: (0, pg_core_1.text)('connector_version').notNull(),
    transportPolicyId: (0, pg_core_1.text)('transport_policy_id').notNull(),
    transportPolicyVersion: (0, pg_core_1.text)('transport_policy_version').notNull(),
    decision: (0, pg_core_1.text)('decision').$type().notNull(),
    reasonCodes: (0, pg_core_1.jsonb)('reason_codes').$type().notNull(),
    warnings: (0, pg_core_1.jsonb)('warnings').$type().notNull(),
    canonicalUrl: (0, pg_core_1.text)('canonical_url').notNull(),
    hostname: (0, pg_core_1.text)('hostname').notNull(),
    port: (0, pg_core_1.integer)('port'),
    maxResponseBytes: (0, pg_core_1.bigint)('max_response_bytes', { mode: 'number' }).notNull(),
    timeoutMs: (0, pg_core_1.bigint)('timeout_ms', { mode: 'number' }).notNull(),
    evaluatedAt: (0, pg_core_1.timestamp)('evaluated_at', { withTimezone: true, mode: 'date' }).notNull(),
    envelope: (0, pg_core_1.jsonb)('envelope').$type().notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.foreignKey)({
        name: 'source_transport_audit_records_source_task_identity_fk',
        columns: [
            table.sourceTaskId,
            table.workspaceId,
            table.sourceRequestId,
            table.connectorKey,
            table.connectorVersion,
        ],
        foreignColumns: [
            source_task_schema_1.sourceTasks.id,
            source_task_schema_1.sourceTasks.workspaceId,
            source_task_schema_1.sourceTasks.requestId,
            source_task_schema_1.sourceTasks.connectorKey,
            source_task_schema_1.sourceTasks.connectorVersion,
        ],
    }).onDelete('restrict'),
    (0, pg_core_1.index)('source_transport_audit_records_task_time_idx').on(table.workspaceId, table.sourceTaskId, table.evaluatedAt, table.createdAt, table.id),
    (0, pg_core_1.check)('source_transport_audit_records_id_check', (0, drizzle_orm_1.sql) `${table.id} ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'`),
    (0, pg_core_1.check)('source_transport_audit_records_transport_request_id_check', (0, drizzle_orm_1.sql) `${table.transportRequestId} ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'`),
    (0, pg_core_1.check)('source_transport_audit_records_source_request_id_check', (0, drizzle_orm_1.sql) `${table.sourceRequestId} ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'`),
    (0, pg_core_1.check)('source_transport_audit_records_source_task_id_check', (0, drizzle_orm_1.sql) `${table.sourceTaskId} ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'`),
    (0, pg_core_1.check)('source_transport_audit_records_connector_key_check', (0, drizzle_orm_1.sql) `${table.connectorKey} ~ '^connector\\.[a-z0-9_.-]+$'`),
    (0, pg_core_1.check)('source_transport_audit_records_response_bytes_check', (0, drizzle_orm_1.sql) `${table.maxResponseBytes} >= 1 AND ${table.maxResponseBytes} <= 9007199254740991`),
    (0, pg_core_1.check)('source_transport_audit_records_timeout_check', (0, drizzle_orm_1.sql) `${table.timeoutMs} >= 100 AND ${table.timeoutMs} <= 120000`),
    (0, pg_core_1.check)('source_transport_audit_records_port_check', (0, drizzle_orm_1.sql) `${table.port} IS NULL OR (${table.port} >= 1 AND ${table.port} <= 65535)`),
]);
//# sourceMappingURL=source-transport-audit-schema.js.map