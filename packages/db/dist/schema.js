"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobEffects = exports.jobCheckpoints = exports.jobWorkUnits = exports.jobRuns = exports.authorizationAuditEvents = exports.workspaceMembershipRoles = exports.workspaceRolePermissions = exports.workspaceRoles = exports.permissions = exports.workspaceMemberships = exports.users = exports.workspacePreferences = exports.workspaces = exports.workErrorClassValues = exports.workUnitStatusValues = exports.jobRunStatusValues = exports.workspaceRoleKindValues = exports.workspaceMembershipStatusValues = exports.userStatusValues = exports.workspaceStatusValues = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
exports.workspaceStatusValues = ['active', 'suspended', 'archived'];
exports.userStatusValues = [
    'pending_verification',
    'active',
    'locked_security',
    'suspended_admin',
    'deletion_pending',
    'deleted_or_anonymized',
];
exports.workspaceMembershipStatusValues = ['active', 'suspended', 'removed'];
exports.workspaceRoleKindValues = ['owner', 'custom'];
exports.jobRunStatusValues = [
    'pending',
    'running',
    'succeeded',
    'failed',
    'cancelled',
    'review',
];
exports.workUnitStatusValues = [
    'runnable',
    'running',
    'retry_wait',
    'succeeded',
    'cancelled',
    'dead_letter',
    'review',
];
exports.workErrorClassValues = ['retryable', 'permanent', 'cancelled'];
exports.workspaces = (0, pg_core_1.pgTable)('workspaces', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    slug: (0, pg_core_1.text)('slug').notNull().unique('workspaces_slug_unique'),
    displayName: (0, pg_core_1.text)('display_name').notNull(),
    status: (0, pg_core_1.text)('status').$type().notNull().default('active'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.check)('workspaces_slug_format_check', (0, drizzle_orm_1.sql) `${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`),
    (0, pg_core_1.check)('workspaces_status_check', (0, drizzle_orm_1.sql) `${table.status} in ('active', 'suspended', 'archived')`),
]);
exports.workspacePreferences = (0, pg_core_1.pgTable)('workspace_preferences', {
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .primaryKey()
        .references(() => exports.workspaces.id, { onDelete: 'cascade' }),
    timezone: (0, pg_core_1.text)('timezone').notNull().default('UTC'),
    locale: (0, pg_core_1.text)('locale').notNull().default('en'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    status: (0, pg_core_1.text)('status').$type().notNull().default('active'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.check)('users_status_check', (0, drizzle_orm_1.sql) `${table.status} in ('pending_verification', 'active', 'locked_security', 'suspended_admin', 'deletion_pending', 'deleted_or_anonymized')`),
]);
exports.workspaceMemberships = (0, pg_core_1.pgTable)('workspace_memberships', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => exports.workspaces.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(() => exports.users.id, { onDelete: 'cascade' }),
    status: (0, pg_core_1.text)('status').$type().notNull().default('active'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('workspace_memberships_workspace_user_unique').on(table.workspaceId, table.userId),
    (0, pg_core_1.uniqueIndex)('workspace_memberships_id_workspace_unique').on(table.id, table.workspaceId),
    (0, pg_core_1.index)('workspace_memberships_user_idx').on(table.userId, table.workspaceId),
    (0, pg_core_1.check)('workspace_memberships_status_check', (0, drizzle_orm_1.sql) `${table.status} in ('active', 'suspended', 'removed')`),
]);
exports.permissions = (0, pg_core_1.pgTable)('permissions', {
    key: (0, pg_core_1.text)('key').primaryKey(),
    description: (0, pg_core_1.text)('description').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.check)('permissions_key_check', (0, drizzle_orm_1.sql) `${table.key} ~ '^[a-z][a-z0-9_.-]*$'`),
]);
exports.workspaceRoles = (0, pg_core_1.pgTable)('workspace_roles', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => exports.workspaces.id, { onDelete: 'cascade' }),
    key: (0, pg_core_1.text)('key').notNull(),
    displayName: (0, pg_core_1.text)('display_name').notNull(),
    kind: (0, pg_core_1.text)('kind').$type().notNull().default('custom'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('workspace_roles_workspace_key_unique').on(table.workspaceId, table.key),
    (0, pg_core_1.uniqueIndex)('workspace_roles_id_workspace_unique').on(table.id, table.workspaceId),
    (0, pg_core_1.index)('workspace_roles_workspace_kind_idx').on(table.workspaceId, table.kind),
    (0, pg_core_1.check)('workspace_roles_key_check', (0, drizzle_orm_1.sql) `${table.key} ~ '^[a-z][a-z0-9_.-]*$'`),
    (0, pg_core_1.check)('workspace_roles_kind_check', (0, drizzle_orm_1.sql) `${table.kind} in ('owner', 'custom')`),
]);
exports.workspaceRolePermissions = (0, pg_core_1.pgTable)('workspace_role_permissions', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    roleId: (0, pg_core_1.uuid)('role_id')
        .notNull()
        .references(() => exports.workspaceRoles.id, { onDelete: 'cascade' }),
    permissionKey: (0, pg_core_1.text)('permission_key')
        .notNull()
        .references(() => exports.permissions.key, { onDelete: 'restrict' }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('workspace_role_permissions_role_permission_unique').on(table.roleId, table.permissionKey),
]);
exports.workspaceMembershipRoles = (0, pg_core_1.pgTable)('workspace_membership_roles', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    membershipId: (0, pg_core_1.uuid)('membership_id')
        .notNull()
        .references(() => exports.workspaceMemberships.id, { onDelete: 'cascade' }),
    roleId: (0, pg_core_1.uuid)('role_id')
        .notNull()
        .references(() => exports.workspaceRoles.id, { onDelete: 'restrict' }),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => exports.workspaces.id, { onDelete: 'cascade' }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('workspace_membership_roles_membership_role_unique').on(table.membershipId, table.roleId),
    (0, pg_core_1.index)('workspace_membership_roles_workspace_idx').on(table.workspaceId, table.membershipId),
]);
exports.authorizationAuditEvents = (0, pg_core_1.pgTable)('authorization_audit_events', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => exports.workspaces.id, { onDelete: 'restrict' }),
    actorUserId: (0, pg_core_1.uuid)('actor_user_id').references(() => exports.users.id, { onDelete: 'set null' }),
    targetUserId: (0, pg_core_1.uuid)('target_user_id').references(() => exports.users.id, { onDelete: 'set null' }),
    action: (0, pg_core_1.text)('action').notNull(),
    resourceType: (0, pg_core_1.text)('resource_type').notNull(),
    resourceId: (0, pg_core_1.uuid)('resource_id'),
    details: (0, pg_core_1.jsonb)('details').$type().notNull().default((0, drizzle_orm_1.sql) `'{}'::jsonb`),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.index)('authorization_audit_events_workspace_created_idx').on(table.workspaceId, table.createdAt),
    (0, pg_core_1.check)('authorization_audit_events_action_check', (0, drizzle_orm_1.sql) `${table.action} ~ '^[a-z][a-z0-9_.-]*$'`),
    (0, pg_core_1.check)('authorization_audit_events_resource_type_check', (0, drizzle_orm_1.sql) `${table.resourceType} ~ '^[a-z][a-z0-9_.-]*$'`),
]);
exports.jobRuns = (0, pg_core_1.pgTable)('job_runs', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => exports.workspaces.id, { onDelete: 'cascade' }),
    jobType: (0, pg_core_1.text)('job_type').notNull(),
    jobVersion: (0, pg_core_1.integer)('job_version').notNull().default(1),
    idempotencyKey: (0, pg_core_1.text)('idempotency_key').notNull(),
    correlationId: (0, pg_core_1.uuid)('correlation_id').defaultRandom().notNull(),
    status: (0, pg_core_1.text)('status').$type().notNull().default('pending'),
    startedAt: (0, pg_core_1.timestamp)('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: (0, pg_core_1.timestamp)('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('job_runs_workspace_type_idempotency_unique').on(table.workspaceId, table.jobType, table.idempotencyKey),
    (0, pg_core_1.index)('job_runs_workspace_status_idx').on(table.workspaceId, table.status),
    (0, pg_core_1.check)('job_runs_type_format_check', (0, drizzle_orm_1.sql) `${table.jobType} ~ '^[a-z][a-z0-9_.-]*$'`),
    (0, pg_core_1.check)('job_runs_version_check', (0, drizzle_orm_1.sql) `${table.jobVersion} > 0`),
    (0, pg_core_1.check)('job_runs_status_check', (0, drizzle_orm_1.sql) `${table.status} in ('pending', 'running', 'succeeded', 'failed', 'cancelled', 'review')`),
]);
exports.jobWorkUnits = (0, pg_core_1.pgTable)('job_work_units', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    jobRunId: (0, pg_core_1.uuid)('job_run_id')
        .notNull()
        .references(() => exports.jobRuns.id, { onDelete: 'cascade' }),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => exports.workspaces.id, { onDelete: 'cascade' }),
    queueName: (0, pg_core_1.text)('queue_name').notNull(),
    workType: (0, pg_core_1.text)('work_type').notNull(),
    workVersion: (0, pg_core_1.integer)('work_version').notNull().default(1),
    idempotencyKey: (0, pg_core_1.text)('idempotency_key').notNull(),
    correlationId: (0, pg_core_1.uuid)('correlation_id').notNull(),
    payload: (0, pg_core_1.jsonb)('payload').$type().notNull().default((0, drizzle_orm_1.sql) `'{}'::jsonb`),
    status: (0, pg_core_1.text)('status').$type().notNull().default('runnable'),
    attemptCount: (0, pg_core_1.integer)('attempt_count').notNull().default(0),
    maxAttempts: (0, pg_core_1.integer)('max_attempts').notNull().default(3),
    nextAttemptAt: (0, pg_core_1.timestamp)('next_attempt_at', { withTimezone: true, mode: 'date' }),
    cancellationRequestedAt: (0, pg_core_1.timestamp)('cancellation_requested_at', {
        withTimezone: true,
        mode: 'date',
    }),
    workerId: (0, pg_core_1.text)('worker_id'),
    leaseExpiresAt: (0, pg_core_1.timestamp)('lease_expires_at', { withTimezone: true, mode: 'date' }),
    lastErrorCode: (0, pg_core_1.text)('last_error_code'),
    lastErrorClass: (0, pg_core_1.text)('last_error_class').$type(),
    startedAt: (0, pg_core_1.timestamp)('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: (0, pg_core_1.timestamp)('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('job_work_units_run_type_idempotency_unique').on(table.jobRunId, table.workType, table.idempotencyKey),
    (0, pg_core_1.index)('job_work_units_recovery_idx').on(table.status, table.nextAttemptAt, table.leaseExpiresAt),
    (0, pg_core_1.index)('job_work_units_workspace_status_idx').on(table.workspaceId, table.status),
    (0, pg_core_1.check)('job_work_units_queue_format_check', (0, drizzle_orm_1.sql) `${table.queueName} ~ '^brovexa-[a-z0-9-]+-v[1-9][0-9]*$'`),
    (0, pg_core_1.check)('job_work_units_type_format_check', (0, drizzle_orm_1.sql) `${table.workType} ~ '^[a-z][a-z0-9_.-]*$'`),
    (0, pg_core_1.check)('job_work_units_version_check', (0, drizzle_orm_1.sql) `${table.workVersion} > 0`),
    (0, pg_core_1.check)('job_work_units_attempt_count_check', (0, drizzle_orm_1.sql) `${table.attemptCount} >= 0`),
    (0, pg_core_1.check)('job_work_units_max_attempts_check', (0, drizzle_orm_1.sql) `${table.maxAttempts} >= 1`),
    (0, pg_core_1.check)('job_work_units_status_check', (0, drizzle_orm_1.sql) `${table.status} in ('runnable', 'running', 'retry_wait', 'succeeded', 'cancelled', 'dead_letter', 'review')`),
    (0, pg_core_1.check)('job_work_units_error_class_check', (0, drizzle_orm_1.sql) `${table.lastErrorClass} is null or ${table.lastErrorClass} in ('retryable', 'permanent', 'cancelled')`),
]);
exports.jobCheckpoints = (0, pg_core_1.pgTable)('job_checkpoints', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    workUnitId: (0, pg_core_1.uuid)('work_unit_id')
        .notNull()
        .references(() => exports.jobWorkUnits.id, { onDelete: 'cascade' }),
    checkpointKey: (0, pg_core_1.text)('checkpoint_key').notNull(),
    data: (0, pg_core_1.jsonb)('data').$type().notNull().default((0, drizzle_orm_1.sql) `'{}'::jsonb`),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('job_checkpoints_work_unit_key_unique').on(table.workUnitId, table.checkpointKey),
]);
exports.jobEffects = (0, pg_core_1.pgTable)('job_effects', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    workUnitId: (0, pg_core_1.uuid)('work_unit_id')
        .notNull()
        .references(() => exports.jobWorkUnits.id, { onDelete: 'cascade' }),
    effectKey: (0, pg_core_1.text)('effect_key').notNull(),
    data: (0, pg_core_1.jsonb)('data').$type().notNull().default((0, drizzle_orm_1.sql) `'{}'::jsonb`),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [(0, pg_core_1.uniqueIndex)('job_effects_work_unit_key_unique').on(table.workUnitId, table.effectKey)]);
//# sourceMappingURL=schema.js.map