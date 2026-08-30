import { describe, expect, it } from 'vitest';
import {
  AuthorizationError,
  assertWorkspaceCapability,
  type AuthorizationErrorCode,
  type WorkspaceAuthorizationContext,
} from './identity';

const context: WorkspaceAuthorizationContext = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  membershipId: '33333333-3333-4333-8333-333333333333',
  roleKeys: ['member'],
  permissions: ['workspace.read'],
  isOwner: false,
};

function expectAuthorizationCode(work: () => void, expectedCode: AuthorizationErrorCode): void {
  try {
    work();
  } catch (error) {
    expect(error).toBeInstanceOf(AuthorizationError);
    expect((error as AuthorizationError).code).toBe(expectedCode);
    return;
  }
  throw new Error(`Expected AuthorizationError(${expectedCode}).`);
}

describe('workspace authorization guard', () => {
  it('allows a capability in the same workspace', () => {
    expect(() => assertWorkspaceCapability(context, 'workspace.read')).not.toThrow();
  });

  it('denies a missing capability', () => {
    expectAuthorizationCode(
      () => assertWorkspaceCapability(context, 'workspace.members.manage'),
      'FORBIDDEN',
    );
  });

  it('rejects a resource from another workspace before capability evaluation', () => {
    expectAuthorizationCode(
      () =>
        assertWorkspaceCapability(
          context,
          'workspace.read',
          '44444444-4444-4444-8444-444444444444',
        ),
      'TENANT_SCOPE_MISMATCH',
    );
  });
});
