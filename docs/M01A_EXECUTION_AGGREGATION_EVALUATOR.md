# M01A — Execution Aggregation + Evaluator Handoff

Status: **VERIFIED / INTEGRATED TO `main`**

Updated: 2026-09-01

## Purpose

This is the ninth reversible implementation slice of **M01A — AI Agent Runtime & Memory OS**. It adds a deterministic completed-DAG aggregation boundary after canonical specialist WorkUnits have finished, validates the specialist execution projections and either completes the orchestrator, sends it to explicit review, maps terminal dispatch failure/cancellation state, or creates an exact independent evaluator handoff.

Provider/model invocation remains disabled. This slice uses the existing PostgreSQL AgentRun, ContextReceipt, execution-plan, JobRun/WorkUnit, effect, budget and lifecycle primitives and therefore introduces no new migration or queue framework.

## Integration evidence

- PR: `#33` — `feat(m01a): aggregate specialist DAGs and create evaluator handoff`
- final exact source head: `65fa365ef22c481d721bd93ce630f631b67fde46`
- final exact-head FULL GATE run: `33484348956` — PASS
- quality/security job: `99780868770` — PASS
- PostgreSQL 18 migration + RBAC job: `99781570196` — PASS
- canonical worker + Valkey job: `99781739052` — PASS
- merge SHA: `bd67b1331652f7aee390f1d43fc171fa39ea10e4`

The initial run `33483976613` exposed a stale pre-existing lifecycle verifier timestamp rather than an aggregation runtime defect. `verify-agent-memory-lifecycle.mjs` used a fixed `2026-09-01T01:00:00Z` transition time while persisted AgentRun `updated_at` used current database time. The existing time-regression guard correctly rejected it. The verifier was changed to derive transition times from the persisted run projection; no lifecycle guard or runtime invariant was weakened. The final exact-head run then passed every FULL GATE lane, including the new aggregation verifier.

## Aggregation boundary

`aggregateAgentExecutionPlan` revalidates the current persisted state before trusting any specialist output:

- exact workspace + dispatch → single canonical JobRun projection;
- exact immutable execution plan and orchestrator run identity;
- current active `workspace.read` authorization for the initiating user;
- exact approved deterministic-only orchestrator definition;
- exact plan-step ↔ WorkUnit payload correspondence;
- successful specialist result effect shape and plan identity;
- successful child AgentRun binding to the orchestrator and WorkUnit handoff;
- result projection equality between the child AgentRun and WorkUnit effect;
- budget usage ledger bounds and result-cost accounting;
- proposed actions remain inside the plan command allowlist;
- deterministic validator support, evidence requirements and confidence/review thresholds.

Aggregation uses deterministic ordering and union rules for step outputs, evidence/fact/source references, assumptions/conflicts, tool summaries, proposed actions, cost and resource usage.

## Orchestrator outcomes

For a completed canonical dispatch:

- valid aggregate with no independent evaluator → orchestrator `queued → running → succeeded`;
- invalid projection, unsupported validator, evidence gap, budget/cost mismatch or confidence below the orchestrator review threshold → orchestrator `review_required` with explicit issue codes;
- failed dispatch → orchestrator `failed`;
- cancelled dispatch → orchestrator `cancelled`;
- review dispatch → orchestrator `review_required`;
- nonterminal dispatch → aggregation fails closed as not ready.

The final aggregation is persisted inside the orchestrator AgentRun envelope, making replay deterministic and preventing a later call from silently replacing the already-frozen aggregation result.

## Independent evaluator handoff

When the approved orchestrator definition names `independentEvaluatorKey`, aggregation requires an exact evaluator version and revalidates that definition before creating state.

The bounded evaluator path is intentionally deterministic-only in this slice:

- approved exact evaluator definition;
- no T4/human-approval evaluator;
- no provider/model route;
- zero token and currency budget in the evaluator ContextReceipt;
- minimum-necessary parent policy/canonical refs and no inherited memory refs;
- deterministic evaluator ContextReceipt, handoff ID and queued child AgentRun;
- evaluator run is separate from the subject orchestrator run;
- orchestrator moves to `running` with `evaluatorState=pending` and remains incomplete.

A provider/model-routed evaluator fails closed with `AGENT_AGGREGATION_EVALUATOR_ROUTE_UNAVAILABLE`. Actual evaluator execution and EvalResult acceptance/rejection are a later bounded step.

## Verified behavior

`scripts/verify-agent-execution-aggregation.mjs` is chained through canonical `scripts/verify-db.mjs` and proves:

1. a successful specialist WorkUnit is prepared through the real specialist execution persistence boundary;
2. bounded usage is recorded through the canonical dispatch budget ledger;
3. specialist result effect and successful child AgentRun are cross-checked;
4. valid completed DAG aggregates and completes a no-evaluator orchestrator;
5. aggregation replay is idempotent and the stored state is readable tenant-scoped;
6. a configured provider/model evaluator is rejected before mutating orchestrator aggregation state;
7. an exact deterministic evaluator creates a zero-provider-budget ContextReceipt + queued evaluator AgentRun and leaves the orchestrator `running/evaluatorState=pending`;
8. evaluator aggregation replay is idempotent;
9. confidence below the configured review threshold moves the orchestrator to `review_required` with explicit issue state.

Existing migration, Agent/Memory lifecycle, Context Builder, execution-plan, dispatcher, identity/RBAC and canonical worker/Valkey regressions also passed in the final integration context.

## Explicit non-scope

This slice does not implement or activate:

- provider/model routing or invocation;
- evaluator worker execution;
- persistence/finalization of independent `EvalResult` against the aggregate;
- evaluator accept/reject → orchestrator terminal transition;
- manual review resume APIs;
- production specialist business logic;
- external source/API/tool execution;
- memory promotion/curation;
- outreach, CRM, billing or production deployment.

## Next safe slice

Complete deterministic evaluator decision application and explicit review/resume semantics: execute an already-approved deterministic evaluator boundary, persist an independent `EvalResult`, validate evaluator separation and evidence state, then transition the subject orchestrator from evaluation pending to `succeeded`, `failed` or `review_required` without activating provider/model execution.
