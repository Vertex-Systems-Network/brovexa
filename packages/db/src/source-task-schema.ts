import { sql } from 'drizzle-orm';
import { bigint, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { jobRuns, jobWorkUnits, workspaces } from './schema';
import { sourceAdmissionSnapshots } from './source-schema';

export const researchJobPreflightDecisionValues = ['allow', 'review_required', 'blocked'] as const;
export type ResearchJobPreflightDecision = (typeof researchJobPreflightDecisionValues)[number];

export const researchJobPreflights = pgTable(
  'research_job_preflights',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    researchJobId: text('research_job_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    decision: text('decision').$type<ResearchJobPreflightDecision>().notNull(),
    admissionSnapshotIds: jsonb('admission_snapshot_ids').$type<string[]>().notNull(),
    aggregateBudget: jsonb('aggregate_budget').$type<Record<string, number>>().notNull(),
    envelope: jsonb('envelope').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('research_job_preflights_id_workspace_unique').on(table.id, table.workspaceId),
    uniqueIndex('research_job_preflights_identity_unique').on(table.id, table.workspaceId, table.researchJobId),
    uniqueIndex('research_job_preflights_workspace_job_idempotency_unique').on(
      table.workspaceId,
      table.researchJobId,
      table.idempotencyKey,
    ),
    index('research_job_preflights_workspace_job_idx').on(table.workspaceId, table.researchJobId, table.createdAt, table.id),
    check('research_job_preflights_id_check', sql`length(btrim(${table.id})) > 0`),
    check('research_job_preflights_job_id_check', sql`length(btrim(${table.researchJobId})) > 0`),
    check('research_job_preflights_idempotency_check', sql`length(btrim(${table.idempotencyKey})) > 0`),
  ],
);

export const sourceTasks = pgTable(
  'source_tasks',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    researchJobId: text('research_job_id').notNull(),
    preflightId: text('preflight_id').notNull(),
    admissionSnapshotId: text('admission_snapshot_id')
      .notNull()
      .references(() => sourceAdmissionSnapshots.id, { onDelete: 'restrict' }),
    requestId: text('request_id').notNull(),
    sourceKey: text('source_key').notNull(),
    capabilityVersion: text('capability_version').notNull(),
    connectorKey: text('connector_key').notNull(),
    connectorVersion: text('connector_version').notNull(),
    policyId: text('policy_id').notNull(),
    policyVersion: text('policy_version').notNull(),
    operation: text('operation').notNull(),
    jobRunId: uuid('job_run_id')
      .notNull()
      .references(() => jobRuns.id, { onDelete: 'restrict' }),
    workUnitId: uuid('work_unit_id')
      .notNull()
      .references(() => jobWorkUnits.id, { onDelete: 'restrict' }),
    maxAttempts: integer('max_attempts').notNull(),
    effectiveBudget: jsonb('effective_budget').$type<Record<string, number>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('source_tasks_id_workspace_unique').on(table.id, table.workspaceId),
    uniqueIndex('source_tasks_workspace_snapshot_unique').on(table.workspaceId, table.admissionSnapshotId),
    uniqueIndex('source_tasks_workspace_work_unique').on(table.workspaceId, table.workUnitId),
    index('source_tasks_workspace_research_job_idx').on(table.workspaceId, table.researchJobId, table.createdAt, table.id),
    check('source_tasks_id_check', sql`length(btrim(${table.id})) > 0`),
    check('source_tasks_job_id_check', sql`length(btrim(${table.researchJobId})) > 0`),
    check('source_tasks_source_key_check', sql`${table.sourceKey} ~ '^source\\.[a-z0-9_.-]+$'`),
    check('source_tasks_connector_key_check', sql`${table.connectorKey} ~ '^connector\\.[a-z0-9_.-]+$'`),
    check('source_tasks_max_attempts_check', sql`${table.maxAttempts} >= 1 AND ${table.maxAttempts} <= 10`),
  ],
);

export const sourceTaskUsageEvents = pgTable(
  'source_task_usage_events',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sourceTaskId: text('source_task_id').notNull(),
    requests: bigint('requests', { mode: 'number' }).notNull().default(0),
    pages: bigint('pages', { mode: 'number' }).notNull().default(0),
    bytes: bigint('bytes', { mode: 'number' }).notNull().default(0),
    currencyMicros: bigint('currency_micros', { mode: 'number' }).notNull().default(0),
    runtimeMs: bigint('runtime_ms', { mode: 'number' }).notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('source_task_usage_events_id_workspace_unique').on(table.id, table.workspaceId),
    index('source_task_usage_events_task_time_idx').on(table.workspaceId, table.sourceTaskId, table.occurredAt, table.id),
    check('source_task_usage_events_requests_check', sql`${table.requests} >= 0`),
    check('source_task_usage_events_pages_check', sql`${table.pages} >= 0`),
    check('source_task_usage_events_bytes_check', sql`${table.bytes} >= 0`),
    check('source_task_usage_events_currency_check', sql`${table.currencyMicros} >= 0`),
    check('source_task_usage_events_runtime_check', sql`${table.runtimeMs} >= 0`),
  ],
);
