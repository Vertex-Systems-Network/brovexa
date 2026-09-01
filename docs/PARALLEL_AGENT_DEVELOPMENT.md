# Brovexa Parallel Agent Development Protocol

Status: **ACTIVE ENGINEERING GOVERNANCE**

Updated: 2026-09-02

## Purpose

Brovexa uses bounded parallel AI-assisted development to reduce calendar time without agents overwriting one another, duplicating architecture, colliding on migrations, drifting from `main`, double-claiming slots, or weakening integration gates.

The design goal is conflict avoidance by architecture—not more conflict handling.

Canonical companion sources:

- `AGENTS.md` — mandatory operating instructions;
- `docs/AI_NATIVE_PLAN.md` — standing branches/modules/merge plan;
- `docs/NEW_AGENT_ONBOARDING.md` — main-first onboarding protocol;
- `.agent/slots.yaml` — static slot definitions;
- GitHub issue #53 — live slot occupancy/agent assignment;
- GitHub issue #50 — live integrated-main synchronization epoch;
- `docs/PROJECT_PLAN.md` / `docs/CHECKPOINT.md` — program/state context.

## Main-repository Supervisor

The Main-repository agent is the **Supervisor** and sole integration/onboarding authority under this workflow.

It owns:

- branch bootstrap before adding capacity;
- serialized live slot assignment/release;
- dependency DAG/interface freezes;
- shared-file integration;
- migration coordination;
- exact-head PR review and merge order;
- synchronization broadcasts;
- bounded work on `supervisor/integration-control`.

Supervisor authority never overrides tests, policy, security, tenant isolation, budgets, or activation gates.

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
6. re-read issue #53 and confirm ownership;
7. hand the branch/work packet to the agent.

Assignments are serialized by the Supervisor so two arrivals cannot claim one slot.

**Temporary assignment/release does not require a repository PR** when standing definitions/rules are unchanged. This avoids serializing all startup behind FULL GATE.

If no assignable live slot is `OPEN`, Supervisor responds exactly:

**Go Home Come Back Next Time**

The rejected arrival gets no module/branch/task/work/implementation PR.

Slot release requires no active/unmerged work, idle-branch sync to current main, issue #53 update to `OPEN` / `WAITING`, revision increment, and post-update re-read.

## Default capacity

Default target: **6 concurrent agents**.

1. Supervisor / Integration Architecture
2. Contracts / Policy
3. Database / Persistence
4. Worker / Runtime
5. Module / Connector Infrastructure
6. Verification / Security

Scale to **8** only when boundaries and throughput metrics remain healthy. Arrival itself never expands capacity.

## Core isolation rule

`1 agent = 1 work packet = 1 isolated branch/worktree = 1 PR`

One active owner per standing module branch unless a task is explicitly decomposed into non-overlapping child workstreams.

## Work packet contract

Every task declares:

- task/workstream ID and assigned slot ID;
- agent/role/module/branch/base SHA;
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

A valid signal requires current PR head = handoff exact head, current issue #53 slot ownership, current issue #50 epoch, verification/dependency evidence, and instruction-drift completion.

**Any commit pushed after the completion signal invalidates it.** The agent must update handoff, rerun required verification, and post a fresh exact signal after the new head exists.

## Supervisor interrupt handling

On valid completion:

`WORKING → PAUSED_FOR_REVIEW → REVIEWING → MERGING | CHANGES_REQUESTED → BROADCASTING → WORKING`

Supervisor reviews current head, signal freshness, slot ownership, dependencies, migrations, shared files, review threads, security, and exact-head gates. Approved work merges with expected-head protection. Multiple submissions are FIFO subject to dependency priority; overlapping merges are serialized.

## Synchronization broadcast

After every approved merge Supervisor sends exactly:

**New changes have been merged — please merge these changes into your branch first, then resume your own work.**

Issue #50 is the canonical live synchronization ledger. Each broadcast includes resulting `main` SHA, monotonically increasing epoch, merged PR/branch, and cross-workstream impact.

Every active agent seeing a newer epoch enters `PAUSED_FOR_SYNC`, merges current main non-destructively, resolves owned conflicts/escalates shared conflicts, reruns minimum verification, records new SHA/epoch, then resumes.

## Live-state separation

To avoid coordination PR bottlenecks:

- versioned files define standing policy/slot/branch structure;
- issue #50 carries live synchronization state;
- issue #53 carries live slot occupancy;
- PR/work packet/handoff carries live task state.

Do not put temporary `WORKING` or temporary agent occupancy back into versioned manifests unless the state itself is a durable architectural change.

## Main-branch integration integrity

Direct pushes to `main` are prohibited. Normal flow is PR → exact-head FULL GATE → expected-head merge.

Hosted CI runs on both pull requests and `push` to `main`. A main-push provenance check queries GitHub for PR association and fails when the pushed main commit is not associated with a merged PR targeting `main`.

This is defense in depth. GitHub branch protection/ruleset remains the external preventive layer and should require PRs/status checks, block force pushes/deletions, and prevent ordinary direct updates.

## Verification independence

Implementation agents prove expected behavior; verification/security agents try to break it. Relevant adversarial checks include invalid transitions, replay/idempotency, concurrency/stale state, tenant leakage, authorization/policy/budget bypass, append-only mutation, migration rollback, malformed input, dependency drift, network/credential bypass, queue failure/recovery, and provenance integrity.

Tests/invariants are not weakened merely to obtain green CI.

## Executable governance

`pnpm run verify:parallel`

Hosted CI runs the same verifier. It fails closed for material versioned governance drift: missing static slot definitions/live issue #53 authority, missing main-first/rejection rules, duplicate slot identities/branches, invalid assignability, missing head-change invalidation, missing issue #50 synchronization rules, migration/concurrency drift, missing main-push provenance guard, or stale instruction references.

The verifier intentionally does not freeze temporary issue #53 occupancy into Git.

## Integration queue

A workstream can be `READY_FOR_INTEGRATION` only with:

- fresh head-bound completion signal;
- valid live issue #53 slot ownership;
- latest issue #50 synchronization;
- required verification and `verify:parallel` PASS;
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

Mandatory at task start and before completion. Read/check `README.md`, `AGENTS.md`, `docs/PROJECT_PLAN.md`, `docs/CHECKPOINT.md`, this document, `docs/AI_NATIVE_PLAN.md`, `docs/NEW_AGENT_ONBOARDING.md` when relevant, `.agent/` manifests, issue #50, issue #53, module docs, current `main`, own branch/head, and required gates.

If workflow/architecture/onboarding/slot definitions/live-state authority/merge/sync/CI/security behavior changes, update relevant instructions/manifests/verifier in the same change set.

No work packet is ready while future-agent instructions are materially stale.

## Handoff

Every handoff includes task ID, agent/role/status, assigned slot ID, base/head SHA, branch/PR, synced main/epoch, changed paths, contract/migration/dependency impact, verification, security impact, shared-file requests, limitations, instruction-drift result, and completion-signal state.

## Throughput metrics

Supervisor monitors task lead time, dependency wait, CI queue/run time, merge-conflict/rework rate, shared-file collisions, rejected/double onboarding attempts, stale-epoch submissions, sync conflicts, stale completion signals, and defect escapes.

Increase concurrency only while these remain healthy.

## Safety boundaries

Parallelism never authorizes production credentials, network/provider activation, unrestricted acquisition, autonomous outreach, destructive production actions, or other separately gated capabilities.
