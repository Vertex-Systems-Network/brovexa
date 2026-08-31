# Brovexa — M00 Architecture & Deployment ADR Baseline v1.0

Status: **Planning Only — architecture decision baseline, not implementation authorization**

## Architecture objective

Brovexa must become usable quickly without creating a throwaway prototype. Initial architecture therefore optimizes for one deployable product with strong internal module boundaries, durable background execution, shared TypeScript contracts and an explicit extraction path if measured scale later justifies services.

## Accepted baseline

- pnpm workspace monorepo; Turborepo unless implementation validation finds a material blocker.
- Web: Next.js App Router + React + TypeScript.
- API: NestJS modular monolith.
- Worker: NestJS/TypeScript worker pools.
- Desktop: Tauri 2 + React/Vite, Windows-first; Electron only as a documented fallback for a proven capability blocker.
- Extension: WXT + React, one shared Chrome/Chromium + Firefox product with browser adapters.
- Canonical DB: PostgreSQL 18.x, latest supported security patch at implementation time.
- Data access baseline: typed PostgreSQL schema/migrations; evaluate Drizzle ORM + PostgreSQL driver first, permit reviewed parameterized SQL for complex queries.
- Search: PostgreSQL relational/full-text/trigram + pgvector where evaluated; no OpenSearch initially.
- Background execution: Redis + BullMQ; PostgreSQL remains canonical workflow/job/checkpoint state.
- Temporal: deferred behind explicit complexity/adoption thresholds; do not dual-run initially.
- Object/evidence storage: S3-compatible API behind provider abstraction, policy-aware retention.
- Primary API: versioned REST + OpenAPI/JSON Schema + generated clients; signed/versioned webhooks.
- AI/model routing: provider-neutral, task/policy/eval/cost/data-residency aware; pre-approved fallbacks only.
- Python: only for workloads with concrete ecosystem advantage; no Python service merely because a feature uses an LLM.
- Identity: OIDC/OAuth-compatible boundary accepted; exact provider remains a Human Decision after security/price/lock-in comparison.
- Deployment: independently scalable Web/API/worker processes + PostgreSQL + Redis + S3 + observability; no Kubernetes initially.
- Observability: OpenTelemetry-compatible traces/metrics + structured logs/correlation IDs.
- Local/dev: Docker Compose infrastructure, seeded demo workspace, mock/sandbox connectors.
- Supply chain: lockfiles, CI gates, dependency/secret scanning, SBOM/provenance/signing where supported.

## Modular-monolith boundaries

Initial bounded modules:

1. Identity / Sessions / Workspaces / RBAC
2. Entitlements / Usage / Credits / Billing projection
3. Geography / Taxonomy / Service Catalog
4. Source Capability / Connector Policy
5. Businesses / Locations / Domains / People / Contact Channels
6. Evidence / Fact / Provenance
7. Research Jobs / Scheduling / Coverage / Budgets
8. Agent Registry / Runs / Evals / Memory metadata
9. Signals / Opportunities / Scoring
10. Leads / Deals / Tasks / Routing / Nurture
11. Compliance / Contactability / Suppression
12. Integrations / CRM / Imports / Webhooks
13. Notifications
14. Audit / Admin / Support

Modules own write paths/invariants. Provider SDK objects never become domain contracts. No initial service mesh/RPC fabric.

## PostgreSQL physical-design rules

- External provider IDs remain mappings; canonical IDs are application-owned.
- Explicit workspace/tenant key on tenant-owned high-volume tables.
- Foreign keys/uniqueness for integrity where lifecycle permits.
- Append/history tables for observations, scores, transitions, audit and ledgers.
- JSONB only for genuinely extensible/versioned fields, not as replacement for core typed data.
- No generic EAV model for core product data.
- Current UI state is a projection over history where applicable.
- Partitioning is not enabled by default; add only after measured table volume/write/retention patterns justify it.

## Durable background execution

Redis/BullMQ carries runnable queue work, delays, retries, priorities, source-specific queues and ephemeral coordination.

PostgreSQL owns ResearchJob, JobVersion, JobRun, WorkUnit/SourceTask identity, attempts, checkpoints, budgets, coverage, cancellation/pause intent, errors and review state.

Queue loss may delay work but may not erase canonical truth. Worker restart must reconstruct runnable work from canonical state. Externally costly/non-idempotent actions require deterministic idempotency protection.

### Temporal adoption trigger

Re-evaluate Temporal only when real measured workflows require enough custom code for multi-day durable timers, human waits, sagas/compensation, nested child workflows or exact recovery that the additional workflow-engine operations are justified.

## Search/vector adoption rule

Vector indexes are derived/rebuildable and never authoritative memory/fact state. OpenSearch remains deferred until Postgres cannot meet measured search SLO/scale/faceting/hybrid-relevance requirements or search indexing materially harms OLTP.

## Object/evidence storage

No public bucket access by default. Every retained object links to workspace/source/evidence, hash, content type, retention class and expiry/delete state. Source rights determine whether raw content is stored at all.

## Identity boundary

Do not build a bespoke token protocol. Exact identity provider remains unresolved until comparison covers PKCE/public clients, MFA/passkeys/recovery, organizations, enterprise federation, sessions/devices, audit/webhooks, data residency, MAU/seat pricing, export/migration and local development.

## Deployment environments

- local
- CI/test
- staging
- production

Production and staging secrets, databases, buckets and provider credentials are isolated. Kubernetes, mandatory microservices, Kafka, dedicated vector DB, GraphQL and multi-region active-active are explicitly deferred extension points rather than missing requirements.

## Observability

Propagate correlation identifiers where applicable: request, workspace, job/run/work-unit, agent run, connector/source, lead and billing event. Do not log sensitive evidence/contact/model context by default.

Monitor API latency/error, DB pressure, queue depth/age/retries, connector limits/outages/cost, ResearchJob coverage/budget stops, AI latency/cost/eval failures, entity-review rate, signal quality, memory conflicts, Lead conversion, suppression/policy blocks and client-version health.

## Backup/DR planning targets

- Automated PostgreSQL backup/PITR where hosting permits.
- Policy-aware object versioning/backup.
- Encrypted backups and periodic restore tests.
- Queue reconstruction from canonical PostgreSQL job state.
- IaC/configuration recovery and credential-rotation runbooks.
- Planning target RPO <= 15 minutes and RTO <= 4 hours for core SaaS; validate against chosen hosting before these become promises.

## Architecture failure proofs required

Test/review recovery for API restart, worker crash, Redis restart/loss, duplicate job delivery, PostgreSQL recovery, connector outage/rate limit, AI provider outage, object-store failure, stale client, policy expiry, cancellation in flight, partial commit, duplicate/out-of-order CRM/payment webhook, and cost exhaustion.

## Remaining M00 architecture decisions

1. exact identity provider
2. hosting/cloud/provider choices
3. managed vs self-hosted Postgres/Redis/S3 production model
4. physical schema/index/migration benchmark validation
5. final data-layer/ORM spike
6. map/tile provider policy
7. concrete source/model cost assumptions
8. infrastructure-as-code and deployment workflow
9. validated RPO/RTO against hosting
10. final architecture/trust/control diagrams

ABD-215 plus explicit owner development consent remain mandatory before implementation.