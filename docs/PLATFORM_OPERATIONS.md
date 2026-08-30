# Brovexa — Workspace, Notifications & Platform Operations Contract v1.0

Status: **Planning Only — cross-cutting platform contract**

## Workspace

States: `PROVISIONING`, `ACTIVE`, `READ_ONLY`, `SUSPENDED`, `DELETION_PENDING`, `DELETED/ANONYMIZED`.

Support create/profile/branding/default locale/timezone/currency, multi-workspace switching, ownership transfer, read-only/suspend and governed deletion. Last owner cannot be removed without transfer/closure. Deletion plans enumerate data classes and retention/billing/audit obligations.

## Membership / teams / permissions

Membership states: INVITED, ACTIVE, SUSPENDED, REMOVED. Support invites/resend/revoke/expiry, teams, built-in/custom roles, service accounts and permission-change auditing.

Code authorizes capabilities, not role-name strings. Example permissions include business/evidence/research/Lead/outreach/suppression/source-policy/agent/billing/API/audit/workspace actions. High-risk actions can require step-up or review.

## Settings

Workspace, Targeting, AI, Data Sources, Compliance, Team, Notifications, Integrations, Developers/API, Security, Billing and Data lifecycle settings are canonical sections.

## Notification Center

Canonical notification is derived from a domain event; delivery never becomes domain truth.

Families: ResearchJob, Lead/Opportunity, review/task/SLA, connector/source, AI/security, billing/credits, workspace/member and Market Scout.

States: unread/read/dismissed/actioned/expired.

Launch baseline: in-app Notification Center + selected Desktop native notifications. Email/browser/Slack/Teams/mobile are optional adapters. Sensitive content is redacted in external previews. Deduplicate/coalesce noisy events, support severity, quiet hours/digests and deterministic mandatory notices.

## API credentials

Use workspace ServiceAccount/ApiCredential with scopes, creator/time, secret fingerprint/version, last use, expiry/status, optional network restrictions and quota profile.

Bearer secrets are shown once where applicable, stored securely and support rotation/revocation. Provider credentials never surface through public APIs.

## API behavior

Versioned canonical schemas, auth/scope enforcement, pagination/filter/sort conventions, idempotency for suitable mutations, rate-limit headers, request/correlation IDs, stable errors, async jobs for huge operations and audit of high-impact mutations.

## Webhooks

Entities: endpoint, subscription, secret version, event, delivery attempt.

HTTPS; verification/test; signed event ID/timestamp; secret rotation; at-least-once delivery; exponential backoff; event-ID dedupe; persistent-failure pause/disable + notification; manual redelivery; minimum tenant-safe payload.

Initial event families: business.updated, research_job.*, signal.*, opportunity.*, lead.*, task.*, connector.health_changed, subscription.changed.

## Saved views / reports / exports

SavedView uses structured filters/sort/group/columns and explicit visibility. Dynamic audiences resolve live; snapshot audiences store historical membership when required.

Large export = policy-aware async job: permission/source/export-policy check → generation → protected storage → short-lived signed download → expiry/deletion → audit. `All columns` can never override restricted fields.

## Support/admin

No silent customer impersonation. Privileged support requires support identity, case/reason, workspace, scope, time window and audit; prefer diagnostic metadata over content access. Any future impersonation-like flow is explicit, time-limited, visibly bannered, audited and separated from secrets/payment credentials.

Repair tools (replay, mapping correction, merge/split proposals, fact/memory supersession, sync reconciliation) still pass domain invariants.

## Localization

Separate UI locale, user/workspace/target timezone, billing currency, Research Credits and source language. Canonical service/signal/taxonomy IDs are language-independent. Preserve original permitted source text and normalized/translated representation. Architecture remains RTL-capable.

## Feature flags / kill switches

Versioned server-authoritative definitions/rules/evaluations. Target environment, plan/entitlement, workspace allowlist or deterministic cohort only. Never sensitive protected attributes. High-risk agent/connector kill switches operate independent of UI deploy. Flags have owner/review/expiry and are removed after rollout rather than becoming permanent business logic.

## Data lifecycle

Export/correction/account closure/workspace deletion/connector disconnect/suppression retention use a deletion planner that distinguishes immediate deletion from legally/security/billing/audit retained/minimized data.

## Abuse controls

Rate/abuse policies cover auth, jobs, source requests, API, exports, webhooks, invitations and free/trial abuse per workspace/user/credential/source.

These contracts are mandatory cross-cutting platform planning and feed ABD-252 before M00 approval.