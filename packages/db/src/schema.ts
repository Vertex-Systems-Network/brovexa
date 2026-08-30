import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const workspaceStatusValues = ['active', 'suspended', 'archived'] as const;
export type WorkspaceStatus = (typeof workspaceStatusValues)[number];

export const jobRunStatusValues = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'review',
] as const;
export type JobRunStatus = (typeof jobRunStatusValues)[number];

export const workUnitStatusValues = [
  'runnable',
  'running',
  'retry_wait',
  'succeeded',
  'cancelled',
  'dead_letter',
  'review',
] as const;
export type WorkUnitStatus = (typeof workUnitStatusValues)[number];

export const workErrorClassValues = ['retryable', 'permanent', 'cancelled'] as const;
export type WorkErrorClass = (typeof workErrorClassValues)[number];

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique('workspaces_slug_unique'),
    displayName: text('display_name').notNull(),
    status: text('status').$type<WorkspaceStatus>().notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    check('workspaces_slug_format_check', sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`),
    check(
      'workspaces_status_check',
      sql`${table.status} in ('active', 'suspended', 'archived')`,
    ),
  ],
);

export const workspacePreferences = pgTable('workspace_preferences', {
  workspaceId: uuid('workspace_id')
    .primaryKey()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  timezone: text('timezone').notNull().default('UTC'),
  locale: text('locale').notNull().default('en'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const jobRuns = pgTable(
  'job_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    jobType: text('job_type').notNull(),
    jobVersion: integer('job_version').notNull().default(1),
    idempotencyKey: text('idempotency_key').notNull(),
    correlationId: uuid('correlation_id').defaultRandom().notNull(),
    status: text('status').$type<JobRunStatus>().notNull().default('pending'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('job_runs_workspace_type_idempotency_unique').on(
      table.workspaceId,
      table.jobType,
      table.idempotencyKey,
    ),
    index('job_runs_workspace_status_idx').on(table.workspaceId, table.status),
    check('job_runs_type_format_check', sql`${table.jobType} ~ '^[a-z][a-z0-9_.-]*$'`),
    check('job_runs_version_check', sql`${table.jobVersion} > 0`),
    check(
      'job_runs_status_check',
      sql`${table.status} in ('pending', 'running', 'succeeded', 'failed', 'cancelled', 'review')`,
    ),
  ],
);

export const jobWorkUnits = pgTable(
  'job_work_units',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jobRunId: uuid('job_run_id')
      .notNull()
      .references(() => jobRuns.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    queueName: text('queue_name').notNull(),
    workType: text('work_type').notNull(),
    workVersion: integer('work_version').notNull().default(1),
    idempotencyKey: text('idempotency_key').notNull(),
    correlationId: uuid('correlation_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    status: text('status').$type<WorkUnitStatus>().notNull().default('runnable'),
    attemptCount: integer('attempt_count').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true, mode: 'date' }),
    cancellationRequestedAt: timestamp('cancellation_requested_at', {
      withTimezone: true,
      mode: 'date',
    }),
    workerId: text('worker_id'),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true, mode: 'date' }),
    lastErrorCode: text('last_error_code'),
    lastErrorClass: text('last_error_class').$type<WorkErrorClass>(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('job_work_units_run_type_idempotency_unique').on(
      table.jobRunId,
      table.workType,
      table.idempotencyKey,
    ),
    index('job_work_units_recovery_idx').on(table.status, table.nextAttemptAt, table.leaseExpiresAt),
    index('job_work_units_workspace_status_idx').on(table.workspaceId, table.status),
    check('job_work_units_queue_format_check', sql`${table.queueName} ~ '^brovexa-[a-z0-9-]+-v[1-9][0-9]*$'`),
    check('job_work_units_type_format_check', sql`${table.workType} ~ '^[a-z][a-z0-9_.-]*$'`),
    check('job_work_units_version_check', sql`${table.workVersion} > 0`),
    check('job_work_units_attempt_count_check', sql`${table.attemptCount} >= 0`),
    check('job_work_units_max_attempts_check', sql`${table.maxAttempts} >= 1`),
    check(
      'job_work_units_status_check',
      sql`${table.status} in ('runnable', 'running', 'retry_wait', 'succeeded', 'cancelled', 'dead_letter', 'review')`,
    ),
    check(
      'job_work_units_error_class_check',
      sql`${table.lastErrorClass} is null or ${table.lastErrorClass} in ('retryable', 'permanent', 'cancelled')`,
    ),
  ],
);

export const jobCheckpoints = pgTable(
  'job_checkpoints',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workUnitId: uuid('work_unit_id')
      .notNull()
      .references(() => jobWorkUnits.id, { onDelete: 'cascade' }),
    checkpointKey: text('checkpoint_key').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('job_checkpoints_work_unit_key_unique').on(table.workUnitId, table.checkpointKey),
  ],
);

export const jobEffects = pgTable(
  'job_effects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workUnitId: uuid('work_unit_id')
      .notNull()
      .references(() => jobWorkUnits.id, { onDelete: 'cascade' }),
    effectKey: text('effect_key').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('job_effects_work_unit_key_unique').on(table.workUnitId, table.effectKey)],
);
