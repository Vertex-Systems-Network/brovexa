# Brovexa Project Checkpoint

Updated: 2026-09-02

## Project state

`ACTIVE_EXISTING_PROJECT`

**M01 — Platform Foundation & Developer Experience is VERIFIED / INTEGRATED. The planned provider-neutral M01A — AI Agent Runtime & Memory OS foundation is VERIFIED / INTEGRATED / IMPLEMENTATION-COMPLETE. M02 — Business Discovery & Source Connectors is ACTIVE with five bounded implementation slices FULL-GATE verified and integrated on `main`. The permanent Supervisor-driven parallel-agent workflow is also VERIFIED / INTEGRATED.**

Current integrated `main` head at this onboarding branch base:

`c20e45e5c8c6e10aaec2a6c7354e94b4b81f87f8`

That commit integrated PR #51, the Supervisor-driven multi-agent repository workflow. PR #51 exact head `09843d0e37c7a51bab1b806365cd2c3748963c7e` passed CI run `33560463952` (#232) with all three FULL GATE lanes green: quality/security, PostgreSQL 18 + RBAC, and canonical worker + Valkey.

Latest durable Supervisor synchronization broadcast at this branch base is GitHub issue #50 **sync epoch 2**, pointing to `c20e45e5c8c6e10aaec2a6c7354e94b4b81f87f8`.

This checkpoint branch adds the next governance slice: **main-first New Agent Onboarding + Supervisor-owned module-slot occupancy**. It does not activate any product/provider/network capability.

## Canonical agent working instructions

Parallel AI-assisted development uses a permanent repository-level operating model:

- `AGENTS.md` — canonical startup/working instructions;
- `docs/PARALLEL_AGENT_DEVELOPMENT.md` — full multi-agent protocol;
- `docs/AI_NATIVE_PLAN.md` — standing branch/module plan plus durable slot occupancy;
- `docs/NEW_AGENT_ONBOARDING.md` — main-first new-agent onboarding;
- `.agent/slots.yaml` — machine-readable Supervisor-owned slot registry;
- `.agent/ownership.yaml` — path/module ownership;
- `.agent/shared-files.yaml` — high-conflict Supervisor-owned files;
- `.agent/workstreams.yaml` — branch/role/workstream contract;
- `.agent/dependencies.yaml` — dependency DAG/interface-freeze rules;
- `.agent/migrations.yaml` — serialized migration reservation state;
- `.agent/supervisor.yaml` — Supervisor onboarding/review/merge/broadcast protocol;
- `pnpm run verify:parallel` — executable governance verifier used locally and by hosted CI.

Every agent performs the **Agent Instruction Drift Check** at task start and before completion. A task is not `READY_FOR_INTEGRATION` while future-agent instructions are materially stale.

## New Agent Onboarding state

New-agent onboarding is now governed as follows:

1. every newly arriving agent starts from exact current `main`;
2. it does not begin on or edit a module branch before assignment;
3. the Supervisor reads `docs/AI_NATIVE_PLAN.md` + `.agent/slots.yaml`;
4. only assignable slots with exact status `OPEN` are eligible;
5. Supervisor serializes assignment, verifies the slot branch is synchronized to current `main`/latest epoch, records the new agent name, marks slot `OCCUPIED`, records start status and publishes the assignment before feature work;
6. a new arrival never expands capacity on demand;
7. slot release is explicit Supervisor action after no active/unmerged work remains.

If no assignable `OPEN` slot exists, the Supervisor stops onboarding and responds exactly:

**Go Home Come Back Next Time**

The rejected arrival receives no module assignment, module-branch checkout, work packet, feature edit or implementation PR.

Current durable slot board in this branch:

- `SUPERVISOR` — `OCCUPIED` by `SUPERVISOR`;
- `CONTRACTS` — `OPEN`;
- `DATABASE` — `OPEN`;
- `RUNTIME` — `OPEN`;
- `MODULE` — `OPEN`;
- `VERIFY` — `OPEN`.

## Completion and synchronization signals

A finished work packet announces exactly:

**Work Done and Submitted**

This means ready for Supervisor review, not automatic merge approval.

After every approved merge, the Supervisor broadcasts exactly:

**New changes have been merged — please merge these changes into your branch first, then resume your own work.**

GitHub issue #50 is the canonical durable synchronization channel. Active agents must sync to the latest epoch/current `main` before resuming or submitting completion.

## Authorization boundary

M01 and provider-neutral M01A foundations are complete. M02 implementation may continue in small reversible provider-neutral slices.

Still separately gated:

- production model/provider invocation and credentials;
- production source connector credentials/activation;
- real provider HTTP/API transport until network/SSRF/policy/credential controls are independently verified;
- payment-provider activation;
- unrestricted acquisition;
- autonomous/bulk outreach;
- Daily Market Intelligence Scout activation;
- production deployment;
- destructive production data actions;
- unresolved legal/provider/commercial decisions.

Parallelism/onboarding never widens authorization.

## Default-branch integration posture

- default branch: `main`
- branch-base integrated head: `c20e45e5c8c6e10aaec2a6c7354e94b4b81f87f8`
- native branch protection observed at that read as `protected: false`; repository compensating controls remain authoritative unless re-verified otherwise
- PR-based integration, exact-head CI evidence, no force-push/history rewrite bypass and expected-head merge checks remain operating discipline

`docs/DEFAULT_BRANCH_INTEGRATION_POLICY.md` remains the canonical compensating-control document.

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

The hosted FULL GATE requires quality/security, PostgreSQL 18 + RBAC, and canonical worker + Valkey lanes.

### ABD-266 — default-branch protection / compensating controls

State: **DONE VIA COMPENSATING CONTROL / NATIVE PROTECTION REQUIRES CURRENT RE-READ BEFORE CLAIMING OTHERWISE**.

PR-only integration, explicit exact-head verification, no history-rewrite bypass and expected-head merge checks remain the compensating path.

## M01A state

**VERIFIED / INTEGRATED / IMPLEMENTATION-COMPLETE — eleven provider-neutral foundation slices.**

Integrated capabilities include governed Agent/Memory/Eval contracts, persistence/lifecycle, deterministic Agent Registry + Context Builder, immutable execution planning/dispatch, specialist execution, aggregation/evaluator review and exact route-policy/privileged execution trace.

Production model/provider execution remains separately gated.

## M02 state

**ACTIVE — five bounded slices VERIFIED / INTEGRATED.**

1. Provider-neutral source adapter foundation — PR #39, merge `f2852d9055d55e332e0617e455901ca673f46503`.
2. Durable source registry + admission persistence — PR #41, merge `e8198d259a4ffccbebd723154e1eafd5dac5365a`.
3. Durable ResearchJob preflight + SourceTask lifecycle — PR #44, merge `ce4f43648f764aeef8e153d21cbc769ddf2bdf60`.
4. Provider-neutral SourceTask execution bridge — PR #46, merge `08b33930bb6678a23ffcc5299ae56ed4b029f1ba`.
5. Connector execution safety / durable health — PR #48, merge `bec3c6bb9fd89dd496b155b0f6087e5a8f77b223`.

Real provider transport remains intentionally absent. Production `source.execute` activation, provider HTTP/network and credentialed connector execution remain separately gated.

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

Default capacity target is **6**, soft maximum **8** subject to healthy metrics. Newly arriving agents consume pre-planned `OPEN` slots only; arrival itself does not increase capacity.

The executable coordination guard is `pnpm run verify:parallel`; hosted CI runs the same check before broader quality/security gates. The verifier checks slot-plan consistency, main-first onboarding, exact rejection phrase, Supervisor workflow, branch mappings, instruction drift and migration numbering.

## Supply-chain posture

- exact direct dependency pins;
- committed/frozen lockfile;
- pinned pnpm and Node policy;
- reviewed lifecycle-script allowlist;
- immutable GitHub Action SHAs;
- hosted CI `contents: read`;
- tracked-secret gate;
- high/critical dependency advisory audit.

## Known limitations / not production verification

- no production deployment has occurred;
- no hosted DB/queue/identity/telemetry provider is activated;
- no production model/provider or source connector is activated;
- no production source-provider network transport or credentials are enabled;
- native default-branch protection must be re-read before making a current claim;
- local developer working-copy/runtime/database state remains unknown when work is performed through remote GitHub tooling;
- M01/M01A/M02/governance integration does not authorize payments, unrestricted acquisition, autonomous outreach or release gates.

## Next safe actions

1. Integrate this main-first New Agent Onboarding/slot-registry slice through the normal PR/FULL-GATE/expected-head Supervisor path.
2. After merge, publish the next issue #50 synchronization epoch and synchronize standing branches before new work resumes.
3. Assign new agents only through pre-planned `OPEN` slots and update both AI-Native Plan + `.agent/slots.yaml` when occupancy changes.
4. Continue M02 through the next bounded provider/network prerequisite slice only after exact SSRF/egress/source-policy/credential/provider-activation boundaries are defined.
5. Keep production network/provider execution disabled until independently verified and integrated.
