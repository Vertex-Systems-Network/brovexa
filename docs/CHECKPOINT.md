# Brovexa Project Checkpoint

Updated: 2026-09-02

## Project state

`ACTIVE_EXISTING_PROJECT`

**M01 — Platform Foundation & Developer Experience is VERIFIED / INTEGRATED. The planned provider-neutral M01A — AI Agent Runtime & Memory OS foundation is VERIFIED / INTEGRATED / IMPLEMENTATION-COMPLETE. M02 — Business Discovery & Source Connectors is ACTIVE with five bounded implementation slices FULL-GATE verified and integrated on `main`. Permanent parallel-agent governance is also VERIFIED / INTEGRATED; the Supervisor branch is extending it with explicit submission/interruption/synchronization workflow.**

Current integrated `main` head at this checkpoint branch base:

`890618e28c5e300496389051b1b3d9c32880adf7`

This is a governed development checkpoint, not a production-release claim. Production model/provider invocation, source-provider network execution/credentials, payments, unrestricted acquisition, autonomous outreach and production deployment remain separately gated.

## Canonical agent working instructions

Parallel AI-assisted development has a permanent repository-level operating model:

- `AGENTS.md` — canonical startup/working instructions;
- `docs/PARALLEL_AGENT_DEVELOPMENT.md` — full multi-agent protocol;
- `docs/AI_NATIVE_PLAN.md` — standing branch/module/agent/merge plan;
- `.agent/ownership.yaml` — path/module ownership defaults;
- `.agent/shared-files.yaml` — high-conflict Supervisor/integration-owned paths;
- `.agent/workstreams.yaml` — standing branches, role/capacity/state model;
- `.agent/dependencies.yaml` — dependency DAG/interface-freeze/default merge-layer rules;
- `.agent/migrations.yaml` — serialized migration reservation state;
- `.agent/supervisor.yaml` — Supervisor state, completion signal, sync epoch and broadcast contract;
- `pnpm run verify:parallel` — executable governance verifier used locally and by hosted CI.

Default parallel target is **6 agents**; scale to **8** only with explicit independent workstreams and healthy integration metrics.

Standing branches were created and synchronized to `890618e28c5e300496389051b1b3d9c32880adf7` before the explicit Supervisor branch plan was documented:

- `supervisor/integration-control`
- `agent/contracts-policy`
- `agent/database-persistence`
- `agent/worker-runtime`
- `agent/module-infrastructure`
- `agent/verification-security`

Durable Supervisor broadcast channel: GitHub issue `#50`.

## Supervisor repository workflow

The Main-repository agent is the **Supervisor** and reviews/merges incoming agent PRs.

Completion signal:

**Work Done and Submitted**

For non-Supervisor agents the canonical event is a top-level PR comment whose whole body is exactly that phrase. It means ready for Supervisor review, not automatic merge approval.

When a valid completion signal arrives, the Supervisor checkpoints/pauses its own work, reviews the exact head/dependencies/migrations/shared files/security/verification, requests changes or merges with expected-head protection, re-reads resulting `main`, increments the synchronization epoch, broadcasts to all active agents, then resumes its paused work.

Canonical alert:

**New changes have been merged — please merge these changes into your branch first, then resume your own work.**

Every active agent must synchronize current `main` before resuming, record the new `synced_main_sha` and `sync_epoch`, and rerun minimum required verification. A branch behind the latest epoch cannot validly submit completion.

Every agent still performs the **Agent Instruction Drift Check** at task start and before completion. If architecture, workflow, Supervisor behavior, branch mapping, migration/dependency/verification/security instructions or synchronization behavior changes, the same change set updates the relevant docs/manifests/verifier. A task is not `READY_FOR_INTEGRATION` while future-agent instructions are materially stale.

## Authorization boundary

The approved M01 and provider-neutral M01A foundations are complete. M02 implementation may continue in small reversible provider-neutral slices.

Still separately gated:

- production model/provider invocation and credentials;
- production source connector credentials/activation;
- real provider HTTP/API transport until network/SSRF/policy/credential controls are independently verified;
- payment-provider activation;
- unrestricted acquisition;
- autonomous/bulk outreach;
- Daily Market Intelligence Scout activation;
- production deployment;
- destructive production data actions;
- unresolved legal/provider/commercial decisions.

Parallelism does not widen any authorization boundary.

## Default-branch integration posture

- default branch: `main`
- current integrated main at this checkpoint base: `890618e28c5e300496389051b1b3d9c32880adf7`
- native branch protection previously observed as off; repository compensating controls remain authoritative unless re-verified otherwise
- PR-based integration, exact-head CI evidence, no force-push/history rewrite and expected-head merge checks remain the operating discipline

`docs/DEFAULT_BRANCH_INTEGRATION_POLICY.md` remains the canonical compensating-control document.

## M01 verification state

### ABD-259 — monorepo foundation / executable CI

State: **VERIFIED / DONE**.

Final hosted evidence remains recorded in the M01 integration history.

### ABD-260 — PostgreSQL migration / data layer

State: **VERIFIED / DONE**.

The canonical migration/data-layer path remains part of every FULL GATE.

### ABD-261 — durable worker / queue foundation

State: **VERIFIED / DONE**.

Canonical worker recovery/idempotency/correlation verification remains active.

### ABD-262 — identity / RBAC / tenant primitives

State: **VERIFIED / INTEGRATED**.

Deny-by-default tenant authorization, cross-tenant integrity and owner/RBAC safeguards remain regression-gated.

### ABD-263 — API / observability / health

State: **VERIFIED / INTEGRATED / DONE**.

API observability, correlated safe errors and health/readiness semantics remain part of the hosted quality/runtime path.

### ABD-264 — M01 FULL GATE

State: **VERIFIED / DONE / INTEGRATED AND CONTINUOUSLY RE-RUN**.

The current hosted FULL GATE continues to require quality/security, PostgreSQL 18 + RBAC, and canonical worker + Valkey lanes.

### ABD-266 — default-branch protection / compensating controls

State: **DONE VIA COMPENSATING CONTROL / NATIVE PROTECTION REQUIRES CURRENT RE-READ BEFORE CLAIMING OTHERWISE**.

PR-only integration, explicit exact-head verification, no history rewrite and expected-head merge checks remain the compensating operating path.

## M01A state

**VERIFIED / INTEGRATED / IMPLEMENTATION-COMPLETE — eleven provider-neutral foundation slices.**

Integrated capabilities include:

1. governed Agent/Memory/Eval contracts;
2. AgentDefinition/ContextReceipt/AgentRun persistence;
3. MemoryRecord/EvalResult persistence;
4. append-only AgentRun and memory lifecycle;
5. deterministic Agent Registry + Context Builder;
6. bounded immutable AgentExecutionPlan persistence;
7. deterministic plan dispatch to canonical JobRun/WorkUnit;
8. specialist execution bridge with durable trace/retry/budgets;
9. completed-DAG aggregation + independent evaluator handoff;
10. evaluator decision/review resolution lifecycle;
11. exact route-policy resolution and privileged bounded execution trace.

Production model/provider execution remains separately gated and is not implied by M01A completion.

## M02 state

**ACTIVE — five bounded slices VERIFIED / INTEGRATED.**

### Slice 1 — provider-neutral source adapter foundation

Integrated behavior:

- executable SourceCapability/ConnectorPolicy/ConnectorDefinition/request/result/health contracts;
- deterministic fail-closed admission;
- provenance-bearing normalized candidate/result contracts;
- export/attribution/pagination/budget hardening;
- no provider HTTP/network/credentials.

Integration evidence:

- source head `efbf0f3f2ad8cfd24ccd7c597e1624cd7dd8dbcd`
- PR #39
- exact-head FULL GATE run `33501506534`: PASS
- merge `f2852d9055d55e332e0617e455901ca673f46503`

### Slice 2 — durable source registry + admission persistence

Integrated behavior:

- migration `0007_source_registry_foundation`;
- immutable/versioned SourceCapability, ConnectorPolicy and ConnectorDefinition persistence;
- tenant-scoped immutable SourceAdmissionSnapshot persistence;
- append-only DB invariants and exact identity bindings;
- no provider transport/credentials.

Integration evidence:

- source head `898ae65940fa635d156adb5ed450039c1eb23b53`
- PR #41
- exact-head FULL GATE run `33516572468`: PASS
- merge `e8198d259a4ffccbebd723154e1eafd5dac5365a`

### Slice 3 — durable ResearchJob preflight + SourceTask lifecycle

Integrated behavior:

- migration `0008_source_task_preflight`;
- immutable ResearchJob preflights bound to exact execute-admission snapshots;
- SourceTasks bound to exact workspace/request/source/connector/policy identity;
- canonical retry/cancel/dead-letter lifecycle;
- append-only usage with admitted-budget enforcement;
- idempotent completion provenance;
- semantic PostgreSQL JSONB replay equality.

Integration evidence:

- source head `3c5a6df1ede81d80c30287ca6d8fe884d1f66a64`
- PR #44
- replacement-PR FULL GATE run `33541205516` (#200): PASS
- merge `ce4f43648f764aeef8e153d21cbc769ddf2bdf60`

### Slice 4 — provider-neutral SourceTask execution bridge

Integrated behavior:

- canonical `source.execute` handler bridge for injected/test-only executors;
- exact SourceTask/WorkUnit/frozen admission/registry identity revalidation;
- mandatory injected contract parsing/result validation;
- per-attempt usage before retry/completion;
- reference-only durable completion effects;
- legitimate empty results supported;
- executor registration restricted to `networkAccess: 'none'`;
- production worker bootstrap remains without `source.execute` registration.

Integration evidence:

- source head `da14088d9cb48a1b68a14a394f82d9100498dbec`
- PR #46
- fresh PR-specific FULL GATE run `33544593764` (#202): PASS
- merge `08b33930bb6678a23ffcc5299ae56ed4b029f1ba`

### Slice 5 — connector execution safety / durable health

Integrated behavior:

- migration `0009_connector_execution_safety`;
- append-only exact connector-version health snapshots;
- execution-time policy-state/review-expiry revalidation;
- health identity/freshness/status gate before executor invocation;
- live quota revalidation before executor invocation;
- rate-limited/circuit-open paths retry without invoking executor;
- missing/stale/future/unknown/disabled health fails closed;
- successful usage/effects bind exact `healthSnapshotId`;
- no production network/provider transport or credential mode enabled.

Integration evidence:

- source head `cdd4fc7fdfb8796c7954255cc2edbc4253e705a4`
- PR #48
- fresh PR-specific FULL GATE run `33550775612` (#219): PASS
- quality/security: PASS
- PostgreSQL 18 migration + RBAC: PASS
- canonical worker + Valkey including source execution safety verifier: PASS
- merge `bec3c6bb9fd89dd496b155b0f6087e5a8f77b223`

## Parallel governance integration evidence

The first permanent parallel-agent governance slice was integrated after exact-head FULL GATE verification:

- PR #49: `docs: add permanent parallel-agent development protocol`
- final source head `5fe06da0536cb927ce61afe427489d3ccaba91ee`
- FULL GATE run `33554435392` (#230): PASS
- quality/security including `verify:parallel`: PASS
- PostgreSQL 18 migration + RBAC: PASS
- canonical worker + Valkey: PASS
- merge `890618e28c5e300496389051b1b3d9c32880adf7`

The active Supervisor branch extends that verified baseline with explicit module branch bootstrap, completion signals, interrupt/review/merge/resume behavior, durable broadcast channel and synchronization-epoch protection. It is not integrated until its own exact-head gates pass.

## Current M02 safety boundary

The source pipeline has durable policy, task, execution and health safety foundations, but **real provider transport is still intentionally absent**.

Current production `apps/worker/src/main.ts` does not register production source/provider execution. Merged M02 infrastructure alone cannot perform real provider network traffic.

Before any real provider transport is enabled, the relevant bounded slice must independently define and verify network/SSRF/egress, robots/provider policy, credential/secret, quota/circuit, observability and provider-specific constraints.

Provider responses remain untrusted candidates and must not become canonical Business/Location/Contact facts merely because transport exists.

## Supply-chain posture

- exact direct dependency pins;
- committed/frozen lockfile;
- pinned pnpm and Node policy;
- exact reviewed lifecycle-script allowlist;
- immutable GitHub Action SHAs;
- hosted CI `contents: read`;
- tracked-secret gate;
- high/critical dependency advisory audit.

Dependency advisory evidence remains time-sensitive and must be rerun on future integration/release gates.

## Known limitations / not production verification

- no production deployment has occurred;
- no hosted DB/queue/identity/telemetry provider is activated;
- no production model/provider or source connector is activated;
- no production source-provider network transport or credentials are enabled;
- native default-branch protection must be re-read before making any current claim about it;
- local developer working-copy/runtime/database state remains unknown when changes are performed through remote GitHub tooling;
- OpenTelemetry exporter/collector rollout remains outside the existing foundation;
- M01/M01A/M02 integration does not authorize payments, unrestricted acquisition, autonomous outreach or release gates.

## Next safe actions

1. Verify/integrate the active Supervisor repository-workflow extension through normal PR/FULL-GATE/expected-head merge discipline.
2. After merge, increment/publish the synchronization epoch and alert/synchronize all standing module branches before assigning/resuming parallel work.
3. Use the six-agent branch plan for the next bounded work packets, with dependency/interface freeze and migration reservations declared before implementation.
4. Continue M02 through the next bounded provider/network prerequisite slice only after exact SSRF/egress/source-policy/credential/provider-activation boundaries are defined.
5. Keep production network/provider execution disabled until that boundary is independently verified and explicitly integrated.
