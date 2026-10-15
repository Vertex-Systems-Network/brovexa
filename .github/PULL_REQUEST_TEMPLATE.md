## Work packet

- Task/workstream ID:
- Agent ID / role:
- Agent instance ID:
- Assigned slot ID:
- Live slot ownership verified in issue #53: yes/no
- Lease ID:
- Lease lock path:
- Module:
- Branch:
- Base SHA:
- Exact head SHA:
- Synced main SHA:
- Sync epoch:
- Depends on:

## Scope

- Goal:
- Explicit non-goals:
- Changed paths:
- Shared-file requests:
- Contract/interface impact:
- Migration impact/reservation:

## Runner benchmark

- Runner benchmark task IDs: none / RUNNER-...
- Runner deferral justification: none / why this is safe to batch later
- Current required merge/security gates deferred to Runner queue: must be no

## Verification

- Active slot lease verified on `coordination/leases`: yes/no
- Tests/evals run:
- FAST/FULL gate evidence for this exact head:
- Security/compliance impact:
- Known limitations:

## Instruction drift

- Agent Instruction Drift Check completed: yes/no
- `AGENTS.md` / `README.md` / relevant docs updated when required: yes/no/not-needed

## Supervisor submission

For a **Supervisor-owned PR**, put the canonical exact phrase below only when the handoff declares the current exact head and all required lease/synchronization metadata is current. This PR-body submission is the Supervisor's head-bound canonical event.

For a **non-Supervisor agent PR**, do not treat PR creation/body text as completion. When the work packet is actually ready for Supervisor review, add a **trusted new top-level PR comment** whose entire body is the canonical completion signal defined in `AGENTS.md`.

Any later head change invalidates the prior role-specific submission. Update the exact-head handoff, rerun required verification, and publish the appropriate fresh role-specific signal.

**Work Done and Submitted**

The active branch lease is also mandatory and instance-bound. A missing/mismatched lease, a lease held by another instance, or branch history that does not descend from the lease acquisition head blocks integration.

The Supervisor will review the current exact head, issue #53 slot ownership, `coordination/leases` instance lease, dependency state, issue #50 synchronization epoch, signal freshness and verification evidence before any merge.
