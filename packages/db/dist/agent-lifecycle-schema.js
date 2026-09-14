"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryRecordLifecycleEvents = exports.agentRunTransitions = exports.memoryLifecycleEventTypeValues = exports.lifecycleActorTypeValues = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const agent_run_schema_1 = require("./agent-run-schema");
const memory_record_schema_1 = require("./memory-record-schema");
const schema_1 = require("./schema");
exports.lifecycleActorTypeValues = ['system', 'user', 'agent', 'worker', 'curator'];
exports.memoryLifecycleEventTypeValues = ['status_changed', 'superseded', 'deleted'];
exports.agentRunTransitions = (0, pg_core_1.pgTable)('agent_run_transitions', {
    id: (0, pg_core_1.text)('id').primaryKey(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => schema_1.workspaces.id, { onDelete: 'cascade' }),
    runId: (0, pg_core_1.text)('run_id')
        .notNull()
        .references(() => agent_run_schema_1.agentRuns.id, { onDelete: 'cascade' }),
    fromStatus: (0, pg_core_1.text)('from_status').$type().notNull(),
    toStatus: (0, pg_core_1.text)('to_status').$type().notNull(),
    reasonCode: (0, pg_core_1.text)('reason_code').notNull(),
    actorType: (0, pg_core_1.text)('actor_type').$type().notNull(),
    actorId: (0, pg_core_1.text)('actor_id'),
    metadata: (0, pg_core_1.jsonb)('metadata').$type().notNull().default({}),
    occurredAt: (0, pg_core_1.timestamp)('occurred_at', { withTimezone: true, mode: 'date' }).notNull(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('agent_run_transitions_id_workspace_unique').on(table.id, table.workspaceId),
    (0, pg_core_1.index)('agent_run_transitions_workspace_run_idx').on(table.workspaceId, table.runId, table.occurredAt, table.id),
    (0, pg_core_1.check)('agent_run_transitions_id_check', (0, drizzle_orm_1.sql) `length(btrim(${table.id})) > 0`),
    (0, pg_core_1.check)('agent_run_transitions_reason_check', (0, drizzle_orm_1.sql) `length(btrim(${table.reasonCode})) > 0`),
    (0, pg_core_1.check)('agent_run_transitions_from_status_check', (0, drizzle_orm_1.sql) `${table.fromStatus} in ('queued', 'running', 'succeeded', 'failed', 'blocked', 'budget_stopped', 'cancelled', 'review_required')`),
    (0, pg_core_1.check)('agent_run_transitions_to_status_check', (0, drizzle_orm_1.sql) `${table.toStatus} in ('queued', 'running', 'succeeded', 'failed', 'blocked', 'budget_stopped', 'cancelled', 'review_required')`),
    (0, pg_core_1.check)('agent_run_transitions_change_check', (0, drizzle_orm_1.sql) `${table.fromStatus} <> ${table.toStatus}`),
]);
exports.memoryRecordLifecycleEvents = (0, pg_core_1.pgTable)('memory_record_lifecycle_events', {
    id: (0, pg_core_1.text)('id').primaryKey(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => schema_1.workspaces.id, { onDelete: 'cascade' }),
    memoryId: (0, pg_core_1.text)('memory_id')
        .notNull()
        .references(() => memory_record_schema_1.memoryRecords.id, { onDelete: 'cascade' }),
    eventType: (0, pg_core_1.text)('event_type').$type().notNull(),
    fromStatus: (0, pg_core_1.text)('from_status').$type().notNull(),
    toStatus: (0, pg_core_1.text)('to_status').$type().notNull(),
    successorMemoryId: (0, pg_core_1.text)('successor_memory_id').references(() => memory_record_schema_1.memoryRecords.id, {
        onDelete: 'restrict',
    }),
    reason: (0, pg_core_1.text)('reason').notNull(),
    actorType: (0, pg_core_1.text)('actor_type').$type().notNull(),
    actorId: (0, pg_core_1.text)('actor_id'),
    metadata: (0, pg_core_1.jsonb)('metadata').$type().notNull().default({}),
    occurredAt: (0, pg_core_1.timestamp)('occurred_at', { withTimezone: true, mode: 'date' }).notNull(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('memory_record_lifecycle_events_id_workspace_unique').on(table.id, table.workspaceId),
    (0, pg_core_1.index)('memory_record_lifecycle_events_workspace_memory_idx').on(table.workspaceId, table.memoryId, table.occurredAt, table.id),
    (0, pg_core_1.check)('memory_record_lifecycle_events_id_check', (0, drizzle_orm_1.sql) `length(btrim(${table.id})) > 0`),
    (0, pg_core_1.check)('memory_record_lifecycle_events_reason_check', (0, drizzle_orm_1.sql) `length(btrim(${table.reason})) > 0`),
    (0, pg_core_1.check)('memory_record_lifecycle_events_type_check', (0, drizzle_orm_1.sql) `${table.eventType} in ('status_changed', 'superseded', 'deleted')`),
    (0, pg_core_1.check)('memory_record_lifecycle_events_change_check', (0, drizzle_orm_1.sql) `${table.fromStatus} <> ${table.toStatus}`),
]);
//# sourceMappingURL=agent-lifecycle-schema.js.map