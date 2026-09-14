import type { Pool } from 'pg';
import type { UserStatus, WorkspaceMembershipStatus } from './schema';
export declare const workspaceCapabilityValues: readonly ['workspace.read', 'workspace.members.read', 'workspace.members.manage', 'workspace.roles.read', 'workspace.roles.manage', 'workspace.audit.read'];
export type WorkspaceCapability = (typeof workspaceCapabilityValues)[number];
export type AuthorizationErrorCode = 'USER_INACTIVE' | 'WORKSPACE_INACTIVE' | 'WORKSPACE_MEMBERSHIP_REQUIRED' | 'MEMBERSHIP_INACTIVE' | 'FORBIDDEN' | 'RESOURCE_NOT_FOUND' | 'TENANT_SCOPE_MISMATCH' | 'MEMBERSHIP_ALREADY_EXISTS' | 'WORKSPACE_OWNER_ALREADY_BOOTSTRAPPED' | 'LAST_ACTIVE_OWNER';
export declare class AuthorizationError extends Error {
    readonly code: AuthorizationErrorCode;
    constructor(code: AuthorizationErrorCode, message: string);
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
export declare function assertWorkspaceCapability(context: WorkspaceAuthorizationContext, capability: WorkspaceCapability, resourceWorkspaceId?: string): void;
export declare function createIdentityUser(pool: Pool, status?: UserStatus): Promise<{
    id: string;
    status: UserStatus;
}>;
export declare function bootstrapWorkspaceOwner(pool: Pool, input: {
    workspaceId: string;
    userId: string;
}): Promise<BootstrapWorkspaceOwnerResult>;
export declare function resolveWorkspaceAuthorization(pool: Pool, input: {
    workspaceId: string;
    userId: string;
}): Promise<WorkspaceAuthorizationContext>;
export declare function getWorkspaceRoleByKey(pool: Pool, workspaceId: string, key: string): Promise<{
    id: string;
    key: string;
    kind: 'owner' | 'custom';
} | null>;
export declare function createWorkspaceMembership(pool: Pool, actor: WorkspaceAuthorizationContext, targetUserId: string): Promise<{
    membershipId: string;
}>;
export declare function assignWorkspaceRole(pool: Pool, actor: WorkspaceAuthorizationContext, input: {
    targetMembershipId: string;
    roleId: string;
}): Promise<boolean>;
export declare function removeWorkspaceRoleAssignment(pool: Pool, actor: WorkspaceAuthorizationContext, input: {
    targetMembershipId: string;
    roleId: string;
}): Promise<void>;
export declare function setWorkspaceMembershipStatus(pool: Pool, actor: WorkspaceAuthorizationContext, input: {
    targetMembershipId: string;
    status: WorkspaceMembershipStatus;
}): Promise<void>;
