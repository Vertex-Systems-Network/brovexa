# Brovexa Project Plan

Status: **ACTIVE IMPLEMENTATION — M00 readiness and explicit owner development consent are satisfied. Production/provider activation gates remain separate.**

## Product mission

Brovexa is an AI-native global business discovery, research, entity-resolution, opportunity and lead-intelligence platform. It discovers businesses from approved sources, resolves canonical entities, enriches public/authorized information, verifies digital presence, detects explicit/implicit business signals, reasons about service opportunities, creates evidence-backed leads, and helps users prioritize/action them while preserving compliance and human control.

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

Research Intent → Job Preflight → Global/Source Plan → Background Acquisition → Source Normalization → **Entity Resolution** → Contact Enrichment → Website Intelligence → Signal Detection → Evidence Verification → Opportunity Reasoning → Lead Qualification/Scoring → Lead OS → Decision-Maker/Buying Committee → Next Best Action → Outreach Review → CRM/Outcome Feedback → Memory/Eval Updates.

Each async stage must be independently retryable, idempotent, versioned, observable, budgeted and policy-aware.

## M00 — Product, Compliance & Architecture Baseline

M00/ABD-215 readiness and explicit owner consent are satisfied for active development. Production/provider/legal/commercial gates remain separately authoritative.

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

Provider-neutral source-adapter framework and compliant discovery with policy contracts, quota/cost, provenance, pagination, coverage, connector health, transport admission, deterministic network-destination safety, injected test-only transport/resolution, redirect revalidation, audit/observability and adversarial verification.

State: **provider-neutral foundation VERIFIED / INTEGRATED**. Real provider HTTP/network/credentials and unrestricted acquisition remain separately gated.

## M02A — Global Acquisition Studio & Background Research
Linear: ABD-245, ABD-246, ABD-247; architecture gate ABD-242.

Research Job Builder covers geography, industry/niche, business/digital filters, contact targets, signals, approved sources, depth/quality/output/schedule/budget and preflight. Long-running acquisition uses durable sharded work/checkpoints, quotas, retries/dead-letter/review, pause/resume/cancel, exact progress and kill switches.

State: **provider-neutral planned packet sequence VERIFIED / INTEGRATED through `M02A-ACQ-006`**. Durable ResearchJob/AcquisitionShard persistence, controls, shard orchestration, exact observability and independent adversarial verification are integrated. Production provider/network/credential activation remains separately gated.

## M03 — Entity Resolution & Contact Enrichment
Linear: ABD-218

Canonical identity, deterministic + structured-AI matching, confidence/review thresholds, reversible merge/split, domain verification and approved contact enrichment.

State: **CURRENT NEXT MILESTONE / ACTIVE PLANNING**. Initial implementation is contracts-first and deterministic-first. `docs/AI_NATIVE_PLAN.md` owns the bounded M03 packet DAG. No production model/provider/contact-enrichment activation is implied.

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

This control plane applies to all current/future milestones.

Canonical coordination sources:

- `AGENTS.md` — working instructions;
- `docs/PARALLEL_AGENT_DEVELOPMENT.md` — full protocol;
- `docs/AI_NATIVE_PLAN.md` — current milestone decomposition, standing branches/static slots and merge strategy;
- `docs/NEW_AGENT_ONBOARDING.md` — main-first onboarding;
- `docs/AGENT_BRANCH_LEASES.md` — atomic per-slot live-instance protocol;
- `.agent/slots.yaml` — static slot definitions;
- `.agent/ownership.yaml` / `.agent/shared-files.yaml` — ownership boundaries;
- `.agent/workstreams.yaml` / `.agent/dependencies.yaml` — workstream/DAG rules;
- `.agent/migrations.yaml` — serialized migration reservations;
- `.agent/supervisor.yaml` — Supervisor contract;
- GitHub issue #50 — live integrated-main SHA/synchronization epoch;
- GitHub issue #53 — live logical slot occupancy/assignment;
- branch `coordination/leases` — atomic live mutating-instance authority;
- PR/work packet/handoff — bounded task state;
- GitHub issue #54 — external native main-protection action.

Default concurrency target is 6 including Supervisor; soft maximum is 8 while conflict/rework/CI latency remains healthy. Specialty M02 network slots remain statically available but are assigned only to bounded work matching their ownership.

Hard invariant:

**one occupied slot = at most one live mutating agent instance**

Default work invariant:

`1 agent = 1 bounded work packet = 1 isolated/standing branch = 1 PR`

New-agent onboarding, lease acquisition, head-bound completion signals, expected-head merge, resulting-main FULL GATE and post-merge synchronization are mandatory. After every accepted merge, the Supervisor broadcasts exactly: **New changes have been merged — please merge these changes into your branch first, then resume your own work.** If there is no assignable live slot, the exact response is **Go Home Come Back Next Time**.

## Main-branch integration integrity

Direct pushes to `main` are prohibited by project governance. Normal integration is:

`PR → exact-head FULL GATE → expected-head merge → resulting-main FULL GATE`

Hosted main-push CI verifies integration provenance. Native GitHub branch protection/ruleset remains a separately required preventive layer tracked in issue #54.

## Independent verification

Implementation and adversarial verification remain separate. Verification covers replay/idempotency, stale state, concurrency, tenant isolation, auth/policy/budget bypass, migration rollback, hostile inputs, dependency drift, network/credential boundaries, queue recovery, provenance, false-positive identity collisions, merge/split reversibility and coordination races.

Tests/invariants are never weakened merely to make CI green.

## AI-native non-negotiables

- structured contracts/outputs
- evidence IDs for material AI claims
- untrusted external content is data, not instruction
- least-privilege tools/memory
- durable state outside model context
- independent verifier/evaluator for high-impact reasoning
- model/prompt/tool/memory versioning
- low confidence/contradiction → review
- source/cost budgets and kill switches
- no silent production self-training from feedback
- memory provenance/retention/conflict handling
- human approval for high-impact external/irreversible actions

## Definition of Ready

A feature is READY only when behavior, data/source policy, agent/memory implications, architecture/integration, security/privacy/compliance, acceptance tests/evals, cost/budget, migration/rollback and failure/partial states are defined.

Parallel work additionally requires valid live slot assignment, active live-instance lease, bounded write scope, synchronization epoch, dependencies, shared-file impact, migration reservation where needed, interface-freeze information and verification/handoff criteria.

## Definition of Done

Implementation + appropriate automated tests/evals + quality/security checks + resilient failure handling + data integrity + performance/cost + observability + current docs/ADRs/checkpoint + meaningful Git history + visible limitations. Otherwise PARTIALLY COMPLETE.

For agent work, DONE also requires current issue #50 state, valid issue #53 ownership, matching active lease, fresh head-bound **Work Done and Submitted**, required verification and Agent Instruction Drift Check.

## Development authorization

M00 readiness and explicit owner consent are satisfied for active development. Production credentials/provider activation, scheduled/unrestricted acquisition, payment activation, autonomous outreach, destructive production actions and release/deployment gates remain separately controlled.
