# Brovexa — Identity, Authentication & Account Lifecycle

Status: **Planning Only — provider selection pending ADR**

## Identity model
- `User`: opaque canonical human account
- `UserIdentifier`: verified/pending email or federated issuer/subject mapping; identifier is not canonical ID
- `Credential`: password or WebAuthn/passkey metadata; secrets not normal domain data
- `FederatedIdentity`: provider issuer + immutable subject; do not merge by unverified email alone
- `Session` / `DeviceRegistration`
- `WorkspaceInvitation`: expiring, single-use, revocable, bound to intended verified identity before membership

## Account states
`PENDING_VERIFICATION / ACTIVE / LOCKED_SECURITY / SUSPENDED_ADMIN / DELETION_PENDING / DELETED_OR_ANONYMIZED`.
Workspace membership/suspension is separate from global User state.

## Registration
Email/password: minimum fields → safe duplicate handling → pending user + verification → Terms/Privacy version → verify → activate → create/join workspace → onboarding.

Federated: approved OIDC/OAuth, validate provider/transaction and map immutable subject. Provider email text alone is not enough to merge accounts.

## Login
Generic failures where practical, anti-automation/risk controls, verify authenticator, evaluate account/workspace state, MFA/step-up, create/rotate strict session, Security/Audit event. AuthN never bypasses workspace AuthZ.

## Passwords
Use maintained modern password-hashing library/parameters selected by ADR; no reversible storage, allow password managers/paste, favor length + compromised-password checks over arbitrary composition, rate-limit auth.

## Email verification
Strong purpose-bound single-use expiring challenge, safe storage, resend limits, supersession. Link verifies identity only; does not grant admin/workspace action.

## Forgot/reset
Request response is enumeration-safe. Reset token is strong, purpose-bound, single-use, short-lived and invalidated on supersession. Completion changes password, consumes token, rotates/revokes sessions as policy requires and records security notification/audit. Reset email access does not silently disable MFA.

## Password/email changes
Require recent authentication/step-up. Email change verifies new email and notifies old address; protects federated collisions/takeover. Security changes rotate appropriate session/token state.

## MFA
Support TOTP, WebAuthn/passkeys/security keys, recovery codes and future enterprise IdP assurance. State: DISABLED / ENROLLING / ENABLED / RECOVERY_REQUIRED / LOCKED. Recovery codes one-time/hashed; removing MFA needs strong auth + notification. Support cannot casually disable MFA.

## Passkeys
Credential schema is WebAuthn-ready for RP-scoped public-key credentials/multiple authenticators. Passkeys do not remove account-recovery/governance needs.

## OAuth/OIDC
Follow current OAuth Security BCP direction:
- authorization code, not implicit
- PKCE S256 for public clients
- exact registered redirects
- issuer/audience/state/nonce validation as applicable
- no access tokens in redirects/logs
- transaction-bound code/state/nonce
- refresh rotation/revocation where supported
- metadata/endpoint allowlist, not user-controlled authorization endpoints

Desktop/extension are public clients unless a secret can genuinely remain confidential; a static secret shipped in binaries is not confidential.

## Web sessions
Opaque unpredictable server session; Secure/HttpOnly/appropriate SameSite cookie; strict acceptance/rotation; idle + absolute expiry; CSRF for cookie-auth state changes; logout/session/device revoke; no session ID in URL. Remember-me, if shipped, is separate revocable credential.

## Desktop/extension
Follow `CROSS_CLIENT_TRUST.md`: browser-safe authorization/PKCE direction, short-lived credentials, no refresh token in page/content script, device/session revocation.

## Workspace membership
Membership states INVITED / ACTIVE / SUSPENDED / REMOVED. Invite acceptance matches authenticated intended identifier or requires controlled reissue. URL parameters never define role. Removal revokes only that workspace across all clients.

## Workspace/onboarding
Create workspace → Owner membership → use case → geography/niche → Service Catalog → Research Credits → first job/demo → optional team/Desktop/extension.
Onboarding is resumable and explicit; optional install/invite does not block activation.

## Locks/suspension
Security lock (compromise/risk), admin suspension (abuse/business/compliance), and workspace suspension (e.g. commercial state) are distinct with appropriate revoke/read-only/recovery behavior.

## Deletion
Checkpointed deletion considers sole-owner transfer, subscription, workspace-owned records, user identifiers/sessions/credentials, audit/legal retention, memory/vector indexes and integrations/API keys.

## Enterprise later
OIDC/SAML + verified organization/domain setup; SCIM evaluation. Do not trust email domain automatically. Local fallback/recovery is explicit.

## Service accounts/API keys
No shared human passwords. Workspace-owned scopes/owner/expiry/rotation. Secret shown once/hashed or secret-managed. No UI login. Audit all creation/revoke/rotate.

## Step-up candidates
Password/email/MFA; API credentials; role/admin; billing ownership; restricted data exports; connector credentials; suppression/policy overrides; workspace deletion/transfer.

## UX states
Login errors/lock/suspension; verification pending/expired/used/resend; reset invalid/expired/used/success; invite invalid/wrong-user/revoked; OAuth denied/error/link conflict; MFA enrollment/recovery; sessions/devices; deletion; membership suspended/removed.

## Tests
Enumeration/timing; reset replay/expiry; OAuth mix-up/state/nonce/PKCE/redirect; link takeover; invite replay/role tamper; session fixation/rotation/timeouts/revocation; CSRF; concurrent identifier/security changes; MFA recovery; membership revoke across clients; service-account escalation; workspace-switch tenant isolation; deletion with active subscription/sole owner.

## Provider decision
Do not select an auth vendor only for speed. ADR compares security, OIDC multi-client support, MFA/passkeys, enterprise federation, control/self-hosting, pricing, migration and lock-in.

## Gate
Before implementation select auth/session/provider ADR, map ASVS/threat controls, finalize initial MFA/password/session TTL policy and trace every auth UI state through ABD-252.