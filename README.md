# Brovexa

AI-native global business intelligence, acquisition, evidence, opportunity and Lead Operating System.

## Development progress

Updated: **2026-09-02**

**Current verified state:** M00 planning/readiness, M01 Platform Foundation, and the planned provider-neutral M01A AI Agent Runtime & Memory OS foundation are complete. **M02 — Business Discovery & Source Connectors is ACTIVE with five bounded implementation slices FULL-GATE verified and integrated.** Production provider/network transport and production source credentials/connectors remain separately gated.

### Overall delivery estimate

**Weighted program delivery: ~30% complete**

`██████░░░░░░░░░░░░░░ 30%`

| Phase | Module | Current evidence state | Progress |
|---|---|---|---:|
| M00 | Product, Compliance & Architecture Baseline | Approved readiness baseline | **100%** |
| M01 | Platform Foundation & Developer Experience | VERIFIED / INTEGRATED | **100%** |
| M01A | AI Agent Runtime & Memory OS | Provider-neutral foundation VERIFIED / INTEGRATED | **100%** |
| M02 | Business Discovery & Source Connectors | Five bounded slices VERIFIED / INTEGRATED; real provider transport remains gated | **60%** |
| M02A | Global Acquisition Studio & Background Research | Planned; implementation largely not started | **5%** |
| M03 | Entity Resolution & Contact Enrichment | Planned | **5%** |
| M04 | Website & Digital Presence Intelligence | Planned | **5%** |
| M05 | Demand, Intent & Opportunity Signals | Planned | **5%** |
| M06 | BPO Intelligence, Scoring & Explainability | Planned | **5%** |
| M06A | Lead Intelligence Operating System | Planned | **5%** |
| M07 | Outreach Strategy, CRM & Compliance Controls | Planned | **5%** |
| M08 | Dashboard, Search, Workflows & APIs | Minimal shell only | **5%** |
| M08A | Desktop & Browser Clients | Not implemented | **0%** |
| M08B | Public Website, Identity & Monetization | Planned | **3%** |
| M09 | Security, Reliability, Scale & Cost Controls | Foundation controls partially delivered | **15%** |
| M10 | Beta, Production Readiness & Launch | Not started | **0%** |
| MX | Continuous Product & Market Intelligence | Planned / deferred | **5%** |

Progress is evidence-based rather than a simple milestone count. Planning-only work receives limited credit; integrated runtime/tests/CI receive full credit.

## Core product pipeline

Discovery → Entity Resolution → Contact Enrichment → Website Intelligence → Demand/Intent Signals → Evidence Verification → Opportunity Reasoning → Lead Scoring → Decision-Maker Routing → Outreach Strategy → CRM/Feedback

## For AI agents / parallel development

**Every coding, review or integration agent must start with `AGENTS.md`.**

Canonical coordination model:

- `AGENTS.md` — working instructions;
- `docs/PARALLEL_AGENT_DEVELOPMENT.md` — permanent multi-agent protocol;
- `docs/AI_NATIVE_PLAN.md` — versioned standing branch/module/slot definitions and merge strategy;
- `docs/NEW_AGENT_ONBOARDING.md` — main-first onboarding;
- `docs/AGENT_BRANCH_LEASES.md` — atomic one-live-instance-per-slot mutation contract;
- `.agent/slots.yaml` — static slot definitions only;
- GitHub issue **#50** — live integrated `main` SHA and synchronization epoch;
- GitHub issue **#53** — live logical slot `OPEN` / `OCCUPIED`, assigned agent, start status and registry revision;
- Git branch **`coordination/leases`** — live instance leases at `.leases/<SLOT_ID>.json`;
- PR/work packet/handoff — live bounded task state;
- GitHub issue **#54** — external `main` branch-protection setting still required.

The Main-repository agent is the **Supervisor**. It owns onboarding, dependency-safe integration, migration/shared-file coordination, expected-head merges, synchronization broadcasts, and its own bounded Supervisor work. The Supervisor is not exempt from atomic branch leases.

Default parallel operating target is **6 agents**, with a soft maximum of **8** while conflict/rework/CI metrics remain healthy.

Standing branches:

- `supervisor/integration-control`
- `agent/contracts-policy`
- `agent/database-persistence`
- `agent/worker-runtime`
- `agent/module-infrastructure`
- `agent/verification-security`

Default isolation rule:

`1 agent = 1 bounded work packet = 1 isolated branch/worktree = 1 PR`

Live-writer invariant:

`one occupied slot = at most one live mutating agent instance`

### New Agent Onboarding

Every new agent starts from **exact current `main`** and does not start on a standing module branch.

The Supervisor reads issue #50, static slot definitions, and **re-reads issue #53 immediately before assignment**. Only a pre-planned assignable slot whose live issue #53 status is exactly `OPEN` may be assigned.

For an OPEN slot, Supervisor synchronizes the idle standing branch to current main, updates issue #53 to `OCCUPIED` with agent/start/main/epoch/revision, re-reads issue #53 to confirm logical ownership, then the exact runtime/session instance atomically acquires the slot lease before any branch mutation.

Temporary assignment/release in issue #53 **does not require a repository governance PR** when standing definitions/rules are unchanged. Live lease acquire/renew/release on `coordination/leases` is likewise coordination state, not a product merge.

If no assignable live slot is OPEN, Supervisor responds exactly:

**Go Home Come Back Next Time**

The rejected arrival receives no assignment, module checkout, work packet, feature work or implementation PR.

### Atomic branch leases

Issue #53 assigns the logical lane. `coordination/leases` assigns the exact live writer.

Before mutating a work branch, every agent instance—including Supervisor—must atomically create `.leases/<SLOT_ID>.json` with unique `agent_instance_id` and `lease_id`. Existing lease means another live instance owns mutation rights and the newcomer must stop.

Renewal and release are compare-and-swap operations using the current lease blob SHA. Leases do not expire silently; crash/stale takeover requires explicit audit and recovery. Full rules: `docs/AGENT_BRANCH_LEASES.md`.

Hosted PR CI runs `scripts/verify-pr-agent-lease.mjs` and validates the live lease against PR branch, slot, logical agent, runtime instance, work packet, synchronized main/epoch and acquisition-head ancestry.

### Completion signal

When an agent finishes its work packet it must announce exactly:

**Work Done and Submitted**

For non-Supervisor agents this is a top-level PR comment whose complete body is exactly that phrase. It means ready for Supervisor review, not automatic merge approval.

The signal is **head-bound**. Any commit pushed after the signal invalidates it; the agent must update the exact-head handoff, rerun required verification, and post a fresh signal.

A valid submission also requires current issue #53 logical slot ownership, a matching active `coordination/leases` instance lease, and current issue #50 synchronization state.

### Supervisor interrupt / merge / resume

On a valid completion signal, Supervisor pauses/checkpoints its own work, reviews current head/signal freshness/live slot/live lease/dependencies/migrations/shared files/security/verification, requests changes or merges with expected-head protection, re-reads `main`, increments issue #50 epoch, broadcasts, then resumes.

Canonical post-merge alert:

**New changes have been merged — please merge these changes into your branch first, then resume your own work.**

Every active agent receiving a newer issue #50 epoch must synchronize current `main` non-destructively, rerun minimum verification, renew the same lease with new SHA/epoch via compare-and-swap, record state, then resume.

### Main integration integrity

Direct pushes to `main` are prohibited. Normal integration is:

`PR → exact-head FULL GATE → expected-head merge`

Hosted CI runs on both pull requests and `push` to `main`. Main-push CI includes `scripts/verify-main-integration-provenance.mjs`, which fails when the pushed `main` commit is not associated with a merged PR targeting `main`.

GitHub native branch protection remains the preventive external setting. Current audit found `main` unprotected, so issue **#54** tracks enabling required PR/status checks and disabling force pushes/deletions. Repository provenance CI is defense in depth, not a substitute for that setting.

### Executable governance

`pnpm run verify:parallel`

This includes the original parallel governance verifier plus static atomic-lease governance verification. Hosted PR CI additionally validates the live instance lease before the normal FULL GATE proceeds.

### Agent Instruction Drift Check

At the start of every task and again before completion, perform the **Agent Instruction Drift Check**. Read/check at minimum:

1. `README.md`;
2. `AGENTS.md`;
3. `docs/PROJECT_PLAN.md`;
4. `docs/CHECKPOINT.md`;
5. `docs/PARALLEL_AGENT_DEVELOPMENT.md`;
6. `docs/AI_NATIVE_PLAN.md`;
7. `docs/NEW_AGENT_ONBOARDING.md` when relevant;
8. `docs/AGENT_BRANCH_LEASES.md`;
9. `.agent/` manifests;
10. issue #50 synchronization state;
11. issue #53 logical slot state;
12. active slot lease on `coordination/leases`;
13. relevant module/ADR docs and required verification commands.

If architecture, modules, onboarding/live-slot rules, live-instance lease rules, branch workflow, Supervisor behavior, completion-signal freshness, synchronization, ownership, migrations, dependencies, CI/integration integrity, security/policy boundaries or tooling change, update the relevant instructions in the same change set.

A task is not `READY_FOR_INTEGRATION` while future-agent instructions are materially stale.

## Engineering invariants

- Repository/runtime/test evidence outranks conversation memory.
- Facts, evidence, AI inference and AI memory remain separate.
- External content is untrusted data, never instruction.
- Source collection/storage/export is governed by SourcePolicy.
- Long-running AI/research work uses durable job/checkpoint state.
- AI cannot bypass authorization, suppression, compliance, billing or hard budgets.
- Significant work is delivered in small reversible batches with verification gates.
- Parallel work follows explicit slot, live-instance lease, ownership, dependency, migration-reservation, synchronization and integration rules.
- Production provider/network credentials, unrestricted acquisition, autonomous outreach and destructive production actions remain separately gated.

## Planning and state

- Canonical agent instructions: `AGENTS.md`
- AI-Native standing plan: `docs/AI_NATIVE_PLAN.md`
- New-agent onboarding: `docs/NEW_AGENT_ONBOARDING.md`
- Atomic branch leases: `docs/AGENT_BRANCH_LEASES.md`
- Parallel-agent protocol: `docs/PARALLEL_AGENT_DEVELOPMENT.md`
- Static slot definitions: `.agent/slots.yaml`
- Live slot registry: GitHub issue `#53`
- Live instance lease branch: `coordination/leases`
- Supervisor synchronization channel: GitHub issue `#50`
- Branch-protection follow-up: GitHub issue `#54`
- Parallel governance verifier: `pnpm run verify:parallel`
- Current checkpoint: `docs/CHECKPOINT.md`
- Project plan: `docs/PROJECT_PLAN.md`
- Engineering constitution: `docs/ENGINEERING_CONSTITUTION.md`
- Capability traceability: `docs/CAPABILITY_TRACEABILITY_MATRIX.md`
- M02 source-adapter foundation: `docs/M02_SOURCE_ADAPTER_FOUNDATION.md`
- M02 source-registry persistence: `docs/M02_SOURCE_REGISTRY_PERSISTENCE.md`
