import type { SessionAuthAdapter } from '@brovexa/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  resolveWorkspaceAuthorization: vi.fn(),
}));

vi.mock('@brovexa/db', () => ({
  resolveWorkspaceAuthorization: dbMocks.resolveWorkspaceAuthorization,
}));

import { AuthenticationRequiredError, resolveTenantRequest } from './tenant-context';

describe('tenant request resolution', () => {
  beforeEach(() => {
    dbMocks.resolveWorkspaceAuthorization.mockReset();
  });

  it('rejects an unauthenticated credential before tenant authorization lookup', async () => {
    const authAdapter: SessionAuthAdapter = {
      resolveSession: vi.fn().mockResolvedValue(null),
      revokeSession: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      resolveTenantRequest({
        authAdapter,
        pool: {} as Parameters<typeof resolveTenantRequest>[0]['pool'],
        opaqueCredential: 'opaque-session',
        client: 'web',
        requestId: 'request-1',
        requestedWorkspaceId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);

    expect(dbMocks.resolveWorkspaceAuthorization).not.toHaveBeenCalled();
  });

  it('derives tenant authorization from the authenticated Brovexa user and requested workspace', async () => {
    const principal = {
      userId: '22222222-2222-4222-8222-222222222222',
      sessionId: 'session-1',
      authenticatedAt: '2026-08-31T07:00:00.000Z',
      method: 'oidc' as const,
      assurance: 'multi_factor' as const,
      providerSubject: 'provider-subject-only',
    };
    const authAdapter: SessionAuthAdapter = {
      resolveSession: vi.fn().mockResolvedValue(principal),
      revokeSession: vi.fn().mockResolvedValue(undefined),
    };
    const pool = {} as Parameters<typeof resolveTenantRequest>[0]['pool'];
    const workspaceId = '11111111-1111-4111-8111-111111111111';
    const authorization = {
      workspaceId,
      userId: principal.userId,
      membershipId: '33333333-3333-4333-8333-333333333333',
      roleKeys: ['member'],
      permissions: ['workspace.read'],
      isOwner: false,
    } as const;
    dbMocks.resolveWorkspaceAuthorization.mockResolvedValue(authorization);

    const resolved = await resolveTenantRequest({
      authAdapter,
      pool,
      opaqueCredential: 'opaque-session',
      client: 'desktop',
      requestId: 'request-2',
      requestedWorkspaceId: workspaceId,
    });

    expect(authAdapter.resolveSession).toHaveBeenCalledWith({
      opaqueCredential: 'opaque-session',
      client: 'desktop',
    });
    expect(dbMocks.resolveWorkspaceAuthorization).toHaveBeenCalledWith(pool, {
      workspaceId,
      userId: principal.userId,
    });
    expect(resolved.principal).toEqual(principal);
    expect(resolved.authorization).toEqual(authorization);
    expect(resolved.tenant).toEqual({
      requestId: 'request-2',
      userId: principal.userId,
      sessionId: principal.sessionId,
      workspaceId,
    });
  });
});
