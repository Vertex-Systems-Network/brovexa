# M01A — AgentRun & Memory Lifecycle

Status: **IMPLEMENTED ON FEATURE BRANCH — AWAITING FULL GATE / INTEGRATION**

Updated: 2026-09-01

## Purpose

This is the fourth reversible implementation slice of **M01A — AI Agent Runtime & Memory OS**. It adds history-preserving AgentRun state transitions and transactional memory supersession/deletion semantics without introducing model/provider execution.

The core rule is:

> lifecycle history is append-only; mutable canonical rows are synchronized projections, not the audit source of truth.

## AgentRun lifecycle

Migration `0005_agent_memory_lifecycle` adds `agent_run_transitions` and a `last_transition_id` projection link on `agent_runs`.

Each transition records:

- immutable transition ID;
- workspace + AgentRun scope;
- explicit from/to status;
- reason code;
- actor type and optional actor ID;
- structured metadata;
- occurrence timestamp.

### AgentRun invariants

The database fails closed on:

1. transition rows that reference a run from another workspace;
2. no-op transitions;
3. transitions originating from terminal `succeeded`, `failed`, `budget_stopped` or `cancelled` states;
4. direct lifecycle projection changes without a newly linked transition event;
5. transition/projection status mismatch;
6. envelope status drift from the canonical projection;
7. projection timestamp drift from the transition timestamp;
8. running state without a start timestamp;
9. terminal state without valid start/completion timestamps;
10. UPDATE or DELETE attempts against transition history.

`transitionAgentRun` serializes the current run with `FOR UPDATE`, inserts the append-only event and updates the canonical row in one PostgreSQL transaction. Same-ID/same-content retries are idempotent; changed replay, stale expected state, terminal mutation and time regression fail explicitly.

## Memory lifecycle

Migration `0005_agent_memory_lifecycle` also adds `memory_record_lifecycle_events` and a `last_lifecycle_event_id` projection link on `memory_records`.

The implemented terminal lifecycle operations are:

- `supersedeMemoryRecord`
- `deleteMemoryRecord`

History reads are exposed through `getMemoryLifecycleHistory`; AgentRun history through `getAgentRunTransitionHistory`.

### Memory invariants

The database/application boundary fails closed on:

1. cross-workspace memory or successor associations;
2. supersession without a distinct direct revision successor;
3. successor memory that is not active/non-deleted;
4. supersession from non-supersedable states;
5. deletion of already deleted or superseded memory;
6. direct terminal lifecycle projection changes without a lifecycle event;
7. lifecycle event/projection status mismatch;
8. envelope status or deletion-reason drift;
9. projection timestamp drift from the lifecycle event timestamp;
10. multiple terminal lifecycle events for the same memory record;
11. UPDATE or DELETE attempts against lifecycle history.

Successor creation, supersession event insertion and parent projection update run in one database transaction. Deletion event insertion and deletion projection update are also atomic.

## Typed database surfaces

This slice adds:

- `packages/db/src/agent-lifecycle-schema.ts`
- `packages/db/src/lifecycle-persistence.ts`
- lifecycle projection links on AgentRun and MemoryRecord schemas
- lifecycle exports through `@brovexa/db`
- readiness probing for both lifecycle ledgers
- schema-level unit coverage.

## Verification

`scripts/verify-agent-memory-lifecycle.mjs` is chained into canonical `pnpm run verify:db` and exercises:

- migration/readiness;
- direct AgentRun projection overwrite rejection;
- queued → running → succeeded history;
- idempotent transition replay;
- conflicting transition replay;
- stale transition rejection;
- terminal-run transition rejection;
- append-only transition history;
- memory supersession with a direct successor revision;
- supersession retry idempotency;
- cross-workspace successor rejection;
- direct memory deletion projection rejection;
- transactional deletion + deletion-reason synchronization;
- terminal-memory mutation rejection;
- append-only memory lifecycle history;
- tenant-scoped history reads.

Existing migration, Agent persistence, Memory/Evaluation, identity/RBAC and worker/queue destructive verification harnesses are reconciled with migration `0005` so the FULL GATE validates the complete current schema rather than an outdated migration list.

This slice is **not VERIFIED** until hosted FULL GATE passes on the exact PR head and the PR is integrated to `main`.

## Explicit non-scope

This slice intentionally does not implement:

- deterministic Agent Registry runtime;
- Context Builder retrieval/ranking/assembly runtime;
- embeddings/vector retrieval;
- planner/orchestrator DAG execution;
- provider/model routing or invocation;
- external tool execution;
- source connectors;
- retention sweeper/background deletion jobs;
- outreach, CRM, billing or deployment.

## Next safe slice after verification

Implement the deterministic Agent Registry + Context Builder runtime: approved AgentDefinition resolution, minimum-necessary policy/canonical/memory retrieval, tenant/capability filtering, deterministic ranking and immutable ContextReceipt construction. Keep provider/model execution outside that slice until registry/context behavior is independently verified.
