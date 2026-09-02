# Brovexa Project Checkpoint

Updated: 2026-09-03

## Project state

`ACTIVE_EXISTING_PROJECT`

**M01 — Platform Foundation & Developer Experience is VERIFIED / INTEGRATED. M01A — AI Agent Runtime & Memory OS provider-neutral foundation is VERIFIED / INTEGRATED / IMPLEMENTATION-COMPLETE. M02 — Business Discovery & Source Connectors is ACTIVE with five bounded provider-neutral implementation slices FULL-GATE verified and integrated. The Supervisor-driven multi-agent workflow, main-first onboarding, live slot registry, head-bound completion signals, main-push provenance controls and atomic live-instance branch leases are integrated.**

Current integrated `main`:

`baa79779db608823f5d9696ebf8e7dda8db6d6ef`

This is the merge result of PR #56 (`chore(agent): enforce atomic live-instance branch leases`). Its post-merge push-to-main CI run `33607121538` (#243) completed successfully with the repository FULL GATE and main-integration provenance controls active.

Latest canonical Supervisor synchronization state is GitHub issue #50 **sync epoch 5**, pointing to `baa79779db608823f5d9696ebf8e7dda8db6d6ef`.

Issue #53 is aligned to the same main SHA / epoch. The five assignable standing module slots are `OPEN`; the `SUPERVISOR` logical slot remains `OCCUPIED` by `SUPERVISOR`. Exact live mutation authority is independently controlled through per-slot lease files on `coordination/leases`.

## Canonical agent working instructions

- `AGENTS.md` — canonical startup / working instructions;
- `docs/PARALLEL_AGENT_DEVELOPMENT.md` — complete multi-agent protocol;
- `docs/AI_NATIVE_PLAN.md` — versioned standing branch/module/static-slot plan;
- `docs/NEW_AGENT_ONBOARDING.md` — main-first onboarding;
- `docs/AGENT_BRANCH_LEASES.md` — atomic per-slot live mutating-instance protocol;
- `.agent/slots.yaml` — static standing slot definitions only;
- `.agent/ownership.yaml` / `.agent/shared-files.yaml` — path/shared-file ownership;
- `.agent/workstreams.yaml` / `.agent/dependencies.yaml` — workstream DAG and lease metadata rules;
- `.agent/migrations.yaml` — serialized migration reservations;
- `.agent/supervisor.yaml` — Supervisor onboarding/review/merge/broadcast/lease contract;
- GitHub issue **#50** — canonical integrated-main SHA / synchronization epoch;
- GitHub issue **#53** — canonical logical slot occupancy / assignment state;
- branch `coordination/leases` — exact live mutating-instance authority;
- PR/work packet/handoff — bounded task state;
- GitHub issue **#54** — required external native `main` branch-protection configuration;
- `pnpm run verify:parallel` — executable governance verifier.

Every agent performs the **Agent Instruction Drift Check** at task start and before completion. A task is not `READY_FOR_INTEGRATION` while future-agent instructions are materially stale.

## Multi-agent integration state

### Live slot assignment

Temporary `OPEN` / `OCCUPIED` state is not stored in Git. Issue #53 is the canonical live logical slot registry. New agents start from exact current `main`; the Supervisor re-reads issue #53 immediately before assignment, synchronizes the selected idle standing branch, updates assignment state and registry revision, re-reads it, then the assigned live instance acquires the slot lease.

If no assignable live `OPEN` slot exists, Supervisor responds exactly:

**Go Home Come Back Next Time**

No assignment, branch checkout, work packet, feature mutation or implementation PR is created for that arrival.

### Atomic live-instance branch leases

Hard invariant:

**one occupied slot = at most one live mutating agent instance**

Each active live writer owns at most one exact slot lock file such as `.leases/SUPERVISOR.json` on `coordination/leases`. The lease records slot, branch, work packet, `agent_instance_id`, `lease_id`, synchronized main SHA/epoch and acquisition head.

Lease behavior:

- acquisition is create-if-absent and fails closed on collision;
- renewal/release use the current lease blob SHA as compare-and-swap protection;
- leases do not silently expire;
- stale/crashed-owner takeover requires explicit recovery audit;
- Supervisor is not exempt;
- PR handoff carries instance/lease/lock-path identity;
- hosted PR CI validates the active lease against issue #53, branch, work packet, handoff identity and synchronized epoch;
- `scripts/verify-agent-lease-governance.mjs` verifies versioned governance wiring;
- `scripts/verify-pr-agent-lease.mjs` verifies live PR lease authority.

### Completion signal

A finished work packet announces exactly:

**Work Done and Submitted**

For non-Supervisor agents this is a top-level PR comment. It means ready for Supervisor review, not automatic approval. The signal is head-bound: any later commit invalidates it until re-verification and a fresh signal.

### Synchronization signal

After each approved integration, Supervisor broadcasts exactly:

**New changes have been merged — please merge these changes into your branch first, then resume your own work.**

Issue #50 is the durable synchronization ledger. Active agents pause, synchronize non-destructively to the new main SHA, rerun required minimum verification and renew/reconcile lease metadata before resuming.

## Main-branch integration integrity

Repository-controlled protections are active:

- normal integration path is `PR → exact-head FULL GATE → expected-head merge`;
- direct pushes to `main` are prohibited by project governance;
- hosted CI runs on PRs and pushes to `main`;
- main-push quality verification runs `scripts/verify-main-integration-provenance.mjs` and fails a `main` commit that is not associated with a merged PR targeting `main`.

Native GitHub protection is still the unresolved preventive layer. Current branch readback reports `main` as unprotected. Issue **#54** remains open until a repository ruleset / branch-protection rule requires PRs and the required status checks, blocks force pushes and deletion, and `main` re-reads as protected.

## Authorization boundary

M01 and provider-neutral M01A are complete. M02 may continue only through small reversible provider-neutral slices unless a separately controlled gate is explicitly opened.

Still separately gated:

- production model/provider invocation and credentials;
- production source connector credentials / activation;
- real provider HTTP/API transport until network/SSRF/policy/credential controls are independently verified;
- payment-provider activation;
- unrestricted acquisition;
- autonomous or bulk outreach;
- production deployment;
- destructive production data actions;
- unresolved legal/provider/commercial decisions.

Parallelism never widens authorization.

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

### ABD-266 — default-branch protection / compensating controls
State: **REPOSITORY COMPENSATING CONTROLS ACTIVE; NATIVE PROTECTION EXTERNAL ACTION OPEN AS ISSUE #54**.

## M01A state

**VERIFIED / INTEGRATED / IMPLEMENTATION-COMPLETE — eleven provider-neutral foundation slices.** Production model/provider execution remains separately gated.

## M02 state

**ACTIVE — five bounded slices VERIFIED / INTEGRATED.**

1. Provider-neutral source adapter foundation — PR #39, merge `f2852d9055d55e332e0617e455901ca673f46503`.
2. Durable source registry + admission persistence — PR #41, merge `e8198d259a4ffccbebd723154e1eafd5dac5365a`.
3. Durable ResearchJob preflight + SourceTask lifecycle — PR #44, merge `ce4f43648f764aeef8e153d21cbc769ddf2bdf60`.
4. Provider-neutral SourceTask execution bridge — PR #46, merge `08b33930bb6678a23ffcc5299ae56ed4b029f1ba`.
5. Connector execution safety / durable health — PR #48, merge `bec3c6bb9fd89dd496b155b0f6087e5a8f77b223`.

Real provider transport remains intentionally absent. Production `source.execute`, provider HTTP/network and credentialed connector execution remain separately gated.

## Parallel engineering operating model

Standing slots / branches:

- `SUPERVISOR` → `supervisor/integration-control`
- `CONTRACTS` → `agent/contracts-policy`
- `DATABASE` → `agent/database-persistence`
- `RUNTIME` → `agent/worker-runtime`
- `MODULE` → `agent/module-infrastructure`
- `VERIFY` → `agent/verification-security`

Default invariant:

`1 agent = 1 bounded work packet = 1 isolated branch/worktree = 1 PR`

Additional hard invariant: one occupied slot has at most one live mutating instance lease.

Default capacity target: **6**. Soft maximum: **8**, only while conflict/rework/CI latency remains healthy.

`pnpm run verify:parallel` verifies static slot/branch consistency, live-registry authority, main-first onboarding, the exact rejection phrase, Supervisor workflow, lease governance, head-bound completion, synchronization, migration numbering and main-push provenance wiring.

## Known limitations / not production verification

- native GitHub branch protection is not yet enabled; issue #54 tracks the external setting;
- no production deployment has occurred;
- no production model/provider/source connector is activated;
- no production source-provider network transport or credentials are enabled;
- remote GitHub sessions cannot prove an unseen local developer working-copy/runtime/database state;
- governance integration does not authorize payments, unrestricted acquisition, autonomous outreach or release gates.

## Next safe actions

1. Keep issue #54 open until native `main` protection/ruleset is enabled and verified by branch readback.
2. Continue M02 from exact epoch-5 `main` using issue #53 assignments plus atomic per-slot leases.
3. Select the next bounded provider-neutral M02 slice through the dependency DAG; do not activate real provider transport or credentials.
4. Prefer infrastructure that strengthens connector execution boundaries before real network transport: explicit outbound request/egress contracts, SSRF-safe destination policy, redirect/DNS/rebinding constraints, bounded response/body/time budgets, and test-only injected transport.
5. Keep source authorization version-bound and revalidated at execution time; no runtime widening of policy, quota, storage, export or credential rights.
6. Require exact-head FULL GATE, live PR lease verification, instruction-drift completion and expected-head merge for every new slice.
7. After each merge, advance issue #50 synchronization epoch, update issue #53 baselines, synchronize idle standing branches and release completed live leases safely.
