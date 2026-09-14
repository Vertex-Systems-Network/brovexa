import { sql } from 'drizzle-orm';
import { bigint, check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { agentDefinitions } from './agent-definition-schema';
import { users, workspaces } from './schema';

export const agentContextReceipts = pgTable(
  'agent_context_receipts',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    runScopeId: text('run_scope_id'),
    agentDefinitionId: uuid('agent_definition_id')
      .notNull()
      .references(() => agentDefinitions.id, { onDelete: 'restrict' }),
    agentKey: text('agent_key').notNull(),
    agentVersion: text('agent_version').notNull(),
    receipt: jsonb('receipt').$type<Record<string, unknown>>().notNull(),
    tokenBudget: bigint('token_budget', { mode: 'number' }).notNull(),
    maxCurrencyMicros: bigint('max_currency_micros', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    uniqueIndex('agent_context_receipts_identity_workspace_definition_unique').on(
      table.id,
      table.workspaceId,
      table.agentDefinitionId,
    ),
    index('agent_context_receipts_workspace_created_idx').on(table.workspaceId, table.createdAt),
    check('agent_context_receipts_id_check', sql`length(btrim(${table.id})) > 0`),
    check('agent_context_receipts_token_budget_check', sql`${table.tokenBudget} >= 0`),
    check('agent_context_receipts_currency_budget_check', sql`${table.maxCurrencyMicros} >= 0`),
  ],
);
