"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentContextReceipts = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const agent_definition_schema_1 = require("./agent-definition-schema");
const schema_1 = require("./schema");
exports.agentContextReceipts = (0, pg_core_1.pgTable)('agent_context_receipts', {
    id: (0, pg_core_1.text)('id').primaryKey(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => schema_1.workspaces.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.uuid)('user_id').references(() => schema_1.users.id, { onDelete: 'set null' }),
    runScopeId: (0, pg_core_1.text)('run_scope_id'),
    agentDefinitionId: (0, pg_core_1.uuid)('agent_definition_id')
        .notNull()
        .references(() => agent_definition_schema_1.agentDefinitions.id, { onDelete: 'restrict' }),
    agentKey: (0, pg_core_1.text)('agent_key').notNull(),
    agentVersion: (0, pg_core_1.text)('agent_version').notNull(),
    receipt: (0, pg_core_1.jsonb)('receipt').$type().notNull(),
    tokenBudget: (0, pg_core_1.bigint)('token_budget', { mode: 'number' }).notNull(),
    maxCurrencyMicros: (0, pg_core_1.bigint)('max_currency_micros', { mode: 'number' }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('agent_context_receipts_identity_workspace_definition_unique').on(table.id, table.workspaceId, table.agentDefinitionId),
    (0, pg_core_1.index)('agent_context_receipts_workspace_created_idx').on(table.workspaceId, table.createdAt),
    (0, pg_core_1.check)('agent_context_receipts_id_check', (0, drizzle_orm_1.sql) `length(btrim(${table.id})) > 0`),
    (0, pg_core_1.check)('agent_context_receipts_token_budget_check', (0, drizzle_orm_1.sql) `${table.tokenBudget} >= 0`),
    (0, pg_core_1.check)('agent_context_receipts_currency_budget_check', (0, drizzle_orm_1.sql) `${table.maxCurrencyMicros} >= 0`),
]);
//# sourceMappingURL=agent-context-schema.js.map