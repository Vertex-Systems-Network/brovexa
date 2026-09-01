# Brovexa AI-Native Multi-Agent Plan

Status: **ACTIVE SUPERVISOR PLAN**

Updated: 2026-09-02

## Purpose

This document is the canonical branch/module/agent integration plan for parallel repository development. It complements `AGENTS.md`, `docs/PARALLEL_AGENT_DEVELOPMENT.md` and the machine-readable `.agent/` manifests.

The Main-repository agent is the **Supervisor**. The Supervisor owns integration review, merge ordering, synchronization broadcasts and resumption of its own bounded work after handling completed submissions.

## Immediate branch bootstrap

Before this plan was documented, the Supervisor created the standing branches required for the current six-agent operating model. All branches were then synchronized to the verified governance baseline merged to `main` at:

`890618e28c5e300496389051b1b3d9c32880adf7`

| Agent ID | Role / module | Branch | Default ownership | Merge strategy |
|---|---|---|---|---|
| `SUPERVISOR` | Integration Control / Architecture | `supervisor/integration-control` | shared files, integration policy, branch plan, merge queue | Integrate after exact-head verification; Supervisor changes follow the same FULL-GATE discipline |
| `AGENT-CONTRACTS` | Contracts / Policy | `agent/contracts-policy` | `packages/contracts/**` | Merge first when downstream work depends on a new/frozen public contract |
| `AGENT-DB` | Database / Persistence | `agent/database-persistence` | `packages/db/**` | Merge after required contract dependency; migration reservation required before SQL migration creation |
| `AGENT-RUNTIME` | Worker / Runtime | `agent/worker-runtime` | `apps/worker/**`, `packages/queue/**` | Merge after required contract/persistence dependencies and current-main revalidation |
| `AGENT-MODULE` | Module / Connector Infrastructure | `agent/module-infrastructure` | task-specific bounded paths declared in work packet | Merge according to explicit dependency DAG; no implicit shared-file ownership |
| `AGENT-VERIFY` | Verification / Security | `agent/verification-security` | verifier/test paths within assigned packet | Normally reviews/tests implementation branches; independent verifier changes merge only when explicitly required |

These are standing coordination branches, not permission to implement unspecified work. Every concrete task still requires a bounded work packet, write scope, dependency declaration and acceptance criteria.

## Merge priority and dependency strategy

Merge order is **dependency-driven**, not first-finished-first-merged.

Default ordering when all corresponding layers are required:

1. public contract / policy freeze;
2. persistence / migration implementation;
3. bounded module or connector infrastructure;
4. worker/runtime integration;
5. independent verification/security changes when repository changes are required;
6. Supervisor shared-file/integration reconciliation.

Independent branches may merge earlier when their `depends_on` set is empty and the Supervisor verifies there is no interface, migration, ownership or shared-file collision.

A completed branch is never merged solely because it announced completion. The Supervisor reviews the exact head, checks dependencies, resolves shared-file requests, requires applicable CI/FULL-GATE evidence and merges with an expected-head SHA guard where supported.

## Completion signal

When any agent, including the Supervisor, finishes its assigned work packet, it must explicitly announce the exact phrase:

**Work Done and Submitted**

For a non-Supervisor agent, the canonical repository signal is a **top-level comment on its pull request whose entire body is exactly `Work Done and Submitted`**. The signal is valid only when the PR also has a complete handoff containing the exact head SHA, verification evidence, dependency state, instruction-drift result and known limitations.

The phrase means **ready for Supervisor review**, not automatically approved or merged.

## Supervisor interrupt state machine

The Supervisor may work on its own bounded module on `supervisor/integration-control`, but completed agent submissions take integration priority.

When a valid `Work Done and Submitted` signal is observed:

1. Supervisor records/retains the current checkpoint of its own work and enters `PAUSED_FOR_REVIEW`.
2. Supervisor inspects the submitted PR, exact head SHA, changed paths, dependency assumptions, migration reservations, review threads, security impact and verification evidence.
3. If defects exist, Supervisor leaves the branch unmerged, returns actionable review feedback, and resumes its own work unless another valid submission is waiting.
4. If approved, Supervisor runs/requires the repository's applicable exact-head gates and merges using the expected-head guard.
5. Supervisor re-reads resulting `main`, records the resulting main SHA and increments the synchronization epoch.
6. Supervisor broadcasts the canonical alert to all active agents.
7. Supervisor resumes its paused work only after issuing the alert; it does not need to wait for every agent to finish synchronizing before resuming unless a direct dependency requires that acknowledgement.

Supervisor states:

`WORKING → PAUSED_FOR_REVIEW → REVIEWING → MERGING | CHANGES_REQUESTED → BROADCASTING → WORKING`

## Post-merge synchronization alert

Canonical alert text:

**New changes have been merged — please merge these changes into your branch first, then resume your own work.**

Durable broadcast channel: GitHub issue **#50 — Multi-Agent Supervisor Broadcast Channel**.

Each broadcast must include:

- merged branch / PR;
- resulting `main` SHA;
- monotonically increasing synchronization epoch;
- any contract/migration/shared-file impact requiring special attention.

The Supervisor should also post the alert on each active agent PR when one exists so the alert is visible in the agent's immediate work context.

## Agent reaction to synchronization alerts

Every active agent receiving a newer synchronization epoch must stop making new changes long enough to synchronize first.

Required sequence:

1. fetch/read the new `main` SHA and broadcast epoch;
2. merge current `main` into the agent branch or use another explicitly approved non-destructive synchronization method;
3. resolve conflicts inside the agent's owned scope; shared-file conflicts are escalated to the Supervisor;
4. rerun the minimum verification needed to prove the synchronization did not break the work packet;
5. record `synced_main_sha` and `sync_epoch` in the handoff/workstream state;
6. only then resume feature work.

Force-push/history rewrite is not the default synchronization mechanism and must not be used to bypass integration safeguards.

## Stale-branch rule

An agent must not submit `Work Done and Submitted` if its recorded synchronization epoch is behind the latest Supervisor broadcast epoch. It must synchronize first, rerun required verification, then submit.

This prevents a branch that was valid against an older `main` from entering the integration queue without current-main validation.

## Supervisor review queue

If multiple agents submit while the Supervisor is already reviewing one branch, submissions enter a FIFO review queue **subject to dependency priority**. A dependency provider may be reviewed before an earlier dependent submission when required to preserve valid merge order.

The Supervisor never merges two overlapping branches concurrently. Each merge establishes a new `main` SHA/sync epoch before the next dependent integration decision.

## Current bootstrap assignments

At protocol bootstrap, branch ownership is established but concrete feature work is not auto-started. The Supervisor/integration branch owns this workflow implementation. Other standing branches remain available for the next bounded work packets after the Supervisor publishes assignments/dependencies.

## Instruction drift

Any change to branch names, Supervisor behavior, submission signaling, synchronization alerts, merge order, workstream states or acknowledgement requirements must update this document, `AGENTS.md`, `README.md`, `docs/PARALLEL_AGENT_DEVELOPMENT.md`, relevant `.agent/` manifests and the executable `pnpm run verify:parallel` contract in the same change set.
