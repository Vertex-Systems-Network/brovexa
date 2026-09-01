# `.agent/` Coordination Manifests

These files are the machine-readable companion to `AGENTS.md`, `docs/PARALLEL_AGENT_DEVELOPMENT.md` and `docs/AI_NATIVE_PLAN.md`.

Before starting or resuming parallel work, agents inspect these manifests, current `main`, their own branch/head and the latest Supervisor synchronization epoch.

Files:

- `ownership.yaml` — default path ownership/write boundaries and Supervisor integration authority.
- `shared-files.yaml` — high-conflict Supervisor/integration-owned paths.
- `workstreams.yaml` — standing branches, active workstreams, capacity and state model.
- `dependencies.yaml` — dependency DAG, default layer order and interface-freeze rules.
- `migrations.yaml` — serialized migration number reservations/current next number.
- `supervisor.yaml` — completion signal, interrupt/review/merge flow, broadcast channel, current sync epoch and main SHA.

Canonical durable Supervisor broadcast channel is GitHub issue `#50`.

These manifests are coordination state, not authorization to widen product behavior.

If a task changes branch/module assignment, Supervisor behavior, synchronization, completion signals, dependencies, migrations or agent instructions, update the applicable manifest plus `AGENTS.md`, `README.md`, `docs/AI_NATIVE_PLAN.md` and relevant policy/checkpoint docs in the same change set.
