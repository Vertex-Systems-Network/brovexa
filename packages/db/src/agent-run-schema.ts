import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { agentContextReceipts } from './agent-context-schema';
import { agentDefinitions } from './agent-definition-schema';
import { workspaces } from './schema';

export const persistedAgentRunStatusValues = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'blocked',
  'budget_stopped',
  'cancelled',
  'review_required',
] as const;
export type PersistedAgentRunStatus = (typeof persistedAgentRunStatusValues)[number];

export const agentExecutionModeValues = ['deterministic', 'model'] as const;
export type AgentExecutionMode = (typeof agentExecutionModeValues)[number];

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    agentDefinitionId: uuid('agent_definition_id')
      .notNull()
      .references(() => agentDefinitions.id, { onDelete: 'restrict' }),
    agentKey: text('agent_key').notNull(),
    agentVersion: text('agent_version').notNull(),
    contextReceiptId: text('context_receipt_id')
      .notNull()
      .references(() => agentContextReceipts.id, { onDelete: 'restrict' }),
    parentRunId: text('parent_run_id'),
    handoffId: text('handoff_id'),
    executionMode: text('execution_mode').$type<AgentExecutionMode>().notNull(),
    providerId: text('provider_id'),
    modelId: text('model_id'),
    status: text('status').$type<PersistedAgentRunStatus>().notNull(),
    lastTransitionId: text('last_transition_id'),
    envelope: jsonb('envelope').$type<Record<string, unknown>>().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('agent_runs_id_workspace_unique').on(table.id, table.workspaceId),
    index('agent_runs_workspace_status_idx').on(table.workspaceId, table.status),
    index('agent_runs_workspace_definition_idx').on(table.workspaceId, table.agentDefinitionId),
    check('agent_runs_id_check', sql`length(btrim(${table.id})) > 0`),
    check('agent_runs_execution_mode_check', sql`${table.executionMode} in ('deterministic', 'model')`),
    check(
      'agent_runs_status_check',
      sql`${table.status} in ('queued', 'running', 'succeeded', 'failed', 'blocked', 'budget_stopped', 'cancelled', 'review_required')`,
    ),
    check(
      'agent_runs_execution_route_check',
      sql`(${table.executionMode} = 'deterministic' and ${table.providerId} is null and ${table.modelId} is null)
        or (${table.executionMode} = 'model' and ${table.providerId} is not null and ${table.modelId} is not null)`,
    ),
    check(
      'agent_runs_completion_time_check',
      sql`${table.completedAt} is null or (${table.startedAt} is not null and ${table.completedAt} >= ${table.startedAt})`,
    ),
  ],
);
