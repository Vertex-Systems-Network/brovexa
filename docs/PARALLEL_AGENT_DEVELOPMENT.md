# Brovexa Parallel Agent Development Protocol

Status: **ACTIVE ENGINEERING GOVERNANCE**

Updated: 2026-09-02

## Purpose

Brovexa uses bounded parallel AI-assisted development to reduce calendar time without agents overwriting one another, duplicating architecture, colliding on migrations, drifting from `main`, double-claiming slots, running multiple live writers on one lane, or weakening integration gates.

The design goal is conflict avoidance by architecture—not more conflict handling.

Canonical companion sources:

- `AGENTS.md` — mandatory operating instructions;
- `docs/AI_NATIVE_PLAN.md` — standing branches/modules/merge plan;
- `docs/NEW_AGENT_ONBOARDING.md` — main-first onboarding protocol;
- `docs/AGENT_BRANCH_LEASES.md` — atomic live-instance branch lease protocol;
- `.agent/slots.yaml` — static slot definitions;
- GitHub issue #53 — live logical slot occupancy/agent assignment;
- Git branch `coordination/leases` — live mutating instance per occupied slot;
- GitHub issue #50 — live integrated-main synchronization epoch;
- `docs/PROJECT_PLAN.md` / `docs/CHECKPOINT.md` — program/state context.

## Main-repository Supervisor

The Main-repository agent is the **Supervisor** and sole integration/onboarding authority under this workflow.

It owns branch bootstrap, serialized live slot assignment/release, dependency DAG/interface freezes, shared-file integration, migration coordination, exact-head PR review/merge order, synchronization broadcasts, and bounded Supervisor work.

Supervisor authority never overrides tests, policy, security, tenant isolation, budgets, activation gates, or live-instance lease requirements.

## Immediate branch bootstrap

For a new parallel wave/capacity increase, branches are created **before** their slots are added to the versioned plan. New-agent arrival never creates a branch/slot on demand.

Current standing branches are versioned in `docs/AI_NATIVE_PLAN.md`, `.agent/slots.yaml`, and `.agent/workstreams.yaml`.

## New Agent Onboarding

Every new agent starts from exact current `main` and may not switch to a module branch before Supervisor assignment.

Static slot definitions are versioned in `.agent/slots.yaml`. Temporary live occupancy is intentionally **not** versioned; it lives in GitHub issue #53.

Open-slot transaction:

1. read current `main` and latest issue #50 sync epoch;
2. re-read issue #53 immediately before assignment;
3. select only a statically assignable slot whose live status is exactly `OPEN`;
4. synchronize/fast-forward its idle standing branch to current `main`;
5. update issue #53 to `OCCUPIED` with agent ID, start status, main SHA, epoch, incremented registry revision;
6. re-read issue #53 and confirm logical ownership;
7. the exact runtime/session instance atomically acquires that slot's lease on `coordination/leases`;
8. only then hand the branch/work packet to the agent for mutation.

Assignments are serialized by the Supervisor so two arrivals cannot claim one slot. Atomic leases separately prevent two live instances—even with the same logical agent ID—from writing the occupied lane concurrently.

**Temporary assignment/release and lease acquire/renew/release do not require a repository PR** when standing definitions/rules are unchanged. This avoids serializing live coordination behind FULL GATE.

If no assignable live slot is `OPEN`, Supervisor responds exactly:

**Go Home Come Back Next Time**

The rejected arrival gets no module/branch/task/work/implementation PR.

Slot release requires no active/unmerged work, safe release of the live instance lease, idle-branch sync to current main, issue #53 update to `OPEN` / `WAITING`, revision increment, and post-update re-read.

## Default capacity

Default target: **6 concurrent agents**.

1. Supervisor / Integration Architecture
2. Contracts / Policy
3. Database / Persistence
4. Worker / Runtime
5. Module / Connector Infrastructure
6. Verification / Security

Scale to **8** only when boundaries and throughput metrics remain healthy. Arrival itself never expands capacity.

## Core isolation rules

`1 agent = 1 work packet = 1 isolated branch/worktree = 1 PR`

`one occupied slot = at most one live mutating agent instance`

One active owner per standing module branch unless a task is explicitly decomposed into non-overlapping child workstreams. A logical slot owner still cannot mutate without the exact runtime/session lease.

## Atomic branch leases

Full contract: `docs/AGENT_BRANCH_LEASES.md`.

Canonical lease branch: `coordination/leases`.

One lock path exists per slot: `.leases/<SLOT_ID>.json`. Acquisition is create-if-absent. If the lock already exists, the newcomer stops without branch mutation. `agent_instance_id` and `lease_id` identify the exact live session, not merely the logical role.

Renewal and release use current lease blob SHA compare-and-swap semantics. Leases never expire silently; crashed/stale lease takeover requires explicit Supervisor/owner recovery audit.

When a newer issue #50 epoch arrives, the holder synchronizes its work branch, verifies it, then renews the same lease with new `synced_main_sha`/`sync_epoch` before resuming edits.

Hosted PR CI verifies the canonical lease against PR branch, slot, logical agent, runtime instance, work packet, synchronized state, and acquisition-head ancestry.

The Supervisor is not exempt.

## Work packet contract

Every task declares:

- task/workstream ID and assigned slot ID;
- agent/role plus unique `agent_instance_id`;
- `lease_id` and lease lock path;
- module/branch/base SHA;
- `synced_main_sha` / `sync_epoch`;
- goal/non-goals and write/read-only/shared scopes;
- public contracts/interfaces and dependency IDs/SHAs;
- migration reservation when applicable;
- acceptance criteria/tests/security constraints;
- handoff requirements.

Agents do not invent missing cross-module behavior to unblock themselves; they raise an interface/dependency request.

## Ownership and shared files

Typical ownership:

- contracts/policy: `packages/contracts/**`;
- DB/persistence: `packages/db/**`;
- runtime/worker: `apps/worker/**`, `packages/queue/**`;
- module specialist: explicit packet paths;
- verification: bounded tests/verifiers;
- Supervisor/shared: root manifests, central exports, CI, lockfiles, aggregate verifiers, governance/checkpoint docs.

Feature agents submit shared-file requests instead of racing the Supervisor/another agent.

## Contract-first parallelism

Preferred pattern:

`contract/interface freeze → persistence/module/runtime/security in parallel → integration`

A frozen interface records exact version/SHA and dependent workstreams. Dependents cannot silently widen it.

## Dependency DAG and merge strategy

Parallel work is a DAG. Every non-trivial work packet declares `depends_on` (including explicit empty list when independent). Cycles are prohibited.

Default layer order when all layers are needed:

`contracts/policy → DB/persistence → module infrastructure → worker/runtime → verification changes → Supervisor integration`

Independent nodes may merge earlier when there is no dependency/interface/migration/ownership/shared-file collision.

## Migration reservation

Migration numbers are serialized resources. Before creating a migration, the DB/Supervisor owner reserves it in `.agent/migrations.yaml`. Two agents never independently choose one number. Integrated migrations are immutable.

## Completion signal — head-bound

Every finished work packet announces exactly:

**Work Done and Submitted**

For non-Supervisor agents, this is a top-level PR comment whose full body is exactly that phrase. It means `READY_FOR_SUPERVISOR_REVIEW`, not approval.

A valid signal requires current PR head = handoff exact head, current issue #53 logical slot ownership, valid active instance lease, current issue #50 epoch, verification/dependency evidence, and instruction-drift completion.

**Any commit pushed after the completion signal invalidates it.** The agent must update handoff, rerun required verification, and post a fresh exact signal after the new head exists.

## Supervisor interrupt handling

On valid completion:

`WORKING → PAUSED_FOR_REVIEW → REVIEWING → MERGING | CHANGES_REQUESTED → BROADCASTING → WORKING`

Supervisor reviews current head, signal freshness, slot ownership, active lease, dependencies, migrations, shared files, review threads, security, and exact-head gates. Approved work merges with expected-head protection. Multiple submissions are FIFO subject to dependency priority; overlapping merges are serialized.

## Synchronization broadcast

After every approved merge Supervisor sends exactly:

**New changes have been merged — please merge these changes into your branch first, then resume your own work.**

Issue #50 is the canonical live synchronization ledger. Each broadcast includes resulting `main` SHA, monotonically increasing epoch, merged PR/branch, and cross-workstream impact.

Every active agent seeing a newer epoch enters `PAUSED_FOR_SYNC`, merges current main non-destructively, resolves owned conflicts/escalates shared conflicts, reruns minimum verification, renews its live lease via compare-and-swap with the new SHA/epoch, records state, then resumes.

## Live-state separation

To avoid coordination PR bottlenecks:

- versioned files define standing policy/slot/branch structure;
- issue #50 carries live synchronization state;
- issue #53 carries live logical slot occupancy;
- `coordination/leases` carries live instance write ownership;
- PR/work packet/handoff carries live task state.

Do not put temporary `WORKING`, temporary agent occupancy, or live lease records back into versioned `main` manifests.

## Main-branch integration integrity

Direct pushes to `main` are prohibited. Normal flow is PR → exact-head FULL GATE → expected-head merge.

Hosted CI runs on both pull requests and `push` to `main`. A main-push provenance check queries GitHub for PR association and fails when the pushed main commit is not associated with a merged PR targeting `main`.

This is defense in depth. GitHub branch protection/ruleset remains the external preventive layer and should require PRs/status checks, block force pushes/deletions, and prevent ordinary direct updates. Issue #54 tracks that repository setting.

## Verification independence

Implementation agents prove expected behavior; verification/security agents try to break it. Relevant adversarial checks include invalid transitions, replay/idempotency, concurrency/stale state, duplicate live writers, tenant leakage, authorization/policy/budget bypass, append-only mutation, migration rollback, malformed input, dependency drift, network/credential bypass, queue failure/recovery, and provenance integrity.

Tests/invariants are not weakened merely to obtain green CI.

## Executable governance

`pnpm run verify:parallel`

This runs versioned parallel-governance checks plus static branch-lease governance checks. Hosted PR CI additionally runs `scripts/verify-pr-agent-lease.mjs` against the live lease branch before FULL GATE work proceeds.

The versioned verifier intentionally does not freeze temporary issue #53 occupancy or live lease records into Git.

## Integration queue

A workstream can be `READY_FOR_INTEGRATION` only with:

- fresh head-bound completion signal;
- valid live issue #53 logical slot ownership;
- valid active exact-instance lease;
- latest issue #50 synchronization;
- required verification and `verify:parallel` PASS;
- hosted PR lease check PASS;
- satisfied dependencies;
- clear migration/ownership/shared-file state;
- current docs/instructions and known limitations.

Supervisor determines final merge order from the DAG/current state.

## Canonical task states

- `PLANNED`
- `CLAIMED`
- `WORKING`
- `BLOCKED`
- `READY_FOR_REVIEW`
- `READY_FOR_INTEGRATION`
- `PAUSED_FOR_SYNC`
- `INTEGRATING`
- `VERIFIED`
- `MERGED`
- `SUPERSEDED`

## Agent Instruction Drift Check

Mandatory at task start and before completion. Read/check `README.md`, `AGENTS.md`, `docs/PROJECT_PLAN.md`, `docs/CHECKPOINT.md`, this document, `docs/AI_NATIVE_PLAN.md`, `docs/NEW_AGENT_ONBOARDING.md`, `docs/AGENT_BRANCH_LEASES.md`, `.agent/` manifests, issue #50, issue #53, active slot lease, module docs, current `main`, own branch/head, and required gates.

If workflow/architecture/onboarding/slot definitions/live-state authority/branch leases/merge/sync/CI/security behavior changes, update relevant instructions/manifests/verifiers in the same change set.

No work packet is ready while future-agent instructions are materially stale.

## Handoff

Every handoff includes task ID, agent/role/status, agent instance ID, assigned slot ID, lease ID/path, base/head SHA, branch/PR, synced main/epoch, changed paths, contract/migration/dependency impact, verification, security impact, shared-file requests, limitations, instruction-drift result, and completion-signal state.

## Throughput metrics

Supervisor monitors task lead time, dependency wait, CI queue/run time, merge-conflict/rework rate, shared-file collisions, rejected/double onboarding attempts, lease-acquisition collisions, stale leases/recoveries, stale-epoch submissions, sync conflicts, stale completion signals, and defect escapes.

Increase concurrency only while these remain healthy.

## Safety boundaries

Parallelism never authorizes production credentials, network/provider activation, unrestricted acquisition, autonomous outreach, destructive production actions, or other separately gated capabilities.
