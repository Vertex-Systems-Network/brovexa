import type { Pool } from 'pg';
import { type AgentExecutionTrace, type GetAgentExecutionTraceInput } from './agent-runtime-hardening';
/**
 * Returns the bounded execution trace for one dispatch only after re-resolving the
 * caller's current tenant authorization and requiring the privileged audit-read
 * capability. The underlying trace reader also revalidates tenant scope.
 */
export declare function getPrivilegedAgentExecutionTrace(pool: Pool, input: GetAgentExecutionTraceInput): Promise<AgentExecutionTrace | null>;
