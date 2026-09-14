# M01A — Agent Persistence Core

Status: **VERIFIED / INTEGRATED TO `main`**

Updated: 2026-09-01

## Purpose

This is the second reversible implementation slice of **M01A — AI Agent Runtime & Memory OS**. It adds canonical PostgreSQL persistence for the minimum runtime identity chain before orchestration/model execution is introduced:

`AgentDefinition → ContextReceipt → AgentRun`

The slice remains provider-neutral and does not activate any production model or external action.

## Implemented data model

### AgentDefinition

- immutable key + version identity
- explicit draft/approved/disabled state
- autonomy tier T0–T4
- required-human-approval flag
- full executable specification stored as JSONB
- database-level T4 approval invariant
- idempotent same-version persistence
- conflicting same-version content fails closed

### ContextReceipt

- immutable receipt identifier
- workspace scope
- optional user/run scope
- exact AgentDefinition identity/version binding
- durable full receipt envelope
- explicit token and currency budgets
- non-negative database budget checks

### AgentRun

- immutable run identifier
- workspace scope
- exact AgentDefinition identity/version binding
- ContextReceipt binding
- same-workspace parent-run binding
- deterministic/model execution mode
- explicit provider/model route fields
- durable full run envelope
- run status and timestamps

## Database integrity invariants

Migration `0003_agent_runtime_core` enforces:

1. AgentDefinition key/version uniqueness.
2. AgentDefinition identifier/key/version composite identity.
3. T4 definitions require human approval.
4. ContextReceipt definition ID/key/version must identify one canonical definition.
5. AgentRun definition ID/key/version must identify one canonical definition.
6. AgentRun may only reference a ContextReceipt from the same workspace and same AgentDefinition.
7. Parent AgentRun references are restricted to the same workspace.
8. Deterministic runs cannot claim provider/model execution.
9. Model runs require both provider and model identifiers.
10. Completion time cannot precede start time.

These constraints make cross-tenant association failure a database property rather than an application-only convention.

## Persistence behavior

`packages/db/src/agent-persistence.ts` provides bounded primitives for:

- `persistAgentDefinition`
- `persistContextReceipt`
- `persistAgentRun`
- tenant-scoped `getAgentRunEnvelope`

Create operations are retry-safe: the same identifier/content is idempotent, while a conflicting replay fails with an explicit persistence conflict.

## Verification evidence

PR #19 exact implementation head: `cd321289ef42d10c69e9db6eae6ce8782b407eef`.

Hosted CI run `33437473216` completed successfully before merge:

- M01 FULL GATE quality/security: PASS
- PostgreSQL 18 migration + RBAC FULL GATE: PASS
- canonical worker + Valkey FULL GATE: PASS

The PostgreSQL lane includes `scripts/verify-agent-persistence.mjs`, covering:

- migration application/readiness;
- same-version definition idempotency;
- conflicting same-version definition rejection;
- T4 human-approval database enforcement;
- definition identity mismatch rejection;
- cross-workspace ContextReceipt reuse rejection;
- deterministic/provider route mismatch rejection;
- tenant-scoped run reads.

PR #19 was merged to `main` as `0b8e52d31f4804b9f88d924a810d80ad39e97297` after exact-head verification.

## Explicit non-scope

This slice intentionally does not implement:

- mutable AgentRun transition/history semantics;
- durable MemoryRecord storage;
- evaluator/release-decision persistence;
- planner/orchestrator DAG execution;
- Context Builder retrieval runtime;
- model/provider selection or invocation;
- embeddings/vector retrieval;
- external tool execution;
- production source connectors;
- outreach, billing or deployment.

## Next safe slice

Implement durable `MemoryRecord` + `EvalResult` persistence with tenant integrity, revision lineage, deletion/supersession semantics and independent evaluator/run constraints. After that, add history-preserving AgentRun transitions, then deterministic Agent Registry/Context Builder runtime before any model execution path.
