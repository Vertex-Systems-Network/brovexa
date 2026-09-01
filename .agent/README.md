# `.agent/` Coordination Manifests

These files are the machine-readable companion to `AGENTS.md`, `docs/PARALLEL_AGENT_DEVELOPMENT.md`, and `docs/AI_NATIVE_PLAN.md`.

Before starting or resuming parallel work, agents inspect these manifests, current `main`, their own branch/head, latest issue #50 synchronization state, and—when assignment matters—issue #53 live slot occupancy.

Files:

- `ownership.yaml` — default path ownership/write boundaries and Supervisor integration authority.
- `shared-files.yaml` — high-conflict Supervisor/integration-owned paths.
- `workstreams.yaml` — standing branches, capacity/state model, and live-state source rules.
- `slots.yaml` — **static standing slot definitions** and onboarding rules; it intentionally does not store temporary live occupancy.
- `dependencies.yaml` — dependency DAG, default layer order, and interface-freeze rules.
- `migrations.yaml` — serialized migration number reservations/current next number.
- `supervisor.yaml` — Supervisor onboarding/completion/interruption/review/merge/broadcast/integration protocol.

Canonical live coordination:

- GitHub issue `#50` — current integrated `main` SHA and synchronization epoch.
- GitHub issue `#53` — current slot `OPEN` / `OCCUPIED`, assigned agent, start status, assigned-main SHA/epoch, and registry revision.

A newly arriving agent always starts from exact current `main`, then waits for Supervisor issue #53 assignment. It must not switch to a standing module branch until the Supervisor has selected an `OPEN` live slot, synchronized the branch, updated issue #53, and re-read the registry to confirm ownership. If no assignable live slot is `OPEN`, Supervisor stops onboarding with **Go Home Come Back Next Time**.

Temporary assignment/release does not require a repository PR when standing slot definitions/rules are unchanged. This avoids serializing agent startup behind governance FULL GATE.

These manifests/registries coordinate work; they do not authorize wider product behavior.

If a task changes standing branch/module definitions, live-slot protocol, Supervisor behavior, synchronization, completion-signal freshness, integration integrity, dependencies, migrations, or future-agent instructions, update the applicable manifest plus `AGENTS.md`, `README.md`, `docs/AI_NATIVE_PLAN.md`, and relevant policy/checkpoint docs in the same change set.
