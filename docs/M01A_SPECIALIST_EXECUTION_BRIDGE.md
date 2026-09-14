# M01A — Deterministic Specialist Execution Bridge

Status: **VERIFIED / INTEGRATED TO `main`**

Updated: 2026-09-01

## Purpose

This is the eighth reversible implementation slice of **M01A — AI Agent Runtime & Memory OS**. It bridges an already-dispatched specialist `JobRun` / `WorkUnit` into governed specialist `ContextReceipt` + `AgentRun` lifecycle state while keeping provider/model invocation, external tools and production specialist implementations disabled.

The slice extends the existing canonical worker instead of creating a second queue, scheduler or execution framework.

## Execution boundary

A deterministic specialist handler is registered by exact `agentKey`, exact agent version and a versioned handler-registry identity.

Before creating any child execution state, the worker rejects handler-registry or handler identity mismatches. The database admission path then revalidates the claimed WorkUnit against:

- canonical queue/job/work identity;
- immutable dispatch payload;
- immutable persisted execution plan and exact plan step;
- current workspace authorization of the initiating user;
- exact approved deterministic-only specialist `AgentDefinition`;
- tool, command and budget scope;
- parent `ContextReceipt` policy/canonical/memory scope.

Provider-routed definitions and definitions requiring independent evaluation are fail-closed in this bounded slice.

## Per-attempt trace model

Every claimed specialist WorkUnit attempt receives deterministic child identities derived from WorkUnit + attempt:

- a minimum-necessary child `ContextReceipt`;
- a child specialist `AgentRun` linked to the orchestrator through `parentRunId`;
- the WorkUnit linked through `handoffId`.

Retry attempts create separate child AgentRuns so a failed attempt is never rewritten into a later success. Lease-recovery can terminalize abandoned queued/running child attempts before the replacement attempt continues.

## Lifecycle and result boundary

The worker uses the existing append-only AgentRun lifecycle primitives:

- `queued -> running` before handler execution;
- retryable failure -> `failed`;
- cancellation -> `cancelled`;
- hard budget stop -> `budget_stopped`;
- invalid/low-confidence/non-passed output -> `review_required`;
- valid deterministic result -> `succeeded`.

Successful completion persists a structured result into the canonical AgentRun projection together with confidence, evidence/fact/source references, assumptions/conflicts, tool summary, cost and proposed actions.

Success requires deterministic validation state `passed`, configured confidence thresholds, evidence when the definition requires it, allowed tool/command claims and result cost within the WorkUnit reservation.

## Checkpoints and budgets

Specialist handlers receive only governed bridge helpers:

- cancellation check;
- canonical dispatch checkpoint writer;
- idempotent bounded dispatch budget accounting.

No provider billing truth is claimed. The existing dispatcher reservation/usage ledger remains authoritative for this deterministic bridge.

## Worker integration

`createDeterministicSpecialistHandlers` produces exact canonical worker handlers and reuses:

- the existing PostgreSQL claim/lease contract;
- canonical retry/backoff behavior;
- existing Valkey/BullMQ delivery;
- existing WorkUnit completion/effect idempotency;
- existing cancellation and recovery semantics.

The canonical `verify:queue` command now runs the original worker/recovery verification and then the dedicated specialist execution bridge verification. No production specialist handler is registered in the worker entrypoint by this slice.

## Verification evidence

Final exact source head: `18340eed0d1be87e27cbe60b2b4777ba6113fc30`.

Hosted FULL GATE run `33452361663`: **PASS**.

- quality/security job `99684875670`: **PASS**;
- PostgreSQL 18 migration + RBAC job `99685310855`: **PASS**;
- canonical worker + Valkey job `99685494095`: **PASS**.

PR #31 merged with the exact expected source head and produced `main` merge SHA `2d1ed2d0f6cb5b24b0601b9a92fe9ba3282fd93f`.

The dedicated specialist queue integration verifier proves an end-to-end deterministic retry sequence:

1. immutable plan dispatch creates one runnable specialist WorkUnit;
2. attempt 1 creates a child ContextReceipt/AgentRun, checkpoints, then fails retryably;
3. the first child AgentRun becomes terminal `failed`;
4. canonical worker retry creates a distinct second child ContextReceipt/AgentRun;
5. attempt 2 accounts bounded usage and returns a structured validated result;
6. the second child AgentRun becomes `succeeded`;
7. the canonical WorkUnit and JobRun complete successfully;
8. the final WorkUnit effect references the successful child AgentRun/result;
9. no provider/model route is claimed anywhere in the specialist run.

The first hosted run `33452024750` reached the new specialist verifier after the existing canonical worker verification had already passed. It failed only because the verifier's broad `ctx-specialist-%` selector also counted the intentionally named parent ContextReceipt. The selector was tightened to the specialist `agent_key`; no runtime semantics, authorization rule or lifecycle invariant was weakened.

Existing quality, migration, RBAC and canonical worker/Valkey regressions also remained green on the final exact head.

## Explicit non-scope

This slice does not implement or activate:

- provider/model routing or invocation;
- prompt/model adapter SDKs;
- external source/API/tool execution;
- production specialist business logic;
- independent evaluator execution;
- orchestrator result aggregation/finalization;
- memory promotion/curation from specialist output;
- outreach, CRM, billing or production deployment.

A successful specialist child AgentRun proves only deterministic registered handler execution inside the governed runtime boundary.

## Next safe slice

Add deterministic execution aggregation and validator/evaluator handoff for a completed specialist DAG, including orchestrator lifecycle progression and explicit review/failure semantics. Provider/model routing should remain a separate later gate until that deterministic aggregation boundary is FULL-GATE verified.
