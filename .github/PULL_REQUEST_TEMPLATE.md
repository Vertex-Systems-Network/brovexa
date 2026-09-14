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

Do not treat PR creation as task completion. When the work packet is actually ready for Supervisor review, add a **new top-level PR comment** whose entire body is the canonical completion signal defined in `AGENTS.md`.

The completion signal is head-bound. If any commit is pushed after the signal, the old signal is invalid: update this handoff to the new exact head, rerun required verification, then post a fresh exact completion signal.

The active branch lease is also mandatory and instance-bound. A missing/mismatched lease, a lease held by another instance, or branch history that does not descend from the lease acquisition head blocks integration.

The Supervisor will review the current exact head, issue #53 slot ownership, `coordination/leases` instance lease, dependency state, issue #50 synchronization epoch, signal freshness and verification evidence before any merge.
