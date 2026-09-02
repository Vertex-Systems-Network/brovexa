# Brovexa AI-Native Multi-Agent Plan

Status: **ACTIVE SUPERVISOR PLAN**

Updated: 2026-09-02

## Purpose

This plan defines standing branches/modules/slots and integration order. It complements `AGENTS.md`, `docs/PARALLEL_AGENT_DEVELOPMENT.md`, `docs/NEW_AGENT_ONBOARDING.md`, `docs/AGENT_BRANCH_LEASES.md`, and `.agent/` manifests.

The Main-repository agent is the **Supervisor**. Supervisor owns onboarding, issue #53 logical slot assignment, dependency-safe review/merge, issue #50 synchronization broadcasts, and integration. Supervisor is not exempt from live-instance leases.

## Immediate branch bootstrap

New capacity is branch-first: create all required standing branches before adding slots/assignments. A new agent never creates capacity on arrival.

Historical bootstrap baseline: `890618e28c5e300496389051b1b3d9c32880adf7`. Live state comes from issue #50/#53 and `coordination/leases`, not this historical SHA.

| Slot ID | Role / module | Branch | Default ownership | Merge strategy |
|---|---|---|---|---|
| `SUPERVISOR` | Integration Control / Architecture | `supervisor/integration-control` | shared/integration files | Exact-head FULL GATE then expected-head merge |
| `CONTRACTS` | Contracts / Policy | `agent/contracts-policy` | `packages/contracts/**` | Before dependent persistence/runtime contracts |
| `DATABASE` | Database / Persistence | `agent/database-persistence` | `packages/db/**` | After required contract; migration reservation required |
| `RUNTIME` | Worker / Runtime | `agent/worker-runtime` | `apps/worker/**`, `packages/queue/**` | After required contract/persistence dependencies |
| `MODULE` | Module / Connector Infrastructure | `agent/module-infrastructure` | bounded work-packet paths | Dependency-DAG order |
| `VERIFY` | Verification / Security | `agent/verification-security` | bounded verifier/test paths | Independent adversarial verification |

Every task still requires bounded scope, dependencies, current live slot ownership, and an exact-instance lease.

## New Agent Onboarding and Live Slot Registry

Every new agent starts from exact current `main`. It may not mutate a standing module branch before assignment and lease acquisition.

### Standing slot definitions

Static source: `.agent/slots.yaml`.

| Slot | Module branch | Assignable to new agent |
|---|---|---:|
| `SUPERVISOR` | `supervisor/integration-control` | No |
| `CONTRACTS` | `agent/contracts-policy` | Yes |
| `DATABASE` | `agent/database-persistence` | Yes |
| `RUNTIME` | `agent/worker-runtime` | Yes |
| `MODULE` | `agent/module-infrastructure` | Yes |
| `VERIFY` | `agent/verification-security` | Yes |

This document and `.agent/slots.yaml` intentionally do not store temporary occupancy or live leases.

### Canonical live authorities

- latest valid Supervisor broadcast comment on issue **#50** = integrated `main` SHA + `sync_epoch`;
- GitHub issue **#53** = logical `OPEN` / `OCCUPIED` slot state + assigned agent;
- Git branch **`coordination/leases`** = exact live runtime/session allowed to mutate each occupied slot, via `.leases/<SLOT_ID>.json`.

Full lease rules: `docs/AGENT_BRANCH_LEASES.md`.

### Supervisor onboarding transaction

1. New agent reads exact current `main` and canonical instructions.
2. Supervisor reads latest issue #50 and `.agent/slots.yaml`.
3. Supervisor re-reads issue #53 immediately before assignment.
4. Select only statically assignable live `OPEN` slot; sync its idle branch to current main.
5. Update issue #53 `OPEN → OCCUPIED` with agent/start/main/epoch/revision and re-read to confirm.
6. Generate unique `agent_instance_id` and `lease_id`.
7. Atomically create `.leases/<SLOT_ID>.json` on `coordination/leases`.
8. Existing lease means STOP: do not overwrite/take over and do not mutate the branch.
9. Only after both issue #53 ownership and exact-instance lease are valid may work begin.

If no assignable live slot is `OPEN`, respond exactly:

**Go Home Come Back Next Time**

No slot/branch/task/work packet/feature edit/agent PR is created for that arrival.

### Release

Release requires no active/unmerged work, compare-and-swap deletion of the current live lease, idle branch synchronization to current main, issue #53 update to `OPEN`/`WAITING`, revision increment, and registry re-read.

Temporary assignment/release and lease acquire/renew/release are live coordination transactions and do not require governance PRs when policy/definitions are unchanged.

## Synchronization

Issue #50 is the live synchronization ledger. On a newer epoch an active holder pauses edits, synchronizes current main non-destructively, reruns minimum verification, renews the same lease via current blob SHA with new `synced_main_sha`/`sync_epoch`, then resumes.

Canonical post-merge alert:

**New changes have been merged — please merge these changes into your branch first, then resume your own work.**

Force-push/history rewrite is not the default synchronization mechanism.

## Dependency and merge strategy

Default ordering when all layers are required:

1. contracts/policy;
2. persistence/migration;
3. bounded module infrastructure;
4. worker/runtime;
5. independent verification changes;
6. Supervisor shared/integration reconciliation.

Independent branches may merge earlier when dependency/interface/migration/ownership/shared-file/lease collisions are absent. Completion never overrides dependency order.

## Completion signal

Finished work announces exactly:

**Work Done and Submitted**

For non-Supervisor agents this is a top-level PR comment whose body is exactly that phrase. It means ready for review, not approval.

The signal is head-bound: current PR head must equal handoff exact head and the latest signal must postdate that head. Any later commit invalidates the signal.

A valid submission additionally requires issue #53 logical ownership, matching active lease (`agent_instance_id`, `lease_id`, work packet, branch, sync state), dependency/verification evidence, instruction-drift completion, and current issue #50 epoch.

## Supervisor review / interrupt

On a valid completion signal Supervisor pauses its own work, reviews exact head, signal freshness, issue #53 ownership, active lease, dependencies, migrations/shared files, reviews/security/evidence, requires exact-head gates, then either requests changes or expected-head merges. After merge it re-reads main, increments issue #50 epoch, broadcasts, then resumes.

Multiple submissions are FIFO subject to dependency priority; overlapping merges are serialized.

## Main integration integrity

Direct pushes to `main` are prohibited. Normal flow is PR → exact-head FULL GATE → expected-head merge. Hosted CI also runs on `push` to main and verifies merged-PR provenance.

Native GitHub branch protection remains required as the preventive external repository setting; issue #54 tracks it until enabled.

## Instruction drift

Changes to branches, slot definitions, issue #53, `coordination/leases`, `docs/AGENT_BRANCH_LEASES.md`, onboarding, Supervisor behavior, completion freshness, synchronization, merge order, CI/integration integrity, or agent handoff requirements must update `AGENTS.md`, `README.md`, `docs/PARALLEL_AGENT_DEVELOPMENT.md`, `docs/NEW_AGENT_ONBOARDING.md`, relevant `.agent/` manifests and executable governance in the same change set.
