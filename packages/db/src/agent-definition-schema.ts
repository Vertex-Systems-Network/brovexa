import { sql } from 'drizzle-orm';
import { boolean, check, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const agentDefinitionStatusValues = ['draft', 'approved', 'disabled'] as const;
export type AgentDefinitionStatus = (typeof agentDefinitionStatusValues)[number];

export const agentAutonomyTierValues = ['T0', 'T1', 'T2', 'T3', 'T4'] as const;
export type AgentAutonomyTier = (typeof agentAutonomyTierValues)[number];

export const agentDefinitions = pgTable(
  'agent_definitions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentKey: text('agent_key').notNull(),
    version: text('version').notNull(),
    status: text('status').$type<AgentDefinitionStatus>().notNull(),
    autonomyTier: text('autonomy_tier').$type<AgentAutonomyTier>().notNull(),
    requiresHumanApproval: boolean('requires_human_approval').notNull(),
    specification: jsonb('specification').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('agent_definitions_key_version_unique').on(table.agentKey, table.version),
    uniqueIndex('agent_definitions_identity_unique').on(table.id, table.agentKey, table.version),
    check('agent_definitions_key_check', sql`${table.agentKey} ~ '^agent\\.[a-z0-9_.-]+$'`),
    check('agent_definitions_version_check', sql`length(btrim(${table.version})) > 0`),
    check('agent_definitions_status_check', sql`${table.status} in ('draft', 'approved', 'disabled')`),
    check('agent_definitions_autonomy_tier_check', sql`${table.autonomyTier} in ('T0', 'T1', 'T2', 'T3', 'T4')`),
    check('agent_definitions_t4_human_approval_check', sql`${table.autonomyTier} <> 'T4' or ${table.requiresHumanApproval} = true`),
  ],
);
