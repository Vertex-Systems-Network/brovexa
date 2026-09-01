# Brovexa Project Plan

Status: **Planning Only — feature development is not authorized until M00/ABD-215 and explicit owner consent.**

## Product mission

Brovexa is an AI-native global business discovery, research, opportunity and lead-intelligence platform. It discovers businesses from approved sources, resolves canonical entities, enriches public/authorized information, verifies digital presence, detects explicit and implicit business signals, reasons about BPO/service opportunities, creates evidence-backed leads, and helps users prioritize and act while preserving compliance and human control.

Brovexa is source-agnostic. It must not depend on unrestricted copying of any one provider dataset.

## Product surfaces

- Public marketing/pricing/auth website
- Web operator application
- Desktop operator application
- Chrome/Chromium extension
- Firefox extension
- API/webhooks/integration surface
- AI Agent OS + durable memory
- Background Global Acquisition Studio
- Lead Intelligence Operating System

Clients share versioned domain/API contracts. Canonical facts, evidence, memory, signals, opportunities, leads, compliance state and audit history remain backend-owned.

## Canonical intelligence pipeline

Research Intent → Job Preflight → Global/Source Plan → Background Acquisition → Source Normalization → Entity Resolution → Contact Enrichment → Website Intelligence → Signal Detection → Evidence Verification → Opportunity Reasoning → Lead Qualification/Scoring → Lead OS → Decision-Maker/Buying Committee → Next Best Action → Outreach Review → CRM/Outcome Feedback → Memory/Eval Updates.

Each asynchronous stage must be independently retryable, idempotent, versioned, observable, budgeted and policy-aware.

## M00 — Product, Compliance & Architecture Baseline

Development is blocked until this milestone and explicit owner consent are approved.

Current required Linear gates include:
- ABD-209 product scope/personas/workflows/service taxonomy
- ABD-210 source/privacy/outreach compliance matrix
- ABD-211 canonical data/evidence schemas
- ABD-212 AI contracts/evals
- ABD-213 threat model
- ABD-214 architecture/deployment/queues/storage/cost
- ABD-226 Web/Desktop/Chrome/Firefox architecture
- ABD-231 24-hour market-research workflow specification
- ABD-233 production stack/UI ADR
- ABD-234–240 public website/auth/packages/payment/billing/SEO planning
- ABD-241 AI Agent OS + durable memory architecture
- ABD-242 global geography/taxonomy/Research Job Builder contracts
- ABD-243 Lead Intelligence OS canonical model/lifecycle
- ABD-248 universal signal/event/opportunity ontology
- ABD-215 final readiness + explicit owner-consent gate

Core expansion documents:
- `docs/AI_AGENT_MEMORY_OS.md`
- `docs/GLOBAL_ACQUISITION_STUDIO.md`
- `docs/UNIVERSAL_SIGNAL_ONTOLOGY.md`
- `docs/LEAD_INTELLIGENCE_OS.md`
- `docs/CLIENT_SURFACES.md`
- `docs/WEBSITE_AUTH_BILLING.md`
- `docs/CONTINUOUS_MARKET_INTELLIGENCE.md`
- `docs/TECH_STACK_UI.md`

## M01 — Platform Foundation & Developer Experience
Linear: ABD-216

Repository/runtime foundation, environments/secrets, PostgreSQL migrations, API conventions, auth/RBAC/tenant primitives, queue/worker/scheduler foundation, test/eval harness, CI/security gates, observability, health checks, ADRs/runbooks/checkpoints.

## M01A — AI Agent Runtime & Memory OS
Linear: ABD-244; architecture gate ABD-241.

Implement a governed Agent Registry, planner/orchestrator, Context Builder, specialist workers, verifier/evaluator separation, model routing, tool permissions, budgets, pause/resume/review, durable checkpoints and memory stores.

Memory types: working/run, semantic, episodic, procedural, entity, lead, research and workspace/user memory. Memory is versioned, provenance-aware, scoped and auditable; verified facts remain separate from AI memory. Context retrieval considers task scope, authority, freshness, confidence and relevance rather than vector similarity alone.

## M02 — Business Discovery & Source Connectors
Linear: ABD-217

Provider-neutral source-adapter framework and compliant discovery with policy contracts, quota/cost, provenance, pagination, coverage and connector health.

## M02A — Global Acquisition Studio & Background Research
Linear: ABD-245, ABD-246, ABD-247; architecture gate ABD-242.

### Global geography
World/UN M49 region/subregion → country (ISO 3166-1) → administrative divisions (ISO 3166-2 and deeper gazetteer mappings) → locality/city → postal/radius/polygon/custom territory. Support aliases/native names, saved sales territories and versioned geography datasets.

### Industry/niche
Brovexa canonical taxonomy with mappings to ISIC Rev.5, NAICS 2022/version-ready revisions, NACE Rev.2.1, Google Places/source categories plus custom keywords/exclusions.

### Research Job Builder
Objective → Geography → Industry/Niche → Business/Digital Filters → Contact Target → Signals → Sources → Depth → Quality → Output → Schedule → Budget → Preflight → Run.

Objectives include business/location discovery, websites, contacts/decision makers, jobs/hiring, RFI/RFP/RFQ/tenders, vendor/outsourcing/partner/distributor/franchise needs, funding/expansion, technology changes, website/digital gaps, CX/reputation pain, operational/back-office/support capacity, news/events/regulatory/security, competitor/market research and custom conditions.

### Source classes
Maps/local APIs; official registries/open data; trade/industry directories; company first-party sites; jobs/careers; procurement/tender portals; news/search indexes; approved reviews/social; technical/technology; funding/company intelligence; licensed B2B; CRM/customer first-party; CSV/manual/API/webhook; future partner/MCP connectors.

`Internet` is not a catch-all source. Every adapter needs SourceCapability + ConnectorPolicy.

### Background execution
ResearchJob → plan → sharded WorkUnits → source tasks → normalization → resolution/enrichment/signals/verification/opportunities/leads → checkpoint. Jobs support preview, start, pause, resume, cancel, once/scheduled/continuous modes, budgets, per-source quota/circuit breakers, retries, dead-letter/review, partial state, exact progress and kill switches. Long-running work survives model/context/process restarts.

## M03 — Entity Resolution & Contact Enrichment
Linear: ABD-218

Canonical identity, deterministic + structured AI matching, confidence/review thresholds, reversible merge/split, domain verification and approved contact enrichment.

## M04 — Website & Digital Presence Intelligence
Linear: ABD-219

Verify websites and classify digital capabilities/gaps through bounded SSRF-safe acquisition with evidence and uncertainty.

## M05 — Demand, Intent & Opportunity Signals
Linear: ABD-220; ontology gate ABD-248.

Signal engine uses a versioned ontology rather than a small fixed list. Families include corporate lifecycle; finance/growth; workforce; procurement/explicit demand; product/market; technology/digital transformation; website/digital presence; CX/reputation; operations/capacity; sales/GTM; BPO/support; back-office; security/risk; regulatory/public record; facilities/property; events/media/community; competitive/market; authorized first-party inbound; and custom future signals.

SignalDefinition is separate from SignalObservation. Explicit requests remain distinct from inferred needs. Observations retain evidence, dates, confidence, freshness/decay, negative evidence and versions.

## M06 — BPO Intelligence, Scoring & Explainability
Linear: ABD-221

Map verified signals to configurable service opportunities; transparent score components include fit, intent, urgency, value, reachability, evidence confidence, freshness and compliance/contactability. Store reason codes, negative evidence and rule/model versions.

## M06A — Lead Intelligence Operating System
Linear: ABD-249, ABD-250, ABD-251; model gate ABD-243.

Canonical distinctions: Account/Business, Location, Contact, Evidence, Signal, Opportunity, Lead and Deal.

Default lead lifecycle: Candidate → Researching → Qualified/Disqualified → Ready for Review → Assigned → Contact Ready → Outreach Approved → Contacted → Engaged → Meeting/Discovery → Deal/Proposal → Won/Lost/Nurture/Suppressed.

Capabilities: lead inbox, qualification, component scoring/history, smart lists/audiences, tags/custom fields, owner/team/territory/round-robin routing, buying committee, next-best-action, tasks/SLAs/follow-up, aging/stale detection/re-research, nurture/reactivation, attribution, bulk safety controls, dashboards and provider-neutral CRM/import sync.

AI Lead Copilot can explain why a lead exists, summarize changes, find research gaps, identify buying roles, recommend service/offer and next action, propose tasks and re-research, monitor stale/nurture conditions and draft outreach under approval. It cannot bypass suppression/compliance/ownership/human gates.

## M07 — Outreach Strategy, CRM & Compliance Controls
Linear: ABD-222

Grounded outreach drafting, human review, suppression/opt-out, channel/jurisdiction rules, duplicate prevention and outcome feedback. Initial release remains human-approval-first for external outreach.

## M08 — Dashboard, Search, Workflows & APIs
Linear: ABD-223

Operator UI: Command Center, Acquisition/Discover, Research Jobs, Businesses, Business 360, Evidence, Signals, Opportunities, Lead OS, Outreach Review, CRM/Pipeline, Agent Center, Memory Inspector, Market Intelligence, Connectors, Compliance, AI Quality/Evals, Usage/Cost, Team/Roles, Settings.

## M08A — Desktop & Browser Clients
Linear: ABD-227–230

Windows-first Tauri desktop candidate and shared Chrome/Firefox extension candidate, using canonical backend contracts, secure auth/deep links, evidence capture, notifications and capability/version negotiation. See `docs/CLIENT_SURFACES.md`.

## M08B — Public Website, Identity & Monetization
Linear: ABD-234–240

Public visual product site, login/register/recovery/onboarding, package entitlements/Research Credits, payment-provider ADR, checkout/subscription/billing portal, tax/invoices/refunds/dunning, SEO/analytics/conversion. Pricing/payment remain provisional until unit economics/entity eligibility. See `docs/WEBSITE_AUTH_BILLING.md`.

## M09 — Security, Reliability, Scale & Cost Controls
Linear: ABD-224

ASVS-oriented verification, tenant/memory isolation, SSRF/network egress, prompt injection/memory poisoning/tool abuse, supply chain, queue recovery, source failures, load/performance, AI/search/API budgets, SLOs, observability, backup/restore and disaster recovery.

## M10 — Beta, Production Readiness & Launch
Linear: ABD-225

End-to-end acceptance/evals/security/compliance, migration/rollback/restore, load/cost, production config, monitoring/runbooks, retention/deletion/suppression and controlled go/no-go.

## MX — Continuous Product & Market Intelligence
Linear: ABD-231/232

Governed 24-hour research scout monitors competitors/APIs/AI techniques/client platforms/security/privacy/UX/commercial patterns and creates evidence-backed Add/Experiment/Watch/Reject proposals without auto-coding/merging. See `docs/CONTINUOUS_MARKET_INTELLIGENCE.md`.

## Cross-cutting — Parallel Multi-Agent Engineering System

This execution layer applies to **M02 and every current/future milestone**. Its purpose is to reduce calendar development time through bounded parallelism without allowing agents to overwrite each other, duplicate architecture, collide on migrations, silently widen contracts or weaken integration gates.

Canonical operating documents:

- `AGENTS.md` — mandatory startup/working instructions for every AI coding/review/integration agent;
- `docs/PARALLEL_AGENT_DEVELOPMENT.md` — full parallel-development and integration protocol;
- `.agent/ownership.yaml` — default path/module ownership;
- `.agent/shared-files.yaml` — integration-owned/high-conflict paths;
- `.agent/workstreams.yaml` — concurrency/role/workstream state contract;
- `.agent/dependencies.yaml` — dependency DAG and interface-freeze rules;
- `.agent/migrations.yaml` — serialized migration-number reservations.

### Default concurrency model

Use **6 concurrent agents** when enough independent work exists:

1. Integration / Architecture Controller;
2. Contracts / Policy Agent;
3. Database / Persistence Agent;
4. Worker / Runtime Agent;
5. Module / Connector Infrastructure Agent;
6. Verification / Security Agent.

Scale to **8** only when ownership and dependency boundaries are explicit. More than 8 requires evidence that merge-conflict rate, CI queueing, rework and integration latency remain acceptable.

### Isolation and ownership

Default invariant:

`1 agent = 1 bounded work packet = 1 isolated branch/worktree = 1 PR`

Agents stay inside declared write scopes. Public contracts/interfaces are the coordination boundary. A dependent agent may consume a frozen interface but must not silently redesign another module's internals. Shared/global files are composed by the integration owner when concurrent writers could collide.

### Dependency and migration coordination

Parallel tasks form an explicit DAG. Each work packet declares dependencies and interface-freeze SHAs/versions where applicable. Merge ordering follows the DAG, not PR creation time.

Migration identifiers are serialized resources. A migration number must be reserved in `.agent/migrations.yaml` before the migration is created. Two agents must never independently claim the same number.

### Independent verification

Implementation and adversarial verification are separate responsibilities. Verification agents test failure paths such as replay/idempotency, stale state, concurrency, tenant isolation, authorization/policy/budget bypass, migration rollback, malformed input and network/credential boundary violations. Tests/invariants are not weakened to obtain green CI.

### Agent Instruction Drift Check — mandatory every task

Every agent must check working-instruction freshness **before starting work and again before declaring completion**.

At minimum it reads/checks:

- `README.md`;
- `AGENTS.md`;
- `docs/PROJECT_PLAN.md`;
- `docs/CHECKPOINT.md`;
- `docs/PARALLEL_AGENT_DEVELOPMENT.md`;
- relevant module/ADR docs;
- `.agent/` manifests;
- current branch/head and required verification commands.

If architecture, module boundaries, workflow, ownership, shared files, migration rules, dependency order, verification commands, CI gates, security/policy boundaries, tooling or integration behavior changed, the **same change set must update the relevant agent instructions**. At minimum the agent must check/update `AGENTS.md` and `README.md`, plus the relevant policy/module/checkpoint document.

A task cannot become `READY_FOR_INTEGRATION` while its implementation makes the working instructions materially stale or misleading. If no instruction update is required, the agent handoff must explicitly record that instruction drift was checked and none was found.

### Integration gate

Before merge, require:

- exact verified head SHA;
- satisfied dependency graph or explicit stacked dependency;
- no ownership/shared-file/migration collision;
- required review resolution;
- required exact-head FAST/FULL verification;
- completed instruction/documentation drift check;
- current-base/mergeability revalidation;
- expected-head merge guard where supported.

Parallel development never authorizes production credentials, network/provider activation, unrestricted acquisition, autonomous outreach, destructive production actions or any other separately gated capability.

## Technology recommendation for ADR validation

Current hypothesis, not implementation authorization: Next.js/React/TypeScript; Tailwind/shadcn UI; NestJS modular monolith; PostgreSQL + pgvector initially; Redis/BullMQ initially with Temporal reevaluation if durable multi-day workflow complexity justifies it; Tauri 2; WXT; S3-compatible storage; OpenTelemetry; pnpm monorepo; Python only for AI/data workloads with concrete advantage.

Do not introduce OpenSearch, Temporal, Kubernetes or microservices merely because the project is AI-native.

## AI-native non-negotiables

- structured agent contracts and outputs
- evidence IDs for material AI claims
- untrusted web content is data, not instruction
- least-privilege agent tools/memory
- durable state outside model context
- independent verifier/evaluator for high-impact reasoning
- model/prompt/tool/memory versioning
- low confidence/contradictions → review
- source/cost budgets and kill switches
- no silent production self-training from feedback
- memory provenance/retention/conflict handling
- human approval for high-impact external/irreversible actions.

## Definition of Ready

A feature is READY only when behavior, data/source policy, agent/memory implications, architecture/integration, security/privacy/compliance, acceptance tests/evals, cost/budget, migration/rollback and UI failure/partial states are defined. Acquisition work additionally needs geography/taxonomy/source capability/preflight. Lead work additionally needs lifecycle/scoring/routing/compliance semantics.

For parallel work, READY additionally requires a bounded work packet with write scope, dependency declarations, shared-file impact, migration reservation when applicable, interface-freeze information and required verification/handoff criteria.

## Definition of Done

Implementation + appropriate automated tests/evals + quality/security checks + resilient failure handling + data integrity + performance/cost + observability + docs/ADRs/checkpoint + meaningful Git history + visible limitations. Otherwise PARTIALLY COMPLETE.

For agent-executed work, DONE also requires the Agent Instruction Drift Check. Any change that alters future agent working behavior must update `AGENTS.md`, `README.md` and relevant coordination/module documentation in the same change set; otherwise the task remains incomplete.

## Development authorization

Planning, research, audits, documentation and ADR preparation may proceed. Feature code, connectors, payment activation, scheduled research workflow and product implementation begin only after M00 is internally consistent, ABD-215 is explicitly approved, and the owner explicitly consents to development.