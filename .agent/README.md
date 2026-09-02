# `.agent/` Coordination Manifests

These files are the machine-readable companion to `AGENTS.md`, `docs/PARALLEL_AGENT_DEVELOPMENT.md`, `docs/AI_NATIVE_PLAN.md`, and `docs/AGENT_BRANCH_LEASES.md`.

Before starting or resuming parallel work, agents inspect these manifests, current `main`, their own branch/head, latest issue #50 synchronization state, issue #53 live slot occupancy, and their slot's active lease on `coordination/leases`.

Files:

- `ownership.yaml` — default path ownership/write boundaries and Supervisor integration authority.
- `shared-files.yaml` — high-conflict Supervisor/integration-owned paths.
- `workstreams.yaml` — standing branches, capacity/state model, live-state sources, and branch-lease requirements.
- `slots.yaml` — **static standing slot definitions** and onboarding rules; it intentionally does not store temporary live occupancy.
- `dependencies.yaml` — dependency DAG, default layer order, and interface-freeze rules.
- `migrations.yaml` — serialized migration number reservations/current next number.
- `supervisor.yaml` — Supervisor onboarding/completion/interruption/review/merge/broadcast/integration and atomic lease protocol.

Canonical live coordination:

- GitHub issue `#50` — current integrated `main` SHA and synchronization epoch.
- GitHub issue `#53` — current logical slot `OPEN` / `OCCUPIED`, assigned agent, start status, assigned-main SHA/epoch, and registry revision.
- Git branch `coordination/leases` — current **live mutating instance** for each occupied slot, stored at `.leases/<SLOT_ID>.json`.

A newly arriving agent always starts from exact current `main`, then waits for Supervisor issue #53 assignment. It must not switch to/mutate a standing module branch until the Supervisor has selected an `OPEN` live slot, synchronized the branch, updated/re-read issue #53, and the exact runtime/session instance has atomically acquired the slot lease described in `docs/AGENT_BRANCH_LEASES.md`. If no assignable live slot is `OPEN`, Supervisor stops onboarding with **Go Home Come Back Next Time**.

Temporary slot assignment/release and live lease acquire/renew/release do not require a repository PR when standing definitions/rules are unchanged. They are live coordination transactions.

These manifests/registries/leases coordinate work; they do not authorize wider product behavior.

If a task changes standing branch/module definitions, live-slot protocol, live-instance lease protocol, Supervisor behavior, synchronization, completion-signal freshness, integration integrity, dependencies, migrations, or future-agent instructions, update the applicable manifest plus `AGENTS.md`, `README.md`, `docs/AI_NATIVE_PLAN.md`, `docs/AGENT_BRANCH_LEASES.md`, and relevant policy/checkpoint docs in the same change set.
