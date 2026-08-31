import type { Pool, PoolClient } from 'pg';
import { withPgTransaction } from './client';
import type { UserStatus, WorkspaceMembershipStatus } from './schema';

export const workspaceCapabilityValues = [
  'workspace.read',
  'workspace.members.read',
  'workspace.members.manage',
  'workspace.roles.read',
  'workspace.roles.manage',
  'workspace.audit.read',
] as const;
export type WorkspaceCapability = (typeof workspaceCapabilityValues)[number];

export type AuthorizationErrorCode =
  | 'USER_INACTIVE'
  | 'WORKSPACE_INACTIVE'
  | 'WORKSPACE_MEMBERSHIP_REQUIRED'
  | 'MEMBERSHIP_INACTIVE'
  | 'FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'
  | 'TENANT_SCOPE_MISMATCH'
  | 'MEMBERSHIP_ALREADY_EXISTS'
  | 'WORKSPACE_OWNER_ALREADY_BOOTSTRAPPED'
  | 'LAST_ACTIVE_OWNER';

export class AuthorizationError extends Error {
  readonly code: AuthorizationErrorCode;

  constructor(code: AuthorizationErrorCode, message: string) {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
  }
}

export interface WorkspaceAuthorizationContext {
  workspaceId: string;
  userId: string;
  membershipId: string;
  roleKeys: readonly string[];
  permissions: readonly WorkspaceCapability[];
  isOwner: boolean;
}

export interface BootstrapWorkspaceOwnerResult {
  membershipId: string;
  ownerRoleId: string;
  adminRoleId: string;
  memberRoleId: string;
}

interface PostgresErrorShape {
  code?: string;
  constraint?: string;
  cause?: unknown;
}

const permissionDescriptions: Readonly<Record<WorkspaceCapability, string>> = {
  'workspace.read': 'Read the current workspace.',
  'workspace.members.read': 'Read workspace membership state.',
  'workspace.members.manage': 'Create, suspend, reactivate, or remove workspace memberships.',
  'workspace.roles.read': 'Read workspace roles and grants.',
  'workspace.roles.manage': 'Assign and remove workspace role grants.',
  'workspace.audit.read': 'Read authorization audit history for the current workspace.',
};

const defaultRoles = [
  { key: 'owner', displayName: 'Owner', kind: 'owner' },
  { key: 'admin', displayName: 'Admin', kind: 'custom' },
  { key: 'member', displayName: 'Member', kind: 'custom' },
] as const;

type DefaultRoleKey = (typeof defaultRoles)[number]['key'];

const roleCapabilities: Readonly<Record<DefaultRoleKey, readonly WorkspaceCapability[]>> = {
  owner: workspaceCapabilityValues,
  admin: [
    'workspace.read',
    'workspace.members.read',
    'workspace.members.manage',
    'workspace.roles.read',
  ],
  member: ['workspace.read'],
};

function findPostgresError(error: unknown): PostgresErrorShape | null {
  let current: unknown = error;
  for (let depth = 0; depth < 8; depth += 1) {
    if (!current || typeof current !== 'object') return null;
    const candidate = current as PostgresErrorShape;
    if (typeof candidate.code === 'string') return candidate;
    current = candidate.cause;
  }
  return null;
}

function translateIdentityInvariant(error: unknown): never {
  const postgresError = findPostgresError(error);
  if (
    postgresError?.code === '23514' &&
    postgresError.constraint === 'workspace_requires_active_owner'
  ) {
    throw new AuthorizationError(
      'LAST_ACTIVE_OWNER',
      'The workspace must retain at least one active owner.',
    );
  }
  throw error;
}

async function appendAuthorizationAuditEvent(
  client: PoolClient,
  input: {
    workspaceId: string;
    actorUserId: string | null;
    targetUserId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO authorization_audit_events (
       workspace_id,
       actor_user_id,
       target_user_id,
       action,
       resource_type,
       resource_id,
       details
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      input.workspaceId,
      input.actorUserId,
      input.targetUserId ?? null,
      input.action,
      input.resourceType,
      input.resourceId ?? null,
      JSON.stringify(input.details ?? {}),
    ],
  );
}

async function authorizeActor(
  client: PoolClient,
  context: WorkspaceAuthorizationContext,
  capability: WorkspaceCapability,
): Promise<{ isOwner: boolean }> {
  const result = await client.query<{ has_capability: boolean; is_owner: boolean }>(
    `SELECT
       EXISTS (
         SELECT 1
         FROM workspace_memberships AS wm
         INNER JOIN users AS u ON u.id = wm.user_id
         INNER JOIN workspaces AS w ON w.id = wm.workspace_id
         INNER JOIN workspace_membership_roles AS wmr
           ON wmr.membership_id = wm.id
           AND wmr.workspace_id = wm.workspace_id
         INNER JOIN workspace_roles AS wr
           ON wr.id = wmr.role_id
           AND wr.workspace_id = wmr.workspace_id
         INNER JOIN workspace_role_permissions AS wrp ON wrp.role_id = wr.id
         WHERE wm.id = $1
           AND wm.user_id = $2
           AND wm.workspace_id = $3
           AND wm.status = 'active'
           AND u.status = 'active'
           AND w.status = 'active'
           AND wrp.permission_key = $4
       ) AS has_capability,
       EXISTS (
         SELECT 1
         FROM workspace_memberships AS wm
         INNER JOIN users AS u ON u.id = wm.user_id
         INNER JOIN workspaces AS w ON w.id = wm.workspace_id
         INNER JOIN workspace_membership_roles AS wmr
           ON wmr.membership_id = wm.id
           AND wmr.workspace_id = wm.workspace_id
         INNER JOIN workspace_roles AS wr
           ON wr.id = wmr.role_id
           AND wr.workspace_id = wmr.workspace_id
         WHERE wm.id = $1
           AND wm.user_id = $2
           AND wm.workspace_id = $3
           AND wm.status = 'active'
           AND u.status = 'active'
           AND w.status = 'active'
           AND wr.kind = 'owner'
       ) AS is_owner`,
    [context.membershipId, context.userId, context.workspaceId, capability],
  );

  const row = result.rows[0];
  if (!row?.has_capability) {
    throw new AuthorizationError('FORBIDDEN', `Missing required capability: ${capability}`);
  }
  return { isOwner: row.is_owner };
}

export function assertWorkspaceCapability(
  context: WorkspaceAuthorizationContext,
  capability: WorkspaceCapability,
  resourceWorkspaceId = context.workspaceId,
): void {
  if (resourceWorkspaceId !== context.workspaceId) {
    throw new AuthorizationError(
      'TENANT_SCOPE_MISMATCH',
      'The requested resource is outside the authorized workspace.',
    );
  }
  if (!context.permissions.includes(capability)) {
    throw new AuthorizationError('FORBIDDEN', `Missing required capability: ${capability}`);
  }
}

export async function createIdentityUser(
  pool: Pool,
  status: UserStatus = 'active',
): Promise<{ id: string; status: UserStatus }> {
  const result = await pool.query<{ id: string; status: UserStatus }>(
    'INSERT INTO users (status) VALUES ($1) RETURNING id, status',
    [status],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Identity user insert returned no row.');
  return row;
}

export async function bootstrapWorkspaceOwner(
  pool: Pool,
  input: { workspaceId: string; userId: string },
): Promise<BootstrapWorkspaceOwnerResult> {
  return withPgTransaction(pool, async (client) => {
    const workspace = await client.query<{ status: string }>(
      'SELECT status FROM workspaces WHERE id = $1 FOR UPDATE',
      [input.workspaceId],
    );
    if (workspace.rows[0]?.status !== 'active') {
      throw new AuthorizationError('WORKSPACE_INACTIVE', 'Workspace is not active.');
    }

    const ownerRoleExists = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM workspace_roles
         WHERE workspace_id = $1
           AND kind = 'owner'
       ) AS exists`,
      [input.workspaceId],
    );
    if (ownerRoleExists.rows[0]?.exists) {
      throw new AuthorizationError(
        'WORKSPACE_OWNER_ALREADY_BOOTSTRAPPED',
        'Workspace owner authority has already been initialized.',
      );
    }

    const user = await client.query<{ status: string }>(
      'SELECT status FROM users WHERE id = $1 FOR SHARE',
      [input.userId],
    );
    if (user.rows[0]?.status !== 'active') {
      throw new AuthorizationError('USER_INACTIVE', 'User is not active.');
    }

    for (const capability of workspaceCapabilityValues) {
      await client.query(
        `INSERT INTO permissions (key, description)
         VALUES ($1, $2)
         ON CONFLICT (key) DO NOTHING`,
        [capability, permissionDescriptions[capability]],
      );
    }

    for (const role of defaultRoles) {
      await client.query(
        `INSERT INTO workspace_roles (workspace_id, key, display_name, kind)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (workspace_id, key) DO NOTHING`,
        [input.workspaceId, role.key, role.displayName, role.kind],
      );
    }

    const roles = await client.query<{ id: string; key: DefaultRoleKey; kind: string }>(
      `SELECT id, key, kind
       FROM workspace_roles
       WHERE workspace_id = $1
         AND key = ANY($2::text[])`,
      [input.workspaceId, defaultRoles.map((role) => role.key)],
    );
    const ownerRole = roles.rows.find((role) => role.key === 'owner');
    const adminRole = roles.rows.find((role) => role.key === 'admin');
    const memberRole = roles.rows.find((role) => role.key === 'member');
    if (!ownerRole || !adminRole || !memberRole || ownerRole.kind !== 'owner') {
      throw new Error('Default workspace role bootstrap is inconsistent.');
    }

    for (const role of [ownerRole, adminRole, memberRole]) {
      for (const capability of roleCapabilities[role.key]) {
        await client.query(
          `INSERT INTO workspace_role_permissions (role_id, permission_key)
           VALUES ($1, $2)
           ON CONFLICT (role_id, permission_key) DO NOTHING`,
          [role.id, capability],
        );
      }
    }

    const membership = await client.query<{ id: string }>(
      `INSERT INTO workspace_memberships (workspace_id, user_id, status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (workspace_id, user_id)
       DO UPDATE SET status = 'active', updated_at = now()
       RETURNING id`,
      [input.workspaceId, input.userId],
    );
    const membershipId = membership.rows[0]?.id;
    if (!membershipId) throw new Error('Owner membership bootstrap returned no row.');

    await client.query(
      `INSERT INTO workspace_membership_roles (membership_id, role_id, workspace_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (membership_id, role_id) DO NOTHING`,
      [membershipId, ownerRole.id, input.workspaceId],
    );

    await appendAuthorizationAuditEvent(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.userId,
      targetUserId: input.userId,
      action: 'workspace.owner_bootstrapped',
      resourceType: 'workspace_membership',
      resourceId: membershipId,
      details: { roleId: ownerRole.id },
    });

    return {
      membershipId,
      ownerRoleId: ownerRole.id,
      adminRoleId: adminRole.id,
      memberRoleId: memberRole.id,
    };
  });
}

export async function resolveWorkspaceAuthorization(
  pool: Pool,
  input: { workspaceId: string; userId: string },
): Promise<WorkspaceAuthorizationContext> {
  const membership = await pool.query<{
    membership_id: string;
    membership_status: WorkspaceMembershipStatus;
    user_status: UserStatus;
    workspace_status: string;
  }>(
    `SELECT
       wm.id AS membership_id,
       wm.status AS membership_status,
       u.status AS user_status,
       w.status AS workspace_status
     FROM workspace_memberships AS wm
     INNER JOIN users AS u ON u.id = wm.user_id
     INNER JOIN workspaces AS w ON w.id = wm.workspace_id
     WHERE wm.workspace_id = $1
       AND wm.user_id = $2
     LIMIT 1`,
    [input.workspaceId, input.userId],
  );

  const row = membership.rows[0];
  if (!row) {
    throw new AuthorizationError(
      'WORKSPACE_MEMBERSHIP_REQUIRED',
      'No membership exists for the requested workspace.',
    );
  }
  if (row.user_status !== 'active') {
    throw new AuthorizationError('USER_INACTIVE', 'User is not active.');
  }
  if (row.workspace_status !== 'active') {
    throw new AuthorizationError('WORKSPACE_INACTIVE', 'Workspace is not active.');
  }
  if (row.membership_status !== 'active') {
    throw new AuthorizationError('MEMBERSHIP_INACTIVE', 'Workspace membership is not active.');
  }

  const grants = await pool.query<{
    role_key: string | null;
    role_kind: string | null;
    permission_key: WorkspaceCapability | null;
  }>(
    `SELECT
       wr.key AS role_key,
       wr.kind AS role_kind,
       wrp.permission_key AS permission_key
     FROM workspace_membership_roles AS wmr
     INNER JOIN workspace_roles AS wr
       ON wr.id = wmr.role_id
       AND wr.workspace_id = wmr.workspace_id
     LEFT JOIN workspace_role_permissions AS wrp ON wrp.role_id = wr.id
     WHERE wmr.workspace_id = $1
       AND wmr.membership_id = $2`,
    [input.workspaceId, row.membership_id],
  );

  const roleKeys = [...new Set(grants.rows.flatMap((grant) => (grant.role_key ? [grant.role_key] : [])))];
  const permissions = [
    ...new Set(grants.rows.flatMap((grant) => (grant.permission_key ? [grant.permission_key] : []))),
  ];
  const isOwner = grants.rows.some((grant) => grant.role_kind === 'owner');

  return {
    workspaceId: input.workspaceId,
    userId: input.userId,
    membershipId: row.membership_id,
    roleKeys,
    permissions,
    isOwner,
  };
}

export async function getWorkspaceRoleByKey(
  pool: Pool,
  workspaceId: string,
  key: string,
): Promise<{ id: string; key: string; kind: 'owner' | 'custom' } | null> {
  const result = await pool.query<{ id: string; key: string; kind: 'owner' | 'custom' }>(
    `SELECT id, key, kind
     FROM workspace_roles
     WHERE workspace_id = $1 AND key = $2
     LIMIT 1`,
    [workspaceId, key],
  );
  return result.rows[0] ?? null;
}

export async function createWorkspaceMembership(
  pool: Pool,
  actor: WorkspaceAuthorizationContext,
  targetUserId: string,
): Promise<{ membershipId: string }> {
  return withPgTransaction(pool, async (client) => {
    await authorizeActor(client, actor, 'workspace.members.manage');

    const user = await client.query<{ status: UserStatus }>(
      'SELECT status FROM users WHERE id = $1 FOR SHARE',
      [targetUserId],
    );
    if (user.rows[0]?.status !== 'active') {
      throw new AuthorizationError('USER_INACTIVE', 'Target user is not active.');
    }

    const membership = await client.query<{ id: string }>(
      `INSERT INTO workspace_memberships (workspace_id, user_id, status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (workspace_id, user_id) DO NOTHING
       RETURNING id`,
      [actor.workspaceId, targetUserId],
    );
    const membershipId = membership.rows[0]?.id;
    if (!membershipId) {
      throw new AuthorizationError(
        'MEMBERSHIP_ALREADY_EXISTS',
        'A membership already exists for this user and workspace.',
      );
    }

    const memberRole = await client.query<{ id: string }>(
      `SELECT id
       FROM workspace_roles
       WHERE workspace_id = $1 AND key = 'member'
       LIMIT 1`,
      [actor.workspaceId],
    );
    const memberRoleId = memberRole.rows[0]?.id;
    if (!memberRoleId) throw new Error('Default member role is missing.');

    await client.query(
      `INSERT INTO workspace_membership_roles (membership_id, role_id, workspace_id)
       VALUES ($1, $2, $3)`,
      [membershipId, memberRoleId, actor.workspaceId],
    );

    await appendAuthorizationAuditEvent(client, {
      workspaceId: actor.workspaceId,
      actorUserId: actor.userId,
      targetUserId,
      action: 'workspace.membership.created',
      resourceType: 'workspace_membership',
      resourceId: membershipId,
      details: { defaultRoleId: memberRoleId },
    });

    return { membershipId };
  });
}

export async function assignWorkspaceRole(
  pool: Pool,
  actor: WorkspaceAuthorizationContext,
  input: { targetMembershipId: string; roleId: string },
): Promise<boolean> {
  return withPgTransaction(pool, async (client) => {
    const actorState = await authorizeActor(client, actor, 'workspace.roles.manage');

    const target = await client.query<{ user_id: string }>(
      `SELECT user_id
       FROM workspace_memberships
       WHERE id = $1
         AND workspace_id = $2
         AND status = 'active'
       LIMIT 1`,
      [input.targetMembershipId, actor.workspaceId],
    );
    const targetUserId = target.rows[0]?.user_id;
    if (!targetUserId) {
      throw new AuthorizationError('RESOURCE_NOT_FOUND', 'Target membership was not found.');
    }

    const role = await client.query<{ kind: 'owner' | 'custom'; key: string }>(
      `SELECT kind, key
       FROM workspace_roles
       WHERE id = $1
         AND workspace_id = $2
       LIMIT 1`,
      [input.roleId, actor.workspaceId],
    );
    const roleRow = role.rows[0];
    if (!roleRow) {
      throw new AuthorizationError('RESOURCE_NOT_FOUND', 'Target role was not found.');
    }
    if (roleRow.kind === 'owner' && !actorState.isOwner) {
      throw new AuthorizationError('FORBIDDEN', 'Only an active owner may grant owner authority.');
    }

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO workspace_membership_roles (membership_id, role_id, workspace_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (membership_id, role_id) DO NOTHING
       RETURNING id`,
      [input.targetMembershipId, input.roleId, actor.workspaceId],
    );
    if (!inserted.rows[0]) return false;

    await appendAuthorizationAuditEvent(client, {
      workspaceId: actor.workspaceId,
      actorUserId: actor.userId,
      targetUserId,
      action: 'workspace.role.assigned',
      resourceType: 'workspace_role',
      resourceId: input.roleId,
      details: { membershipId: input.targetMembershipId, roleKey: roleRow.key },
    });
    return true;
  });
}

export async function removeWorkspaceRoleAssignment(
  pool: Pool,
  actor: WorkspaceAuthorizationContext,
  input: { targetMembershipId: string; roleId: string },
): Promise<void> {
  try {
    await withPgTransaction(pool, async (client) => {
      const actorState = await authorizeActor(client, actor, 'workspace.roles.manage');
      const assignment = await client.query<{
        assignment_id: string;
        target_user_id: string;
        role_kind: 'owner' | 'custom';
        role_key: string;
      }>(
        `SELECT
           wmr.id AS assignment_id,
           wm.user_id AS target_user_id,
           wr.kind AS role_kind,
           wr.key AS role_key
         FROM workspace_membership_roles AS wmr
         INNER JOIN workspace_memberships AS wm
           ON wm.id = wmr.membership_id
           AND wm.workspace_id = wmr.workspace_id
         INNER JOIN workspace_roles AS wr
           ON wr.id = wmr.role_id
           AND wr.workspace_id = wmr.workspace_id
         WHERE wmr.membership_id = $1
           AND wmr.role_id = $2
           AND wmr.workspace_id = $3
         LIMIT 1
         FOR UPDATE`,
        [input.targetMembershipId, input.roleId, actor.workspaceId],
      );
      const row = assignment.rows[0];
      if (!row) {
        throw new AuthorizationError('RESOURCE_NOT_FOUND', 'Role assignment was not found.');
      }
      if (row.role_kind === 'owner' && !actorState.isOwner) {
        throw new AuthorizationError('FORBIDDEN', 'Only an active owner may revoke owner authority.');
      }

      await client.query('DELETE FROM workspace_membership_roles WHERE id = $1', [row.assignment_id]);
      await appendAuthorizationAuditEvent(client, {
        workspaceId: actor.workspaceId,
        actorUserId: actor.userId,
        targetUserId: row.target_user_id,
        action: 'workspace.role.removed',
        resourceType: 'workspace_role',
        resourceId: input.roleId,
        details: { membershipId: input.targetMembershipId, roleKey: row.role_key },
      });
    });
  } catch (error) {
    translateIdentityInvariant(error);
  }
}

export async function setWorkspaceMembershipStatus(
  pool: Pool,
  actor: WorkspaceAuthorizationContext,
  input: { targetMembershipId: string; status: WorkspaceMembershipStatus },
): Promise<void> {
  try {
    await withPgTransaction(pool, async (client) => {
      const actorState = await authorizeActor(client, actor, 'workspace.members.manage');
      const target = await client.query<{
        user_id: string;
        status: WorkspaceMembershipStatus;
        is_owner: boolean;
      }>(
        `SELECT
           wm.user_id,
           wm.status,
           EXISTS (
             SELECT 1
             FROM workspace_membership_roles AS wmr
             INNER JOIN workspace_roles AS wr
               ON wr.id = wmr.role_id
               AND wr.workspace_id = wmr.workspace_id
             WHERE wmr.membership_id = wm.id
               AND wmr.workspace_id = wm.workspace_id
               AND wr.kind = 'owner'
           ) AS is_owner
         FROM workspace_memberships AS wm
         WHERE wm.id = $1
           AND wm.workspace_id = $2
         LIMIT 1
         FOR UPDATE`,
        [input.targetMembershipId, actor.workspaceId],
      );
      const row = target.rows[0];
      if (!row) {
        throw new AuthorizationError('RESOURCE_NOT_FOUND', 'Target membership was not found.');
      }
      if (row.status === input.status) return;
      if (row.is_owner && !actorState.isOwner) {
        throw new AuthorizationError(
          'FORBIDDEN',
          'Only an active owner may change an owner membership status.',
        );
      }

      await client.query(
        `UPDATE workspace_memberships
         SET status = $1, updated_at = now()
         WHERE id = $2 AND workspace_id = $3`,
        [input.status, input.targetMembershipId, actor.workspaceId],
      );
      await appendAuthorizationAuditEvent(client, {
        workspaceId: actor.workspaceId,
        actorUserId: actor.userId,
        targetUserId: row.user_id,
        action: 'workspace.membership.status_changed',
        resourceType: 'workspace_membership',
        resourceId: input.targetMembershipId,
        details: { from: row.status, to: input.status },
      });
    });
  } catch (error) {
    translateIdentityInvariant(error);
  }
}
