# Brovexa Project Checkpoint

Updated: 2026-09-02

## Project state

`ACTIVE_EXISTING_PROJECT`

**M01 — Platform Foundation & Developer Experience is VERIFIED / INTEGRATED. The planned provider-neutral M01A — AI Agent Runtime & Memory OS foundation is VERIFIED / INTEGRATED / IMPLEMENTATION-COMPLETE. M02 — Business Discovery & Source Connectors is ACTIVE with five bounded implementation slices FULL-GATE verified and integrated. The Supervisor-driven parallel-agent workflow and main-first onboarding are also VERIFIED / INTEGRATED.**

Current integrated `main` before this final coordination-hardening slice:

`bb6da2b0fb93e42eccfc425b25a329298df6e925`

That commit integrated PR #52 (`docs: add main-first new-agent onboarding`). PR #52 exact head `c91ef8f4a685a98cfc19320927678dbe8a1ac622` passed hosted CI run `33563538336` (#235) with all three FULL GATE lanes green: quality/security, PostgreSQL 18 + RBAC, and canonical worker + Valkey.

Latest Supervisor synchronization broadcast at this branch base is GitHub issue #50 **sync epoch 3**, pointing to `bb6da2b0fb93e42eccfc425b25a329298df6e925`.

This final governance hardening slice removes remaining repo-controlled multi-agent throughput/race risks without enabling product/provider/network capability.

## Canonical agent working instructions

- `AGENTS.md` — canonical startup/working instructions;
- `docs/PARALLEL_AGENT_DEVELOPMENT.md` — full multi-agent protocol;
- `docs/AI_NATIVE_PLAN.md` — versioned standing branch/module/static-slot plan;
- `docs/NEW_AGENT_ONBOARDING.md` — main-first onboarding;
- `.agent/slots.yaml` — static standing slot definitions only;
- `.agent/ownership.yaml` / `.agent/shared-files.yaml` — path/shared-file ownership;
- `.agent/workstreams.yaml` / `.agent/dependencies.yaml` — workstream/DAG rules;
- `.agent/migrations.yaml` — serialized migration reservations;
- `.agent/supervisor.yaml` — Supervisor onboarding/review/merge/broadcast/integration contract;
- GitHub issue **#50** — live integrated-main SHA/synchronization epoch;
- GitHub issue **#53** — live slot occupancy/assigned agent/start state;
- PR/work packet/handoff — live bounded task state;
- GitHub issue **#54** — required external native `main` branch-protection configuration;
- `pnpm run verify:parallel` — executable governance verifier.

Every agent performs the **Agent Instruction Drift Check** at task start and before completion. A task is not `READY_FOR_INTEGRATION` while future-agent instructions are materially stale.

## Multi-agent throughput hardening

### Live slot assignment no longer requires a governance PR

The earlier onboarding design stored temporary `OPEN` / `OCCUPIED` state in Git, which would serialize every new-agent assignment/release behind a governance PR and FULL GATE.

That bottleneck is removed:

- Git stores standing slot identity/branch/assignability only;
- issue #53 is the canonical live slot registry;
- issue #50 remains canonical live synchronization state;
- PR/work packet/handoff carries live task state.

Supervisor re-reads issue #53 immediately before assignment, updates agent/status/main/epoch/registry revision, then re-reads it after assignment to confirm ownership. Temporary assignment/release does not need a repository PR when standing definitions/rules are unchanged.

New agents still always start from exact current `main` and may not switch to a module branch before confirmed Supervisor assignment.

If no assignable live `OPEN` slot exists, Supervisor responds exactly:

**Go Home Come Back Next Time**

No assignment, module checkout, work packet, feature edit or implementation PR is created for that arrival.

### Completion signal is head-bound

A finished work packet announces exactly:

**Work Done and Submitted**

This means ready for Supervisor review, not automatic merge approval.

Any commit pushed after that exact signal invalidates the signal. Current handoff exact head must equal PR head; verification must be current; a fresh exact completion comment is required after a new head exists.

This closes the stale-signal race where an old completion comment could otherwise survive later code changes.

### Synchronization signal

After every approved merge, Supervisor broadcasts exactly:

**New changes have been merged — please merge these changes into your branch first, then resume your own work.**

Issue #50 remains the canonical durable synchronization ledger. Active agents sync current `main` non-destructively before resuming or submitting completion.

## Main-branch integration integrity

Audit found native GitHub `main` protection currently reports `protected: false`.

Repository-controlled mitigation in this hardening slice:

- hosted CI now runs on both pull requests and `push` to `main`;
- main-push quality lane runs `scripts/verify-main-integration-provenance.mjs`;
- the verifier queries commit-to-PR association and fails if the pushed `main` commit is not associated with a merged PR targeting `main`;
- direct pushes remain prohibited by project governance;
- normal path remains `PR → exact-head FULL GATE → expected-head merge`.

Native branch protection/ruleset is still the stronger preventive control and cannot be enabled through the available repository connector. GitHub issue **#54** tracks requiring PRs/status checks, blocking force pushes/deletion, and preventing ordinary bypass.

## Authorization boundary

M01 and provider-neutral M01A foundations are complete. M02 may continue in small reversible provider-neutral slices.

Still separately gated:

- production model/provider invocation/credentials;
- production source connector credentials/activation;
- real provider HTTP/API transport until network/SSRF/policy/credential controls are independently verified;
- payment-provider activation;
- unrestricted acquisition;
- autonomous/bulk outreach;
- Daily Market Intelligence Scout activation;
- production deployment;
- destructive production data actions;
- unresolved legal/provider/commercial decisions.

Parallelism never widens authorization.

## Default-branch integration posture

- default branch: `main`
- integrated base head: `bb6da2b0fb93e42eccfc425b25a329298df6e925`
- native branch protection at latest audit: `protected: false`
- external action: issue #54
- repository defense in depth: PR-only governance, exact-head CI, expected-head merges, main-push CI/provenance verification, no force-history rewrite bypass

`docs/DEFAULT_BRANCH_INTEGRATION_POLICY.md` remains a compensating-control reference where applicable.

## M01 verification state

### ABD-259 — monorepo foundation / executable CI

State: **VERIFIED / DONE**.

### ABD-260 — PostgreSQL migration / data layer

State: **VERIFIED / DONE**.

### ABD-261 — durable worker / queue foundation

State: **VERIFIED / DONE**.

### ABD-262 — identity / RBAC / tenant primitives

State: **VERIFIED / INTEGRATED**.

### ABD-263 — API / observability / health

State: **VERIFIED / INTEGRATED / DONE**.

### ABD-264 — M01 FULL GATE

State: **VERIFIED / DONE / INTEGRATED AND CONTINUOUSLY RE-RUN**.

Hosted FULL GATE requires quality/security, PostgreSQL 18 + RBAC, and canonical worker + Valkey lanes.

### ABD-266 — default-branch protection / compensating controls

State: **REPOSITORY COMPENSATING CONTROLS ACTIVE; NATIVE PROTECTION EXTERNAL ACTION OPEN AS ISSUE #54**.

PR integration, exact-head verification, expected-head merge, main-push CI/provenance detection and no history-rewrite bypass are repository controls. Do not claim native protection is enabled until `main` re-reads as protected.

## M01A state

**VERIFIED / INTEGRATED / IMPLEMENTATION-COMPLETE — eleven provider-neutral foundation slices.**

Production model/provider execution remains separately gated.

## M02 state

**ACTIVE — five bounded slices VERIFIED / INTEGRATED.**

1. Provider-neutral source adapter foundation — PR #39, merge `f2852d9055d55e332e0617e455901ca673f46503`.
2. Durable source registry + admission persistence — PR #41, merge `e8198d259a4ffccbebd723154e1eafd5dac5365a`.
3. Durable ResearchJob preflight + SourceTask lifecycle — PR #44, merge `ce4f43648f764aeef8e153d21cbc769ddf2bdf60`.
4. Provider-neutral SourceTask execution bridge — PR #46, merge `08b33930bb6678a23ffcc5299ae56ed4b029f1ba`.
5. Connector execution safety / durable health — PR #48, merge `bec3c6bb9fd89dd496b155b0f6087e5a8f77b223`.

Real provider transport remains intentionally absent. Production `source.execute`, provider HTTP/network and credentialed connector execution remain separately gated.

## Parallel engineering operating model

Standing branches:

- `supervisor/integration-control`
- `agent/contracts-policy`
- `agent/database-persistence`
- `agent/worker-runtime`
- `agent/module-infrastructure`
- `agent/verification-security`

Default invariant:

`1 agent = 1 bounded work packet = 1 isolated branch/worktree = 1 PR`

Default capacity target: **6**. Soft maximum: **8**, subject to healthy conflict/rework/CI metrics.

The executable coordination guard is `pnpm run verify:parallel`. It verifies static slots/branches, issue #53 live-registry authority, main-first onboarding, exact rejection phrase, Supervisor workflow, head-bound completion, synchronization rules, migration numbering and main-push provenance wiring.

## Supply-chain posture

- exact direct dependency pins;
- committed/frozen lockfile;
- pinned pnpm/Node policy;
- reviewed lifecycle-script allowlist;
- immutable GitHub Action SHAs;
- hosted CI read-only contents plus PR metadata read for provenance;
- tracked-secret gate;
- high/critical dependency advisory audit.

## Known limitations / not production verification

- native GitHub branch protection is not yet enabled; issue #54 tracks the external setting;
- no production deployment has occurred;
- no hosted DB/queue/identity/telemetry provider is activated;
- no production model/provider/source connector is activated;
- no production source-provider network transport or credentials are enabled;
- local developer working-copy/runtime/database state is unknown when work is performed through remote GitHub tooling;
- M01/M01A/M02/governance integration does not authorize payments, unrestricted acquisition, autonomous outreach or release gates.

## Next safe actions

1. Integrate this final repo-controlled multi-agent hardening through normal PR/FULL-GATE/expected-head Supervisor flow.
2. Verify the post-merge **push-to-main** CI run exercises and passes the new integration-provenance check.
3. Publish the next issue #50 synchronization epoch and sync standing branches.
4. Update issue #53 baseline main SHA/epoch/revision after all idle standing branches are synchronized.
5. Enable native `main` branch protection/ruleset per issue #54 through GitHub repository settings and re-read it as protected.
6. Start parallel M02 work using issue #53 live assignments; no temporary occupancy PR is required.
