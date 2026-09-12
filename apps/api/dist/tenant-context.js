"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationRequiredError = void 0;
exports.resolveTenantRequest = resolveTenantRequest;
const db_1 = require("@brovexa/db");
class AuthenticationRequiredError extends Error {
    constructor() {
        super('An authenticated session is required.');
        this.name = 'AuthenticationRequiredError';
    }
}
exports.AuthenticationRequiredError = AuthenticationRequiredError;
/**
 * Authentication proves the Brovexa user only. Workspace identity, roles and
 * permissions are deliberately derived from canonical PostgreSQL state after
 * session resolution; provider claims are never trusted as tenant authority.
 */
async function resolveTenantRequest(input) {
    const principal = await input.authAdapter.resolveSession({
        opaqueCredential: input.opaqueCredential,
        client: input.client,
    });
    if (!principal)
        throw new AuthenticationRequiredError();
    const authorization = await (0, db_1.resolveWorkspaceAuthorization)(input.pool, {
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
//# sourceMappingURL=tenant-context.js.map