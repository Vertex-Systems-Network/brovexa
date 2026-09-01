# Brovexa Project Checkpoint

Updated: 2026-09-02

## Project state

`ACTIVE_EXISTING_PROJECT`

**M01 — Platform Foundation & Developer Experience is VERIFIED / INTEGRATED. The planned provider-neutral M01A — AI Agent Runtime & Memory OS foundation is VERIFIED / INTEGRATED / IMPLEMENTATION-COMPLETE. M02 — Business Discovery & Source Connectors is ACTIVE with five bounded implementation slices FULL-GATE verified and integrated on `main`.**

Current integrated `main` head at this checkpoint branch base:

`bec3c6bb9fd89dd496b155b0f6087e5a8f77b223`

This is a governed development checkpoint, not a production-release claim. Production model/provider invocation, source-provider network execution/credentials, payments, unrestricted acquisition, autonomous outreach and production deployment remain separately gated.

## Canonical agent working instructions

Parallel AI-assisted development now has a permanent repository-level operating model:

- `AGENTS.md` — canonical startup/working instructions;
- `docs/PARALLEL_AGENT_DEVELOPMENT.md` — full multi-agent protocol;
- `.agent/ownership.yaml` — path/module ownership defaults;
- `.agent/shared-files.yaml` — high-conflict integration-owned paths;
- `.agent/workstreams.yaml` — role/capacity/state model;
- `.agent/dependencies.yaml` — dependency DAG/interface-freeze rules;
- `.agent/migrations.yaml` — serialized migration reservation state;
- `pnpm run verify:parallel` — executable governance verifier used locally and by hosted CI.

Every agent must perform the **Agent Instruction Drift Check** at task start and before completion. If architecture, workflow, ownership, migration, dependency, verification, CI, security/policy or integration instructions changed, the same change set must update `AGENTS.md`, `README.md` and relevant coordination/module/checkpoint documentation. A task is not `READY_FOR_INTEGRATION` while future-agent instructions are materially stale.

Default parallel target is **6 agents**; scale to **8** only with explicit independent workstreams and healthy integration metrics.

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
- current integrated main at this checkpoint base: `bec3c6bb9fd89dd496b155b0f6087e5a8f77b223`
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
- PR #48 (replacement for draft #47 due connector GraphQL ready-for-review bug)
- fresh PR-specific FULL GATE run `33550775612` (#219): PASS
- quality/security: PASS
- PostgreSQL 18 migration + RBAC: PASS
- canonical worker + Valkey including source execution safety verifier: PASS
- merge `bec3c6bb9fd89dd496b155b0f6087e5a8f77b223`

## Current M02 safety boundary

The source pipeline has durable policy, task, execution and health safety foundations, but **real provider transport is still intentionally absent**.

Current production `apps/worker/src/main.ts` registers only the foundation handler and does not register `source.execute`. Therefore merged M02 execution infrastructure alone cannot perform real provider network traffic.

Before any real provider transport is enabled, the relevant bounded slice must independently define and verify the required network/SSRF/egress, robots/provider policy, credential/secret, quota/circuit, observability and provider-specific constraints.

Provider responses remain untrusted candidates and must not become canonical Business/Location/Contact facts merely because transport exists.

## Parallel engineering operating model

Default active layout when sufficient independent work exists:

1. Integration / Architecture Controller
2. Contracts / Policy Agent
3. Database / Persistence Agent
4. Worker / Runtime Agent
5. Module / Connector Infrastructure Agent
6. Verification / Security Agent

Default invariant:

`1 agent = 1 bounded work packet = 1 isolated branch/worktree = 1 PR`

Dependent work is coordinated through explicit contract/interface freeze points and a dependency DAG. Migration identifiers are reserved before use. Shared files are integration-owned when collision risk exists.

The implementation agent does not self-certify security by itself: a separate verification role attempts replay, concurrency, tenant, authorization, budget, stale-state, migration and network-boundary failures.

The executable coordination guard is `pnpm run verify:parallel`; hosted CI runs the same check before the broader quality/security gates.

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

1. Integrate the permanent parallel-agent development protocol, machine-readable coordination manifests and executable `verify:parallel` gate through the normal PR/FULL-GATE/expected-head path.
2. Use the protocol for subsequent work with a default six-agent concurrency target when the dependency DAG permits it.
3. Continue M02 through the next bounded provider/network prerequisite slice only after defining exact SSRF/egress, source-policy, credential and provider-activation boundaries.
4. Keep production network/provider execution disabled until that boundary is independently verified and explicitly integrated.
5. Refresh `README.md`, `AGENTS.md`, this checkpoint and relevant module docs whenever an implementation changes future agent working instructions.
