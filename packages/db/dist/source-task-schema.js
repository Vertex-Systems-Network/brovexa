"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sourceTaskUsageEvents = exports.sourceTasks = exports.researchJobPreflights = exports.researchJobPreflightDecisionValues = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const schema_1 = require("./schema");
const source_schema_1 = require("./source-schema");
exports.researchJobPreflightDecisionValues = ['allow', 'review_required', 'blocked'];
exports.researchJobPreflights = (0, pg_core_1.pgTable)('research_job_preflights', {
    id: (0, pg_core_1.text)('id').primaryKey(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => schema_1.workspaces.id, { onDelete: 'cascade' }),
    researchJobId: (0, pg_core_1.text)('research_job_id').notNull(),
    idempotencyKey: (0, pg_core_1.text)('idempotency_key').notNull(),
    decision: (0, pg_core_1.text)('decision').$type().notNull(),
    admissionSnapshotIds: (0, pg_core_1.jsonb)('admission_snapshot_ids').$type().notNull(),
    aggregateBudget: (0, pg_core_1.jsonb)('aggregate_budget').$type().notNull(),
    envelope: (0, pg_core_1.jsonb)('envelope').$type().notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('research_job_preflights_id_workspace_unique').on(table.id, table.workspaceId),
    (0, pg_core_1.uniqueIndex)('research_job_preflights_identity_unique').on(table.id, table.workspaceId, table.researchJobId),
    (0, pg_core_1.uniqueIndex)('research_job_preflights_workspace_job_idempotency_unique').on(table.workspaceId, table.researchJobId, table.idempotencyKey),
    (0, pg_core_1.index)('research_job_preflights_workspace_job_idx').on(table.workspaceId, table.researchJobId, table.createdAt, table.id),
    (0, pg_core_1.check)('research_job_preflights_id_check', (0, drizzle_orm_1.sql) `length(btrim(${table.id})) > 0`),
    (0, pg_core_1.check)('research_job_preflights_job_id_check', (0, drizzle_orm_1.sql) `length(btrim(${table.researchJobId})) > 0`),
    (0, pg_core_1.check)('research_job_preflights_idempotency_check', (0, drizzle_orm_1.sql) `length(btrim(${table.idempotencyKey})) > 0`),
]);
exports.sourceTasks = (0, pg_core_1.pgTable)('source_tasks', {
    id: (0, pg_core_1.text)('id').primaryKey(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => schema_1.workspaces.id, { onDelete: 'cascade' }),
    researchJobId: (0, pg_core_1.text)('research_job_id').notNull(),
    preflightId: (0, pg_core_1.text)('preflight_id').notNull(),
    admissionSnapshotId: (0, pg_core_1.text)('admission_snapshot_id')
        .notNull()
        .references(() => source_schema_1.sourceAdmissionSnapshots.id, { onDelete: 'restrict' }),
    requestId: (0, pg_core_1.text)('request_id').notNull(),
    sourceKey: (0, pg_core_1.text)('source_key').notNull(),
    capabilityVersion: (0, pg_core_1.text)('capability_version').notNull(),
    connectorKey: (0, pg_core_1.text)('connector_key').notNull(),
    connectorVersion: (0, pg_core_1.text)('connector_version').notNull(),
    policyId: (0, pg_core_1.text)('policy_id').notNull(),
    policyVersion: (0, pg_core_1.text)('policy_version').notNull(),
    operation: (0, pg_core_1.text)('operation').notNull(),
    jobRunId: (0, pg_core_1.uuid)('job_run_id')
        .notNull()
        .references(() => schema_1.jobRuns.id, { onDelete: 'restrict' }),
    workUnitId: (0, pg_core_1.uuid)('work_unit_id')
        .notNull()
        .references(() => schema_1.jobWorkUnits.id, { onDelete: 'restrict' }),
    maxAttempts: (0, pg_core_1.integer)('max_attempts').notNull(),
    effectiveBudget: (0, pg_core_1.jsonb)('effective_budget').$type().notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('source_tasks_id_workspace_unique').on(table.id, table.workspaceId),
    (0, pg_core_1.uniqueIndex)('source_tasks_workspace_snapshot_unique').on(table.workspaceId, table.admissionSnapshotId),
    (0, pg_core_1.uniqueIndex)('source_tasks_workspace_work_unique').on(table.workspaceId, table.workUnitId),
    (0, pg_core_1.uniqueIndex)('source_tasks_transport_audit_identity_unique').on(table.id, table.workspaceId, table.requestId, table.connectorKey, table.connectorVersion),
    (0, pg_core_1.index)('source_tasks_workspace_research_job_idx').on(table.workspaceId, table.researchJobId, table.createdAt, table.id),
    (0, pg_core_1.check)('source_tasks_id_check', (0, drizzle_orm_1.sql) `length(btrim(${table.id})) > 0`),
    (0, pg_core_1.check)('source_tasks_job_id_check', (0, drizzle_orm_1.sql) `length(btrim(${table.researchJobId})) > 0`),
    (0, pg_core_1.check)('source_tasks_source_key_check', (0, drizzle_orm_1.sql) `${table.sourceKey} ~ '^source\\.[a-z0-9_.-]+$'`),
    (0, pg_core_1.check)('source_tasks_connector_key_check', (0, drizzle_orm_1.sql) `${table.connectorKey} ~ '^connector\\.[a-z0-9_.-]+$'`),
    (0, pg_core_1.check)('source_tasks_max_attempts_check', (0, drizzle_orm_1.sql) `${table.maxAttempts} >= 1 AND ${table.maxAttempts} <= 10`),
]);
exports.sourceTaskUsageEvents = (0, pg_core_1.pgTable)('source_task_usage_events', {
    id: (0, pg_core_1.text)('id').primaryKey(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => schema_1.workspaces.id, { onDelete: 'cascade' }),
    sourceTaskId: (0, pg_core_1.text)('source_task_id').notNull(),
    requests: (0, pg_core_1.bigint)('requests', { mode: 'number' }).notNull().default(0),
    pages: (0, pg_core_1.bigint)('pages', { mode: 'number' }).notNull().default(0),
    bytes: (0, pg_core_1.bigint)('bytes', { mode: 'number' }).notNull().default(0),
    currencyMicros: (0, pg_core_1.bigint)('currency_micros', { mode: 'number' }).notNull().default(0),
    runtimeMs: (0, pg_core_1.bigint)('runtime_ms', { mode: 'number' }).notNull().default(0),
    metadata: (0, pg_core_1.jsonb)('metadata').$type().notNull().default((0, drizzle_orm_1.sql) `'{}'::jsonb`),
    occurredAt: (0, pg_core_1.timestamp)('occurred_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('source_task_usage_events_id_workspace_unique').on(table.id, table.workspaceId),
    (0, pg_core_1.index)('source_task_usage_events_task_time_idx').on(table.workspaceId, table.sourceTaskId, table.occurredAt, table.id),
    (0, pg_core_1.check)('source_task_usage_events_requests_check', (0, drizzle_orm_1.sql) `${table.requests} >= 0`),
    (0, pg_core_1.check)('source_task_usage_events_pages_check', (0, drizzle_orm_1.sql) `${table.pages} >= 0`),
    (0, pg_core_1.check)('source_task_usage_events_bytes_check', (0, drizzle_orm_1.sql) `${table.bytes} >= 0`),
    (0, pg_core_1.check)('source_task_usage_events_currency_check', (0, drizzle_orm_1.sql) `${table.currencyMicros} >= 0`),
    (0, pg_core_1.check)('source_task_usage_events_runtime_check', (0, drizzle_orm_1.sql) `${table.runtimeMs} >= 0`),
]);
//# sourceMappingURL=source-task-schema.js.map