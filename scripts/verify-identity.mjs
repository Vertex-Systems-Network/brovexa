import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  AuthorizationError,
  applyPendingMigrations,
  assignWorkspaceRole,
  bootstrapWorkspaceOwner,
  createIdentityUser,
  createPgPool,
  createWorkspaceMembership,
  getWorkspaceRoleByKey,
  probeDatabase,
  removeWorkspaceRoleAssignment,
  resolveWorkspaceAuthorization,
  rollbackLatestMigration,
  setWorkspaceMembershipStatus,
} from '../packages/db/dist/index.js';
import {
  authClientKindValues,
  authenticationMethodValues,
} from '../packages/contracts/dist/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for identity integration verification.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for destructive identity verification.');
}

const migrationsDir = resolve('packages/db/migrations');
const pool = createPgPool({ connectionString, max: 6 });

function findPostgresError(error) {
  let current = error;
  for (let depth = 0; depth < 8; depth += 1) {
    if (!current || typeof current !== 'object') return null;
    if (typeof current.code === 'string' && /^[0-9A-Z]{5}$/.test(current.code)) return current;
    current = current.cause;
  }
  return null;
}

function expectPostgresConstraint(expectedCode, expectedConstraint) {
  return (error) => {
    const postgresError = findPostgresError(error);
    assert.ok(postgresError, `Expected nested PostgreSQL error ${expectedCode}.`);
    assert.equal(postgresError.code, expectedCode);
    assert.equal(postgresError.constraint, expectedConstraint);
    return true;
  };
}

function expectAuthorizationCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof AuthorizationError, `Expected AuthorizationError(${expectedCode}).`);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function resetTestDatabase() {
  await pool.query('DROP TABLE IF EXISTS agent_eval_results CASCADE');
  await pool.query('DROP TABLE IF EXISTS memory_records CASCADE');
  await pool.query('DROP TABLE IF EXISTS agent_runs CASCADE');
  await pool.query('DROP TABLE IF EXISTS agent_context_receipts CASCADE');
  await pool.query('DROP TABLE IF EXISTS agent_definitions CASCADE');
  await pool.query('DROP TABLE IF EXISTS authorization_audit_events CASCADE');
  await pool.query('DROP TABLE IF EXISTS workspace_membership_roles CASCADE');
  await pool.query('DROP TABLE IF EXISTS workspace_role_permissions CASCADE');
  await pool.query('DROP TABLE IF EXISTS workspace_roles CASCADE');
  await pool.query('DROP TABLE IF EXISTS permissions CASCADE');
  await pool.query('DROP TABLE IF EXISTS workspace_memberships CASCADE');
  await pool.query('DROP TABLE IF EXISTS users CASCADE');
  await pool.query('DROP TABLE IF EXISTS job_effects CASCADE');
  await pool.query('DROP TABLE IF EXISTS job_checkpoints CASCADE');
  await pool.query('DROP TABLE IF EXISTS job_work_units CASCADE');
  await pool.query('DROP TABLE IF EXISTS job_runs CASCADE');
  await pool.query('DROP TABLE IF EXISTS workspace_preferences CASCADE');
  await pool.query('DROP TABLE IF EXISTS workspaces CASCADE');
  await pool.query('DROP SCHEMA IF EXISTS brovexa_internal CASCADE');
}

async function createWorkspace(slug, displayName) {
  const result = await pool.query(
    'INSERT INTO workspaces (slug, display_name) VALUES ($1, $2) RETURNING id',
    [slug, displayName],
  );
  const id = result.rows[0]?.id;
  assert.ok(id);
  return id;
}

try {
  const identity = await pool.query('SELECT current_database() AS name');
  const databaseName = identity.rows[0]?.name;
  assert.ok(databaseName?.endsWith('_test'), `Refusing destructive verification against database: ${databaseName}`);

  await resetTestDatabase();
  assert.deepEqual(await applyPendingMigrations(pool, migrationsDir), [
    '0000_workspace_foundation',
    '0001_job_execution_foundation',
    '0002_identity_authorization_foundation',
    '0003_agent_runtime_core',
    '0004_memory_evaluation_core',
  ]);
  assert.equal((await probeDatabase(pool)).schemaReady, true);

  assert.deepEqual(authClientKindValues, ['web', 'desktop', 'extension', 'api']);
  assert.deepEqual(authenticationMethodValues, ['test', 'password', 'oidc', 'passkey']);

  const workspaceA = await createWorkspace('tenant-a', 'Tenant A');
  const workspaceB = await createWorkspace('tenant-b', 'Tenant B');

  const ownerA = await createIdentityUser(pool);
  const ownerB = await createIdentityUser(pool);
  const memberA = await createIdentityUser(pool);
  const secondOwnerA = await createIdentityUser(pool);
  const extraA = await createIdentityUser(pool);

  const bootstrapA = await bootstrapWorkspaceOwner(pool, {
    workspaceId: workspaceA,
    userId: ownerA.id,
  });
  const bootstrapB = await bootstrapWorkspaceOwner(pool, {
    workspaceId: workspaceB,
    userId: ownerB.id,
  });

  await assert.rejects(
    () => bootstrapWorkspaceOwner(pool, { workspaceId: workspaceA, userId: extraA.id }),
    expectAuthorizationCode('WORKSPACE_OWNER_ALREADY_BOOTSTRAPPED'),
  );
  await assert.rejects(
    () => resolveWorkspaceAuthorization(pool, { workspaceId: workspaceA, userId: extraA.id }),
    expectAuthorizationCode('WORKSPACE_MEMBERSHIP_REQUIRED'),
  );

  await assert.rejects(
    () => pool.query('DELETE FROM workspace_roles WHERE id = $1', [bootstrapA.ownerRoleId]),
    expectPostgresConstraint('23514', 'workspace_owner_role_identity_immutable'),
  );
  await assert.rejects(
    () =>
      pool.query(`UPDATE workspace_roles SET kind = 'custom' WHERE id = $1`, [
        bootstrapA.ownerRoleId,
      ]),
    expectPostgresConstraint('23514', 'workspace_owner_role_identity_immutable'),
  );

  const ownerAContext = await resolveWorkspaceAuthorization(pool, {
    workspaceId: workspaceA,
    userId: ownerA.id,
  });
  assert.equal(ownerAContext.isOwner, true);
  assert.ok(ownerAContext.permissions.includes('workspace.roles.manage'));
  assert.ok(ownerAContext.permissions.includes('workspace.members.manage'));

  await assert.rejects(
    () => resolveWorkspaceAuthorization(pool, { workspaceId: workspaceB, userId: ownerA.id }),
    expectAuthorizationCode('WORKSPACE_MEMBERSHIP_REQUIRED'),
  );

  const memberAMembership = await createWorkspaceMembership(pool, ownerAContext, memberA.id);
  const memberAContext = await resolveWorkspaceAuthorization(pool, {
    workspaceId: workspaceA,
    userId: memberA.id,
  });
  assert.equal(memberAContext.isOwner, false);
  assert.deepEqual(memberAContext.roleKeys, ['member']);
  assert.deepEqual(memberAContext.permissions, ['workspace.read']);

  await assert.rejects(
    () => createWorkspaceMembership(pool, memberAContext, extraA.id),
    expectAuthorizationCode('FORBIDDEN'),
  );

  await assert.rejects(
    () =>
      assignWorkspaceRole(pool, ownerAContext, {
        targetMembershipId: bootstrapB.membershipId,
        roleId: bootstrapA.adminRoleId,
      }),
    expectAuthorizationCode('RESOURCE_NOT_FOUND'),
  );

  await assert.rejects(
    () =>
      pool.query(
        `INSERT INTO workspace_membership_roles (membership_id, role_id, workspace_id)
         VALUES ($1, $2, $3)`,
        [bootstrapB.membershipId, bootstrapA.adminRoleId, workspaceA],
      ),
    expectPostgresConstraint('23503', 'workspace_membership_roles_membership_workspace_fk'),
  );

  assert.equal(
    await assignWorkspaceRole(pool, ownerAContext, {
      targetMembershipId: memberAMembership.membershipId,
      roleId: bootstrapA.adminRoleId,
    }),
    true,
  );

  await pool.query(
    `INSERT INTO workspace_role_permissions (role_id, permission_key)
     VALUES ($1, 'workspace.roles.manage')
     ON CONFLICT (role_id, permission_key) DO NOTHING`,
    [bootstrapA.adminRoleId],
  );
  const elevatedNonOwnerContext = await resolveWorkspaceAuthorization(pool, {
    workspaceId: workspaceA,
    userId: memberA.id,
  });
  assert.equal(elevatedNonOwnerContext.isOwner, false);
  assert.ok(elevatedNonOwnerContext.permissions.includes('workspace.roles.manage'));
  assert.ok(elevatedNonOwnerContext.permissions.includes('workspace.members.manage'));

  await assert.rejects(
    () =>
      assignWorkspaceRole(pool, elevatedNonOwnerContext, {
        targetMembershipId: memberAMembership.membershipId,
        roleId: bootstrapA.ownerRoleId,
      }),
    expectAuthorizationCode('FORBIDDEN'),
  );

  await assert.rejects(
    () =>
      removeWorkspaceRoleAssignment(pool, ownerAContext, {
        targetMembershipId: bootstrapA.membershipId,
        roleId: bootstrapA.ownerRoleId,
      }),
    expectAuthorizationCode('LAST_ACTIVE_OWNER'),
  );

  const secondOwnerMembership = await createWorkspaceMembership(pool, ownerAContext, secondOwnerA.id);
  assert.equal(
    await assignWorkspaceRole(pool, ownerAContext, {
      targetMembershipId: secondOwnerMembership.membershipId,
      roleId: bootstrapA.ownerRoleId,
    }),
    true,
  );

  await assert.rejects(
    () =>
      setWorkspaceMembershipStatus(pool, elevatedNonOwnerContext, {
        targetMembershipId: secondOwnerMembership.membershipId,
        status: 'suspended',
      }),
    expectAuthorizationCode('FORBIDDEN'),
  );

  await removeWorkspaceRoleAssignment(pool, ownerAContext, {
    targetMembershipId: memberAMembership.membershipId,
    roleId: bootstrapA.adminRoleId,
  });
  await assert.rejects(
    () =>
      assignWorkspaceRole(pool, elevatedNonOwnerContext, {
        targetMembershipId: memberAMembership.membershipId,
        roleId: bootstrapA.adminRoleId,
      }),
    expectAuthorizationCode('FORBIDDEN'),
  );

  await removeWorkspaceRoleAssignment(pool, ownerAContext, {
    targetMembershipId: bootstrapA.membershipId,
    roleId: bootstrapA.ownerRoleId,
  });

  const secondOwnerContext = await resolveWorkspaceAuthorization(pool, {
    workspaceId: workspaceA,
    userId: secondOwnerA.id,
  });
  assert.equal(secondOwnerContext.isOwner, true);

  await assert.rejects(
    () =>
      setWorkspaceMembershipStatus(pool, secondOwnerContext, {
        targetMembershipId: secondOwnerMembership.membershipId,
        status: 'suspended',
      }),
    expectAuthorizationCode('LAST_ACTIVE_OWNER'),
  );

  const ownerRole = await getWorkspaceRoleByKey(pool, workspaceA, 'owner');
  assert.equal(ownerRole?.id, bootstrapA.ownerRoleId);
  assert.equal(ownerRole?.kind, 'owner');

  const audit = await pool.query(
    `SELECT action, actor_user_id, target_user_id
     FROM authorization_audit_events
     WHERE workspace_id = $1
     ORDER BY created_at ASC`,
    [workspaceA],
  );
  assert.ok(audit.rowCount >= 5);
  assert.ok(audit.rows.some((event) => event.action === 'workspace.owner_bootstrapped'));
  assert.ok(audit.rows.some((event) => event.action === 'workspace.membership.created'));
  assert.ok(audit.rows.some((event) => event.action === 'workspace.role.assigned'));
  assert.ok(audit.rows.some((event) => event.action === 'workspace.role.removed'));

  assert.equal(await rollbackLatestMigration(pool, migrationsDir), '0004_memory_evaluation_core');
  assert.equal(await rollbackLatestMigration(pool, migrationsDir), '0003_agent_runtime_core');
  assert.equal(await rollbackLatestMigration(pool, migrationsDir), '0002_identity_authorization_foundation');
  assert.equal((await probeDatabase(pool)).schemaReady, false);
  const afterRollback = await pool.query(`
    SELECT
      to_regclass('public.workspaces')::text AS workspaces,
      to_regclass('public.job_runs')::text AS job_runs,
      to_regclass('public.users')::text AS users,
      to_regclass('public.workspace_memberships')::text AS memberships,
      to_regclass('public.agent_definitions')::text AS agent_definitions,
      to_regclass('public.memory_records')::text AS memory_records,
      to_regclass('public.agent_eval_results')::text AS agent_eval_results
  `);
  assert.equal(afterRollback.rows[0]?.workspaces, 'workspaces');
  assert.equal(afterRollback.rows[0]?.job_runs, 'job_runs');
  assert.equal(afterRollback.rows[0]?.users, null);
  assert.equal(afterRollback.rows[0]?.memberships, null);
  assert.equal(afterRollback.rows[0]?.agent_definitions, null);
  assert.equal(afterRollback.rows[0]?.memory_records, null);
  assert.equal(afterRollback.rows[0]?.agent_eval_results, null);

  assert.deepEqual(await applyPendingMigrations(pool, migrationsDir), [
    '0002_identity_authorization_foundation',
    '0003_agent_runtime_core',
    '0004_memory_evaluation_core',
  ]);
  assert.equal((await probeDatabase(pool)).schemaReady, true);

  console.log('Brovexa tenant isolation / RBAC / provider-neutral identity integration verification passed.');
} finally {
  await resetTestDatabase();
  await pool.end();
}
