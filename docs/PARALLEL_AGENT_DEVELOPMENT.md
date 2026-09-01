# Brovexa Parallel Agent Development Protocol

Status: **ACTIVE ENGINEERING GOVERNANCE**

Updated: 2026-09-02

## Purpose

Brovexa is large enough that sequential AI-assisted development unnecessarily slows delivery. This protocol defines a reusable multi-agent operating model for current and future milestones while preserving architecture, data integrity, security, policy and verification guarantees.

The goal is not to make agents resolve more merge conflicts. The goal is to structure work so conflicting edits are uncommon by design.

## Default operating capacity

Default target: **6 concurrent agents** when enough independent work exists.

Recommended roles:

1. **Integration / Architecture Controller** — owns dependency graph, interface freeze points, shared-file integration, merge order and final current-main verification.
2. **Contracts / Policy Agent** — owns bounded public schemas, interfaces, policy contracts and compatibility implications.
3. **Database / Persistence Agent** — owns migrations, persistence APIs, DB invariants, rollback and data-integrity verification.
4. **Worker / Runtime Agent** — owns queue/worker/runtime lifecycle, retry/cancel/idempotency and execution integration.
5. **Module / Connector Infrastructure Agent** — owns the current milestone-specific bounded implementation that does not overlap the above ownership.
6. **Verification / Security Agent** — independently attempts to break the implementation and verifies failure, security, concurrency, isolation and regression paths.

Scale to **8 concurrent agents** only when workstreams are truly independent and the integration controller can prove clear ownership/dependency boundaries. More than 8 concurrent agents requires evidence from actual repository metrics that conflict rate, rework, CI queueing and merge latency remain acceptable.

## Core isolation rule

Default mapping:

`1 agent = 1 work packet = 1 isolated branch/worktree = 1 PR`

Two coding agents do not actively develop on the same branch. Shared integration is performed by the integration owner after bounded work has a stable handoff.

## Work packet contract

Every parallel task must define before implementation:

- stable task/workstream ID;
- goal and explicit non-goals;
- base branch/SHA;
- write scope;
- read-only/dependency scope;
- forbidden/shared paths;
- required public contracts;
- dependency IDs/SHAs;
- migration reservation if applicable;
- acceptance criteria;
- required tests/evals/gates;
- security/compliance constraints;
- expected handoff artifacts.

Agents must not invent missing cross-module behavior merely to unblock themselves. Missing contract/dependency information becomes an explicit interface/dependency request.

## Module/path ownership

Ownership is a coordination mechanism, not permanent code silos. A task may be granted additional paths explicitly, but broad edits are not implicit.

Typical ownership classes:

- contracts/policy: `packages/contracts/**`;
- database/persistence: `packages/db/**`;
- runtime/worker: `apps/worker/**`, queue integration paths when explicitly assigned;
- API: API application paths when explicitly assigned;
- UI: web/client surfaces when explicitly assigned;
- verification: relevant test/eval/verifier paths, without weakening implementation invariants;
- integration-only/shared: root manifests, lockfiles, central exports, canonical aggregate verifier lists, CI workflows and global checkpoint/governance files when multiple workstreams would otherwise collide.

The active machine-readable allocation lives under `.agent/`.

## Shared-file discipline

High-conflict paths are integration-owned by default, including examples such as:

- root `package.json` / `pnpm-lock.yaml`;
- shared package manifests when multiple workstreams depend on them;
- central `index.ts`/barrel exports touched by multiple agents;
- `.github/workflows/**`;
- global verification aggregators such as root DB/queue orchestration scripts;
- `README.md`, `AGENTS.md`, `docs/CHECKPOINT.md` and cross-cutting governance docs.

A feature agent may prepare the exact requested integration change, but should not race another agent on a shared file. The integration owner composes shared-file edits whenever parallel collision risk exists.

## Contract-first parallelism and interface freeze

Parallel work should begin from a narrow public contract whenever possible.

Example:

`contract/interface freeze → persistence/runtime/security implementations in parallel → integration`

An interface freeze records the version/SHA a dependent task is implementing against. A dependent agent may use that frozen contract but must not silently widen it. Contract changes after freeze require dependency impact review and explicit revalidation of affected workstreams.

## Dependency DAG

Parallel work is governed as a directed acyclic graph, not a flat list of PRs.

Each task declares `depends_on`. Independent nodes may run concurrently. A dependent PR may be stacked temporarily on a dependency branch only when the dependency SHA is explicit. Before final merge, it must be rebased/recreated/revalidated against the current integrated `main` context as required by repository policy.

Random merge ordering is prohibited when task dependencies exist.

## Migration reservation

Database migration identifiers are a serialized resource.

Before creating a migration, the DB/integration owner reserves the identifier in `.agent/migrations.yaml`. Two agents must never independently create the same migration number. Reservations include task, branch and status.

Changing an existing released/integrated migration is prohibited unless the repository's explicit migration policy authorizes it. Prefer a new forward migration.

## Verification independence

The implementation agent proves expected behavior. The verification/security agent separately searches for unsafe behavior.

Verification should include relevant checks such as:

- invalid state transitions;
- replay/idempotency conflicts;
- race/concurrency behavior;
- stale state and time-bound policy behavior;
- cross-tenant leakage;
- authorization bypass;
- budget/quota bypass;
- append-only mutation attempts;
- migration rollback/reapply;
- malformed/hostile input;
- dependency/contract drift;
- network/credential boundary bypass;
- cancellation/retry/dead-letter behavior;
- provenance/evidence integrity.

A failing test is fixed at the implementation/invariant level. Tests are not weakened merely to obtain green CI.

## Integration queue

A workstream may enter `READY_FOR_INTEGRATION` only when:

- its declared implementation is complete;
- required local/repository verification for that work packet has passed;
- dependency assumptions are still valid;
- migration and ownership conflicts are clear;
- required documentation/instruction updates are complete;
- known limitations/non-scope are recorded.

The integration controller determines merge order from the dependency graph, integrates shared files, and requires the repository's required exact-head verification before merge.

## Canonical workstream states

Use these states consistently:

- `PLANNED`
- `CLAIMED`
- `WORKING`
- `BLOCKED`
- `READY_FOR_REVIEW`
- `READY_FOR_INTEGRATION`
- `INTEGRATING`
- `VERIFIED`
- `MERGED`
- `SUPERSEDED`

A task may have only one active owner unless it is deliberately decomposed into separate child work packets.

## Agent Instruction Drift Check

This is mandatory on **every task**, not just documentation tasks.

### At task start

The agent must verify that its working instructions still match repository reality by reading:

1. `README.md`;
2. `AGENTS.md`;
3. `docs/PROJECT_PLAN.md`;
4. `docs/CHECKPOINT.md`;
5. this document;
6. relevant module docs/ADRs;
7. `.agent/` coordination manifests;
8. current branch/head and relevant CI/verification commands.

If a prompt, old checkpoint or remembered instruction conflicts with repository/runtime/test evidence, repository evidence wins.

### Before task completion

The agent must ask: **Did this task change how a future agent should work?**

Examples:

- new/renamed package or module;
- new branch/worktree requirement;
- new migration allocation rule;
- new shared file;
- changed verification command;
- changed CI gate;
- changed security/policy boundary;
- changed ownership rule;
- changed dependency/integration sequence;
- new mandatory context/checkpoint document;
- new activation/non-scope rule.

If yes, the same PR/change set must update the agent instructions. At minimum, check `AGENTS.md` and `README.md`, then update this document and any relevant module/checkpoint/ADR. If no update is necessary, the handoff must explicitly state that instruction drift was checked and none was found.

**No stale-instruction completion:** a work packet cannot be `READY_FOR_INTEGRATION` while its implementation makes the documented working instructions materially wrong or incomplete.

## Handoff contract

Every agent handoff should include:

- task/workstream ID;
- role/owner;
- status;
- base and head SHA;
- branch/PR;
- changed paths;
- contract/interface impact;
- migration impact/reservation;
- dependency assumptions;
- verification evidence;
- security/compliance impact;
- shared-file integration requests;
- known limitations/non-scope;
- instruction-drift result and docs updated.

This lets a replacement agent resume without reconstructing the complete repository history.

## Context minimization for speed

Agents should receive task-specific context packs instead of repeatedly re-auditing the entire repository. Context packs should point to authoritative repository documents rather than copy large stale snapshots. They must include current task boundaries, relevant architecture, invariants, dependencies and exact acceptance criteria.

Deep repository-wide audit remains appropriate for architecture/integration checkpoints, not every bounded feature implementation.

## Merge discipline

Before an integration merge:

1. freeze/check exact head SHA;
2. verify dependency graph satisfaction;
3. verify ownership/shared-file/migration collisions are resolved;
4. inspect review threads/comments;
5. run required exact-head FAST/FULL gates;
6. run instruction drift/documentation check;
7. verify mergeability/current base context;
8. merge with expected-head protection where supported;
9. re-read resulting `main` and record integration evidence when required.

Default branch history must not be rewritten to bypass integration safeguards.

## Safety boundaries

Parallelism never authorizes broader product behavior. Existing product gates remain authoritative, including tenant isolation, source policy, credential handling, network/SSRF controls, provider activation, destructive actions, production deployment and human approval for high-impact external actions.

An agent cannot infer authorization merely because another workstream is building an adjacent interface.

## Throughput metrics

The integration owner should periodically review:

- median task lead time;
- time waiting on dependencies;
- merge-conflict frequency;
- PR rework after integration;
- CI queue/run time;
- failed integration rate;
- number of shared-file collisions;
- number of stale-instruction corrections;
- defect escapes after merge.

Increase concurrency only when these metrics remain healthy. If coordination overhead rises, reduce active agents or decompose work differently rather than weakening gates.

## Adoption

This protocol is cross-cutting and applies to M02 and all future milestones. `docs/PROJECT_PLAN.md` references it as a permanent engineering execution layer. `AGENTS.md` is the canonical startup instruction entrypoint.