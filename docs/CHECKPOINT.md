# Brovexa Project Checkpoint

## Authorization state

**Planning Only. Feature development is not authorized.**

Repository baseline before planning: `main` at initial commit `49673ebd8d40133eaa00d3bd8d760ce4b372fd5a`, effectively no product implementation.

Planning branch: `planning/brovexa-baseline`
Draft PR: #1

PR #1 remains documentation/planning only and must not be treated as development consent.

## Product definition

Brovexa is planned as an AI-native global business discovery, evidence, signal, opportunity and Lead Intelligence Operating System with:

- public website + identity/onboarding + packages/billing
- Web operator control plane
- Windows-first Desktop client
- shared Chrome/Chromium + Firefox extension
- provider-neutral APIs/webhooks/CRM/imports
- AI Agent OS + durable backend memory
- Global Acquisition Studio + policy-aware background ResearchJobs
- global geography/classification registry
- universal signal/opportunity ontology
- BPO/custom-service opportunity reasoning
- Lead Intelligence OS + AI Lead Copilot
- controlled/compliant outreach workflow
- governed 24-hour Market Intelligence Scout.

## Canonical planning documents

Core:
- `docs/PROJECT_PLAN.md`
- `docs/ENGINEERING_CONSTITUTION.md`
- `docs/PREDEVELOPMENT_7_DAY_CLOSURE.md`
- `docs/M00_COMPLETENESS_MATRIX.md`

Product/data/AI:
- `docs/PRODUCT_SCOPE_SERVICE_TAXONOMY.md`
- `docs/SERVICE_TAXONOMY_REGISTRY.md`
- `docs/GLOBAL_GEOGRAPHY_CLASSIFICATION_REGISTRY.md`
- `docs/GLOBAL_ACQUISITION_STUDIO.md`
- `docs/UNIVERSAL_SIGNAL_ONTOLOGY.md`
- `docs/CANONICAL_DATA_PROVENANCE.md`
- `docs/AI_AGENT_MEMORY_OS.md`
- `docs/AI_AGENT_CONTRACTS_EVALS.md`
- `docs/LEAD_INTELLIGENCE_OS.md`
- `docs/CRM_INTEGRATION_SYNC.md`

Security/compliance/clients:
- `docs/SOURCE_POLICY_MATRIX.md`
- `docs/JURISDICTION_OUTREACH_POLICY.md`
- `docs/THREAT_MODEL.md`
- `docs/CROSS_CLIENT_TRUST.md`
- `docs/IDENTITY_AUTH_LIFECYCLE.md`
- `docs/CLIENT_SURFACES.md`

Architecture/operations:
- `docs/TECH_STACK_UI.md`
- `docs/ARCHITECTURE_ADR_BASELINE.md`
- `docs/RELIABILITY_CAPACITY_COST.md`

Commercial/public:
- `docs/WEBSITE_AUTH_BILLING.md`
- `docs/PUBLIC_WEBSITE_COMMERCIAL_LIFECYCLE.md`
- `docs/LAUNCH_SCOPE_WAVES.md`

Market intelligence:
- `docs/CONTINUOUS_MARKET_INTELLIGENCE.md`
- `docs/DAILY_MARKET_SCOUT_EXECUTION.md`

## Architecture decisions now stable enough for downstream M00

Accepted initial direction:

- pnpm workspace monorepo; Turborepo unless validation finds a material blocker
- Next.js + React + TypeScript Web
- NestJS modular monolith API + TypeScript workers
- PostgreSQL 18.x canonical store
- Drizzle-first typed PostgreSQL/data-layer validation with reviewed parameterized SQL escape hatch
- PostgreSQL relational/full-text/trigram + pgvector initially
- Redis + BullMQ execution while PostgreSQL owns durable ResearchJob/WorkUnit/checkpoint truth
- S3-compatible policy-aware object storage
- REST/OpenAPI/JSON Schema + generated clients and signed/versioned webhooks
- Tauri 2 Windows-first Desktop
- WXT shared Chrome/Firefox extension
- OpenTelemetry-compatible server observability
- Python only for workloads with material ecosystem advantage
- no initial Kubernetes, mandatory microservices, OpenSearch, Temporal, Kafka, dedicated vector DB or GraphQL.

Temporal/OpenSearch/service extraction have measurable adoption triggers.

Identity uses an OIDC/OAuth-compatible boundary; exact identity provider remains a Human Decision. Exact hosting/cloud/managed offerings remain ADR/Human decisions.

## Durable execution / cost invariants

- Queue/Redis is never canonical workflow state.
- Worker/Redis restart must recover runnable work from PostgreSQL state.
- Externally costly/non-idempotent operations need deterministic idempotency protection.
- ResearchJobs have hard/warning budgets for APIs/search/fetch/model/tokens/credits/cost/runtime/concurrency.
- Agents cannot expand approved hard budgets or geography/source/purpose.
- Usage and Research Credit debits are immutable/idempotent ledger entries.
- System retry/restore/replay may not double-charge.
- Fair scheduling/backpressure preserves interactive capacity and respects provider limits.

## AI/memory state

Agent pattern:

`Trigger → Orchestrator → Context Builder → bounded specialists → validators → Evidence Verifier → Independent Evaluator → canonical state → Memory Curator/checkpoint`.

Every production AgentDefinition is versioned with tool/source permissions, memory scopes, autonomy, schemas, model/prompt/skill versions, budgets, validators, fallbacks and eval suite.

Durable memory types: working/run, semantic, episodic, procedural, entity, Lead, research, workspace/user. Memory is not raw chat history and never competes with canonical domain state. Vector indexes are derived/rebuildable. Conflicts/staleness/supersession/deletion are explicit.

## Acquisition / geography / signals

Research Job Builder:

`Objective → Geography → Industry/Niche → Business/Digital/Contact Filters → Signals → Sources → Depth/Quality → Output → Schedule → Budget → Preflight → Run`.

Global geo/classification uses internal stable IDs with versioned mappings to UN M49, ISO 3166, attributed gazetteer data, ISIC, NACE, NAICS and provider categories. External codes are mappings, not Brovexa canonical IDs.

`Internet` is never an unrestricted connector. Every source has SourceCapability + ConnectorPolicy.

Signals use versioned SignalDefinition and immutable/history-preserving SignalObservation. Explicit demand remains distinct from inferred need; absence signals require active verification.

## Lead OS state

Business, Location, Contact, Evidence, Signal, Opportunity, Lead and Deal are separate canonical objects.

Lead lifecycle categories and transitions are server-authoritative and history-preserving. Duplicate-pursuit decisions, qualification/score history, routing, buying-role gaps, tasks/SLA, nurture/reactivation, re-research, CRM field authority and compliance/contactability are defined.

AI Lead Copilot proposes/explains/researches/drafts but cannot bypass suppression, routing authority, compliance or approval gates.

## Public website / commercial state

Homepage/product planning now uses real-product/synthetic-fixture proof rather than generic marketing imagery. Feature visuals are planned for Discovery, Job progress, Business 360, Signals, Evidence, Opportunity reasoning, Lead OS, Buying Committee, Agent Trace, Memory, extensions/Desktop, Market Scout and Compliance.

Signup funnel aims at first evidence-backed useful result, not merely account creation.

Provisional package hypothesis remains:
- Free $0
- Launch $49/mo
- Pro $149/mo
- Growth $399/mo
- Enterprise custom

Entitlements and Research Credits are separate. Exact included credits and final prices remain provisional until representative unit economics exist.

Paddle is the current preferred **validation candidate** for a Pakistani/global SaaS MoR launch model; Stripe remains direct-control comparison and Lemon Squeezy MoR alternative. No provider is activated/selected until actual Brovexa legal entity onboarding, terms, payouts, fees and requirements are verified.

Checkout/subscription/tax/refund/dunning/over-limit states are provider-neutral and server-reconciled. Browser redirect success alone never grants durable paid access. Payment failure/downgrade cannot silently delete customer data.

## Market Intelligence Scout

Daily scout is specified but disabled. Future implementation uses bounded research lanes, prior ScoutState, evidence verification, meaningful-delta detection, GitHub/Linear dedupe, Add/Experiment/Watch/Reject proposals, independent evaluator/security review and hard budgets.

It cannot auto-code, merge, change dependencies/policies/pricing, enable connectors, send outreach or publish procedural memory.

## Seven-day readiness control

Target remains Aug 30–Sep 5, 2026 for pre-development readiness, not full implementation.

Hard final controls:
- `ABD-252` exhaustive option/use-case/dependency traceability matrix
- `ABD-253` adversarial contradiction/omission/readiness audit
- `ABD-215` explicit M00 owner approval gate
- explicit owner development consent after review.

## Remaining material pre-development gaps

1. Complete source-by-source launch connector policy/field/retention/licensing matrix for actual selected providers.
2. Exact production jurisdiction/channel legal review profiles beyond current engineering baseline.
3. Physical PostgreSQL table/index/migration benchmark validation and final data-layer spike.
4. Exact identity provider Human Decision.
5. Exact production hosting/cloud/Postgres/Redis/S3/region and IaC/deployment workflow.
6. Map/tile provider policy/ADR if map UI ships in Wave A.
7. Representative source/search/enrichment/model cost pilots; final package credit allowances/prices/gross-margin target.
8. Actual Brovexa operating legal entity + payment-provider onboarding/fees/terms verification.
9. Final AI numeric release thresholds from representative golden/pilot datasets.
10. Complete workspace/admin/notification/developer-API/platform-ops cross-cutting contracts (`ABD-256`).
11. Populate exhaustive `ABD-252` traceability matrix across every option/state/failure/permission/cost/compliance/test.
12. Run `ABD-253` adversarial final audit.
13. Evaluate `ABD-215`; do not infer authorization from `continue`.

## Implementation state

No production feature code, DB migrations, auth/payment integration, connector, AI runtime, geography registry, ResearchJob runner, signal engine, Lead OS, Web/Desktop/extension client or daily GitHub scout has been enabled/implemented as product work yet.

Next safe action is remaining M00 closure and final audit, then present development-consent decision.