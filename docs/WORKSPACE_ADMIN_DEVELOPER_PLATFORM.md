# Brovexa — Workspace Administration, Notifications & Developer Platform Contract v1.0

Status: **Planning Only — no implementation authorization**

## Workspace lifecycle

Canonical states: Active, Read Only, Suspended, Deletion Pending, Archived, Deleted/Anonymized as final retention rules permit.

Actions: create/rename/profile/branding/default locale/timezone/currency, archive/restore, ownership transfer, deletion request/cancel, security/admin suspension and billing-driven restriction.

Last-owner safeguards, step-up auth for sensitive ownership changes and workflow-based deletion are mandatory.

## Multi-workspace / membership

`session → current workspace → active membership → role/capabilities → entitlement → policy` is revalidated server-side. One User may belong to multiple Workspaces. Client workspace selection is not authority.

Teams/groups, invitations, custom roles and service accounts are first-class. Invitation role/workspace URL data is never authoritative.

## Capability authorization

Use resource/action capabilities rather than page-name roles. Built-in roles are capability bundles; custom roles do not require domain authorization rewrites. Sensitive permission/session changes trigger revalidation.

## Service accounts / API credentials

Automation identities are separate from humans, least-privilege, scoped, expiring/rotatable/revocable and audited. No service account can become workspace owner. Provider source/payment secrets are never exposed as Brovexa developer credentials.

## Settings IA

General; Members/Teams/Roles; Geography/Territories; ICP/Service Catalog; AI Agents/Autonomy/Budgets; Sources; Compliance/Suppression; Notifications; CRM/Integrations; Developer API/Webhooks; Security/Sessions; Billing/Usage; Data/Retention/Export; feature/beta settings where exposed.

## Notification Center

Notification is a durable user-facing delivery derived from a canonical event, never the event source of truth.

States: Unread/Read/Dismissed/Actioned/Expired as appropriate.

Categories cover ResearchJobs, review, Signals/Opportunities, Leads/tasks/SLA, connectors, AI/security/policy, billing/credits, account/security, membership and Market Scout.

Preferences support category/channel/severity/immediate-vs-digest/quiet-hours. Sensitive preview redaction, dedupe, burst coalescing and rate limits are mandatory. Channel failure does not lose canonical in-app event state.

## Developer API

Public/internal API invokes the same application services/policies as first-party clients. Scoped workspace API keys, OAuth applications later when justified and service accounts are supported by the identity architecture.

Credential metadata includes scopes, owner, created/last-used/expiry/revoked, rate plan, optional network restriction, fingerprint and audit. One-time secrets are never logged.

## Webhooks

Endpoint registration/verification, event subscription/version, signing-secret rotation, at-least-once delivery, immutable event ID, idempotency, backoff, delivery logs, manual redelivery, persistent-failure pause/disable and SSRF-safe endpoint validation.

Payloads are minimum necessary and tenant safe.

Event families include business, ResearchJob, evidence, signal, opportunity, Lead, deal, task, connector, compliance, billing, usage, workspace/member and market-intelligence events.

## Saved views / exports

Saved views can be Private/Team/Workspace but never grant underlying data access.

CSV/XLSX/JSON/API/webhook exports pass current RBAC/entitlement/SourcePolicy/privacy/contact restrictions. Large exports are async jobs with field/row policy, audit, expiry and cancellation.

Scheduled reports revalidate permissions/policy/entitlements before every run.

## Support/admin

No silent impersonation. Privileged support requires dedicated identity, case/reason, least privilege, step-up auth, immutable audit and time-bound access where possible.

Safe admin actions include inspect/replay/reconcile with invariants, audited credit adjustment, entity correction proposal, session/API revoke and kill switches. No arbitrary production DB editor.

## Data operations

Export/delete/correct/contact-removal workflows propagate to derived memory/vector/search/object copies while honoring permitted audit/billing retention. Partial deletion is retryable/reviewable; never falsely claim completion.

## Localization/time

Canonical IDs/values are locale neutral. Support UI language, workspace/user timezone, target-business timezone, ISO currency, Unicode, locale-aware date/number/address/phone display and RTL-ready architecture. Translated labels never alter canonical taxonomy/service/signal IDs.

Timestamps store UTC plus IANA timezone/local intent where needed. DST-safe schedules preserve intended local cadence.

## Feature flags / kill switches

Server-authoritative versioned flags support environment/workspace/cohort/percentage rollout but never override RBAC, entitlement, SourcePolicy or compliance. Remove stale flags after stable release.

Audited kill switches can disable connectors/source classes/models/agents/outreach/Market Scout/webhooks/new ResearchJobs/dangerous client versions/payment checkout/top-ups/features without deleting state.

## Audit / platform operations

Audit auth/session, membership/role, source policy, ResearchJob/budget, entity corrections, high-impact Signal/Opportunity/Lead/deal transitions, suppression/contactability, API/webhook, billing/credits, export/delete, flags/kill switches and privileged support.

Operational dashboards cover API/DB/queue/workers, connectors, models, ResearchJob backlog, failed/review work, billing/webhook reconciliation, notification/webhook health, backups, client versions, costs and security/policy blocks.

## Test gates

Last-owner, invitation replay/expiry, permission/session revalidation, service-account rotation, notification dedupe/digests, webhook signing/retry/idempotency/SSRF, API rate/entitlement/budget, export policy, support audit, workspace deletion, locale/timezone/DST/currency and feature/kill-switch tests.

This contract feeds ABD-252. Implementation waits for ABD-215 + explicit owner consent.