# Brovexa New Agent Onboarding

Status: **ACTIVE ENGINEERING GOVERNANCE**

Updated: 2026-09-02

## Objective

This protocol governs every newly arriving AI/software-development agent before it is allowed to work on a Brovexa module. It prevents stale-base work, double assignment, branch collisions and accidental capacity expansion.

## Main-first invariant

Every new agent starts from the exact current `main` branch/head.

Before assignment, the new agent may read repository instructions and record the current `main` SHA/latest Supervisor synchronization epoch, but it must not:

- start from a standing module branch;
- edit a module;
- claim a task/work packet;
- open an implementation PR.

## Supervisor slot check

The Supervisor immediately checks:

- `docs/AI_NATIVE_PLAN.md`;
- `.agent/slots.yaml`;
- current `main` SHA;
- latest Supervisor sync epoch from GitHub issue #50.

Only an assignable slot whose status is exactly `OPEN` is eligible.

Onboarding decisions are serialized. Two simultaneous arrivals cannot receive the same slot.

## Open-slot path

If an `OPEN` slot exists:

1. choose the slot appropriate to the ready bounded work packet and agent capability;
2. verify the standing branch for that slot is synchronized to the same current `main` SHA and latest sync epoch;
3. update `docs/AI_NATIVE_PLAN.md` and `.agent/slots.yaml` with:
   - slot status `OCCUPIED`;
   - assigned agent name;
   - start status;
4. publish the occupancy update through the normal Supervisor integration path;
5. only after repository-visible assignment is authoritative may the agent switch from `main` to that module branch and start its bounded work packet.

The Supervisor owns assignment and release changes. A feature agent cannot self-assign a slot.

## No-slot path

If there is no assignable `OPEN` slot, the Supervisor stops onboarding immediately and responds exactly:

**Go Home Come Back Next Time**

The rejection has no side effects for that arrival:

- no module assignment;
- no module branch checkout;
- no new module/branch creation;
- no work packet;
- no feature changes;
- no agent implementation PR.

A new arrival never expands capacity on demand. Additional module slots/branches must be planned and bootstrapped before an arrival can use them.

## Slot release

A slot may return to `OPEN` only when the Supervisor confirms that the assigned agent has:

- no active work packet for that slot;
- no unmerged branch work requiring that ownership;
- completed required handoff/integration work.

The Supervisor then clears the assigned agent, sets start status to `WAITING`, updates both the AI-Native Plan and `.agent/slots.yaml`, and integrates the change through the normal governance path.

## Source of truth

- durable slot occupancy: `docs/AI_NATIVE_PLAN.md` + `.agent/slots.yaml` (must agree);
- standing branch/module mapping: `docs/AI_NATIVE_PLAN.md` + `.agent/workstreams.yaml`;
- live synchronization epoch/current integrated main SHA: latest valid Supervisor broadcast on GitHub issue #50;
- agent working rules: `AGENTS.md`;
- broader parallel workflow: `docs/PARALLEL_AGENT_DEVELOPMENT.md`.

## Verification

`pnpm run verify:parallel` must fail closed when onboarding governance drifts, including:

- missing slot registry;
- missing main-first rule;
- missing exact no-capacity phrase;
- duplicate slot IDs/branches;
- invalid slot status/occupancy combinations;
- AI-Native Plan vs slot-registry disagreement;
- standing branch mappings that disagree with slot definitions.

Do not weaken the verifier to bypass onboarding rules.
