# M01 Identity, Authorization, and Tenant Foundation

Status: implementation contract for ABD-262. This document does not select an authentication vendor.

## Canonical boundaries

- `workspaces` remains the only canonical tenant root.
- `users` is an opaque Brovexa identity record. Email, password, OIDC subject mapping, MFA, recovery, and hosted-provider state do not define tenant authority.
- `workspace_memberships` binds a user to exactly one workspace and carries membership lifecycle state.
- workspace roles and permissions are canonical PostgreSQL authorization data.
- session/authentication adapters resolve only an authenticated Brovexa user principal. They never supply trusted workspace IDs, roles, or permissions.
- request handling derives workspace authorization server-side from the authenticated user plus the requested workspace.

## Default role policy

Every bootstrapped workspace receives three role definitions:

- `owner`: all M01 workspace capabilities; owner grant/revoke additionally requires the actor to be an active owner.
- `admin`: workspace read, member read/manage, and role read. It intentionally does not receive role-management authority by default.
- `member`: workspace read only.

Owner bootstrap is a one-shot initialization path. It serializes on the workspace row and refuses to run after canonical owner authority already exists. Later ownership changes must use the authorized role-assignment/revocation flow rather than replay bootstrap.

M01 capabilities are:

- `workspace.read`
- `workspace.members.read`
- `workspace.members.manage`
- `workspace.roles.read`
- `workspace.roles.manage`
- `workspace.audit.read`

Authorization is deny-by-default. A role or capability absent from canonical PostgreSQL grants no authority.

## Tenant isolation

Application mutations scope target memberships and roles by the actor's canonical workspace. A target ID from another tenant is treated as not found.

The database also carries `workspace_id` on membership-role assignments and enforces composite foreign keys back to both the membership and role workspace. This means a direct SQL attempt to attach a role from tenant A to a membership from tenant B is rejected even if the individual UUIDs are valid.

Resource-level guards compare the resource workspace with the resolved tenant context before evaluating capabilities. API layers should map tenant-scope mismatches to a non-enumerating response such as 404 rather than disclose cross-tenant object existence.

## Mutation-time authorization

A resolved `WorkspaceAuthorizationContext` is useful for request propagation and read guards, but writes do not trust it as a durable permission snapshot. Membership and role mutations re-check the actor's active user, workspace, membership, and required permission inside the database transaction before changing state.

This prevents a stale context from retaining authority after a concurrent suspension or role revocation.

## Last-active-owner invariant

Once a workspace has an owner role, PostgreSQL deferred constraint triggers require at least one active membership carrying that owner role at transaction commit.

The check is deferred so legitimate ownership transfer can grant a second owner and revoke the first within one transaction while still preventing removal or suspension of the final active owner.

The canonical owner role identity itself is immutable at the database boundary: it cannot be renamed, converted to a custom role, moved to another workspace, or deleted. This prevents direct-SQL removal of the owner-role sentinel from bypassing the deferred last-active-owner check.

Global user security/admin lifecycle remains a separate control from workspace membership lifecycle, consistent with `IDENTITY_AUTH_LIFECYCLE.md`.

## Authorization audit events

Security-relevant M01 mutations write `authorization_audit_events` in the same transaction as the canonical state change. Current events cover:

- owner bootstrap
- membership creation
- membership status changes
- role assignment
- role removal

Audit details contain canonical IDs and role keys only; authentication credentials and provider secrets are not stored.

## Provider-neutral authentication adapter

`@brovexa/contracts` exposes `SessionAuthAdapter` and an `AuthenticatedPrincipal` containing user/session/authentication metadata. The adapter boundary deliberately excludes workspace and RBAC claims.

Permitted M01 implementations include a test/local resolver used by automated tests. Password storage, OIDC configuration, passkey enrollment, MFA, recovery workflows, production session cookies/tokens, and any hosted IdP remain gated by the auth/session/provider ADR described in `IDENTITY_AUTH_LIFECYCLE.md`.

## Executable evidence

`scripts/verify-identity.mjs` must prove on PostgreSQL 18 that:

- tenant A cannot resolve or mutate tenant B membership state;
- the database rejects cross-tenant membership-role injection;
- owner bootstrap cannot be replayed to grant a second user owner authority;
- the canonical owner role cannot be mutated or deleted;
- a non-owner cannot escalate to owner even if a custom role is accidentally granted role-management capability;
- the last active owner cannot be removed or suspended;
- ownership can be transferred before revocation;
- authorization mutations produce audit events;
- migration `0002_identity_authorization_foundation` rolls back cleanly and re-applies;
- no hosted identity provider is required for the test.
