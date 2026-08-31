# Brovexa — Production Architecture & Durable Execution ADR v1.0

Status: **Planning Only — architecture baseline, not implementation authorization**

## Decision

Use a **modular monolith + independent worker processes + provider adapters** for initial production. Avoid a premature microservice fleet and Kubernetes dependency.

Primary deployables:
1. Web/public application
2. Canonical API
3. Background worker pool
4. Scheduler/monitor process where needed
5. Optional Python AI/data worker only where the Python ecosystem gives a material advantage
6. Desktop client
7. Browser extension

## Runtime baseline

- Next.js 16 + React + TypeScript for web
- NestJS 12 + TypeScript for canonical API/workers
- PostgreSQL 18.x as canonical transactional store
- Redis + BullMQ initially for execution/scheduling
- S3-compatible object storage only for policy-permitted evidence/artifacts
- OpenTelemetry server traces/metrics + structured logs
- pnpm monorepo; build orchestrator selected by implementation spike without unnecessary tooling

Exact package/runtime versions are pinned only when implementation begins.

## Canonical persistence

PostgreSQL owns durable truth for identity/workspaces/RBAC; business/entity/location/domain/contact mappings; source policy/capabilities; evidence/facts/inferences; signals/opportunities; ResearchJob/JobVersion/Run/WorkUnit/Checkpoint; Agent definitions/runs/context receipts/memory metadata; Lead OS/deals/tasks/attribution; CRM mappings/conflicts; billing/entitlements/credit ledger; audit/security events.

Redis/BullMQ is an execution and coordination layer, **never the only workflow state**. Queue loss/rebuild must be recoverable from PostgreSQL.

S3-compatible storage contains only data allowed by SourcePolicy. Raw provider payloads/pages are never retained merely because object storage exists.

## PostgreSQL logical domains

Prefer one database initially with explicit ownership boundaries, for example:

- identity
- workspace
- geo
- taxonomy
- source
- intelligence
- research
- agent
- lead
- integration
- billing
- audit

Physical schema boundaries may be adjusted for query/ORM ergonomics without changing domain ownership.

### Transaction/integrity rules

- transactions at business-invariant boundaries
- immutable history for score/stage/evidence/ledger/audit events
- optimistic concurrency/version checks where useful
- unique/idempotency constraints for webhook/source/job/provider events
- merge/split uses explicit history records
- workspace/tenant ownership revalidated server-side

## Index strategy

Index concrete query contracts, not every field.

Expected initial index families:
- workspace + status/list queries
- provider mapping uniqueness
- normalized domain/contact lookups
- geography hierarchy/path
- ResearchJob/Run/WorkUnit state/due/retry fields
- evidence/fact subject + freshness/date
- signal subject + definition + occurrence/freshness
- Lead workspace + stage/owner/priority/next action
- CRM provider + external id
- billing provider event/idempotency/subscription
- audit actor/entity/time

Large event tables become partition candidates only after measured growth; do not pre-partition everything.

## Search/vector

- relational/faceted filters use PostgreSQL SQL/indexes
- PostgreSQL full-text/trigram can cover initial operator search
- pgvector may be used as a **derived** semantic retrieval index
- vector similarity never grants authority or tenant access
- embedding index is rebuildable/versioned by model/index version
- OpenSearch/Elasticsearch is deferred until measured latency/faceting/full-text scale justifies its operational cost

## BullMQ vs Temporal

### Initial decision: BullMQ + PostgreSQL durable state

BullMQ supports retries/backoff, Job Schedulers and parent/child flows and provides a fast TypeScript-native execution layer for Wave A/B.

Rules:
- DB stores Job/Run/WorkUnit/Checkpoint truth
- queue payloads carry stable IDs/minimal execution input
- worker actions are idempotent or protected by idempotency keys/leases
- retry is failure-category driven
- transient provider failures use exponential backoff/jitter
- exhausted/ambiguous failures go to review/dead-letter handling
- cancellation/pause/budget/policy checks happen before expensive/high-impact stages
- Redis queue configuration must use non-evicting behavior appropriate for BullMQ correctness

### Temporal reevaluation trigger

Evaluate/adopt Temporal when queue+DB orchestration becomes materially costly because of:
- many multi-day/month workflows with long durable timers
- extensive human-wait/approval orchestration
- complex compensation/saga flows
- repeated custom resume/replay logic
- difficult workflow versioning with many in-flight runs
- incidents showing queue/checkpoint reconstruction is too error-prone
- orchestration code dominating product engineering

Temporal is a strong future durable-execution option, not a default dependency.

## Work-unit contract

`ResearchJob → JobVersion → Run → WorkUnit → SourceTask/AgentRun → Checkpoint`

WorkUnit records include stable idempotency identity, parent run/version, stage/type, geography/category/entity scope, approved source/purpose/budget envelope, state/attempts, lease ownership, timestamps/heartbeat, retry policy, cost reservation/actual usage, checkpoint/output refs and failure category.

Workers may crash/duplicate/restart without duplicating committed canonical outcomes.

## Recurring and continuous research

Recurring schedules are represented canonically in PostgreSQL. BullMQ Job Schedulers can trigger due work, but Redis is not the sole schedule truth.

Before each scheduled run revalidate:
- entitlements and workspace budget
- SourcePolicy/capabilities
- jurisdiction/compliance where relevant
- immutable JobVersion if configuration changed

Stop in explicit states such as `POLICY_BLOCKED`, `BUDGET_STOPPED` or `ENTITLEMENT_BLOCKED`; never silently broaden/fallback.

## Redis

Initial production direction:
- dedicated managed Redis-compatible service where feasible
- environment isolation/prefixes
- TLS/auth where supported
- non-evicting queue configuration
- queues, coordination and short-lived cache only
- SourcePolicy-aware cache TTLs

Scale worker concurrency/queue separation before introducing new service boundaries.

## Evidence/object storage

Use an S3-compatible abstraction. Store only policy-permitted evidence/artifacts.

Metadata links object to tenant/evidence/source, classification, content hash, encryption, created/retention/delete dates and source-policy version.

Versioning is used where recovery/audit needs justify it. Object Lock/WORM is **not** a blanket evidence default because retention/privacy/source-delete rules may require deletion; use only for explicitly justified audit/legal classes.

Presigned access is short-lived and server-authorized. Object keys never function as authorization.

## Identity provider abstraction

Brovexa owns canonical User/Workspace/Session/RBAC behavior even if authentication execution uses a managed provider/library.

Implementation ADR must compare:
- email/password security
- OAuth/OIDC + PKCE for Desktop/extensions
- MFA/passkeys
- future enterprise SAML/OIDC/SCIM
- session/device management
- audit/webhooks
- MAU/pricing
- region/data residency
- export/migration/lock-in
- abuse controls

Do not invent a home-grown auth protocol. Provider subject IDs remain mappings.

## AI/model gateway

Internal typed model gateway selects pre-approved model capabilities based on task/policy/evals/cost/data classification. Track provider/model version, region/residency, token/output limits, structured-output support, cost/latency, fallback and eval release.

AgentDefinitions request a capability, not arbitrary model names. No silent fallback to unevaluated models.

## Environments

Minimum:
- local/dev
- ephemeral CI/test
- staging
- production

No production secrets in Git. Validate environment configuration on boot. Staging uses synthetic/redacted fixtures unless explicit safe data exists.

Migrations run through a controlled deployment step and staged releases must tolerate required compatible old/new schema windows.

## Deployment

Containerize API/worker/scheduler for reproducibility. Start on a managed container/application platform or small orchestrated VM/container topology.

**Kubernetes is deferred** until scale/operations/team evidence justifies it.

## Backup/recovery

Provisional Wave-A targets to validate with real infrastructure:
- PostgreSQL RPO <= 15 minutes
- PostgreSQL RTO <= 4 hours
- PITR/continuous WAL strategy where platform supports
- daily durable backups
- restore drill before production and recurrently afterwards
- queue/cache loss recoverable from canonical DB state
- infra/configuration reproducible from code/runbooks

Exact SLA claims require measured restore tests.

## Observability

Use operation correlation fields as applicable:
`requestId / traceId / workspaceId / jobRunId / workUnitId / agentRunId`.

Track structured logs, server traces/metrics, dependency latency/errors/rate limits, queue depth/age/retries, research coverage/cost, model latency/token/schema failures, billing reconciliation and source/connector health.

Do not place secrets/raw sensitive evidence/unnecessary personal data in logs or traces.

## Cost and budgets

Budget Service estimates/reserves cost before expensive stages and records actual usage afterwards.

Meter source/API calls, fetch/storage, model input/output/embeddings, enrichment credits and relevant compute. Research Credits are a versioned commercial abstraction, not provider credits exposed directly.

Hard limits are deterministic and cannot be waived by agent prompts.

## Failure taxonomy

- `TRANSIENT_PROVIDER`
- `RATE_LIMITED`
- `AUTH_EXPIRED`
- `POLICY_BLOCKED`
- `BUDGET_STOPPED`
- `ENTITLEMENT_BLOCKED`
- `INVALID_INPUT`
- `SCHEMA_INVALID`
- `EVIDENCE_INSUFFICIENT`
- `CONFLICT_REVIEW`
- `SECURITY_BLOCKED`
- `PERMANENT_PROVIDER`
- `INTERNAL_BUG`

Retries depend on failure category, not blanket retry.

## Required pre-implementation gates

- runtime/package versions pinned
- DB query/migration layer ADR complete
- Redis provider/config verified
- object-storage encryption/lifecycle policies verified
- identity approach/provider ADR complete
- model-gateway provider/eval allowlist complete
- restore test passed
- RPO/RTO measured
- telemetry redaction tests defined/passed at release
- crash/retry/idempotency/budget-stop tests defined/passed
- provider outage/reconciliation tests
- cost model measured on representative pilot jobs

## Deferred with reevaluation triggers

- Kubernetes
- broad microservice fleet
- Kafka/event-stream platform
- OpenSearch/Elasticsearch
- Temporal
- separate vector DB
- multi-region active-active writes
- custom identity provider

These are sequenced, not forgotten.