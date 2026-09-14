"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentDefinitions = exports.agentAutonomyTierValues = exports.agentDefinitionStatusValues = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
exports.agentDefinitionStatusValues = ['draft', 'approved', 'disabled'];
exports.agentAutonomyTierValues = ['T0', 'T1', 'T2', 'T3', 'T4'];
exports.agentDefinitions = (0, pg_core_1.pgTable)('agent_definitions', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    agentKey: (0, pg_core_1.text)('agent_key').notNull(),
    version: (0, pg_core_1.text)('version').notNull(),
    status: (0, pg_core_1.text)('status').$type().notNull(),
    autonomyTier: (0, pg_core_1.text)('autonomy_tier').$type().notNull(),
    requiresHumanApproval: (0, pg_core_1.boolean)('requires_human_approval').notNull(),
    specification: (0, pg_core_1.jsonb)('specification').$type().notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('agent_definitions_key_version_unique').on(table.agentKey, table.version),
    (0, pg_core_1.uniqueIndex)('agent_definitions_identity_unique').on(table.id, table.agentKey, table.version),
    (0, pg_core_1.check)('agent_definitions_key_check', (0, drizzle_orm_1.sql) `${table.agentKey} ~ '^agent\\.[a-z0-9_.-]+$'`),
    (0, pg_core_1.check)('agent_definitions_version_check', (0, drizzle_orm_1.sql) `length(btrim(${table.version})) > 0`),
    (0, pg_core_1.check)('agent_definitions_status_check', (0, drizzle_orm_1.sql) `${table.status} in ('draft', 'approved', 'disabled')`),
    (0, pg_core_1.check)('agent_definitions_autonomy_tier_check', (0, drizzle_orm_1.sql) `${table.autonomyTier} in ('T0', 'T1', 'T2', 'T3', 'T4')`),
    (0, pg_core_1.check)('agent_definitions_t4_human_approval_check', (0, drizzle_orm_1.sql) `${table.autonomyTier} <> 'T4' or ${table.requiresHumanApproval} = true`),
]);
//# sourceMappingURL=agent-definition-schema.js.map