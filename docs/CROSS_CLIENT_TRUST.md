# Brovexa — Cross-Client Trust, Session & Capability Architecture

Status: **Planning Only**

## Principle
Brovexa has one canonical backend and multiple untrusted/partially trusted clients: Web, Desktop, Chrome/Chromium, Firefox and future API/mobile/CLI. Client possession proves a session, never tenant/permission/billing/policy authority.

## Identity/session objects
`User`, `WorkspaceMember`, `ClientApplication`, optional `DeviceRegistration`, server `Session`, `ClientSession`, secure refresh credential metadata and `ClientCapability`.

Install/device ID is never user identity or tenant authorization.

## Shared auth
- central OIDC-compatible architecture
- short-lived audience/scope-bound access credentials
- refresh/session credentials rotated/revocable and never exposed to page/content-script contexts
- server checks current account/membership/RBAC/session state on every privileged request
- logout/reset/suspension/membership removal propagates
- step-up auth for high-risk commands

## Web
Prefer secure server-managed session/cookies unless ADR proves another bounded approach. Secure/HttpOnly/appropriate SameSite; CSRF for cookie-auth state changes; strict session rotation; idle/absolute expiry; device/session revoke; no auth tokens in URLs; CSP/XSS protection; backend authorization regardless of hidden UI.

## Extension zones
1. webpage/DOM: hostile input
2. content script: low-privilege structured bridge, no reusable backend refresh/session secret
3. privileged background: Chrome service worker or Firefox event/background script adapter, API/session/permission coordinator
4. extension UI: side panel/popup/options communicate through typed messaging

## Chrome permissions
Current Chrome guidance favors minimum and optional permissions. Core candidates only if required: `storage`, `activeTab`, `scripting`, `sidePanel`. Prefer `activeTab` user-gesture temporary page access over default `<all_urls>`. Optional integrations use runtime `optional_host_permissions` with feature explanation.

Do not request persistent Gmail/CRM/professional-network/all-sites access merely to future-proof.

## Firefox adapter
Chrome MV3 uses a service worker for background context; Firefox MV3 currently uses background scripts/event-page behavior and does not support `background.service_worker`. Shared code must persist state outside process memory and abstract alarms/messages/permissions/sidebar/store differences.

Unsupported capability degrades explicitly.

## Extension messages
Every page/content/UI→privileged message has schema/version/type/request ID/bounded payload and sender/tab/origin context where applicable. Privileged layer rechecks sender, user gesture/permission, current session and backend authorization.

No free-form page message becomes an arbitrary Brovexa command.

## Evidence capture
`user gesture → activeTab/site permission → bounded extraction/preview → confirm → EvidenceCandidate(URL/time/user/type/note) → backend source-policy/evidence verification`.

Never silently capture whole authenticated/private pages, forms or unrelated tabs. Special site integrations are optional and separately reviewed.

## Extension auth
Final identity provider is pending, but public-client direction uses authorization-code/OIDC with PKCE where appropriate. Content scripts never get refresh tokens. Privileged context stores only minimum browser-safe session material with short life/server revocation.

## Desktop capabilities
Tauri 2 capabilities/plugins remain minimum privilege; frontend WebView gets no broad filesystem/shell/process/plugin rights by default. Initial candidates: auth callback/deep-link read, notification, updater, scoped app-cache paths. Clipboard/file/process access is feature-specific and scoped.

## Deep links
`brovexa://business/<id>`, `lead/<id>`, `job/<id>` are untrusted navigation hints: strict parse, current auth, server tenant/object authorization, no irreversible automatic action. Desktop command-line/deep-link inputs are validated.

## Desktop local state
Credentials in OS-secure storage; UI prefs local; bounded encrypted canonical-summary cache only under retention policy; source/evidence raw content not offline by default; redacted diagnostics. Device can be revoked server-side.

## Capability/version negotiation
Client sends type/version/API range/runtime capability/channel. Backend returns capabilities/minimum secure version/flags and state: Supported / Degraded / UpgradeRecommended / UpgradeRequired / Blocked. Old clients cannot call unsupported commands just by knowing endpoint names.

## Cross-client handoff/state
Handoff sends canonical navigation ID + optional state/nonce, never authority/secrets. Canonical state sync is server/API/event based; clients do not peer-sync. Offline Desktop mutations are limited/idempotent/version-conflict aware.

## Notifications
Backend DomainEvent→preference/eligibility→client notification. Sensitive preview minimized; click only navigates then reauthorizes.

## Failure states
Signed out, revoked membership/device, site permission missing/revoked, API unavailable, offline/degraded, old client, invalid deep link, cache expired/policy blocked. Never silently fall back to broader permissions.

## Release trust
Signed/provenanced artifacts; internal/beta/stable channels; backend compatibility; Chrome/Firefox store rules; signed Tauri update process; emergency minimum-version/rollback; no remote executable extension code.

## Tests
Tenant/session revocation, stale client, schema mismatch, unauthorized deep links, cross-client logout; extension hostile-page messages/prompt injection/permission revocation/activeTab expiry/Chrome SW restart/Firefox event-page restart/multi-tabs/CSP; Desktop crafted links/local storage/updater tamper/offline conflict/device revoke/plugin permission denial.

## Gate
Exact provider/session implementation belongs to auth/architecture ADR. Permission manifests are validated against actual Wave-B features before release. Implementation waits for ABD-226/235/215 + owner consent.