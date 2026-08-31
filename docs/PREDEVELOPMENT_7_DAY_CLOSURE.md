# Brovexa — 7-Day Pre-Development Closure Plan

Status: **Planning Only — not development authorization**

Window: **2026-08-30 through 2026-09-05**

## Objective
Close the M00 pre-development baseline quickly without hiding unresolved decisions or losing traceability. The seven-day target is for planning/readiness closure, not full production implementation.

## Speed model
Run independent research/document tracks in parallel, but preserve one dependency graph and one canonical set of decisions. Time-box research once current official evidence is sufficient for a reversible decision. Unknowns become explicit Human Decision / Deferred / Blocker entries rather than disappearing.

## Day 1 — Aug 30 — Scope & source truth
Linear: ABD-209, ABD-210, ABD-242, ABD-248.

Lock launch personas/jobs/non-goals, configurable service taxonomy, source/compliance matrix framework, global geography/taxonomy/job-builder contract and universal signal/opportunity ontology. Start decision register and completeness matrix.

## Day 2 — Aug 31 — Data, memory & Lead OS
Linear: ABD-211, ABD-241, ABD-243, ABD-251.

Finalize canonical entity/relationship/state model, evidence/provenance/history/retention, Agent OS + durable memory contract, Lead/Deal lifecycle and CRM/import ownership/conflict semantics.

## Day 3 — Sep 1 — AI, security & identity
Linear: ABD-212, ABD-213, ABD-226, ABD-235.

Finalize agent/tool/memory/autonomy contracts and eval thresholds; threat model; Web/Desktop/Chrome/Firefox trust/session/deep-link boundaries; auth/register/forgot/reset/verification/workspace/onboarding state machines.

## Day 4 — Sep 2 — Architecture & execution
Linear: ABD-214, ABD-233, ABD-231 plus source/background-execution architecture dependencies.

Lock modular topology, durable ResearchJob/AgentRun/checkpoint behavior, queue/workflow thresholds, storage/search/vector/observability/backup/rollback, source router/quota/budget/fan-out, client technology contracts and 24-hour research scout specification.

## Day 5 — Sep 3 — Commercial & public product
Linear: ABD-234, ABD-236, ABD-237, ABD-238, ABD-239, ABD-240.

Finalize public website/product IA and visual truth rules; package/entitlement/Research Credit model; unit-economics assumptions; payment-provider ADR inputs; checkout/subscription/billing/refund/dunning/tax states; SEO/analytics/attribution/privacy contracts.

## Day 6 — Sep 4 — Exhaustive completeness & traceability
Linear: ABD-252.

Every capability/option is traced through:

User → Surface → Input → Preconditions → Source/Agent → Canonical Data → State Transition → Permission → Cost/Budget → Compliance → Failure/Recovery → Tests/Evals → Issue/Document → Build/Defer/Reject.

No meaningful capability may exist only in chat history. No UI option may lack a backend contract. No state transition may lack permissions/audit/recovery/testing semantics.

## Day 7 — Sep 5 — Adversarial audit & freeze
Linear: ABD-253, then ABD-215.

Run final contradiction/omission/readiness audit. Produce explicit buckets:
- VERIFIED READY
- HUMAN DECISION
- KNOWN DEFERRED
- BLOCKER

Freeze/version planning only after contradictions are resolved or explicitly accepted. Ask the owner for development consent only if no unaccepted blocker remains.

## Daily quality gate
A day is not considered closed merely because prose exists. Daily checkpoint requires:
1. durable decisions written to GitHub/Linear;
2. contradictions resolved or logged;
3. dependencies/readiness gates updated;
4. failure/edge/security/compliance implications captured;
5. GitHub↔Linear state reconciled;
6. next critical path identified.

## Scope control
Launch scope and future extensibility are separate. Brovexa uses adapter/ontology/schema extension points for future sources, signals and markets; the plan must not pretend that every future internet source can be enumerated today.

## Authorization
This fast-track plan does **not** authorize source connector execution, product code, payment activation, autonomous outreach, the 24-hour GitHub research workflow, or merges to `main`. `ABD-215` and explicit owner development consent remain mandatory.