# M01A — Deterministic Agent Registry & Context Builder Runtime

Status: **VERIFIED / INTEGRATED TO `main`**

Updated: 2026-09-01

## Purpose

This is the fifth reversible implementation slice of **M01A — AI Agent Runtime & Memory OS**. It turns the already-persisted AgentDefinition, MemoryRecord and ContextReceipt contracts into a provider-neutral deterministic runtime boundary.

The slice implements two tightly coupled responsibilities:

1. exact approved AgentDefinition resolution; and
2. minimum-necessary, tenant-scoped ContextReceipt construction from governed durable memory.

It intentionally does not execute a model, provider, tool or orchestration DAG.

## Agent Registry resolution

`resolveApprovedAgentDefinition` resolves an exact `agentKey + version` from canonical `agent_definitions` persistence and fails closed when:

- the definition does not exist;
- the definition is not `approved`;
- persisted row identity/status/autonomy/approval fields drift from its stored specification;
- memory read scopes are malformed;
- declared data classifications are unknown or empty;
- context token/currency budgets are malformed.

There is no implicit latest-version selection and no fallback to a draft/disabled definition.

## Context Builder runtime

`buildAndPersistAgentContext` re-resolves current workspace authorization from the database and requires `workspace.read`; caller-supplied permission claims are not trusted.

Candidate memory retrieval is constrained before ranking by:

- exact workspace;
- active status only;
- expiry at the context construction time;
- current user scope when `user_id` is present;
- exact run scope when `run_id` is present;
- AgentDefinition-approved data classifications.

Application-level deterministic eligibility then requires:

- canonical namespace within current system/workspace/user/run scope;
- user/run scope fields consistent with the namespace;
- a matching AgentDefinition `memory.read` namespace pattern;
- stored envelope identity/version/namespace/type/subtype/authority/status/classification matching canonical columns;
- at least one memory `readCapabilities` entry held by the current authorization context.

## Deterministic ranking

Eligible candidates are ranked without embeddings or model calls.

Authority is the primary ordering dimension:

1. `platform_policy`
2. `explicit_configuration`
3. `verified_fact`
4. `reviewed_human_decision`
5. `evaluated_agent_conclusion`
6. `agent_inference`
7. `historical_context`

Within the same authority class, deterministic ordering uses:

- target entity / lead specificity;
- exact run specificity;
- current-user specificity;
- confidence;
- freshness;
- stable ID tie-break.

Candidates are deduplicated by `namespace + subtype` after ranking so lower-ranked copies cannot displace the stronger record.

## Budget packing and receipt persistence

The builder:

- rejects requested token/currency budgets above the AgentDefinition hard limits;
- caps candidate retrieval and selected memory count;
- uses a deterministic conservative JSON-size token estimate for bounded packing;
- skips candidates that would exceed the requested context token budget;
- persists the immutable ContextReceipt through the existing idempotent `persistContextReceipt` primitive.

Same receipt ID + same content remains retry-safe. Same receipt ID + changed scope/content remains an explicit `CONTEXT_RECEIPT_ID_CONFLICT` through the canonical persistence boundary.

Receipt reads are tenant-scoped through `getContextReceiptEnvelope`.

## Verification

`scripts/verify-agent-context-runtime.mjs` is chained into canonical `pnpm run verify:db` without changing the root `verify:db` command.

The PostgreSQL 18 integration verification covers:

- exact approved definition resolution;
- missing version rejection;
- draft definition rejection;
- malformed/unknown classification specification rejection;
- current database authorization re-resolution;
- authority-first ordering over higher-confidence lower-authority memory;
- target-entity specificity within equal authority;
- current-user memory selection;
- cross-user exclusion;
- ACL exclusion;
- disallowed classification exclusion;
- expired and stale memory exclusion;
- cross-workspace exclusion;
- duplicate lower-ranked memory exclusion;
- bounded memory-count/token packing;
- persisted tenant-scoped ContextReceipt reads;
- idempotent receipt replay;
- changed same-ID receipt conflict;
- requested budget overflow rejection;
- mandatory policy-reference rejection;
- cross-tenant user authorization rejection;
- run-scoped memory inclusion only for the matching run.

### Hosted FULL GATE evidence

Verified source head: `2e9c76d5b571eea0aa497c60cb2f8a99dde627bd`

Pull request: **#25 — `feat(m01a): add deterministic Agent Registry and Context Builder`**

Exact-head/current-main merge-context run: `33443959594` — **PASS**

- M01 FULL GATE quality and security — job `99658572955`: **PASS**
- PostgreSQL 18 migration + RBAC FULL GATE — job `99659218677`: **PASS**
- Canonical worker + Valkey FULL GATE — job `99659406478`: **PASS**

PR #25 was merged to `main` as `857ac0e663d20a7522215f12340fb300aca77d60` after all three lanes passed on the exact verified source head.

## Explicit non-scope

This slice intentionally does not implement:

- model/provider routing or invocation;
- embeddings or vector retrieval;
- semantic-similarity ranking;
- planner/orchestrator DAG execution;
- external tool execution;
- source connectors;
- canonical Business/Lead/Fact retrieval that does not yet have an implemented canonical runtime surface; callers may provide governed canonical reference IDs only;
- background/system-actor context construction without an active user membership;
- context caching;
- model prompt assembly;
- outreach, CRM, billing or deployment.

## Next safe slice after verification

Implement a bounded provider-neutral Orchestrator/Planner execution foundation that consumes an approved AgentDefinition + persisted ContextReceipt, creates governed AgentRun/WorkUnit state, uses existing lifecycle transitions, enforces hard budgets/validators and preserves deterministic/manual failure states. Keep actual provider/model invocation separately gated until that execution state machine is independently verified.
