"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentExecutionPlans = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const agent_context_schema_1 = require("./agent-context-schema");
const agent_definition_schema_1 = require("./agent-definition-schema");
const agent_run_schema_1 = require("./agent-run-schema");
const schema_1 = require("./schema");
exports.agentExecutionPlans = (0, pg_core_1.pgTable)('agent_execution_plans', {
    id: (0, pg_core_1.text)('id').primaryKey(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => schema_1.workspaces.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(() => schema_1.users.id, { onDelete: 'restrict' }),
    runId: (0, pg_core_1.text)('run_id')
        .notNull()
        .references(() => agent_run_schema_1.agentRuns.id, { onDelete: 'restrict' }),
    contextReceiptId: (0, pg_core_1.text)('context_receipt_id')
        .notNull()
        .references(() => agent_context_schema_1.agentContextReceipts.id, { onDelete: 'restrict' }),
    orchestratorDefinitionId: (0, pg_core_1.uuid)('orchestrator_definition_id')
        .notNull()
        .references(() => agent_definition_schema_1.agentDefinitions.id, { onDelete: 'restrict' }),
    orchestratorKey: (0, pg_core_1.text)('orchestrator_key').notNull(),
    orchestratorVersion: (0, pg_core_1.text)('orchestrator_version').notNull(),
    planVersion: (0, pg_core_1.integer)('plan_version').notNull(),
    maxParallelism: (0, pg_core_1.integer)('max_parallelism').notNull(),
    stepCount: (0, pg_core_1.integer)('step_count').notNull(),
    envelope: (0, pg_core_1.jsonb)('envelope').$type().notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('agent_execution_plans_id_workspace_unique').on(table.id, table.workspaceId),
    (0, pg_core_1.uniqueIndex)('agent_execution_plans_run_workspace_unique').on(table.runId, table.workspaceId),
    (0, pg_core_1.index)('agent_execution_plans_workspace_created_idx').on(table.workspaceId, table.createdAt),
    (0, pg_core_1.check)('agent_execution_plans_id_check', (0, drizzle_orm_1.sql) `length(btrim(${table.id})) > 0`),
    (0, pg_core_1.check)('agent_execution_plans_orchestrator_key_check', (0, drizzle_orm_1.sql) `${table.orchestratorKey} = 'agent.control.orchestrator'`),
    (0, pg_core_1.check)('agent_execution_plans_orchestrator_version_check', (0, drizzle_orm_1.sql) `length(btrim(${table.orchestratorVersion})) > 0`),
    (0, pg_core_1.check)('agent_execution_plans_plan_version_check', (0, drizzle_orm_1.sql) `${table.planVersion} > 0`),
    (0, pg_core_1.check)('agent_execution_plans_step_count_check', (0, drizzle_orm_1.sql) `${table.stepCount} between 1 and 64`),
    (0, pg_core_1.check)('agent_execution_plans_parallelism_check', (0, drizzle_orm_1.sql) `${table.maxParallelism} between 1 and 256 and ${table.maxParallelism} <= ${table.stepCount}`),
]);
//# sourceMappingURL=agent-execution-schema.js.map