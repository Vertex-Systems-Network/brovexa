# `.agent/` Coordination Manifests

These files are the machine-readable companion to `AGENTS.md`, `docs/PARALLEL_AGENT_DEVELOPMENT.md` and `docs/AI_NATIVE_PLAN.md`.

Before starting or resuming parallel work, agents inspect these manifests, current `main`, their own branch/head and the latest Supervisor synchronization epoch.

Files:

- `ownership.yaml` — default path ownership/write boundaries and Supervisor integration authority.
- `shared-files.yaml` — high-conflict Supervisor/integration-owned paths.
- `workstreams.yaml` — standing branches, capacity/state model and live-state source rules.
- `slots.yaml` — new-agent onboarding slot availability/occupancy contract; only the Supervisor assigns or releases slots.
- `dependencies.yaml` — dependency DAG, default layer order and interface-freeze rules.
- `migrations.yaml` — serialized migration number reservations/current next number.
- `supervisor.yaml` — Supervisor onboarding/completion/interruption/review/merge/broadcast protocol plus baseline synchronization seed; it is not the always-current post-merge state ledger.

Canonical durable Supervisor broadcast channel is GitHub issue `#50`. The latest valid Supervisor broadcast comment on issue #50 is the live source of the current synchronization epoch and integrated `main` SHA.

A newly arriving agent always starts from exact current `main`, then waits for Supervisor slot assignment. It must not switch to a standing module branch until the Supervisor has selected an `OPEN` slot and the slot branch is synchronized to the same current `main`/epoch. If no assignable slot is `OPEN`, the Supervisor stops onboarding with the exact response **Go Home Come Back Next Time**.

These manifests are coordination state/policy, not authorization to widen product behavior.

If a task changes branch/module assignment, slot occupancy rules, Supervisor behavior, synchronization, completion signals, dependencies, migrations or agent instructions, update the applicable manifest plus `AGENTS.md`, `README.md`, `docs/AI_NATIVE_PLAN.md` and relevant policy/checkpoint docs in the same change set.
