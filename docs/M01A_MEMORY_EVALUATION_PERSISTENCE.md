# M01A — Memory & Evaluation Persistence

Status: **IMPLEMENTED ON FEATURE BRANCH — AWAITING FULL GATE / INTEGRATION**

Updated: 2026-09-01

## Purpose

This is the third reversible implementation slice of **M01A — AI Agent Runtime & Memory OS**. It extends the canonical runtime persistence chain with durable governed memory and independent evaluation state:

`AgentDefinition → ContextReceipt → AgentRun → MemoryRecord / EvalResult`

No production model/provider or external action is activated by this slice.

## Durable MemoryRecord

Migration `0004_memory_evaluation_core` and `packages/db/src/memory-record-schema.ts` persist:

- immutable memory ID and explicit version;
- same-workspace revision parent lineage;
- workspace/user/run namespace scope;
- entity/lead references;
- memory type/subtype;
- writer and AI-derived state;
- derivation metadata;
- confidence and authority;
- lifecycle status;
- retention/deletion metadata;
- data classification;
- complete contract envelope and timestamps.

### Memory database invariants

The database fails closed on:

1. cross-workspace revision lineage;
2. cross-workspace AgentRun binding;
3. namespace/scope mismatch;
4. agent-written `system/procedural/*` memory;
5. AI-derived memory without derivation metadata;
6. non-AI memory that claims derivation metadata;
7. deleted memory without an explicit deletion reason;
8. non-deleted memory that carries a deletion reason;
9. self-referential revision lineage;
10. out-of-range confidence.

## Durable EvalResult

`agent_eval_results` persists:

- workspace scope;
- evaluator AgentRun;
- subject AgentRun;
- accept/reject/review decision;
- evidence verification state;
- reason codes;
- evidence and policy references;
- confidence;
- complete evaluation envelope and timestamp.

### Evaluation database invariants

The database fails closed when:

1. evaluator and subject reuse the same AgentRun;
2. an accepted result does not have verified evidence;
3. evaluator or subject run belongs to another workspace;
4. reason codes or policy references are empty/non-array values;
5. confidence is outside 0–1.

## Persistence primitives

`packages/db/src/memory-eval-persistence.ts` provides retry-safe primitives:

- `persistMemoryRecord`
- `getMemoryRecordEnvelope`
- `persistEvalResult`
- `getEvalResultEnvelope`

Same-ID/same-content retries are idempotent. Same-ID conflicting content, scope or lineage fails with an explicit `AgentPersistenceConflictError`.

## Verification

`scripts/verify-memory-evaluation.mjs` exercises:

- migration/readiness;
- memory idempotency and conflicting replay;
- tenant-scoped reads;
- same-workspace revision lineage;
- cross-workspace revision rejection;
- protected procedural-memory rejection;
- namespace mismatch rejection;
- deletion semantics;
- run-scoped AI-derived memory;
- cross-workspace run binding rejection;
- evaluation idempotency/conflicting replay;
- independent evaluator enforcement;
- verified-evidence acceptance rule;
- cross-workspace evaluation rejection.

The script is chained into the canonical `pnpm run verify:db` database gate without changing the guarded root command.

## Explicit non-scope

This slice does not implement:

- mutable AgentRun transition/history semantics;
- memory supersession transaction APIs;
- retention sweeper/deletion jobs;
- embedding/vector retrieval;
- Context Builder query/ranking runtime;
- Agent Registry runtime;
- planner/orchestrator DAG execution;
- model/provider invocation;
- external tool execution;
- source connectors, outreach, billing or deployment.

## Next safe slice after verification

Implement append-only AgentRun transition/history semantics and explicit memory supersession/deletion transaction primitives. Then add deterministic Agent Registry + Context Builder retrieval/runtime before any model execution path.
