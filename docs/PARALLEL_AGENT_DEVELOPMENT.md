# Brovexa Parallel Agent Development Protocol

Status: **ACTIVE ENGINEERING GOVERNANCE**

Updated: 2026-09-02

## Purpose

Brovexa uses bounded parallel AI-assisted development to reduce calendar time without allowing agents to overwrite one another, duplicate architecture, collide on migrations, silently widen contracts, drift from current `main`, double-claim module slots, or weaken integration gates.

The goal is not to make agents resolve more conflicts. The goal is to structure work so conflicts are uncommon by design and stale/invalid assignments are detected before implementation or integration.

Canonical companion documents:

- `AGENTS.md` — mandatory operating instructions;
- `docs/AI_NATIVE_PLAN.md` — branch/module/agent/merge plan plus durable slot occupancy;
- `docs/NEW_AGENT_ONBOARDING.md` — main-first new-agent onboarding protocol;
- `docs/PROJECT_PLAN.md` — program architecture and permanent cross-cutting governance;
- `docs/CHECKPOINT.md` — latest integrated project state;
- `.agent/slots.yaml` — machine-readable onboarding slot registry;
- `.agent/*.yaml` — machine-readable coordination policy/baseline state.

## Main-repository Supervisor

The agent operating the Main repository is the **Supervisor**.

The Supervisor is the sole integration and onboarding authority for this workflow. It owns:

- creation of parallel module branches before documenting/assigning a new parallel wave;
- new-agent onboarding from exact current `main`;
- slot assignment/release and slot-plan synchronization;
- branch/module/agent mapping in `docs/AI_NATIVE_PLAN.md`;
- dependency DAG and interface freeze points;
- shared-file integration;
- migration reservation coordination;
- review of submitted agent PRs;
- dependency-safe merge order;
- exact-head verification and expected-head merge;
- post-merge `main` readback;
- synchronization epoch publication;
- post-merge alerts to all active agents;
- its own bounded work on `supervisor/integration-control`.

The Supervisor may not bypass tests, policy, security, tenant, migration, budget or production-activation gates merely because it owns integration.

## Immediate branch bootstrap rule

For a newly planned parallel wave, the Supervisor's first repository mutation is to create the branch for every module/agent workstream that will run in parallel, including its own Supervisor work branch when required.

Only after those branches exist may the Supervisor publish/update module assignments, work packets, merge ordering, interface freeze points and dependency edges.

The current standing branches are recorded in `docs/AI_NATIVE_PLAN.md` and `.agent/workstreams.yaml`.

A newly arriving agent does **not** create a new branch/capacity slot on demand. It can only consume a pre-planned `OPEN` slot.

## New Agent Onboarding

Every newly arriving agent always begins from the exact current `main` branch/head.

Before assignment, it may read the repository/instructions and record current `main` SHA/latest Supervisor sync epoch, but it must not start from a standing module branch, claim a work packet, edit module code or open an implementation PR.

The Supervisor immediately checks `docs/AI_NATIVE_PLAN.md` and `.agent/slots.yaml`.

Only a slot that is both assignable and exactly `OPEN` may be used.

Onboarding decisions are serialized so concurrent arrivals cannot claim the same slot.

### Open-slot path

If an `OPEN` slot exists:

1. choose a slot appropriate to the ready bounded work packet/agent capability;
2. verify the slot's standing branch is synchronized to exact current `main` and latest Supervisor sync epoch;
3. record the arriving agent name, slot status `OCCUPIED` and start status in `docs/AI_NATIVE_PLAN.md` and `.agent/slots.yaml`;
4. publish that occupancy through the normal Supervisor integration path;
5. only once repository-visible assignment is authoritative may the agent switch from `main` to the assigned branch and begin its bounded work packet.

A feature agent cannot self-assign or release a slot.

### No-slot path

If no assignable `OPEN` slot exists, the Supervisor stops onboarding immediately and responds exactly:

**Go Home Come Back Next Time**

The rejected arrival receives no module assignment, no module-branch checkout, no work packet, no feature edit and no agent implementation PR.

### Slot release

The Supervisor may return a slot to `OPEN` only after confirming the assigned agent has no active work packet and no unmerged work requiring that slot. The Supervisor clears the assigned agent, sets start status to `WAITING`, updates both durable slot sources and integrates that change.

The AI-Native Plan and `.agent/slots.yaml` must agree. Mismatch is governance failure.

See `docs/NEW_AGENT_ONBOARDING.md` for the canonical detailed flow.

## Default operating capacity

Default target: **6 concurrent agents** when enough independent work exists.

1. **Supervisor / Integration Architecture**
2. **Contracts / Policy Agent**
3. **Database / Persistence Agent**
4. **Worker / Runtime Agent**
5. **Module / Connector Infrastructure Agent**
6. **Verification / Security Agent**

Scale to **8 concurrent agents** only when workstreams are truly independent and repository metrics show acceptable conflict, rework, CI queue and merge latency. More than 8 requires an explicit metrics-backed governance change.

A newly arriving agent never triggers concurrency expansion by itself.

## Core isolation rule

Default mapping:

`1 agent = 1 work packet = 1 isolated branch/worktree = 1 PR`

Two coding agents do not actively develop on the same branch. A standing module branch may host successive bounded work packets over time, but only one active work packet/owner is permitted on that branch unless explicitly decomposed.

## Work packet contract

Every parallel task defines before implementation:

- task/workstream ID;
- assigned slot ID;
- agent ID and role;
- module;
- branch and base SHA;
- current `synced_main_sha` and `sync_epoch` from the latest Supervisor broadcast;
- goal and explicit non-goals;
- write/read-only/forbidden/shared scopes;
- public contracts/interfaces consumed or produced;
- dependency IDs/SHAs;
- migration reservation if applicable;
- acceptance criteria;
- required tests/evals/gates;
- security/compliance constraints;
- expected handoff artifacts.

Agents do not invent missing cross-module behavior merely to unblock themselves. Missing contract/dependency information becomes an explicit interface/dependency request to the owning agent/Supervisor.

## Module/path ownership

Ownership coordinates writes; it does not create permanent silos.

Typical classes:

- contracts/policy: `packages/contracts/**`;
- database/persistence: `packages/db/**`;
- runtime/worker: `apps/worker/**`, `packages/queue/**` when assigned;
- module specialist: explicit work-packet paths only;
- verification: relevant verifier/test/eval paths without weakening implementation invariants;
- Supervisor/shared: root manifests, lockfiles, central exports, aggregate verifiers, CI workflows and cross-cutting governance/checkpoint files.

Machine-readable defaults live in `.agent/ownership.yaml`.

## Shared-file discipline

High-conflict files are Supervisor/integration-owned when concurrent work exists, including:

- `AGENTS.md`, `README.md`;
- `docs/PROJECT_PLAN.md`, `docs/CHECKPOINT.md`, `docs/PARALLEL_AGENT_DEVELOPMENT.md`, `docs/AI_NATIVE_PLAN.md`, `docs/NEW_AGENT_ONBOARDING.md`;
- `.agent/**` including `.agent/slots.yaml`;
- `.github/workflows/**`, `.github/PULL_REQUEST_TEMPLATE.md`;
- root/package manifests and lockfiles;
- central exports touched by multiple workstreams;
- root DB/identity/queue verification aggregators.

A feature agent records requested shared-file changes in its handoff rather than racing another agent. Shared-file conflicts found during post-merge synchronization are escalated to the Supervisor.

## Contract-first parallelism and interface freeze

Parallel work should start from a narrow public contract whenever practical:

`contract/interface freeze → persistence/module/runtime/security work in parallel → integration`

An interface freeze records the exact contract version/SHA and dependent workstreams. A dependent agent must not silently widen it. Contract changes after freeze require impact review and revalidation of affected workstreams.

## Dependency DAG and merge strategy

Parallel work is a DAG, not a flat PR list.

Every non-trivial work packet declares `depends_on`, including an explicit empty list when independent. Dependency edges cannot form cycles.

Default layer order when all layers are required:

1. contracts/policy;
2. database/persistence;
3. module/connector infrastructure;
4. worker/runtime;
5. verification/security repository changes;
6. Supervisor shared-file/integration reconciliation.

Independent workstreams may merge earlier if the Supervisor verifies no dependency, ownership, migration, interface or shared-file collision.

A completion signal never overrides dependency order.

## Migration reservation

Migration identifiers are serialized resources.

Before creating a migration, the DB/Supervisor owner reserves it in `.agent/migrations.yaml`. Two agents must never independently choose the same number. Integrated migrations are immutable; prefer a new forward migration unless an explicit migration policy says otherwise.

## Task completion signal

When any agent, including the Supervisor, finishes its assigned task, it must announce the exact phrase:

**Work Done and Submitted**

For non-Supervisor agents, the canonical repository event is a **top-level PR comment whose complete body is exactly `Work Done and Submitted`**.

The signal means only `READY_FOR_SUPERVISOR_REVIEW`; it does **not** mean approved, verified or mergeable.

A valid completion submission also requires open PR, exact head SHA, assigned slot, complete handoff, current dependency state, applicable test/CI evidence, security/compliance impact, Agent Instruction Drift Check result, and `synced_main_sha`/`sync_epoch` matching the latest Supervisor broadcast.

A stale branch may not issue a valid completion signal.

## Supervisor interrupt handling

The Supervisor also performs bounded work on `supervisor/integration-control`.

When a valid `Work Done and Submitted` event arrives, integration takes priority over the Supervisor's current feature/governance work.

State machine:

`WORKING → PAUSED_FOR_REVIEW → REVIEWING → MERGING | CHANGES_REQUESTED → BROADCASTING → WORKING`

Required behavior:

1. checkpoint/preserve the Supervisor's current work;
2. review submitted exact head/diff/paths/dependencies/migrations/interface assumptions/shared-file requests/review threads/security/verification;
3. request changes without merge when defects exist;
4. if approved, require applicable exact-head FAST/FULL gates;
5. merge with expected-head SHA protection where supported;
6. re-read resulting `main` and record resulting SHA;
7. increment synchronization epoch relative to latest Supervisor broadcast;
8. broadcast the synchronization alert to all active agents;
9. resume Supervisor work unless direct dependency requires immediate follow-up.

Multiple submissions use **FIFO with dependency priority**. Overlapping merges are serialized.

## Post-merge synchronization broadcast

After every approved merge, the Supervisor sends the exact alert:

**New changes have been merged — please merge these changes into your branch first, then resume your own work.**

Canonical durable broadcast channel: GitHub issue **#50**.

Each Supervisor broadcast includes merged PR/branch, resulting `main` SHA, monotonically increasing synchronization epoch and relevant cross-workstream impact.

The **latest valid Supervisor broadcast comment on issue #50 is the canonical live synchronization state**. `.agent/supervisor.yaml` stores protocol/baseline seed, not an always-current post-merge SHA.

When active agent PRs exist, the Supervisor should also place the alert on each active PR.

## Agent response to synchronization alerts

Every active agent that observes a newer synchronization epoch must:

1. enter `PAUSED_FOR_SYNC` and stop new feature edits;
2. fetch/read the new `main` SHA;
3. merge current `main` into its branch or use another explicitly approved **non-destructive** method;
4. resolve owned-scope conflicts;
5. escalate Supervisor/shared conflicts;
6. rerun minimum verification needed after sync;
7. record new `synced_main_sha` and `sync_epoch`;
8. only then resume work.

Force-push/history rewrite is not the default sync method and cannot be used to bypass safeguards.

## Synchronization epoch / stale-branch protection

`.agent/supervisor.yaml` defines protocol/baseline seed. The latest Supervisor broadcast on issue #50 supplies live `sync_epoch` and integrated `main` SHA.

Every handoff records `synced_main_sha` and `sync_epoch`. A stale epoch invalidates completion until the branch is synchronized and appropriate verification is rerun.

## Verification independence

The implementation agent proves expected behavior. The verification/security agent separately tries to break it.

Relevant adversarial checks include invalid transitions, replay/idempotency, race/concurrency, stale state, tenant leakage, authorization/policy/budget bypass, append-only mutation, migration rollback/reapply, malformed input, contract/dependency drift, network/credential bypass, retry/cancel/dead-letter and provenance integrity.

Tests/invariants are fixed at implementation level and are not weakened merely to get green CI.

## Executable governance gate

The repository provides:

`pnpm run verify:parallel`

which runs `scripts/verify-parallel-development.mjs` and is also invoked by hosted CI.

The verifier fails closed for material governance drift, including missing canonical files/manifests, onboarding main-first drift, slot-plan disagreement, duplicate/invalid slot occupancy, missing exact rejection phrase, missing instruction-drift rules, concurrency/migration drift, missing Supervisor workflow contracts, missing branch plan, missing completion/sync signals or inconsistent machine-readable coordination policy.

When governance intentionally changes, update verifier and docs together. Do not weaken assertions only to make CI pass.

## Integration queue

A workstream may enter `READY_FOR_INTEGRATION` only when declared implementation is complete, valid completion signal exists, slot assignment is valid, branch is synchronized to latest epoch, `verify:parallel` passes, required verification passes, dependency assumptions remain valid, migration/ownership/shared-file conflicts are clear, docs are current and limitations are recorded.

The Supervisor determines final merge order from DAG/current integration state.

## Canonical workstream states

Use consistently:

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

A task has one active owner unless deliberately decomposed into separate child work packets.

## Agent Instruction Drift Check

Mandatory on **every task**.

### At task start

Read/check `README.md`, `AGENTS.md`, `docs/PROJECT_PLAN.md`, `docs/CHECKPOINT.md`, this document, `docs/AI_NATIVE_PLAN.md`, `docs/NEW_AGENT_ONBOARDING.md` when relevant, module docs/ADRs, `.agent/` manifests, latest issue #50 sync epoch, current `main`, own branch/head and required verification commands.

Repository/runtime/test evidence wins over stale prompts/checkpoints/memory.

### Before completion

Ask: **Did this task change how a future agent should work?**

Examples include onboarding/slot states, new/renamed modules, branch rules, Supervisor behavior, completion signal, sync behavior, migration rules, shared files, verification commands, CI gates, security boundaries, ownership, dependencies or mandatory context docs.

If yes, update relevant instructions in the same change set. At minimum check `AGENTS.md`, `README.md`, this document, `docs/AI_NATIVE_PLAN.md`, `docs/NEW_AGENT_ONBOARDING.md`, relevant module/checkpoint/ADR, `.agent/` manifests and governance verifier.

**No stale-instruction completion:** a work packet cannot be ready for integration while documented instructions are materially wrong/incomplete.

## Handoff contract

Every handoff includes task/workstream ID, agent ID/role/status, assigned slot ID, base/head SHA, branch/PR, `synced_main_sha`/`sync_epoch`, changed paths, contract/interface impact, migration impact/reservation, dependency assumptions, verification evidence, security/compliance impact, shared-file requests, limitations/non-scope, instruction-drift result and completion-signal state.

## Context minimization for speed

Agents receive task-specific context packs pointing to authoritative repository docs rather than reconstructing full history. Repository-wide audits are reserved for architecture/integration checkpoints or suspected cross-cutting drift.

## Merge discipline

Before each merge, the Supervisor checks exact head, latest sync epoch, slot assignment, dependency DAG, ownership/shared-file/migration collisions, reviews/comments, `verify:parallel`, exact-head FAST/FULL gates, instruction drift, mergeability/current base and expected-head protection. After merge it re-reads `main`, increments epoch and broadcasts.

Default branch history is not rewritten to bypass safeguards.

## Throughput metrics

Supervisor periodically reviews task lead time, dependency wait, merge conflicts, PR rework, CI queue/run time, failed integration rate, shared-file collisions, rejected/double onboarding attempts, stale-epoch submissions, sync conflict rate, stale-instruction corrections and defect escapes.

Increase concurrency only while these stay healthy.

## Safety boundaries

Parallelism/onboarding never authorizes broader product behavior. Tenant isolation, source policy, credentials, network/SSRF controls, provider activation, destructive actions, production deployment and human-approval gates remain independently authoritative.

## Adoption

This protocol applies to M02 and all future milestones. `docs/AI_NATIVE_PLAN.md` carries standing branch/module/slot occupancy; `docs/NEW_AGENT_ONBOARDING.md` defines arrival behavior; `AGENTS.md` is startup entrypoint; `.agent/slots.yaml` is machine-readable slot truth; `.agent/supervisor.yaml` defines Supervisor protocol/baseline; issue #50 carries live sync broadcasts; and `pnpm run verify:parallel` enforces governance.
