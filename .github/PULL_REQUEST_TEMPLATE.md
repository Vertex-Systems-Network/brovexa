## Work packet

- Task/workstream ID:
- Agent ID / role:
- Assigned slot ID:
- Live slot ownership verified in issue #53: yes/no
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

The Supervisor will review the current exact head, issue #53 slot ownership, dependency state, issue #50 synchronization epoch, signal freshness and verification evidence before any merge.
