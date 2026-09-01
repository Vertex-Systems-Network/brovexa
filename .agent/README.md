# `.agent/` Coordination Manifests

These files are the machine-readable companion to `AGENTS.md`, `docs/PARALLEL_AGENT_DEVELOPMENT.md` and `docs/AI_NATIVE_PLAN.md`.

Before starting or resuming parallel work, agents inspect these manifests, current `main`, their own branch/head and the latest Supervisor synchronization epoch.

Files:

- `ownership.yaml` — default path ownership/write boundaries and Supervisor integration authority.
- `shared-files.yaml` — high-conflict Supervisor/integration-owned paths.
- `workstreams.yaml` — standing branches, capacity/state model and live-state source rules.
- `dependencies.yaml` — dependency DAG, default layer order and interface-freeze rules.
- `migrations.yaml` — serialized migration number reservations/current next number.
- `supervisor.yaml` — Supervisor completion/interruption/review/merge/broadcast protocol plus baseline synchronization seed; it is not the always-current post-merge state ledger.

Canonical durable Supervisor broadcast channel is GitHub issue `#50`. The latest valid Supervisor broadcast comment on issue #50 is the live source of the current synchronization epoch and integrated `main` SHA.

These manifests are coordination state/policy, not authorization to widen product behavior.

If a task changes branch/module assignment, Supervisor behavior, synchronization, completion signals, dependencies, migrations or agent instructions, update the applicable manifest plus `AGENTS.md`, `README.md`, `docs/AI_NATIVE_PLAN.md` and relevant policy/checkpoint docs in the same change set.
