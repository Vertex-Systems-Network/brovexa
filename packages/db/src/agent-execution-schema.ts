import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { agentContextReceipts } from './agent-context-schema';
import { agentDefinitions } from './agent-definition-schema';
import { agentRuns } from './agent-run-schema';
import { users, workspaces } from './schema';

export const agentExecutionPlans = pgTable(
  'agent_execution_plans',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    runId: text('run_id')
      .notNull()
      .references(() => agentRuns.id, { onDelete: 'restrict' }),
    contextReceiptId: text('context_receipt_id')
      .notNull()
      .references(() => agentContextReceipts.id, { onDelete: 'restrict' }),
    orchestratorDefinitionId: uuid('orchestrator_definition_id')
      .notNull()
      .references(() => agentDefinitions.id, { onDelete: 'restrict' }),
    orchestratorKey: text('orchestrator_key').notNull(),
    orchestratorVersion: text('orchestrator_version').notNull(),
    planVersion: integer('plan_version').notNull(),
    maxParallelism: integer('max_parallelism').notNull(),
    stepCount: integer('step_count').notNull(),
    envelope: jsonb('envelope').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    uniqueIndex('agent_execution_plans_id_workspace_unique').on(table.id, table.workspaceId),
    uniqueIndex('agent_execution_plans_run_workspace_unique').on(table.runId, table.workspaceId),
    index('agent_execution_plans_workspace_created_idx').on(table.workspaceId, table.createdAt),
    check('agent_execution_plans_id_check', sql`length(btrim(${table.id})) > 0`),
    check(
      'agent_execution_plans_orchestrator_key_check',
      sql`${table.orchestratorKey} = 'agent.control.orchestrator'`,
    ),
    check(
      'agent_execution_plans_orchestrator_version_check',
      sql`length(btrim(${table.orchestratorVersion})) > 0`,
    ),
    check('agent_execution_plans_plan_version_check', sql`${table.planVersion} > 0`),
    check(
      'agent_execution_plans_step_count_check',
      sql`${table.stepCount} between 1 and 64`,
    ),
    check(
      'agent_execution_plans_parallelism_check',
      sql`${table.maxParallelism} between 1 and 256 and ${table.maxParallelism} <= ${table.stepCount}`,
    ),
  ],
);
