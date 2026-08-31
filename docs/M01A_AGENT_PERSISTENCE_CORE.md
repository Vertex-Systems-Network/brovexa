# M01A — Agent Persistence Core

Status: **IMPLEMENTED ON FEATURE BRANCH — AWAITING FULL GATE / INTEGRATION**

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

## Verification

`pnpm run verify:db` now includes `scripts/verify-agent-persistence.mjs` after the general migration test. The dedicated verification covers:

- migration application/readiness;
- same-version definition idempotency;
- conflicting same-version definition rejection;
- T4 human-approval database enforcement;
- definition identity mismatch rejection;
- cross-workspace ContextReceipt reuse rejection;
- deterministic/provider route mismatch rejection;
- tenant-scoped run reads.

The slice is **not VERIFIED** until hosted FULL GATE passes on the exact PR head and the PR is integrated to `main`.

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

## Next safe slice after verification

Add history-preserving AgentRun transitions plus durable MemoryRecord and evaluator persistence in separate small batches, then introduce the deterministic Agent Registry/Context Builder runtime before any model execution path.
