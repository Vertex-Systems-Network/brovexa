# Brovexa — CRM, Imports & Integration Synchronization Contract

Status: **Planning Only — provider-neutral integration contract**

## Core principle
External CRMs, files, browser captures, forms and partner APIs may contribute commercial context, but no provider becomes canonical intelligence authority by default.

## Ingress
ResearchJob/Lead OS events; manual entry; CSV/XLSX; API/webhooks; browser extension; public-site forms; customer-authorized first-party events; CRM sync; partner/referral connectors.

Each ingress declares source/workspace/purpose/actor/data classification/field mapping/policy state.

## Canonical integration objects
- `IntegrationDefinition` — provider type, API/auth versions, object/event capabilities, limits/scopes.
- `IntegrationInstance` — workspace connection, credential ref, enabled scopes/features, health/sync state.
- `IntegrationMapping` — canonical entity↔provider object mapping; provider IDs never replace Brovexa IDs.
- `FieldMappingRule` — versioned external↔canonical field transform/direction.
- `FieldAuthorityRule` — `BROVEXA / PROVIDER / MANUAL_LOCK / LATEST_VERIFIED / MERGE_SET / REVIEW`.
- `SyncCursor` — checkpointed provider cursor/time/version.
- `SyncEvent` — webhook/poll/import event, idempotency/timestamps/state/retries/outcome.
- `SyncConflict` — competing values/provenance/authority/review/resolution.

Authority is separate from direction: a field may be pushed to a CRM without the CRM gaining authority over it.

## Sync modes
One-time import; push; pull; bidirectional; webhook + reconciliation; review-only. Every object/field explicitly declares direction—no unsafe global `sync everything` switch.

## Semantic mapping
Provider Company/Account/Contact/Lead/Opportunity/Deal concepts are not assumed identical to Brovexa Business/Contact/Lead/Deal. Each adapter declares mapping semantics and version.

CRM stage mappings never become canonical lifecycle authority and cannot bypass Brovexa transition guards.

## Mutation flow
`authenticate source → idempotency → schema/version validate → normalize → resolve mapping/entity → policy/field authority → conflict detection → atomic allowed canonical change → Activity/Audit/DomainChangeEvent → cursor/ack`.

External side effects use outbox/retry/reconciliation.

## Webhooks
Verify authenticity/signature, replay/timestamp defenses where available, idempotency before mutation, tolerate out-of-order events, reconcile missing events, dead-letter poison events, separate HTTP receipt from successful domain mutation.

## Reconciliation
Detect lost webhooks, mapping drift, provider archive/delete, duplicates, field/stage drift, suppression conflicts and scope/credential changes. Runs are bounded/checkpointed/rate-limit aware.

## Loop prevention
Outbound changes carry correlation/origin metadata where supported or use normalized value/version fingerprints. A Brovexa-originated update must not bounce forever through the provider.

## Delete/archive
Provider deletion does not blindly delete canonical Business/Evidence/Lead history. Policy/authority determines unlink mapping, provider archived state, proposed Brovexa archive, privacy deletion propagation or review. Reverse propagation is also explicit.

## Suppression/opt-out
Suppression is high-authority safety data. A CRM/provider cannot silently unsuppress a Brovexa route. Conflict defaults to safe suppressed/review state.

## CSV/XLSX
`upload → file/security validation → isolated staging → preview/sample → field mapping → validation → entity/dedupe planned actions → user commit → chunked idempotent import → error report`.

Row outcomes: CREATE / UPDATE / LINK / SKIP_DUPLICATE / REVIEW / POLICY_BLOCKED / INVALID / ERROR. Imports resume safely and never hide partial failures.

## Browser/manual/public form
Browser capture is EvidenceCandidate/BusinessCandidate with URL/user/time provenance. Manual entry is manual/unverified provenance until verified. Public forms create InboundEvent then entity/Lead dedupe.

## First-party isolation
Customer first-party signals remain strictly scoped to that workspace/purpose; they are not recycled into another customer's/global intent dataset.

## API idempotency
Write operations are retry-safe. External clients cannot choose arbitrary canonical IDs; Brovexa returns canonical identity and stores client/provider mapping.

## Conflict review UI
Shows Brovexa value/provenance/freshness, provider value/source/time, authority rules, downstream impact and suggested resolution.

Actions: Keep Brovexa / Accept Provider / Merge / Manual Lock / Ignore Once / permissioned Rule Change. Resolution is audited and can re-evaluate Leads/eligibility.

## CRM prioritization
Score HubSpot/Salesforce/Pipedrive/Zoho/future providers on actual customer demand, object/API/webhook coverage, OAuth/service account, rate limits, licensing/marketplace requirements, sandbox, custom fields, security/data residency, maintenance and support cost. Brand popularity alone does not decide order.

## Observability/tests
Track sync lag, processed/failed events, conflicts, retries, rate limits, duplicate prevention, suppression conflicts, created/updated/skipped and provider cost/latency.

Tests: duplicate/out-of-order webhook, invalid signature, outage/429, expired OAuth/scope reduction, concurrent edits, delete/archive, loop prevention, missed webhook+reconcile, suppression conflict, partial/duplicate/large import resume, cross-tenant mapping attack.

## Gate
Provider implementation order is a later decision. This contract maps to canonical schema, Lead transition rules, source/privacy policy and ABD-252 before a connector ships.