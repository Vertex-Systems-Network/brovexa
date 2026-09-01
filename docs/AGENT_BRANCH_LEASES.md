# Brovexa Atomic Agent Branch Leases

Status: **ACTIVE MULTI-AGENT COORDINATION CONTRACT**

## Purpose

Live slot ownership in GitHub issue #53 answers **which logical agent owns a module lane**. It does not, by itself, prevent two concurrent runtime/session instances using the same logical agent identity from mutating the same lane at the same time.

Brovexa therefore uses a second, independent control: an **atomic per-slot branch lease**.

Invariant:

`one occupied slot = at most one live mutating agent instance`

Slot ownership and branch leases are both required. Neither replaces the other.

## Lease branch

Canonical lease state lives on the dedicated branch:

`coordination/leases`

Lease records are intentionally kept off feature branches and off `main` so acquisition/release does not require a product/governance merge.

Each slot has exactly one possible active lock path:

- `.leases/SUPERVISOR.json`
- `.leases/CONTRACTS.json`
- `.leases/DATABASE.json`
- `.leases/RUNTIME.json`
- `.leases/MODULE.json`
- `.leases/VERIFY.json`

A lease file exists only while a live instance owns the right to mutate that slot's work branch.

## Atomic acquisition

Before the first mutation to an assigned work branch, the agent must have:

1. current issue #50 synchronization SHA/epoch;
2. valid issue #53 live slot assignment;
3. a unique `agent_instance_id` for this runtime/session;
4. a unique `lease_id` for this lease;
5. a bounded `work_packet_id` and exact starting branch head.

The agent then creates the slot's lease path on `coordination/leases` using an atomic create operation.

If the file already exists, acquisition **fails closed**. The new instance must not edit, merge, rebase, force-push, commit, or otherwise mutate the work branch.

Do not overwrite an existing lease merely because `agent_id` or `slot_id` matches. Two instances of the same logical agent are still different writers.

## Lease record

Every active lease is JSON containing at least:

- `version`;
- `state: "ACTIVE"`;
- `branch`;
- `slot_id`;
- `agent_id`;
- `agent_instance_id`;
- `work_packet_id`;
- `lease_id`;
- `synced_main_sha`;
- `sync_epoch`;
- `acquired_branch_head_sha`;
- `acquired_at`;
- `renewed_at`.

`agent_instance_id` and `lease_id` must be unique opaque IDs, not shared role names.

## Renewal / compare-and-swap

Lease renewal uses the current lease blob SHA. GitHub rejects a stale update when another transaction changed the file first.

Renewal may update operational metadata such as `renewed_at`, synchronized main SHA/epoch, or current work context, but it must not silently transfer ownership to another `agent_instance_id` or `lease_id`.

A lease holder that cannot prove the current lease blob SHA must re-read the lease before continuing.

## Release

Normal release deletes the slot lease using the current lease blob SHA after:

1. the work packet is merged, cancelled, or explicitly abandoned;
2. no unsubmitted mutation remains that needs preservation;
3. the live slot registry is updated/released as applicable;
4. the agent has stopped writing the branch.

Deletion with the current blob SHA provides compare-and-swap protection against releasing a lease that has changed since the holder last read it.

## Crash / stale lease recovery

Leases do not expire silently. Time alone is insufficient evidence that an agent is dead.

A stale lease may be recovered only by the Supervisor (or repository owner when the Supervisor lease itself is stale) after auditing:

- current lease contents/blob SHA;
- issue #53 slot owner;
- branch head and divergence from current `main`;
- open PRs and completion signals;
- unmerged/unsubmitted work that must be preserved;
- whether the previous live instance is actually cancelled/unavailable.

Recovery is explicit: preserve or close old work as needed, delete the old lease with its exact blob SHA, then acquire a new lease with a new `agent_instance_id` and `lease_id`.

No force-reset or silent takeover is allowed as a lease-recovery shortcut.

## PR integration gate

Every implementation/governance PR from an agent work branch must declare:

- `Agent instance ID`;
- `Lease ID`;
- `Lease lock path`;
- assigned slot ID;
- work packet ID;
- synchronized main SHA/epoch.

Hosted PR CI runs `scripts/verify-pr-agent-lease.mjs`. The verifier reads the canonical lease from `coordination/leases` and requires it to match the current PR:

- lease state is `ACTIVE`;
- lock path is exactly `.leases/<SLOT_ID>.json`;
- branch matches PR head branch;
- slot, logical agent, instance ID, work packet, and lease ID match the handoff;
- synchronized main SHA/epoch match the declared handoff;
- current PR head descends from the branch head recorded when the lease was acquired.

A missing, stale, mismatched, or transferred lease fails the PR gate.

`push` CI on `main` skips PR lease validation and instead uses the separate main-integration provenance check.

## Synchronization while leased

When issue #50 publishes a newer epoch, the live lease holder pauses feature edits, synchronizes its branch non-destructively, verifies the result, then renews the same lease via compare-and-swap with the new `synced_main_sha` and `sync_epoch` before resuming.

The slot remains owned by the same agent instance during this transaction.

## Supervisor rule

The Supervisor is not exempt. Any live Supervisor work packet that mutates a branch must hold `.leases/SUPERVISOR.json` before its first branch mutation.

This prevents two concurrent Supervisor sessions from simultaneously editing `supervisor/integration-control` or alternate Supervisor work branches.

## Relationship to GitHub branch protection

Atomic leases prevent cooperative multi-agent double writers and CI rejects PRs without the matching live lease. They do not replace native GitHub branch protection/rulesets for `main`.

Issue #54 tracks the still-required external repository setting for preventive `main` branch protection.
