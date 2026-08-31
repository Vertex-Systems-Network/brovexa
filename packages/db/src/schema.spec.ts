import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  authorizationAuditEvents,
  permissions,
  userStatusValues,
  users,
  workspaceMembershipRoles,
  workspaceMembershipStatusValues,
  workspaceMemberships,
  workspacePreferences,
  workspaceRoleKindValues,
  workspaceRolePermissions,
  workspaceRoles,
  workspaceStatusValues,
  workspaces,
} from './schema';

describe('database schema contract', () => {
  it('keeps stable tenant-root and identity table names', () => {
    expect(getTableName(workspaces)).toBe('workspaces');
    expect(getTableName(workspacePreferences)).toBe('workspace_preferences');
    expect(getTableName(users)).toBe('users');
    expect(getTableName(workspaceMemberships)).toBe('workspace_memberships');
    expect(getTableName(permissions)).toBe('permissions');
    expect(getTableName(workspaceRoles)).toBe('workspace_roles');
    expect(getTableName(workspaceRolePermissions)).toBe('workspace_role_permissions');
    expect(getTableName(workspaceMembershipRoles)).toBe('workspace_membership_roles');
    expect(getTableName(authorizationAuditEvents)).toBe('authorization_audit_events');
  });

  it('keeps the reviewed workspace lifecycle states', () => {
    expect(workspaceStatusValues).toEqual(['active', 'suspended', 'archived']);
  });

  it('keeps provider-neutral user and membership lifecycle states', () => {
    expect(userStatusValues).toEqual([
      'pending_verification',
      'active',
      'locked_security',
      'suspended_admin',
      'deletion_pending',
      'deleted_or_anonymized',
    ]);
    expect(workspaceMembershipStatusValues).toEqual(['active', 'suspended', 'removed']);
    expect(workspaceRoleKindValues).toEqual(['owner', 'custom']);
  });
});
