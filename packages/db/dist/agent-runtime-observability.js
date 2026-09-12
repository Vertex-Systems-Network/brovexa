"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrivilegedAgentExecutionTrace = getPrivilegedAgentExecutionTrace;
const agent_runtime_hardening_1 = require("./agent-runtime-hardening");
const identity_1 = require("./identity");
/**
 * Returns the bounded execution trace for one dispatch only after re-resolving the
 * caller's current tenant authorization and requiring the privileged audit-read
 * capability. The underlying trace reader also revalidates tenant scope.
 */
async function getPrivilegedAgentExecutionTrace(pool, input) {
    const authorization = await (0, identity_1.resolveWorkspaceAuthorization)(pool, {
        workspaceId: input.workspaceId,
        userId: input.userId,
    });
    (0, identity_1.assertWorkspaceCapability)(authorization, 'workspace.audit.read');
    return (0, agent_runtime_hardening_1.getAgentExecutionTrace)(pool, input);
}
//# sourceMappingURL=agent-runtime-observability.js.map