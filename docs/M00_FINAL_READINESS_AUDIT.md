# Brovexa — M00 Final Adversarial Readiness Audit

Date: 2026-08-30
Owner: Linear `ABD-253`
Status: **M01 FOUNDATION READY WITH EXPLICIT LATER-MILESTONE GATES**

This audit is adversarial: its purpose is to find contradictions, omissions and unsafe assumptions, not to prove prior planning correct.

## Scope decision

The owner explicitly authorized implementation on 2026-08-30. Approval is applied at **M01 milestone scope** first.

M00 does not pretend that every launch/vendor/legal choice is solved. Decisions not required to safely implement the provider-neutral platform foundation remain explicit later-milestone gates.

## VERIFIED READY

### Product/system boundary
- Brovexa is defined as an AI-native global business intelligence, acquisition, evidence, opportunity and Lead Operating System.
- Business, Location, Domain, Contact, Evidence, Fact, Inference, Signal, Opportunity, Lead, Deal, Job, AgentRun, Memory and Billing concepts are separated.
- Public site, Web app, Desktop, Chrome/Firefox and API are clients/surfaces of one canonical backend rather than separate business-rule implementations.

### Architecture
- modular monolith first; independent workers/provider adapters where useful
- Node.js LTS line; current verified target 24.20.0
- Next.js 16.3.3 Active LTS for Web
- NestJS 12 stable line for API/workers
- PostgreSQL 18.x canonical state
- Redis/Valkey + BullMQ as execution transport while PostgreSQL owns durable job/checkpoint truth
- pgvector is derived/optional semantic index, not canonical memory truth
- S3-compatible object abstraction for evidence/artifacts
- OpenTelemetry-compatible server observability
- Tauri 2 and WXT remain later client implementations
- Temporal/OpenSearch/Kubernetes/Kafka/broad microservices remain deferred behind measurable triggers

### Engineering governance
- project-state detection and Plan↔Reality statuses adopted
- repository/runtime/test/CI evidence outranks conversation/docs for actual implementation state
- documentation-first substantial module development
- milestone-level approval and `AWAITING_DEVELOPMENT_APPROVAL` semantics
- small-batch/no-unrelated-cleanup/change-surface rules
- parallel-safety classes
- FAST GATE / FULL GATE
- baseline-failure/flaky-test policy
- release-state/recovery classifications
- incident and STOP-THE-LINE behavior
- durable checkpoint/resume rules

### Security/privacy
- tenant isolation/server authorization is mandatory
- external content is untrusted data
- SSRF and prompt/tool-injection controls planned
- no unrestricted agent tools/memory
- source policies govern collection/storage/export/retention
- suppression/opt-out/contactability is separate from discovery
- unknown jurisdiction/contact class fails closed for outreach
- no browser content-script reusable backend credentials
- deep links do not grant authorization

### AI/memory
- model context is not canonical state
- durable AgentRun/Plan/Handoff/Checkpoint concepts exist
- memory types/namespaces/authority/provenance/staleness/conflict/deletion are explicit
- facts/evidence/inference/memory remain separate
- high-impact actions require deterministic validation/evaluation/human policy gates

### Data/recovery
- canonical lineage and immutable/history-preserving records are planned
- entity merge/split is reversible
- retries/idempotency/cancellation/partial completion are explicit
- internal retry/replay cannot double-charge
- migration strategy requires reviewed migrations and compatibility-aware evolution

### Capability traceability
`docs/CAPABILITY_TRACEABILITY_MATRIX.md` v1.0 assigns material capabilities to permission namespaces, data/billing classes, failure/recovery behavior, test/eval families, implementation packages and Build/Defer/Blocked/Human-Decision states.

## HUMAN DECISION — NOT M01 BLOCKERS

These are not silently solved. They remain required before the affected capability is enabled:

1. hosted identity provider selection; M01 builds provider-neutral user/workspace/session/RBAC boundaries first
2. production cloud/region/managed Postgres/Redis/object store/IaC
3. actual Brovexa legal entity and payment-provider onboarding
4. exact package prices/included Research Credits/concurrency/max-job limits after pilot COGS
5. exact launch source providers and their field/TTL/export/license profiles
6. production jurisdiction/channel legal profiles
7. exact model/provider allowlist and numeric production AI release thresholds
8. exact launch locale set

## KNOWN DEFERRED

- autonomous/bulk external outreach
- payment activation before provider/entity ADR
- production connector enablement before SourcePolicy tests
- Daily Market Scout activation
- Mobile companion
- Slack/Teams/email/calendar context adapters
- extra CRM/ERP/helpdesk connectors
- Temporal/OpenSearch/Kubernetes unless adoption triggers are met
- active-active multi-region writes

## ADVERSARIAL FINDINGS AND DISPOSITION

### A-01 — Planning branch had no executable CI
Risk: future claims could outrun evidence.
Disposition: **M01 first slice must create CI before significant product code.** No PASS claim until workflow evidence exists.

### A-02 — Remote GitHub audit cannot prove local working-copy state
Risk: hidden uncommitted/local runtime changes.
Disposition: local state remains `UNKNOWN`; any implementation agent with filesystem access must inspect `git status`, runtime and DB before modifying them. Remote GitHub changes stay isolated to a dedicated implementation branch.

### A-03 — Repository rulesets/branch protection not observable through current connector
Risk: unknown merge protections.
Disposition: state remains `NOT VERIFIED`; do not weaken protections; use draft PRs, CI and no auto-merge as compensating controls until repository-admin verification is available.

### A-04 — Identity/payment/hosting vendor choice could leak into domain model
Disposition: provider-neutral canonical User/Workspace/Membership/Subscription/Entitlement/ProviderMapping boundaries are mandatory. Vendor SDKs remain adapters.

### A-05 — Queue could accidentally become canonical job state
Disposition: prohibited. PostgreSQL durable job/work-unit/checkpoint state is authoritative; queue is delivery/execution transport.

### A-06 — AI memory could become untraceable shadow truth
Disposition: prohibited. canonical business facts remain domain records; memory references/summarizes them with provenance and authority.

### A-07 — “Internet research” could become unrestricted scraping
Disposition: prohibited. ResearchJob source selection compiles only to approved SourceCapabilities/ConnectorPolicies.

### A-08 — Lead generation could bypass contact/outreach law
Disposition: prohibited. Discovery/Lead promotion/contactability/outreach approval are separate states; suppression wins.

### A-09 — Package credit model could charge internal retries
Disposition: prohibited by immutable/idempotent usage + credit ledgers and reserve/settle/release semantics.

### A-10 — Huge initial scaffold could violate small-batch rule
Disposition: M01 begins with a minimal **Foundation Slice 1**: monorepo metadata, shared TypeScript/config/contracts, API/Web shells, health endpoint, basic tests and CI. Database/queue/auth deeper primitives follow in separate slices.

## M01 ENTRY CRITERIA

Satisfied for starting Foundation Slice 1:
- owner implementation approval: YES
- canonical architecture direction: YES
- engineering governance v1.2: YES
- capability traceability baseline: YES
- M01 issue/acceptance criteria: YES
- no production data/runtime to migrate: verified from remote repo state only
- dedicated implementation branch required: YES
- CI must be created in first slice: YES

## M01 NON-AUTHORIZED ACTIONS

M01 approval does not permit production deployment, connector activation, payment activation, autonomous outreach, Market Scout activation, destructive data actions or bypassing later provider/legal gates.

## FINAL VERDICT

### VERIFIED READY
**M01 — Platform Foundation & Developer Experience may start now in small verified batches.**

### HUMAN DECISION
The listed vendor/legal/commercial choices remain explicit gates for their affected later capabilities.

### KNOWN DEFERRED
The deferred scope above remains documented and has extension points.

### BLOCKER
**No blocker remains for M01 Foundation Slice 1.**

This is not a production-readiness claim and not authorization for all later milestones.