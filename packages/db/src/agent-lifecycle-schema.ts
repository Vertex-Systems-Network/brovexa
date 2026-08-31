import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { agentRuns, persistedAgentRunStatusValues, type PersistedAgentRunStatus } from './agent-run-schema';
import { memoryRecords, type PersistedMemoryStatus } from './memory-record-schema';
import { workspaces } from './schema';

export const lifecycleActorTypeValues = ['system', 'user', 'agent', 'worker', 'curator'] as const;
export type LifecycleActorType = (typeof lifecycleActorTypeValues)[number];

export const memoryLifecycleEventTypeValues = ['status_changed', 'superseded', 'deleted'] as const;
export type MemoryLifecycleEventType = (typeof memoryLifecycleEventTypeValues)[number];

export const agentRunTransitions = pgTable(
  'agent_run_transitions',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    runId: text('run_id')
      .notNull()
      .references(() => agentRuns.id, { onDelete: 'cascade' }),
    fromStatus: text('from_status').$type<PersistedAgentRunStatus>().notNull(),
    toStatus: text('to_status').$type<PersistedAgentRunStatus>().notNull(),
    reasonCode: text('reason_code').notNull(),
    actorType: text('actor_type').$type<LifecycleActorType>().notNull(),
    actorId: text('actor_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    uniqueIndex('agent_run_transitions_id_workspace_unique').on(table.id, table.workspaceId),
    index('agent_run_transitions_workspace_run_idx').on(
      table.workspaceId,
      table.runId,
      table.occurredAt,
      table.id,
    ),
    check('agent_run_transitions_id_check', sql`length(btrim(${table.id})) > 0`),
    check('agent_run_transitions_reason_check', sql`length(btrim(${table.reasonCode})) > 0`),
    check(
      'agent_run_transitions_from_status_check',
      sql`${table.fromStatus} in (${sql.join(
        persistedAgentRunStatusValues.map((value) => sql`${value}`),
        sql`, `,
      )})`,
    ),
    check(
      'agent_run_transitions_to_status_check',
      sql`${table.toStatus} in (${sql.join(
        persistedAgentRunStatusValues.map((value) => sql`${value}`),
        sql`, `,
      )})`,
    ),
    check('agent_run_transitions_change_check', sql`${table.fromStatus} <> ${table.toStatus}`),
  ],
);

export const memoryRecordLifecycleEvents = pgTable(
  'memory_record_lifecycle_events',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    memoryId: text('memory_id')
      .notNull()
      .references(() => memoryRecords.id, { onDelete: 'cascade' }),
    eventType: text('event_type').$type<MemoryLifecycleEventType>().notNull(),
    fromStatus: text('from_status').$type<PersistedMemoryStatus>().notNull(),
    toStatus: text('to_status').$type<PersistedMemoryStatus>().notNull(),
    successorMemoryId: text('successor_memory_id').references(() => memoryRecords.id, {
      onDelete: 'restrict',
    }),
    reason: text('reason').notNull(),
    actorType: text('actor_type').$type<LifecycleActorType>().notNull(),
    actorId: text('actor_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    uniqueIndex('memory_record_lifecycle_events_id_workspace_unique').on(table.id, table.workspaceId),
    index('memory_record_lifecycle_events_workspace_memory_idx').on(
      table.workspaceId,
      table.memoryId,
      table.occurredAt,
      table.id,
    ),
    check('memory_record_lifecycle_events_id_check', sql`length(btrim(${table.id})) > 0`),
    check('memory_record_lifecycle_events_reason_check', sql`length(btrim(${table.reason})) > 0`),
    check(
      'memory_record_lifecycle_events_type_check',
      sql`${table.eventType} in ('status_changed', 'superseded', 'deleted')`,
    ),
    check('memory_record_lifecycle_events_change_check', sql`${table.fromStatus} <> ${table.toStatus}`),
  ],
);
