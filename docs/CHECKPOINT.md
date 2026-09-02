# Brovexa Project Checkpoint

Updated: 2026-09-02

## Project state

`ACTIVE_EXISTING_PROJECT`

**M01 — Platform Foundation & Developer Experience is VERIFIED / INTEGRATED. The provider-neutral M01A — AI Agent Runtime & Memory OS foundation is VERIFIED / INTEGRATED / IMPLEMENTATION-COMPLETE. M02 — Business Discovery & Source Connectors is ACTIVE with five bounded implementation slices FULL-GATE verified and integrated. Supervisor-driven parallel-agent workflow, main-first onboarding, live slot registry and main-push provenance controls are integrated. Atomic live-instance branch leases are the current final coordination-hardening slice.**

Current integrated `main` at this slice base:

`09fc8ba7b6cc3cbf5cdea4af21ed5b869519d1c1`

That commit integrated PR #55 (`chore(agent): remove remaining multi-agent coordination blockers`). PR #55 exact head `21d43939bdce3e50780e9dd4a6fb8bed0e7a6b77` passed hosted CI run `33566370299` (#236) with all three FULL GATE lanes green. The post-merge push-to-main CI run `33566907096` (#237) executed the new main integration-provenance check successfully in the quality lane; PostgreSQL/RBAC also passed and the worker/Valkey lane was subsequently required to complete before the next integration step.

Latest Supervisor synchronization state for this hardening work is GitHub issue #50 **sync epoch 4**, pointing to `09fc8ba7b6cc3cbf5cdea4af21ed5b869519d1c1`.

Issue #53 is updated to the same epoch/main baseline. Five assignable standing module branches were synchronized to this main SHA. The Supervisor standing lane was synchronized non-destructively.

## Canonical agent working instructions

- `AGENTS.md` — canonical startup/working instructions;
- `docs/PARALLEL_AGENT_DEVELOPMENT.md` — full multi-agent protocol;
- `docs/AI_NATIVE_PLAN.md` — versioned standing branch/module/static-slot plan;
- `docs/NEW_AGENT_ONBOARDING.md` — main-first onboarding;
- `docs/AGENT_BRANCH_LEASES.md` — atomic per-slot live mutating-instance protocol;
- `.agent/slots.yaml` — static standing slot definitions only;
- `.agent/ownership.yaml` / `.agent/shared-files.yaml` — path/shared-file ownership;
- `.agent/workstreams.yaml` / `.agent/dependencies.yaml` — workstream/DAG and lease metadata rules;
- `.agent/migrations.yaml` — serialized migration reservations;
- `.agent/supervisor.yaml` — Supervisor onboarding/review/merge/broadcast/lease contract;
- GitHub issue **#50** — live integrated-main SHA/synchronization epoch;
- GitHub issue **#53** — live logical slot occupancy/assigned agent/start state;
- branch `coordination/leases` — live instance-level mutation authority;
- PR/work packet/handoff — live bounded task state;
- GitHub issue **#54** — required external native `main` branch-protection configuration;
- `pnpm run verify:parallel` — executable governance verifier.

Every agent performs the **Agent Instruction Drift Check** at task start and before completion. A task is not `READY_FOR_INTEGRATION` while future-agent instructions are materially stale.

## Multi-agent throughput hardening

### Live slot assignment

Temporary `OPEN` / `OCCUPIED` state is not stored in Git. Issue #53 is the canonical live logical slot registry; issue #50 remains canonical live synchronization state; PR/work packet/handoff carries bounded task state.

New agents always start from exact current `main`. Supervisor re-reads issue #53 immediately before assignment, updates agent/status/main/epoch/registry revision, then re-reads it after assignment to confirm ownership.

If no assignable live `OPEN` slot exists, Supervisor responds exactly:

**Go Home Come Back Next Time**

No assignment, module checkout, work packet, feature edit or implementation PR is created for that arrival.

### Atomic live-instance branch leases

Logical slot ownership alone does not prevent two concurrent sessions using the same logical agent identity. This final repository-controlled race is addressed by `docs/AGENT_BRANCH_LEASES.md` and dedicated branch `coordination/leases`.

Hard invariant:

**one occupied slot = at most one live mutating agent instance**

Each occupied slot has at most one active lock file such as `.leases/SUPERVISOR.json`. The lease records slot, branch, work packet, `agent_instance_id`, `lease_id`, synchronized main SHA/epoch and acquisition head.

Lease behavior:

- acquisition is create-if-absent;
- renewal/release use compare-and-swap ownership validation;
- leases do not silently expire;
- stale/crashed-owner takeover requires explicit Supervisor recovery audit;
- Supervisor is not exempt;
- PR handoff carries instance/lease/lock-path fields;
- PR CI reads the active slot lease from `coordination/leases` and verifies it against issue #53, PR branch/work packet and handoff identity before integration;
- `scripts/verify-agent-lease-governance.mjs` checks the versioned governance wiring;
- `scripts/verify-pr-agent-lease.mjs` checks live PR lease authority.

The current hardening session successfully acquired the `SUPERVISOR` slot lease on `coordination/leases`, demonstrating the atomic lock path before final integration.

### Completion signal is head-bound

A finished work packet announces exactly:

**Work Done and Submitted**

This means ready for Supervisor review, not automatic merge approval. Any commit pushed after that exact signal invalidates the signal; current handoff exact head, current verification and active lease must be revalidated before a fresh signal.

### Synchronization signal

After every approved merge, Supervisor broadcasts exactly:

**New changes have been merged — please merge these changes into your branch first, then resume your own work.**

Issue #50 is the canonical durable synchronization ledger. Active agents sync current `main` non-destructively and renew/reconcile their live lease metadata before resuming when required.

## Main-branch integration integrity

Native GitHub `main` protection currently reports `protected: false`. Direct protection endpoint access through the connected integration returns 403, and no branch-protection write action is exposed by the available connector.

Repository-controlled compensating controls are active:

- hosted CI runs on pull requests and `push` to `main`;
- main-push quality lane runs `scripts/verify-main-integration-provenance.mjs`;
- the verifier fails when the pushed `main` commit is not associated with a merged PR targeting `main`;
- direct pushes remain prohibited by project governance;
- normal path remains `PR → exact-head FULL GATE → expected-head merge`.

Native branch protection/ruleset remains the stronger external preventive control. GitHub issue **#54** stays open until repository settings require PR/status checks, block force pushes/deletion, and `main` re-reads as protected.

## Authorization boundary

M01 and provider-neutral M01A foundations are complete. M02 may continue in small reversible provider-neutral slices.

Still separately gated:

- production model/provider invocation/credentials;
- production source connector credentials/activation;
- real provider HTTP/API transport until network/SSRF/policy/credential controls are independently verified;
- payment-provider activation;
- unrestricted acquisition;
- autonomous/bulk outreach;
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

M01 platform, PostgreSQL/data layer, durable worker/queue, identity/RBAC/tenant primitives, API/observability and continuous FULL GATE remain **VERIFIED / INTEGRATED**.

Default-branch protection posture: repository compensating controls active; native protection external action open as issue #54.

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

Standing slots/branches:

- `SUPERVISOR` → `supervisor/integration-control`
- `CONTRACTS` → `agent/contracts-policy`
- `DATABASE` → `agent/database-persistence`
- `RUNTIME` → `agent/worker-runtime`
- `MODULE` → `agent/module-infrastructure`
- `VERIFY` → `agent/verification-security`

Default invariant:

`1 agent = 1 bounded work packet = 1 isolated branch/worktree = 1 PR`

Additional hard invariant: one occupied slot has at most one live mutating instance lease.

Default capacity target: **6**. Soft maximum: **8**, subject to healthy conflict/rework/CI metrics.

The executable coordination guard is `pnpm run verify:parallel`. It verifies static slots/branches, issue #53 live-registry authority, main-first onboarding, exact rejection phrase, Supervisor workflow, atomic lease governance, head-bound completion, synchronization rules, migration numbering and main-push provenance wiring.

## Known limitations / not production verification

- native GitHub branch protection is not yet enabled; issue #54 tracks the external setting;
- no production deployment has occurred;
- no production model/provider/source connector is activated;
- no production source-provider network transport or credentials are enabled;
- local developer working-copy/runtime/database state is unknown when work is performed through remote GitHub tooling;
- governance integration does not authorize payments, unrestricted acquisition, autonomous outreach or release gates.

## Next safe actions

1. Finish this atomic lease hardening branch and renew the live `SUPERVISOR` lease to the exact final head.
2. Open the lease-hardening PR with complete lease-aware handoff.
3. Post fresh **Work Done and Submitted** for the exact PR head.
4. Require all three FULL GATE lanes plus the live PR lease verifier to pass.
5. Merge only with expected-head protection.
6. Verify the post-merge push-to-main provenance lane passes.
7. Publish the next issue #50 synchronization epoch, update issue #53 baseline, synchronize idle standing branches, and release the hardening lease safely.
8. Enable native `main` branch protection/ruleset through GitHub repository settings per issue #54 and re-read it as protected.
9. Then start parallel M02 work using issue #53 assignments + atomic slot leases.
