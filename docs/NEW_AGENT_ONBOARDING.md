# Brovexa New Agent Onboarding

Status: **ACTIVE ENGINEERING GOVERNANCE**

Updated: 2026-09-02

## Objective

This protocol governs every newly arriving AI/software-development agent before it can work on a Brovexa module. It prevents stale-base work, double assignment, branch collisions, and accidental capacity expansion without forcing a governance PR for every temporary assignment.

## Main-first invariant

Every new agent starts from the exact current `main` branch/head.

Before assignment, the new agent may read repository instructions and record current `main` SHA/latest Supervisor synchronization epoch, but it must not:

- start from a standing module branch;
- edit a module;
- claim a task/work packet;
- open an implementation PR.

## Static definitions vs live occupancy

Standing slots/branches are defined in:

- `docs/AI_NATIVE_PLAN.md`;
- `.agent/slots.yaml`.

Those versioned files define **which slots exist** and whether they are assignable. They do not store current temporary occupancy.

Canonical live occupancy is GitHub issue **#53 — AI-Native Plan — Live Agent Slot Registry**. Issue #53 records live `OPEN` / `OCCUPIED`, assigned agent, start status, assigned main SHA, sync epoch, and monotonic registry revision.

GitHub issue #50 remains the separate synchronization source for current integrated `main` SHA and `sync_epoch`.

## Supervisor slot check

The Supervisor immediately checks:

- current `main` SHA;
- latest issue #50 synchronization broadcast;
- `docs/AI_NATIVE_PLAN.md`;
- `.agent/slots.yaml`;
- issue #53 live occupancy.

Onboarding decisions are serialized. The Supervisor **re-reads issue #53 immediately before assignment** so two arrivals cannot receive the same slot.

Only a statically assignable slot whose live issue #53 status is exactly `OPEN` is eligible.

## Open-slot transaction

If an `OPEN` slot exists:

1. choose the slot appropriate to the ready bounded work packet and agent capability;
2. verify/fast-forward the idle standing branch for that slot to exact current `main` and latest sync epoch;
3. update issue #53 with:
   - slot status `OCCUPIED`;
   - assigned agent name/logical ID;
   - start status;
   - assigned current-main SHA;
   - current issue #50 sync epoch;
   - incremented registry revision;
4. re-read issue #53 after the update and confirm the intended agent owns the intended slot;
5. only after that confirmation may the agent switch from `main` to the assigned module branch and start its bounded work packet.

The Supervisor owns assignment/release. A feature agent cannot self-assign a slot.

**No repository governance PR is required merely to record temporary assignment/release** when slot definitions, branch names, capacity, and rules are unchanged. This keeps onboarding fast and prevents the coordination system from serializing all agent startup behind FULL GATE.

## No-slot path

If there is no assignable live `OPEN` slot, the Supervisor stops onboarding immediately and responds exactly:

**Go Home Come Back Next Time**

The rejection has no work side effects:

- no module assignment;
- no module branch checkout;
- no new module/branch creation;
- no work packet;
- no feature changes;
- no agent implementation PR.

A new arrival never expands capacity on demand. Additional module slots/branches must be planned, bootstrapped, and merged as governance changes before issue #53 may expose them.

## Slot release transaction

A slot may return to `OPEN` only when the Supervisor confirms:

- no active work packet remains for that slot;
- no unmerged branch work requires that ownership;
- required handoff/integration work is complete.

The Supervisor then:

1. synchronizes the idle standing branch to current `main`;
2. updates issue #53: clears assigned agent, sets `OPEN` / `WAITING`, records current main SHA/epoch, increments registry revision;
3. re-reads issue #53 and confirms release.

## Assignment consistency

Before accepting work or completion from an agent, Supervisor verifies:

- PR/work packet `assigned_slot_id` exists in `.agent/slots.yaml`;
- PR branch matches that slot's standing branch;
- issue #53 currently assigns that slot to the submitting agent;
- issue #50 synchronization state matches handoff `synced_main_sha` / `sync_epoch`.

## Completion-signal freshness

`Work Done and Submitted` is head-bound. If an agent posts the exact completion signal and then pushes another commit, the old signal is invalid. The agent must update its exact-head handoff, rerun required verification, and post a fresh exact signal after the new head exists.

## Sources of truth

- standing branch/module/slot definitions: `docs/AI_NATIVE_PLAN.md` + `.agent/slots.yaml`;
- live slot occupancy/agent assignment: GitHub issue #53;
- live synchronization epoch/current integrated main SHA: latest valid Supervisor broadcast on GitHub issue #50;
- agent working rules: `AGENTS.md`;
- broader parallel workflow: `docs/PARALLEL_AGENT_DEVELOPMENT.md`.

## Verification

`pnpm run verify:parallel` fails closed when versioned onboarding governance drifts, including:

- missing static slot registry;
- missing issue #53 live-registry authority;
- missing main-first rule;
- missing exact no-capacity phrase;
- duplicate slot IDs/branches;
- invalid assignability definitions;
- standing branch mappings that disagree with slot definitions;
- missing head-change invalidation for completion signals;
- missing main-push integration-provenance guard.

The verifier intentionally does not freeze temporary live issue #53 occupancy into Git because that would reintroduce the startup bottleneck this protocol removes.
