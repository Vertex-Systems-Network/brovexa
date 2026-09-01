# Brovexa Project Plan

Status: **ACTIVE IMPLEMENTATION — M00/ABD-215 readiness and explicit owner development consent are satisfied. Production/provider activation gates remain separate.**

## Product mission

Brovexa is an AI-native global business discovery, research, opportunity and lead-intelligence platform. It discovers businesses from approved sources, resolves canonical entities, enriches public/authorized information, verifies digital presence, detects explicit/implicit business signals, reasons about service opportunities, creates evidence-backed leads, and helps users prioritize/action them while preserving compliance and human control.

Brovexa is source-agnostic and must not depend on unrestricted copying of any one provider dataset.

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

## Canonical intelligence pipeline

Research Intent → Job Preflight → Global/Source Plan → Background Acquisition → Source Normalization → Entity Resolution → Contact Enrichment → Website Intelligence → Signal Detection → Evidence Verification → Opportunity Reasoning → Lead Qualification/Scoring → Lead OS → Decision-Maker/Buying Committee → Next Best Action → Outreach Review → CRM/Outcome Feedback → Memory/Eval Updates.

Each async stage must be independently retryable, idempotent, versioned, observable, budgeted and policy-aware.

## M00 — Product, Compliance & Architecture Baseline

M00/ABD-215 readiness and explicit owner consent are satisfied for active development. Production/provider/legal/commercial gates remain separately authoritative.

Core baseline includes product scope, source/privacy/outreach policy, canonical data/evidence schemas, AI contracts/evals, threat model, architecture/deployment/queues/storage/cost, client surfaces, AI Agent OS/memory, global acquisition, lead OS, universal signals, website/auth/billing and launch readiness.

## M01 — Platform Foundation & Developer Experience
Linear: ABD-216

Repository/runtime foundation, environments/secrets, PostgreSQL migrations, API conventions, auth/RBAC/tenant primitives, queue/worker foundation, test/eval harness, CI/security gates, observability, health checks, ADRs/runbooks/checkpoints.

State: **VERIFIED / INTEGRATED**.

## M01A — AI Agent Runtime & Memory OS
Linear: ABD-244; architecture gate ABD-241.

Governed Agent Registry, planner/orchestrator, Context Builder, specialist workers, verifier/evaluator separation, model routing, tool permissions, budgets, pause/resume/review, durable checkpoints and provenance-aware memory.

State: **provider-neutral foundation VERIFIED / INTEGRATED / IMPLEMENTATION-COMPLETE**. Production model/provider execution remains separately gated.

## M02 — Business Discovery & Source Connectors
Linear: ABD-217

Provider-neutral source-adapter framework and compliant discovery with policy contracts, quota/cost, provenance, pagination, coverage and connector health.

State: **ACTIVE — five bounded slices VERIFIED / INTEGRATED**: source contracts/admission, registry persistence, SourceTask preflight/lifecycle, no-network execution bridge, and execution-time connector policy/health/quota safety.

Real provider HTTP/network/credential execution remains separately gated.

## M02A — Global Acquisition Studio & Background Research
Linear: ABD-245, ABD-246, ABD-247; architecture gate ABD-242.

Research Job Builder covers geography, industry/niche, business/digital filters, contact targets, signals, approved sources, depth/quality/output/schedule/budget and preflight. Long-running acquisition uses durable sharded work/checkpoints, quotas, retries/dead-letter/review, pause/resume/cancel, exact progress and kill switches.

## M03 — Entity Resolution & Contact Enrichment
Linear: ABD-218

Canonical identity, deterministic + structured AI matching, confidence/review thresholds, reversible merge/split, domain verification and approved contact enrichment.

## M04 — Website & Digital Presence Intelligence
Linear: ABD-219

Verify websites and classify digital capabilities/gaps through bounded SSRF-safe acquisition with evidence and uncertainty.

## M05 — Demand, Intent & Opportunity Signals
Linear: ABD-220; ontology gate ABD-248.

Versioned signal ontology with explicit observations, evidence, confidence, freshness/decay, negative evidence and rule/model versions. Explicit demand remains distinct from inferred need.

## M06 — BPO Intelligence, Scoring & Explainability
Linear: ABD-221

Map verified signals to configurable opportunities with transparent fit/intent/urgency/value/reachability/evidence/freshness/compliance components and explainable reason codes.

## M06A — Lead Intelligence Operating System
Linear: ABD-249, ABD-250, ABD-251; model gate ABD-243.

Canonical Account/Business, Location, Contact, Evidence, Signal, Opportunity, Lead and Deal distinctions; qualification/scoring/routing/tasks/SLAs/nurture/buying committee/next-best-action/attribution/bulk safety and provider-neutral CRM sync.

## M07 — Outreach Strategy, CRM & Compliance Controls
Linear: ABD-222

Grounded outreach drafting, human review, suppression/opt-out, channel/jurisdiction rules, duplicate prevention and outcome feedback. Initial release remains human-approval-first.

## M08 — Dashboard, Search, Workflows & APIs
Linear: ABD-223

Operator UI for command center, acquisition, research jobs, business/evidence/signal/opportunity/lead surfaces, outreach review, CRM/pipeline, Agent Center, Memory Inspector, compliance, AI quality/evals, usage/cost, team/roles and settings.

## M08A — Desktop & Browser Clients
Linear: ABD-227–230

Windows-first Tauri desktop candidate and shared Chrome/Firefox extension candidate using canonical backend contracts, secure auth/deep links, evidence capture, notifications and capability negotiation.

## M08B — Public Website, Identity & Monetization
Linear: ABD-234–240

Public product site, auth/onboarding, package entitlements/Research Credits, payment-provider ADR, checkout/subscription/billing, tax/invoice/refund/dunning and SEO/analytics/conversion.

## M09 — Security, Reliability, Scale & Cost Controls
Linear: ABD-224

ASVS-oriented verification, tenant/memory isolation, SSRF/network egress, prompt injection/memory poisoning/tool abuse, supply chain, queue recovery, source failure, load/performance, budgets, SLOs, observability, backup/restore and DR.

## M10 — Beta, Production Readiness & Launch
Linear: ABD-225

End-to-end acceptance/evals/security/compliance, migration/rollback/restore, load/cost, production config, monitoring/runbooks, retention/deletion/suppression and controlled go/no-go.

## MX — Continuous Product & Market Intelligence
Linear: ABD-231/232

Governed research scout can create evidence-backed Add/Experiment/Watch/Reject proposals without auto-coding/merging. Activation remains separately controlled.

## Cross-cutting — Parallel Multi-Agent Engineering System

This control plane applies to **M02 and all current/future milestones**. It is designed to increase calendar throughput without agents overwriting one another, double-claiming work, colliding on migrations, submitting stale heads or bypassing integration gates.

### Canonical coordination sources

- `AGENTS.md` — working instructions;
- `docs/PARALLEL_AGENT_DEVELOPMENT.md` — full protocol;
- `docs/AI_NATIVE_PLAN.md` — versioned standing branches/modules/static slot definitions/merge strategy;
- `docs/NEW_AGENT_ONBOARDING.md` — main-first onboarding;
- `.agent/slots.yaml` — static slot definitions only;
- `.agent/ownership.yaml` / `.agent/shared-files.yaml` — write/shared ownership;
- `.agent/workstreams.yaml` / `.agent/dependencies.yaml` — workstream/DAG rules;
- `.agent/migrations.yaml` — serialized migration reservations;
- `.agent/supervisor.yaml` — Supervisor workflow contract;
- GitHub issue **#50** — live integrated-main SHA/synchronization epoch;
- GitHub issue **#53** — live slot occupancy/assigned agent/start state;
- PR/work packet/handoff — live bounded task state;
- GitHub issue **#54** — external native `main` branch-protection action.

### Supervisor model

The Main-repository agent is the **Supervisor**. It owns onboarding, live slot assignment/release, dependency/interface coordination, shared-file integration, migration ordering, exact-head PR review/merge, synchronization broadcasts and its own bounded `supervisor/integration-control` work.

For new capacity, branches are created **before** new slots are added to the versioned plan. A new agent never creates capacity merely by arriving.

### Default concurrency

Use **6 concurrent agents** when enough independent work exists:

1. Supervisor / Integration Architecture
2. Contracts / Policy
3. Database / Persistence
4. Worker / Runtime
5. Module / Connector Infrastructure
6. Verification / Security

Soft maximum: **8**, only while conflict/rework/CI latency metrics remain healthy.

### New Agent Onboarding

A new agent always starts from exact current `main`. It must not start feature work or switch to a standing module branch before Supervisor assignment.

Standing slots are defined in `.agent/slots.yaml`; live `OPEN` / `OCCUPIED` is issue #53.

Assignment transaction:

1. read current `main` and latest issue #50 epoch;
2. re-read issue #53 immediately before assignment;
3. select a statically assignable live `OPEN` slot;
4. synchronize/fast-forward its idle branch to current `main`;
5. update issue #53 with `OCCUPIED`, agent/start/main/epoch and incremented registry revision;
6. re-read issue #53 to confirm ownership;
7. only then hand the branch/work packet to the agent.

Temporary assignment/release **does not require a governance PR** when standing definitions/rules are unchanged. This removes a major startup serialization bottleneck.

If no assignable live slot is `OPEN`, Supervisor responds exactly:

**Go Home Come Back Next Time**

The rejected arrival receives no assignment, branch checkout, work packet, feature changes or implementation PR.

### Isolation, ownership and dependencies

Default invariant:

`1 agent = 1 bounded work packet = 1 isolated branch/worktree = 1 PR`

Agents stay inside declared write scopes. Public contracts/interfaces are coordination boundaries. Shared files are Supervisor-composed. Tasks form an explicit DAG.

Default dependency priority when all layers are required:

`contracts/policy → DB/persistence → module infrastructure → worker/runtime → verification changes → Supervisor integration`

Independent nodes may proceed/merge earlier when they genuinely have no dependency/interface/migration/ownership/shared-file collision.

Migration numbers must be reserved in `.agent/migrations.yaml` before creation.

### Completion signal and stale-head protection

A completed work packet announces exactly:

**Work Done and Submitted**

For non-Supervisor agents this is a top-level PR comment whose full body is exactly that phrase. It means `READY_FOR_SUPERVISOR_REVIEW`, not automatic approval.

The signal is **head-bound**. PR body/handoff exact head must equal current PR head, and the latest exact completion comment must postdate the current head commit. Any later commit invalidates the signal and requires re-verification + a fresh announcement.

A valid submission also requires current issue #53 slot ownership and latest issue #50 synchronization state.

### Supervisor review / merge / synchronization

Supervisor serializes overlapping merges, uses FIFO review subject to dependency priority, requires exact-head verification, and merges approved PRs using expected-head protection.

After every approved merge it broadcasts exactly:

**New changes have been merged — please merge these changes into your branch first, then resume your own work.**

Issue #50 carries resulting `main` SHA and monotonic `sync_epoch`. Active agents pause, synchronize non-destructively, rerun minimum verification, record new SHA/epoch, then resume.

### Main-branch integration integrity

Direct pushes to `main` are prohibited. Normal integration is:

`PR → exact-head FULL GATE → expected-head merge`

Hosted CI runs on pull requests and `push` to `main`. Main pushes execute `scripts/verify-main-integration-provenance.mjs`, which fails if the main commit is not associated with a merged PR targeting `main`.

Native GitHub branch protection/ruleset is still required as the preventive layer. Current audit found `main` unprotected; issue #54 tracks requiring PR/status checks and disabling force pushes/deletions. Repository provenance CI is defense in depth, not a substitute.

### Independent verification

Implementation and adversarial verification remain separate. Verification covers replay/idempotency, stale state, concurrency, tenant isolation, auth/policy/budget bypass, migration rollback, hostile inputs, dependency drift, network/credential boundaries and queue recovery.

Tests/invariants are not weakened merely to get green CI.

### Agent Instruction Drift Check — mandatory every task

Every agent performs the **Agent Instruction Drift Check** at task start and before completion. Check README, AGENTS, this plan, checkpoint, parallel/onboarding docs, `.agent/` manifests, issue #50, issue #53, relevant module/ADR docs, current `main`, own branch/head and verification commands.

If architecture, modules, slot definitions/live-state authority, Supervisor behavior, branch workflow, completion-signal freshness, synchronization, ownership, migrations, dependencies, CI/integration integrity, security/policy boundaries or tooling change, update relevant instructions in the same change set.

A task cannot become `READY_FOR_INTEGRATION` while future-agent instructions are materially stale.

### Integration gate

Before merge require:

- exact current head SHA and fresh completion signal;
- valid issue #53 slot ownership;
- latest issue #50 synchronization;
- satisfied dependency graph;
- no ownership/shared-file/migration collision;
- resolved review threads;
- `pnpm run verify:parallel` PASS;
- required exact-head FAST/FULL verification;
- completed instruction-drift check;
- current-base/mergeability revalidation;
- expected-head merge guard.

Parallel development never authorizes production credentials, provider/network activation, unrestricted acquisition, autonomous outreach, destructive production actions or any separately gated capability.

## Technology recommendation for ADR validation

Current hypothesis, not blanket implementation authorization: Next.js/React/TypeScript; Tailwind/shadcn UI; NestJS modular monolith; PostgreSQL + pgvector initially; Redis/BullMQ initially with Temporal reevaluation if durable multi-day workflow complexity justifies it; Tauri 2; WXT; S3-compatible storage; OpenTelemetry; pnpm monorepo; Python only where it has concrete AI/data advantage.

Do not introduce OpenSearch, Temporal, Kubernetes or microservices merely because the project is AI-native.

## AI-native non-negotiables

- structured agent contracts/outputs
- evidence IDs for material AI claims
- untrusted external content is data, not instruction
- least-privilege agent tools/memory
- durable state outside model context
- independent verifier/evaluator for high-impact reasoning
- model/prompt/tool/memory versioning
- low confidence/contradiction → review
- source/cost budgets and kill switches
- no silent production self-training from feedback
- memory provenance/retention/conflict handling
- human approval for high-impact external/irreversible actions

## Definition of Ready

A feature is READY only when behavior, data/source policy, agent/memory implications, architecture/integration, security/privacy/compliance, acceptance tests/evals, cost/budget, migration/rollback and UI failure/partial states are defined.

Parallel work additionally requires a valid live slot assignment, bounded work packet, branch/write scope, synchronization epoch, dependencies, shared-file impact, migration reservation where needed, interface-freeze information and verification/handoff criteria.

## Definition of Done

Implementation + appropriate automated tests/evals + quality/security checks + resilient failure handling + data integrity + performance/cost + observability + docs/ADRs/checkpoint + meaningful Git history + visible limitations. Otherwise PARTIALLY COMPLETE.

For agent work, DONE also requires a current issue #50 epoch, valid issue #53 slot ownership, fresh head-bound **Work Done and Submitted**, required verification and Agent Instruction Drift Check.

## Development authorization

M00/ABD-215 readiness and explicit owner consent are satisfied for active development. Production credentials/provider activation, scheduled/unrestricted acquisition, payment activation, autonomous outreach, destructive production actions and release/deployment gates remain separately controlled.
