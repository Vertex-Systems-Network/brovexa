import type { AuthClientKind, AuthenticatedPrincipal, SessionAuthAdapter, TenantRequestContext } from '@brovexa/contracts';
import { resolveWorkspaceAuthorization, type WorkspaceAuthorizationContext } from '@brovexa/db';
type AuthorizationPool = Parameters<typeof resolveWorkspaceAuthorization>[0];
export declare class AuthenticationRequiredError extends Error {
    constructor();
}
export interface ResolveTenantRequestInput {
    authAdapter: SessionAuthAdapter;
    pool: AuthorizationPool;
    opaqueCredential: string;
    client: AuthClientKind;
    requestId: string;
    requestedWorkspaceId: string;
}
export interface ResolvedTenantRequest {
    principal: AuthenticatedPrincipal;
    tenant: TenantRequestContext;
    authorization: WorkspaceAuthorizationContext;
}
/**
 * Authentication proves the Brovexa user only. Workspace identity, roles and
 * permissions are deliberately derived from canonical PostgreSQL state after
 * session resolution; provider claims are never trusted as tenant authority.
 */
export declare function resolveTenantRequest(input: ResolveTenantRequestInput): Promise<ResolvedTenantRequest>;
export {};
