# Brovexa M01A Agent Runtime & Durable Memory Foundation

Status: **ABD-244 IN PROGRESS — provider-neutral foundation only**

This document describes the first bounded implementation slice of Linear `ABD-244` after M01 integration and explicit development authorization. It is an internal development checkpoint and is **not DEPLOYED**, not released, and not production verified.

## Scope in this slice

The slice establishes deterministic authority and durable state below any future model/provider layer:

- versioned `AgentDefinition` contracts and canonical definition hashes;
- a deny-by-default `AgentRegistry` with a default T2 autonomy ceiling;
- internal tool and memory capability declarations;
- durable tenant-scoped `agent_runs` and idempotent `agent_checkpoints`;
- durable memory records, revisions, provenance metadata and explicit conflicts;
- immutable content/provenance records with terminal-state protection;
- deterministic context selection under authority, freshness, conflict and token-budget limits;
- immutable reference-only `ContextReceipt` records bound to the exact agent run definition;
- PostgreSQL cross-tenant constraints for requester, parent-run, user-memory, run-memory, revision and receipt relationships;
- proposal-only memory writes from the application API in this slice.

## Authority boundary

Security remains below any future model:

- agents receive allowlisted server-side capabilities rather than raw database, shell or credential authority;
- the foundation registry denies external tool access by default;
- T3/T4 definitions are rejected by the default foundation registry;
- ordinary agent definitions cannot write system procedural memory;
- memory written by an agent/curator must bind to the exact `agent_run_id + workspace_id + agent_key + agent_version` in PostgreSQL;
- user-scoped memory must bind to a membership in the same workspace;
- cross-workspace parent runs, memory references and context receipts fail at the database boundary;
- model text, prompts or memory content never prove that a canonical mutation succeeded.

## Memory safety model

Durable memory is not an unrestricted prompt cache.

A memory record carries namespace, type, subtype, status, authority class, provenance, writer identity, confidence, data classification and freshness metadata. Durable content/provenance fields are immutable; changed knowledge is represented by a new revision rather than silent mutation.

The context read path returns only memory that is:

- in the requested workspace;
- workspace-visible or scoped to the requesting user;
- `active`;
- non-expired at query time;
- not involved in an open conflict;
- within an allowlisted namespace prefix and memory type.

The deterministic Context Builder then applies tenant/user checks again, required-context fail-closed behavior, authority/relevance/confidence ordering and hard token budgets before a reference-only ContextReceipt is persisted.

## Explicit non-scope

This slice activates **no production model provider**, **no external agent tool**, and no production AI credential or secret. It does not activate model SDKs, browsing/source connectors, unrestricted acquisition, autonomous outreach, payment/billing effects, shell access, arbitrary database commands, production deployment or release.

There is no claim that an AI Agent OS is production complete. Planner/orchestrator execution, bounded specialist fan-out, evaluator disagreement handling, provider routing/fallback, model outage behavior, budget-stop orchestration, human-review UI/API, memory curator jobs and full adversarial prompt/memory eval suites remain later ABD-244 slices.

## Database migration

Migration:

```text
packages/db/migrations/0003_agent_memory_foundation.up.sql
```

Rollback:

```text
packages/db/migrations/down/0003_agent_memory_foundation.down.sql
```

The migration extends the existing `workspaces` tenant root; it does not create a second tenant authority domain.

## Verification

Zero-dependency structural/security gate:

```bash
pnpm run verify:m01a:foundation
```

PostgreSQL 18 integration gate:

```bash
pnpm run verify:agent-memory
```

The integration verifier exercises:

- current identity/bootstrap API compatibility;
- inactive/cross-tenant requester rejection;
- cross-tenant parent-run rejection;
- allowed run-state transitions and invalid-transition rejection;
- checkpoint replay idempotency and monotonic sequence allocation;
- forged writer/run identity rejection;
- cross-tenant namespace rejection;
- cross-workspace user-memory rejection;
- immutable memory content/provenance;
- conflict and expiry exclusion from context retrieval;
- unsafe namespace-prefix rejection;
- deterministic Context Builder selection;
- exact run-definition ContextReceipt binding and immutability;
- terminal memory-state immutability;
- migration rollback and re-apply.

Existing M01 database, identity/RBAC and queue/worker regressions are also upgraded to migration `0003`, so M01A cannot silently regress the verified platform foundation.

## Promotion rule

ABD-244 cannot be called verified merely because files exist or TypeScript compiles. The exact PR head must pass hosted quality/security, PostgreSQL migration/RBAC/agent-memory integration and worker/Valkey regression evidence, followed by self-review. Integration to `main` remains separately governed by the default-branch compensating policy.
