# Brovexa AI-Native Multi-Agent Plan

Status: **ACTIVE SUPERVISOR PLAN**

Updated: 2026-09-02

## Purpose

This plan defines Brovexa's standing multi-agent branches, module boundaries, assignment/integration strategy, and live coordination authorities. It complements `AGENTS.md`, `docs/PARALLEL_AGENT_DEVELOPMENT.md`, `docs/NEW_AGENT_ONBOARDING.md`, and `.agent/` manifests.

The Main-repository agent is the **Supervisor**. The Supervisor owns onboarding, live slot assignment/release, integration review, merge ordering, synchronization broadcasts, and its own bounded integration work.

## Immediate branch bootstrap

Before this plan was first published, the Supervisor created the standing branches required for the six-agent operating model. Historical bootstrap baseline:

`890618e28c5e300496389051b1b3d9c32880adf7`

Live synchronization must never be inferred from that historical SHA. Use the latest valid Supervisor broadcast comment on GitHub issue #50.

| Slot ID | Role / module | Branch | Default ownership | Merge strategy |
|---|---|---|---|---|
| `SUPERVISOR` | Integration Control / Architecture | `supervisor/integration-control` | shared files, integration policy, branch plan, merge queue | Integrate after exact-head verification; Supervisor changes use the same FULL-GATE discipline |
| `CONTRACTS` | Contracts / Policy | `agent/contracts-policy` | `packages/contracts/**` | Merge first when downstream work depends on a new/frozen public contract |
| `DATABASE` | Database / Persistence | `agent/database-persistence` | `packages/db/**` | Merge after required contract dependency; migration reservation required before SQL migration creation |
| `RUNTIME` | Worker / Runtime | `agent/worker-runtime` | `apps/worker/**`, `packages/queue/**` | Merge after required contract/persistence dependencies and current-main revalidation |
| `MODULE` | Module / Connector Infrastructure | `agent/module-infrastructure` | task-specific bounded paths declared in work packet | Merge according to explicit dependency DAG; no implicit shared-file ownership |
| `VERIFY` | Verification / Security | `agent/verification-security` | verifier/test paths within assigned packet | Independent adversarial verification; repository changes merge only when explicitly required |

These are standing coordination branches, not permission to implement unspecified work. Every concrete task still requires a bounded work packet, write scope, dependency declaration, acceptance criteria, and valid live slot assignment.

For future capacity expansion, the Supervisor creates all new standing branches **before** adding their definitions to this plan and `.agent/slots.yaml`. A newly arriving agent never creates extra capacity on demand.

## New Agent Onboarding and Live Slot Registry

A newly arriving agent must **always start from exact current `main`**. It may read the repository/instructions there, but it must not begin from or edit a standing module branch before Supervisor assignment.

### Standing slot definitions

Versioned static definition source: `.agent/slots.yaml`.

| Slot | Module branch | Assignable to new agent |
|---|---|---:|
| `SUPERVISOR` | `supervisor/integration-control` | No |
| `CONTRACTS` | `agent/contracts-policy` | Yes |
| `DATABASE` | `agent/database-persistence` | Yes |
| `RUNTIME` | `agent/worker-runtime` | Yes |
| `MODULE` | `agent/module-infrastructure` | Yes |
| `VERIFY` | `agent/verification-security` | Yes |

This versioned document and `.agent/slots.yaml` define **which slots exist**. They intentionally do not store current agent occupancy.

### Canonical live occupancy

GitHub issue **#53 — AI-Native Plan — Live Agent Slot Registry** is the canonical live `OPEN` / `OCCUPIED` state, assigned agent, start status, assigned-main SHA, sync epoch, and registry revision.

Operationally, the AI-Native Plan is composed of:

1. this versioned standing plan; and
2. issue #53 live slot registry.

This separation is deliberate: onboarding must not wait for a documentation PR/FULL-GATE merely to record a temporary agent assignment.

### Supervisor onboarding transaction

When a new agent arrives:

1. require the agent to initialize from exact current `main` and read canonical instructions;
2. read latest issue #50 synchronization epoch/main SHA;
3. read `.agent/slots.yaml` static definitions;
4. **re-read issue #53 immediately before assignment**;
5. consider only pre-planned slots that are statically assignable and live status exactly `OPEN`;
6. if an `OPEN` slot exists, select the slot appropriate to the ready bounded work packet/agent capability;
7. verify/fast-forward the idle standing branch to current `main` and latest sync epoch before the new agent switches to it;
8. update issue #53 atomically from the Supervisor perspective: `OPEN → OCCUPIED`, assigned agent, start status, current main SHA, sync epoch, and incremented registry revision;
9. **re-read issue #53 after the update** and confirm that the intended agent owns the intended slot;
10. only then hand the assigned branch/work packet to the agent and allow feature work.

Onboarding decisions are serialized by the Supervisor. Two arrivals cannot simultaneously claim one slot.

If **no assignable live slot is `OPEN`**, the Supervisor stops onboarding immediately and responds exactly:

**Go Home Come Back Next Time**

No slot/branch/task/work packet/feature edit/agent PR is created for that rejected arrival.

### Slot release

A slot returns to `OPEN` only by explicit Supervisor action after there is no active work packet or unmerged work requiring that slot. Before release, the Supervisor synchronizes the idle standing branch to current `main`. It then updates issue #53, clears the assigned agent, sets `WAITING`, records current main SHA/epoch, increments registry revision, and re-reads the registry to confirm release.

Live assignment/release does **not** require a repository governance PR when standing slot definitions and rules did not change.

## Live synchronization authority

Canonical live synchronization state is the latest valid Supervisor broadcast comment on GitHub issue **#50 — Multi-Agent Supervisor Broadcast Channel**. Each broadcast carries the newest:

- `sync_epoch`;
- resulting `main` SHA;
- merged PR/branch;
- cross-workstream impact.

`.agent/supervisor.yaml` defines protocol/baseline rules. Issue #50 is the live source so every merge does not require a recursive state-only PR.

Issue #50 and issue #53 have separate responsibilities:

- issue #50 = current integrated `main` + synchronization epoch;
- issue #53 = current slot occupancy/agent assignment.

## Merge priority and dependency strategy

Merge order is **dependency-driven**, not first-finished-first-merged.

Default ordering when all corresponding layers are required:

1. public contract / policy freeze;
2. persistence / migration implementation;
3. bounded module or connector infrastructure;
4. worker/runtime integration;
5. independent verification/security repository changes;
6. Supervisor shared-file/integration reconciliation.

Independent branches may merge earlier when their `depends_on` set is empty and the Supervisor verifies there is no interface, migration, ownership, or shared-file collision.

A completed branch is never merged solely because it announced completion. The Supervisor reviews the exact head, current live slot assignment, dependencies, shared-file requests, verification evidence, and mergeability.

## Completion signal

When any agent, including the Supervisor, finishes its assigned work packet, it must explicitly announce:

**Work Done and Submitted**

For a non-Supervisor agent, the canonical repository signal is a **top-level PR comment whose entire body is exactly `Work Done and Submitted`**.

The phrase means **ready for Supervisor review**, not automatically approved or merged.

A valid completion signal is **head-bound**:

- PR body/current handoff exact head SHA must equal the current PR head;
- the latest exact completion-signal comment must be posted after the current head commit exists;
- any new commit after the signal invalidates that signal and the agent must re-announce after re-verification.

The handoff must also contain current verification evidence, dependency state, assigned slot ID, current issue #50 synchronization epoch/main SHA, instruction-drift result, and known limitations.

## Supervisor interrupt state machine

The Supervisor may work on its own bounded module on `supervisor/integration-control`, but valid completed submissions take integration priority.

When a valid `Work Done and Submitted` signal is observed:

1. preserve/checkpoint current Supervisor work and enter `PAUSED_FOR_REVIEW`;
2. review PR exact head, live slot ownership from issue #53, changed paths, dependencies, migration reservations, review threads, security impact, verification evidence, and signal freshness;
3. request changes without merge when defects exist;
4. if approved, require applicable exact-head gates;
5. merge with expected-head protection;
6. re-read resulting `main`;
7. increment issue #50 synchronization epoch and broadcast;
8. alert active agents;
9. resume paused Supervisor work unless dependency priority requires immediate follow-up.

Supervisor states:

`WORKING → PAUSED_FOR_REVIEW → REVIEWING → MERGING | CHANGES_REQUESTED → BROADCASTING → WORKING`

Multiple submissions use FIFO review order subject to dependency priority. Overlapping merges are serialized.

## Post-merge synchronization alert

Canonical alert text:

**New changes have been merged — please merge these changes into your branch first, then resume your own work.**

Durable broadcast channel: GitHub issue **#50**.

Each broadcast includes merged branch/PR, resulting `main` SHA, monotonically increasing sync epoch, and relevant cross-workstream impact.

The Supervisor should also post the alert on each active agent PR when one exists.

## Agent reaction to synchronization alerts

Every active agent receiving a newer epoch must:

1. pause new feature edits and enter `PAUSED_FOR_SYNC`;
2. fetch/read the new `main` SHA;
3. merge current `main` into its branch or use another explicitly approved non-destructive method;
4. resolve owned-scope conflicts and escalate Supervisor/shared conflicts;
5. rerun minimum required verification;
6. record `synced_main_sha` and `sync_epoch` in handoff/current task state;
7. only then resume feature work.

Force-push/history rewrite is not the default synchronization mechanism.

## Main-branch integration integrity

Direct pushes to `main` are prohibited by project governance. Normal integration is PR + exact-head FULL GATE + expected-head merge.

Hosted CI must run both on pull requests and on `push` to `main`. Main-push CI includes an integration-provenance check that verifies the resulting main commit is associated with a merged PR targeting `main`.

GitHub branch protection/ruleset remains the external repository-setting layer and should require PRs/status checks and block force pushes/deletions. The repository-level provenance guard exists so an accidental direct push is visible/failing even before that external setting is applied.

## Stale-branch rule

An agent must not submit completion if its recorded issue #50 synchronization epoch is behind the latest broadcast. It must synchronize first, rerun required verification, and then re-announce completion.

## Assignment lifecycle

Standing slot identity and branch ownership persist across work packets in this document/`.agent/slots.yaml`.

Live slot ownership exists only in issue #53. Concrete active task state exists in work packet, branch/PR, and handoff.

This avoids two expensive stale-state patterns:

- a repository PR for every temporary agent assignment/release;
- versioned `WORKING` state that remains stale after work is merged.

## Instruction drift

Any change to branch names, slot definitions, issue #53 live-registry protocol, onboarding, Supervisor behavior, completion-signal freshness, synchronization alerts, merge order, workstream states, CI integration integrity, or acknowledgement rules must update this document, `AGENTS.md`, `README.md`, `docs/PARALLEL_AGENT_DEVELOPMENT.md`, `docs/NEW_AGENT_ONBOARDING.md`, relevant `.agent/` manifests, and `pnpm run verify:parallel` enforcement in the same change set.
