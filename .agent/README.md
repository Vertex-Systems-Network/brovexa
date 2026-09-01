# `.agent/` Coordination Manifests

These files are the machine-readable companion to `AGENTS.md` and `docs/PARALLEL_AGENT_DEVELOPMENT.md`.

Before starting parallel work, agents must inspect the manifests here and the current repository head.

Files:

- `ownership.yaml` — default path ownership/write boundaries.
- `shared-files.yaml` — high-conflict integration-owned paths.
- `workstreams.yaml` — active/default role capacity and workstream state model.
- `dependencies.yaml` — task dependency/interface-freeze rules.
- `migrations.yaml` — migration number reservation protocol/current next number.

These manifests are coordination state, not authorization to widen product behavior.

If a task changes how agents should operate, update the applicable manifest plus `AGENTS.md`/`README.md`/policy docs in the same change set.