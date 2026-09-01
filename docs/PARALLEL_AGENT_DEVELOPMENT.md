# Brovexa Parallel Agent Development Protocol

Status: **ACTIVE ENGINEERING GOVERNANCE**

Updated: 2026-09-02

## Purpose

Brovexa uses bounded parallel AI-assisted development to reduce calendar time without allowing agents to overwrite one another, duplicate architecture, collide on migrations, silently widen contracts, drift from current `main`, or weaken integration gates.

The goal is not to make agents resolve more conflicts. The goal is to structure work so conflicts are uncommon by design and stale branches are detected before integration.

Canonical companion documents:

- `AGENTS.md` — mandatory operating instructions;
- `docs/AI_NATIVE_PLAN.md` — current branch/module/agent/merge plan;
- `docs/PROJECT_PLAN.md` — program architecture and permanent cross-cutting governance;
- `docs/CHECKPOINT.md` — latest integrated project state;
- `.agent/*.yaml` — machine-readable coordination state.

## Main-repository Supervisor

The agent operating the Main repository is the **Supervisor**.

The Supervisor is the sole integration authority for incoming agent workstreams under this workflow. It owns:

- creation of parallel module branches before documenting/assigning a new parallel wave;
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

Only after those branches exist may the Supervisor publish/update:

- module assignments;
- agent assignments;
- work packets;
- merge ordering;
- interface freeze points;
- dependency edges.

The current standing branches are recorded in `docs/AI_NATIVE_PLAN.md` and `.agent/workstreams.yaml`.

## Default operating capacity

Default target: **6 concurrent agents** when enough independent work exists.

1. **Supervisor / Integration Architecture**
2. **Contracts / Policy Agent**
3. **Database / Persistence Agent**
4. **Worker / Runtime Agent**
5. **Module / Connector Infrastructure Agent**
6. **Verification / Security Agent**

Scale to **8 concurrent agents** only when workstreams are truly independent and repository metrics show acceptable conflict, rework, CI queue and merge latency. More than 8 requires an explicit metrics-backed governance change.

## Core isolation rule

Default mapping:

`1 agent = 1 work packet = 1 isolated branch/worktree = 1 PR`

Two coding agents do not actively develop on the same branch. A standing module branch may host successive bounded work packets over time, but only one active work packet/owner is permitted on that branch unless explicitly decomposed.

## Work packet contract

Every parallel task defines before implementation:

- task/workstream ID;
- agent ID and role;
- module;
- branch and base SHA;
- current `synced_main_sha` and `sync_epoch`;
- goal and explicit non-goals;
- write scope;
- read-only/dependency scope;
- forbidden/shared paths;
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
- `docs/PROJECT_PLAN.md`, `docs/CHECKPOINT.md`, `docs/PARALLEL_AGENT_DEVELOPMENT.md`, `docs/AI_NATIVE_PLAN.md`;
- `.agent/**`;
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

This is a default priority, not an excuse to serialize independent nodes. Independent workstreams may merge earlier if the Supervisor verifies no dependency, ownership, migration, interface or shared-file collision.

A completion signal never overrides dependency order.

## Migration reservation

Migration identifiers are serialized resources.

Before creating a migration, the DB/Supervisor owner reserves it in `.agent/migrations.yaml`. Two agents must never independently choose the same number. Integrated migrations are immutable; prefer a new forward migration unless an explicit migration policy says otherwise.

## Task completion signal

When any agent, including the Supervisor, finishes its assigned task, it must announce the exact phrase:

**Work Done and Submitted**

For non-Supervisor agents, the canonical repository event is a **top-level PR comment whose complete body is exactly `Work Done and Submitted`**.

The signal means only:

`READY_FOR_SUPERVISOR_REVIEW`

It does **not** mean approved, verified or mergeable.

A valid completion submission also requires:

- open PR;
- exact head SHA;
- complete handoff;
- current dependency state;
- applicable test/CI evidence;
- security/compliance impact;
- Agent Instruction Drift Check result;
- `synced_main_sha` and `sync_epoch` matching the latest Supervisor epoch.

A stale branch may not issue a valid completion signal.

## Supervisor interrupt handling

The Supervisor also performs bounded work on `supervisor/integration-control`.

When a valid `Work Done and Submitted` event arrives, integration takes priority over the Supervisor's current feature/governance work.

State machine:

`WORKING → PAUSED_FOR_REVIEW → REVIEWING → MERGING | CHANGES_REQUESTED → BROADCASTING → WORKING`

Required behavior:

1. checkpoint/preserve the Supervisor's own current work;
2. enter `PAUSED_FOR_REVIEW`;
3. review the submitted exact head, diff, changed paths, dependencies, migration reservations, interface freeze assumptions, shared-file requests, review threads, security impact and verification evidence;
4. if changes are required, do not merge; return actionable review feedback and place the workstream back into work/review state;
5. if approved, require applicable exact-head FAST/FULL gates;
6. merge with expected-head SHA protection where supported;
7. re-read resulting `main` and record the resulting SHA;
8. increment the synchronization epoch;
9. broadcast the synchronization alert to all active agents;
10. resume the Supervisor's own paused work after the alert is issued, unless a direct dependency requires immediate follow-up.

### Multiple submissions

If multiple agents finish while the Supervisor is reviewing another submission, they enter a review queue.

Queue policy: **FIFO with dependency priority**.

A dependency-provider PR may be reviewed/merged before an earlier dependent submission. Overlapping merges are serialized so each successful merge establishes a single new `main` SHA and synchronization epoch before the next integration decision.

## Post-merge synchronization broadcast

After every approved merge, the Supervisor sends the exact alert:

**New changes have been merged — please merge these changes into your branch first, then resume your own work.**

Canonical durable broadcast channel: GitHub issue **#50**.

Each broadcast includes:

- merged PR/branch;
- resulting `main` SHA;
- synchronization epoch;
- relevant contract/migration/shared-file impact.

When active agent PRs exist, the Supervisor should also place the alert on each active PR so it appears in that agent's immediate work context.

## Agent response to synchronization alerts

Every active agent that observes a newer synchronization epoch must:

1. enter `PAUSED_FOR_SYNC` and stop new feature edits;
2. fetch/read the new `main` SHA;
3. merge current `main` into its branch or use another explicitly approved **non-destructive** synchronization method;
4. resolve conflicts inside its owned scope;
5. escalate shared/integration-owned conflicts to the Supervisor instead of independently rewriting those files;
6. rerun the minimum verification needed to prove the sync did not break the work packet;
7. record the new `synced_main_sha` and `sync_epoch`;
8. only then resume work.

Force-push/history rewrite is not the default sync method and cannot be used to bypass integration safeguards.

## Synchronization epoch / stale-branch protection

`.agent/supervisor.yaml` tracks the canonical synchronization epoch and current integrated `main` SHA.

Every agent handoff records:

- `synced_main_sha`;
- `sync_epoch`.

A completion submission is stale and invalid when its epoch is behind the latest Supervisor epoch. The agent must sync, rerun appropriate verification and then resubmit/confirm completion.

This prevents “passed yesterday against old main” work from silently entering today's merge queue.

## Verification independence

The implementation agent proves expected behavior. The verification/security agent separately tries to break it.

Relevant adversarial checks include:

- invalid transitions;
- replay/idempotency conflicts;
- race/concurrency behavior;
- stale state/time-bound policy;
- tenant leakage;
- authorization/policy/budget bypass;
- append-only mutation attempts;
- migration rollback/reapply;
- malformed/hostile input;
- contract/dependency drift;
- network/credential boundary bypass;
- retry/cancel/dead-letter behavior;
- provenance/evidence integrity.

Tests/invariants are fixed at implementation level and are not weakened merely to get green CI.

## Executable governance gate

The repository provides:

`pnpm run verify:parallel`

which runs `scripts/verify-parallel-development.mjs` and is also invoked by hosted CI.

The verifier fails closed for material governance drift, including missing canonical files/manifests, missing instruction-drift rules, default concurrency drift, migration manifest drift, missing Supervisor workflow contracts, missing branch plan, missing completion/sync signals, or inconsistent machine-readable coordination state.

When governance intentionally changes, update the verifier and documentation together. Do not weaken assertions only to make CI pass.

## Integration queue

A workstream may enter `READY_FOR_INTEGRATION` only when:

- declared implementation is complete;
- valid `Work Done and Submitted` signal exists;
- it is synchronized to the latest Supervisor epoch;
- `pnpm run verify:parallel` passes where applicable;
- required work-packet verification has passed;
- dependency assumptions remain valid;
- migration/ownership/shared-file conflicts are clear;
- required docs/instruction updates are complete;
- known limitations/non-scope are recorded.

The Supervisor determines final merge order from the DAG and current integration state.

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

Read/check:

1. `README.md`;
2. `AGENTS.md`;
3. `docs/PROJECT_PLAN.md`;
4. `docs/CHECKPOINT.md`;
5. `docs/PARALLEL_AGENT_DEVELOPMENT.md`;
6. `docs/AI_NATIVE_PLAN.md`;
7. relevant module docs/ADRs;
8. `.agent/` manifests, including Supervisor epoch;
9. current `main`, own branch/head and required verification commands.

Repository/runtime/test evidence wins over stale prompts/checkpoints/memory.

### Before completion

Ask: **Did this task change how a future agent should work?**

Examples include new/renamed modules, branch rules, Supervisor behavior, completion signal, sync behavior, migration rules, shared files, verification commands, CI gates, security boundaries, ownership, dependencies or mandatory context docs.

If yes, update the relevant instructions in the same change set. At minimum check `AGENTS.md`, `README.md`, this document, `docs/AI_NATIVE_PLAN.md`, relevant module/checkpoint/ADR, `.agent/` manifests and the governance verifier.

**No stale-instruction completion:** a work packet cannot be ready for integration while documented instructions are materially wrong or incomplete.

## Handoff contract

Every handoff includes:

- task/workstream ID;
- agent ID/role/status;
- base/head SHA;
- branch/PR;
- `synced_main_sha` and `sync_epoch`;
- changed paths;
- contract/interface impact;
- migration impact/reservation;
- dependency assumptions;
- verification evidence;
- security/compliance impact;
- shared-file integration requests;
- known limitations/non-scope;
- instruction-drift result;
- completion-signal state.

## Context minimization for speed

Agents receive task-specific context packs pointing to authoritative repository documents rather than repeatedly reconstructing full history. Repository-wide audits are reserved for architecture/integration checkpoints or when cross-cutting drift is suspected.

## Merge discipline

Before each merge, the Supervisor:

1. freezes/checks exact head SHA;
2. verifies latest synchronization epoch;
3. verifies dependency graph satisfaction;
4. resolves ownership/shared-file/migration collisions;
5. inspects review threads/comments;
6. runs/requires `pnpm run verify:parallel`;
7. runs/requires exact-head FAST/FULL gates;
8. runs instruction drift check;
9. revalidates mergeability/current base;
10. merges with expected-head protection where supported;
11. re-reads resulting `main`;
12. increments epoch and broadcasts to all active agents.

Default branch history is not rewritten to bypass safeguards.

## Throughput metrics

Supervisor periodically reviews:

- median task lead time;
- dependency wait time;
- merge-conflict frequency;
- PR rework after integration;
- CI queue/run time;
- failed integration rate;
- shared-file collisions;
- stale-epoch submissions;
- synchronization conflict rate;
- stale-instruction corrections;
- defect escapes after merge.

Increase concurrency only while these stay healthy.

## Safety boundaries

Parallelism never authorizes broader product behavior. Tenant isolation, source policy, credentials, network/SSRF controls, provider activation, destructive actions, production deployment and human-approval gates remain independently authoritative.

## Adoption

This protocol applies to M02 and all future milestones. The current standing branch/module/agent mapping lives in `docs/AI_NATIVE_PLAN.md`; `AGENTS.md` is the canonical startup instruction entrypoint; `.agent/supervisor.yaml` carries Supervisor coordination state; and `pnpm run verify:parallel` enforces the machine-readable governance contract.
