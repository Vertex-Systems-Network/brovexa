# M01A — Bounded Orchestrator Execution Planning

Status: **VERIFIED / INTEGRATED TO main**

Updated: 2026-09-01

## Purpose

This is the sixth reversible implementation slice of **M01A — AI Agent Runtime & Memory OS**. It adds a provider-neutral execution-planning boundary after the verified Agent Registry + Context Builder runtime.

The slice deliberately stops before specialist WorkUnit dispatch or any provider/model invocation. It makes an approved orchestration plan executable as durable governed state without pretending that unsupported specialist handlers already exist.

## Executable AgentExecutionPlan contract

`packages/contracts/src/agent-execution.ts` defines a bounded plan envelope containing:

- exact workspace, user, orchestrator run and ContextReceipt identities;
- exact orchestrator key/version;
- immutable plan version and creation time;
- bounded maximum parallelism;
- 1–64 specialist steps;
- exact specialist agent key/version per step;
- explicit DAG dependencies;
- requested tool and canonical command keys;
- policy, canonical-data and memory references;
- per-step token/search/API/credit/currency/runtime/concurrency budgets.

Contract invariants reject:

- any orchestrator key other than `agent.control.orchestrator`;
- recursive orchestrator specialist steps;
- duplicate step keys or duplicate dependency/tool/command/policy/canonical/memory identifiers;
- self, unknown or cyclic dependencies;
- plan parallelism above plan width;
- nested specialist concurrency above one in the current bounded foundation.

## Durable execution-plan persistence

Migration `0006_agent_execution_plan` adds `agent_execution_plans` and reversible supporting constraints.

A plan is bound by database constraints to the exact:

- workspace;
- active initiating user recorded on its ContextReceipt;
- orchestrator AgentDefinition;
- ContextReceipt;
- orchestrator AgentRun;
- orchestrator key/version.

The plan envelope is checked against canonical identity columns and step count. Plan rows are append-only through the same fail-closed lifecycle mutation function used by the existing AgentRun/memory history ledgers.

The migration has a reviewed down migration and the canonical PostgreSQL verifier proves `0006` rollback/reapply behavior.

## Planner persistence boundary

`persistAgentExecutionPlan` validates and persists the plan and its queued deterministic orchestrator AgentRun atomically.

Before any plan is persisted it re-checks current database authorization instead of trusting caller-supplied claims. The initiating user must currently have active `workspace.read` authority in an active workspace.

The persisted ContextReceipt must match the exact workspace, user, orchestrator definition and optional run scope. Planning cannot silently broaden the ContextReceipt.

For each specialist step the planner resolves the exact persisted AgentDefinition and requires it to be approved. It then enforces:

- requested tools are a subset of `allowedTools`;
- requested canonical commands are a subset of `allowedCommands`;
- policy references are a subset of ContextReceipt policy references;
- canonical references are a subset of ContextReceipt canonical references;
- memory references are active references already present in the ContextReceipt;
- referenced memory namespaces match the specialist AgentDefinition `memory.read` scopes;
- requested per-step budgets do not exceed the specialist AgentDefinition budget;
- T4 / `requiresHumanApproval` specialists fail closed because an approval artifact is not implemented in this slice.

The canonical orchestrator itself must be an approved **T2**, `deterministic_only` AgentDefinition and must not require a human approval artifact for this path.

Aggregate token/search/API/credit/currency/runtime budgets and plan parallelism are also bounded by the orchestrator AgentDefinition. Safe-integer accounting is enforced before persistence.

## Idempotency and lifecycle

The plan is immutable and retry-safe:

- same plan ID + same JSONB plan content returns the existing plan;
- same plan ID + changed content/scope is a conflict;
- a second plan cannot claim the same orchestrator run;
- a pre-existing unplanned AgentRun ID is a conflict;
- JSONB equality is evaluated by PostgreSQL rather than JavaScript object-key ordering;
- an idempotent replay remains valid after the linked AgentRun has moved forward through the governed lifecycle and returns the current run envelope.

The created AgentRun starts as `queued` and uses the existing append-only AgentRun transition ledger for later state changes.

## Verification

`scripts/verify-agent-execution-plan.mjs` is chained into the canonical `pnpm run verify:db` harness. The root `verify:db` command remains unchanged.

The PostgreSQL 18 verification covers:

- migration 0006 apply, rollback and reapply;
- canonical schema readiness including `agent_execution_plans`;
- exact current workspace authorization;
- exact ContextReceipt/orchestrator identity binding;
- two-step acyclic specialist plan persistence;
- atomic queued deterministic orchestrator AgentRun creation;
- tenant-scoped plan and run reads;
- idempotent plan replay;
- changed same-ID plan conflict;
- one-plan-per-run enforcement;
- unapproved tool and command rejection;
- policy/canonical/memory scope broadening rejection;
- specialist memory-scope rejection;
- specialist and aggregate budget overflow rejection;
- draft specialist rejection;
- T4/human-review specialist rejection;
- cross-tenant user authorization rejection;
- append-only plan UPDATE and DELETE rejection;
- AgentRun queued → running transition through the existing lifecycle primitive;
- successful plan replay after the run transition.

Existing agent persistence, memory/evaluation, lifecycle, Context Builder, RBAC and worker/Valkey verifiers are reconciled with migration 0006 rather than bypassed.

### Verification evidence

- Verified source head: `67c920132441a81f1c57c9bdcfee552d4e6c69c2`
- Hosted FULL GATE run: `33446718454`
- M01 FULL GATE quality and security job: `99667359375` — PASS
- PostgreSQL 18 migration + RBAC FULL GATE job: `99667811785` — PASS
- Canonical worker + Valkey FULL GATE job: `99667972293` — PASS
- Pull request: `#27` — merged
- Integration merge SHA: `0b721b4b43ce27da8f4f81a351879c07cc6ce25a`

An earlier run on source head `263d8c9938f0342019dd9e331277b3138cb9eccc` correctly failed a TypeScript test-fixture inference issue. The fixture typing was fixed without weakening any gate, and the replacement exact head above passed the complete hosted gate.

## Explicit non-scope

This slice intentionally does not implement:

- provider/model routing or invocation;
- specialist WorkUnit creation or queue dispatch;
- dependency-unlock scheduling;
- specialist handler registration;
- external tools or source connectors;
- model prompt assembly;
- execution-result aggregation;
- pause/resume orchestration controls beyond existing canonical lifecycle primitives;
- outreach, CRM, billing or deployment.

No plan record proves that a specialist action ran. It only proves that a bounded plan passed the current deterministic policy/scope/budget checks and was durably attached to a queued orchestrator AgentRun.

## Next safe slice after verification

Implement a deterministic plan dispatcher that converts an already-validated `AgentExecutionPlan` DAG into canonical JobRun/WorkUnit state with stable idempotency keys, dependency readiness/unlocking, cancellation/recovery/checkpoints and budget reservation/accounting.

The dispatcher must only create work for explicitly registered supported handler types. Provider/model invocation remains a separate gate after the execution state machine itself is verified.
