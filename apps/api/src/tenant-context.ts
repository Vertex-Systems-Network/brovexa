import type {
  AuthClientKind,
  AuthenticatedPrincipal,
  SessionAuthAdapter,
  TenantRequestContext,
} from '@brovexa/contracts';
import {
  resolveWorkspaceAuthorization,
  type WorkspaceAuthorizationContext,
} from '@brovexa/db';

type AuthorizationPool = Parameters<typeof resolveWorkspaceAuthorization>[0];

export class AuthenticationRequiredError extends Error {
  constructor() {
    super('An authenticated session is required.');
    this.name = 'AuthenticationRequiredError';
  }
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
export async function resolveTenantRequest(
  input: ResolveTenantRequestInput,
): Promise<ResolvedTenantRequest> {
  const principal = await input.authAdapter.resolveSession({
    opaqueCredential: input.opaqueCredential,
    client: input.client,
  });
  if (!principal) throw new AuthenticationRequiredError();

  const authorization = await resolveWorkspaceAuthorization(input.pool, {
    workspaceId: input.requestedWorkspaceId,
    userId: principal.userId,
  });

  return {
    principal,
    authorization,
    tenant: {
      requestId: input.requestId,
      userId: principal.userId,
      sessionId: principal.sessionId,
      workspaceId: authorization.workspaceId,
    },
  };
}
