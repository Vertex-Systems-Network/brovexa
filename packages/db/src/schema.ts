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

export const userStatusValues = [
  'pending_verification',
  'active',
  'locked_security',
  'suspended_admin',
  'deletion_pending',
  'deleted_or_anonymized',
] as const;
export type UserStatus = (typeof userStatusValues)[number];

export const workspaceMembershipStatusValues = ['active', 'suspended', 'removed'] as const;
export type WorkspaceMembershipStatus = (typeof workspaceMembershipStatusValues)[number];

export const workspaceRoleKindValues = ['owner', 'custom'] as const;
export type WorkspaceRoleKind = (typeof workspaceRoleKindValues)[number];

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

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    status: text('status').$type<UserStatus>().notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'users_status_check',
      sql`${table.status} in ('pending_verification', 'active', 'locked_security', 'suspended_admin', 'deletion_pending', 'deleted_or_anonymized')`,
    ),
  ],
);

export const workspaceMemberships = pgTable(
  'workspace_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').$type<WorkspaceMembershipStatus>().notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('workspace_memberships_workspace_user_unique').on(table.workspaceId, table.userId),
    uniqueIndex('workspace_memberships_id_workspace_unique').on(table.id, table.workspaceId),
    index('workspace_memberships_user_idx').on(table.userId, table.workspaceId),
    check(
      'workspace_memberships_status_check',
      sql`${table.status} in ('active', 'suspended', 'removed')`,
    ),
  ],
);

export const permissions = pgTable(
  'permissions',
  {
    key: text('key').primaryKey(),
    description: text('description').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    check('permissions_key_check', sql`${table.key} ~ '^[a-z][a-z0-9_.-]*$'`),
  ],
);

export const workspaceRoles = pgTable(
  'workspace_roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    displayName: text('display_name').notNull(),
    kind: text('kind').$type<WorkspaceRoleKind>().notNull().default('custom'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('workspace_roles_workspace_key_unique').on(table.workspaceId, table.key),
    uniqueIndex('workspace_roles_id_workspace_unique').on(table.id, table.workspaceId),
    index('workspace_roles_workspace_kind_idx').on(table.workspaceId, table.kind),
    check('workspace_roles_key_check', sql`${table.key} ~ '^[a-z][a-z0-9_.-]*$'`),
    check('workspace_roles_kind_check', sql`${table.kind} in ('owner', 'custom')`),
  ],
);

export const workspaceRolePermissions = pgTable(
  'workspace_role_permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => workspaceRoles.id, { onDelete: 'cascade' }),
    permissionKey: text('permission_key')
      .notNull()
      .references(() => permissions.key, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('workspace_role_permissions_role_permission_unique').on(
      table.roleId,
      table.permissionKey,
    ),
  ],
);

export const workspaceMembershipRoles = pgTable(
  'workspace_membership_roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => workspaceMemberships.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => workspaceRoles.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('workspace_membership_roles_membership_role_unique').on(
      table.membershipId,
      table.roleId,
    ),
    index('workspace_membership_roles_workspace_idx').on(table.workspaceId, table.membershipId),
  ],
);

export const authorizationAuditEvents = pgTable(
  'authorization_audit_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: uuid('resource_id'),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('authorization_audit_events_workspace_created_idx').on(table.workspaceId, table.createdAt),
    check(
      'authorization_audit_events_action_check',
      sql`${table.action} ~ '^[a-z][a-z0-9_.-]*$'`,
    ),
    check(
      'authorization_audit_events_resource_type_check',
      sql`${table.resourceType} ~ '^[a-z][a-z0-9_.-]*$'`,
    ),
  ],
);

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
