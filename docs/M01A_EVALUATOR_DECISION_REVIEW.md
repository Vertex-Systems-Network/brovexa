# M01A — Evaluator Decision Application + Review Resolution

Status: **IMPLEMENTED ON FEATURE BRANCH — AWAITING FULL GATE / INTEGRATION**

Updated: 2026-09-01

## Purpose

This is the tenth reversible implementation slice of **M01A — AI Agent Runtime & Memory OS**. It completes the deterministic independent-evaluator boundary created by the previous aggregation slice and adds explicit owner-governed resolution for orchestrator runs that require human review.

Provider/model execution remains disabled. The slice reuses the existing AgentRun lifecycle, append-only transition history, ContextReceipt, immutable execution aggregation, `agent_eval_results` persistence, workspace authorization and owner-role primitives. It introduces no new migration, provider integration or queue framework.

## Evaluator decision application

`applyAgentEvaluatorDecision` accepts an exact evaluator handoff and revalidates persisted state before changing any run:

- exact workspace + dispatch → immutable execution plan → subject orchestrator projection;
- current active `workspace.read` authorization for the initiating plan user;
- subject is still `running` with `evaluatorState=pending`;
- frozen execution aggregation is still `evaluation_pending` and matches the requested dispatch/plan;
- evaluator AgentRun exactly matches the frozen handoff, subject, ContextReceipt, key/version and deterministic route;
- evaluator definition is still approved, non-T4, non-human-approval and `deterministic_only` with no provider/model allowance;
- evaluator ContextReceipt still belongs to the plan user, evaluator run and exact definition and retains zero provider token/currency budget;
- evidence references are restricted to the frozen aggregate evidence set;
- policy references are restricted to the evaluator ContextReceipt policy set;
- decision timestamps cannot precede subject/evaluator projections.

The decision is normalized fail-closed:

- `accept` requires verified evidence, the configured evaluator confidence threshold, and an evidence reference when the aggregate contains evidence;
- `reject` requires `contradicted` or `policy_invalid` evidence state;
- any failed acceptance/rejection condition becomes `review` rather than silently accepting or rejecting;
- reason, evidence and policy references are normalized and bounded.

## Atomic durable outcome

One PostgreSQL transaction performs the complete deterministic evaluator outcome:

1. evaluator AgentRun `queued → running`;
2. evaluator AgentRun `running → succeeded` with structured result/evidence projection;
3. durable independent `EvalResult` persistence using the existing idempotent `agent_eval_results` primitive;
4. subject orchestrator transition from `running` to:
   - `succeeded` for accepted evaluation,
   - `failed` for rejected evaluation,
   - `review_required` for evaluator review/fail-closed normalization;
5. immutable evaluation metadata is embedded into the subject execution aggregation/envelope for deterministic replay.

Same-ID/same-request replay is idempotent. A changed replay conflicts instead of replacing the frozen evaluation.

## Manual review resolution

`resolveAgentExecutionReview` provides a bounded human resolution path for an orchestrator already in `review_required`:

- requires an active workspace owner, not merely an authenticated member or agent;
- requires an explicit resolution ID, actor user ID, approve/reject decision and reason;
- requires a governed execution aggregation projection;
- approval requires a structured subject result;
- review is explicitly resumed through `review_required → running`;
- finalization is explicit `running → succeeded` or `running → failed`;
- both transitions are append-only AgentRun lifecycle events with `actor_type=user` and the owner actor ID;
- resolution projection is persisted in the AgentRun envelope and is idempotent on exact replay.

This does not create a generic bypass around validator/evaluator rules. It is a narrow owner-authorized resolution of a run already placed into the explicit review state.

## Verification target

`scripts/verify-agent-evaluator-decision.mjs` is chained through canonical `scripts/verify-db.mjs` and exercises the real aggregation, specialist, AgentRun lifecycle and evaluation persistence stack. It verifies:

1. deterministic specialist execution produces a completed canonical dispatch;
2. aggregation creates the exact zero-provider-budget independent evaluator handoff;
3. verified high-confidence acceptance succeeds evaluator and subject runs and persists `EvalResult`;
4. exact evaluator decision replay is idempotent and tenant-scoped state is readable;
5. out-of-scope evidence references fail before mutating the queued evaluator run;
6. a requested accept with insufficient evidence/low confidence is normalized to review and moves the subject to `review_required`;
7. a non-owner cannot resolve the review;
8. an active owner can explicitly resume and approve the reviewed run, producing append-only user-attributed lifecycle transitions;
9. owner resolution replay is idempotent;
10. contradiction-backed evaluator rejection fails the subject orchestrator.

Existing migration, Agent/Memory lifecycle, Context Builder, execution-plan, dispatcher, specialist execution and aggregation regressions remain in the same canonical PostgreSQL 18 FULL GATE.

## Explicit non-scope

This slice does not implement or activate:

- provider/model routing or invocation;
- external evaluator worker/model execution;
- production specialist business logic;
- generic operator review queues/UI;
- arbitrary member review overrides;
- memory promotion/curation;
- external source/API/tool execution;
- acquisition, outreach, CRM, billing or production deployment.

## Next safe slice after verification

After this slice is independently FULL-GATE verified and integrated, re-audit the remaining M01A gap. The likely final M01A hardening boundary is broader pause/review/resume observability and runtime-read APIs around the now-complete deterministic orchestrator → specialist → aggregation → evaluator → review lifecycle, while production provider/model execution remains a separately gated capability.
