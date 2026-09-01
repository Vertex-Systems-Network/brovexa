import type { Pool } from 'pg';
import {
  getAgentExecutionTrace,
  type AgentExecutionTrace,
  type GetAgentExecutionTraceInput,
} from './agent-runtime-hardening';
import { assertWorkspaceCapability, resolveWorkspaceAuthorization } from './identity';

/**
 * Returns the bounded execution trace for one dispatch only after re-resolving the
 * caller's current tenant authorization and requiring the privileged audit-read
 * capability. The underlying trace reader also revalidates tenant scope.
 */
export async function getPrivilegedAgentExecutionTrace(
  pool: Pool,
  input: GetAgentExecutionTraceInput,
): Promise<AgentExecutionTrace | null> {
  const authorization = await resolveWorkspaceAuthorization(pool, {
    workspaceId: input.workspaceId,
    userId: input.userId,
  });
  assertWorkspaceCapability(authorization, 'workspace.audit.read');
  return getAgentExecutionTrace(pool, input);
}
