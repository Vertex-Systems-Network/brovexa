"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentRuns = exports.agentExecutionModeValues = exports.persistedAgentRunStatusValues = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const agent_context_schema_1 = require("./agent-context-schema");
const agent_definition_schema_1 = require("./agent-definition-schema");
const schema_1 = require("./schema");
exports.persistedAgentRunStatusValues = [
    'queued',
    'running',
    'succeeded',
    'failed',
    'blocked',
    'budget_stopped',
    'cancelled',
    'review_required',
];
exports.agentExecutionModeValues = ['deterministic', 'model'];
exports.agentRuns = (0, pg_core_1.pgTable)('agent_runs', {
    id: (0, pg_core_1.text)('id').primaryKey(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => schema_1.workspaces.id, { onDelete: 'cascade' }),
    agentDefinitionId: (0, pg_core_1.uuid)('agent_definition_id')
        .notNull()
        .references(() => agent_definition_schema_1.agentDefinitions.id, { onDelete: 'restrict' }),
    agentKey: (0, pg_core_1.text)('agent_key').notNull(),
    agentVersion: (0, pg_core_1.text)('agent_version').notNull(),
    contextReceiptId: (0, pg_core_1.text)('context_receipt_id')
        .notNull()
        .references(() => agent_context_schema_1.agentContextReceipts.id, { onDelete: 'restrict' }),
    parentRunId: (0, pg_core_1.text)('parent_run_id'),
    handoffId: (0, pg_core_1.text)('handoff_id'),
    executionMode: (0, pg_core_1.text)('execution_mode').$type().notNull(),
    providerId: (0, pg_core_1.text)('provider_id'),
    modelId: (0, pg_core_1.text)('model_id'),
    status: (0, pg_core_1.text)('status').$type().notNull(),
    lastTransitionId: (0, pg_core_1.text)('last_transition_id'),
    envelope: (0, pg_core_1.jsonb)('envelope').$type().notNull(),
    startedAt: (0, pg_core_1.timestamp)('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: (0, pg_core_1.timestamp)('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('agent_runs_id_workspace_unique').on(table.id, table.workspaceId),
    (0, pg_core_1.index)('agent_runs_workspace_status_idx').on(table.workspaceId, table.status),
    (0, pg_core_1.index)('agent_runs_workspace_definition_idx').on(table.workspaceId, table.agentDefinitionId),
    (0, pg_core_1.check)('agent_runs_id_check', (0, drizzle_orm_1.sql) `length(btrim(${table.id})) > 0`),
    (0, pg_core_1.check)('agent_runs_execution_mode_check', (0, drizzle_orm_1.sql) `${table.executionMode} in ('deterministic', 'model')`),
    (0, pg_core_1.check)('agent_runs_status_check', (0, drizzle_orm_1.sql) `${table.status} in ('queued', 'running', 'succeeded', 'failed', 'blocked', 'budget_stopped', 'cancelled', 'review_required')`),
    (0, pg_core_1.check)('agent_runs_execution_route_check', (0, drizzle_orm_1.sql) `(${table.executionMode} = 'deterministic' and ${table.providerId} is null and ${table.modelId} is null)
        or (${table.executionMode} = 'model' and ${table.providerId} is not null and ${table.modelId} is not null)`),
    (0, pg_core_1.check)('agent_runs_completion_time_check', (0, drizzle_orm_1.sql) `${table.completedAt} is null or (${table.startedAt} is not null and ${table.completedAt} >= ${table.startedAt})`),
]);
//# sourceMappingURL=agent-run-schema.js.map