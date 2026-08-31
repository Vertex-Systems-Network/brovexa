# M01A — Deterministic Agent Plan Dispatcher

Status: **VERIFIED / INTEGRATED TO `main`**

Updated: 2026-09-01

## Purpose

This is the seventh reversible implementation slice of **M01A — AI Agent Runtime & Memory OS**. It converts an already-validated immutable `AgentExecutionPlan` into the existing canonical `JobRun` / `WorkUnit` execution foundation without activating model providers, external tools or production specialist handlers.

The implementation deliberately reuses M01 durable queue primitives instead of adding a second execution framework or a new database migration.

## Integration evidence

- final verified source head: `eba81cabe2d8bcfa1bb6b8785ac50d56b03d8b8a`
- PR: #29 — `feat(m01a): add deterministic agent plan dispatcher`
- exact-head hosted FULL GATE run: `33449897197` — PASS
- quality/security job: `99677185961` — PASS
- PostgreSQL 18 migration + RBAC job: `99677793352` — PASS
- canonical worker + Valkey job: `99678018183` — PASS
- merged to `main` as: `2a455d561472417a8b353b0303bb848b94e0cdf2`

The first hosted attempt (`33448973098`) correctly exposed a verification-fixture defect: the authorization-revocation scenario tried to suspend the workspace's only active owner, violating the already-governed `workspace_requires_active_owner` invariant. The fixture was corrected to revoke a normal member while preserving the active owner. Runtime behavior, migration structure and the generic identity/RBAC foundation were not weakened to make the test pass.

## Dispatch boundary

`dispatchAgentExecutionPlan` resolves the exact persisted plan and re-checks the current database authorization of the initiating user before creating execution state.

First dispatch requires the linked orchestrator `AgentRun` to remain `queued`. Idempotent replay is allowed after execution has advanced because the existing canonical JobRun/WorkUnit projection becomes the replay authority.

Every specialist step must:

- target an exact approved persisted `AgentDefinition`;
- remain non-human-approval for this bounded path;
- have a valid persisted retry limit;
- be present in the explicitly supplied supported-handler registry;
- preserve the already-validated plan scope and budget inside its immutable WorkUnit payload.

Unsupported handlers fail closed before any JobRun or WorkUnit is committed.

## Existing execution primitives reused

One `agent.execution.plan` JobRun is created per immutable plan version using a stable idempotency key.

All specialist WorkUnits are created atomically up front. This is important because the existing generic completion primitive can only mark the JobRun successful when every WorkUnit has succeeded; downstream dependency work therefore cannot be omitted from completion accounting.

The canonical queue remains `brovexa-work-v1`.

No new queue transport, scheduler table or dispatcher-specific migration is introduced.

## Dependency and concurrency gating

A dependency/concurrency-blocked specialist WorkUnit is encoded using the existing recoverable state model as:

- `status = retry_wait`;
- `attempt_count = 0`;
- `next_attempt_at = infinity`.

This sentinel is not eligible for `claimWorkUnit` or `listRecoverableWorkUnits`, so the existing worker/recovery loop cannot accidentally execute blocked work.

`reconcileAgentExecutionDispatch` deterministically unlocks only WorkUnits whose declared dependencies have all succeeded and only while the plan has available `maxParallelism` capacity. Eligible steps are ordered by step key for deterministic selection.

Normal retry backoff remains distinct because retrying work has a positive attempt count and a finite retry timestamp.

If the canonical JobRun reaches `failed`, `review` or `cancelled`, still dependency-blocked descendants are cancelled rather than unlocked.

## Checkpoints and recovery

`writeAgentExecutionCheckpoint` reuses canonical `job_checkpoints` and allows checkpoints only for an actually running or normal retry-wait specialist step. Dependency-blocked sentinel work cannot write checkpoints.

Existing worker lease recovery, retry policy, correlation IDs and Valkey delivery semantics remain unchanged and continue to be verified by the existing worker FULL GATE.

## Budget reservation and accounting

Each WorkUnit payload carries the exact per-step budget already approved by the immutable `AgentExecutionPlan`.

`recordAgentExecutionBudgetUsage` stores idempotent usage events in the existing `job_effects` ledger with a dedicated `agent_execution_budget_usage` envelope. Before insertion it locks the WorkUnit, sums prior usage and rejects any event that would exceed the reserved token, search, API-call, credit, currency or runtime budget.

Same event ID + same content is retry-safe. Same event ID + changed content is a conflict.

This slice does not claim provider billing truth; it establishes deterministic reservation/accounting state for later provider execution.

## Cancellation

`cancelAgentExecutionDispatch` propagates cancellation to runnable/dependency-blocked/retry-wait WorkUnits and sets the canonical JobRun to cancelled. Already-running work receives the existing cancellation request signal and must cooperate through the canonical worker cancellation contract.

## Executable contract

`AgentExecutionWorkPayloadSchema` defines the specialist payload emitted by the dispatcher and rejects:

- recursive orchestrator execution;
- nested specialist concurrency above one;
- duplicate dependency/tool/command/policy/canonical/memory references;
- malformed identity, version or budget fields.

## Verification

`scripts/verify-agent-plan-dispatcher.mjs` is chained through the canonical `pnpm run verify:db` command. The root database command remains unchanged.

The PostgreSQL integration verifier covers:

- exact existing migration baseline through `0006_agent_execution_plan`;
- current workspace authorization re-check;
- unsupported-handler atomic rollback;
- stable one-JobRun-per-plan idempotency;
- one WorkUnit per specialist step;
- bounded initial runnable width;
- dependency-blocked work excluded from generic recovery;
- exact handler-registry-version replay conflict;
- tenant-scoped dispatch reads;
- checkpoint create/update on running work;
- budget usage idempotency and hard overflow rejection;
- dependency unlock after prerequisite success;
- successful canonical JobRun completion only after all plan work succeeds;
- cancellation of non-running plan work;
- authorization revocation before dispatch failing closed while preserving the workspace's active-owner invariant.

Existing migration, RBAC, memory, lifecycle, context, plan, API and worker/Valkey gates remain intact.

## Explicit non-scope

This slice does not implement:

- production specialist handler registration;
- provider/model routing or invocation;
- external source/API connectors;
- model prompt assembly;
- specialist result aggregation into orchestrator output;
- evaluator-driven orchestrator completion;
- outreach, CRM, billing or deployment.

A dispatched WorkUnit proves only that an already-governed plan step was durably admitted to the canonical execution system. It does not prove that a model, provider, connector or external side effect ran.

## Next safe slice after verification

Add a deterministic specialist handler registry/execution bridge that validates the shared `AgentExecutionWorkPayload`, creates specialist AgentRun lifecycle state, consumes checkpoints/budgets, and returns structured results through the existing governed lifecycle.

Provider/model routing and invocation must remain a separate later gate after the deterministic specialist execution bridge is FULL-GATE verified.
