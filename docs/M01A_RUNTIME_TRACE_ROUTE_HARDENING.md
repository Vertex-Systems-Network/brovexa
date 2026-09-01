# M01A — Runtime Trace + Route Hardening

Status: **IMPLEMENTED ON FEATURE BRANCH — AWAITING FULL GATE / INTEGRATION**

Updated: 2026-09-01

## Purpose

This is the eleventh bounded implementation slice of **M01A — AI Agent Runtime & Memory OS**. It hardens the now-complete deterministic execution lifecycle with a tenant-authorized bounded runtime trace and an exact provider-neutral route-policy resolver.

The slice introduces no migration, provider SDK, model invocation, credential store, network call, connector, queue framework or production business-specialist activation.

## Provider-neutral route resolution

`resolveAgentExecutionRoute` reuses the exact approved `AgentDefinition` registry and resolves only policy-approved execution identity:

- exact `agentKey + agentVersion` is required;
- definition must resolve through the existing approved Agent Registry;
- `deterministic_only` definitions cannot receive provider/model IDs;
- `approved_models` definitions require an explicit provider and model selection;
- provider must be present in the definition's approved provider allowlist;
- primary model must be present in the approved model allowlist;
- fallback models are accepted only from the explicit fallback allowlist and only with `allowFallback=true`;
- malformed or inconsistent model policy fails closed;
- the result records whether execution is deterministic/model and whether fallback selection was used.

This API **does not execute a provider or model**. It does not read credentials and does not perform a network call. It only resolves the exact route permitted by the persisted approved definition.

## Privileged bounded execution trace

The internal trace reader composes one persisted dispatch across:

- canonical `JobRun`;
- immutable `AgentExecutionPlan`;
- all plan WorkUnits;
- WorkUnit effects and checkpoints;
- orchestrator plus direct specialist/evaluator AgentRuns;
- append-only AgentRun transitions;
- durable independent EvalResults.

Trace reads are bounded with fail-closed cardinality limits for WorkUnits, effects, checkpoints, AgentRuns, transitions and evaluations. The reader validates that the dispatch still maps to one immutable plan/orchestrator projection and that WorkUnit count still matches the immutable plan.

Because trace payloads can contain operational/evaluation detail, the package root does **not** expose the lower-privilege internal reader. The public package surface exposes `getPrivilegedAgentExecutionTrace`, which re-resolves current tenant authorization and requires `workspace.audit.read` before delegating to the tenant-scoped trace reader. A normal member with only `workspace.read` cannot retrieve the full execution trace.

## Verification target

`scripts/verify-agent-runtime-hardening.mjs` is chained through canonical `scripts/verify-db.mjs` and verifies:

1. deterministic-only route resolution returns no provider/model;
2. provider/model selection is rejected for deterministic-only definitions;
3. model-routed definitions require explicit route selection;
4. unapproved providers and models fail closed;
5. fallback models require explicit fallback opt-in;
6. approved primary and explicitly enabled fallback routes resolve deterministically;
7. a real persisted execution plan is dispatched through canonical JobRun/WorkUnit primitives;
8. budget effect, normal effect and checkpoint state are visible in the bounded trace;
9. AgentRun lifecycle transition history is visible in the trace;
10. an owner with `workspace.audit.read` can read the trace;
11. a normal workspace member cannot read the privileged trace;
12. an owner of another workspace receives no cross-tenant trace.

All previous migration, identity/RBAC, Agent/Memory lifecycle, Context Builder, plan, dispatcher, specialist execution, aggregation/evaluator, evaluator-decision and worker/Valkey regressions remain in the same hosted FULL GATE.

## Explicit non-scope

This slice does not implement or activate:

- provider/model network invocation;
- provider credentials or secrets;
- model retry/fallback execution;
- production model billing/quota reconciliation;
- production connectors or external tools;
- production specialist business logic;
- generic operator trace/review UI;
- acquisition, outreach, CRM, payments or deployment.

## M01A completion interpretation

If this exact slice passes the complete hosted FULL GATE and is integrated to `main`, the planned **provider-neutral M01A runtime foundation** can be considered implementation-complete: governed contracts, durable memory/lifecycle, registry/context, planner, dispatch, deterministic specialist bridge, aggregation, evaluator/review lifecycle, route-policy resolution and privileged execution trace are all independently verified.

Actual provider/model invocation remains a later separately gated capability and must not be inferred from M01A foundation completion.
