export const authClientKindValues = ['web', 'desktop', 'extension', 'api'] as const;
export type AuthClientKind = (typeof authClientKindValues)[number];

export const authenticationMethodValues = ['test', 'password', 'oidc', 'passkey'] as const;
export type AuthenticationMethod = (typeof authenticationMethodValues)[number];

export const authenticationAssuranceValues = ['single_factor', 'multi_factor'] as const;
export type AuthenticationAssurance = (typeof authenticationAssuranceValues)[number];

export interface AuthenticatedPrincipal {
  userId: string;
  sessionId: string;
  authenticatedAt: string;
  method: AuthenticationMethod;
  assurance: AuthenticationAssurance;
  providerSubject?: string;
}

export interface SessionResolutionRequest {
  opaqueCredential: string;
  client: AuthClientKind;
}

/**
 * Provider-neutral session boundary. Implementations may be local/test-only or
 * backed by a future hosted/self-managed identity provider selected by ADR.
 * Authorization roles and workspace scope are intentionally absent: they must
 * be derived server-side from Brovexa canonical membership data after session
 * resolution.
 */
export interface SessionAuthAdapter {
  resolveSession(request: SessionResolutionRequest): Promise<AuthenticatedPrincipal | null>;
  revokeSession(sessionId: string): Promise<void>;
}

export interface TenantRequestContext {
  requestId: string;
  userId: string;
  sessionId: string;
  workspaceId: string;
}
