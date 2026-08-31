# M01A — Executable Agent Contracts Foundation

Status: **IMPLEMENTED ON FEATURE BRANCH — AWAITING CI / INTEGRATION**

Updated: 2026-09-01

## Purpose

This is the first reversible implementation slice of **M01A — AI Agent Runtime & Memory OS**. It converts the canonical planning contracts into executable, provider-neutral TypeScript/Zod contracts before any model provider, orchestration framework, vector store, autonomous action, production connector or external action is enabled.

The governing rule remains:

> Models reason; durable platform state remembers; deterministic services enforce permissions/policy; evidence supports claims.

## Implemented contracts

`packages/contracts/src/ai.ts` now defines executable schemas/types for:

- `AgentDefinition`
- autonomy tiers T0–T4
- explicit bounded agent budgets
- model/provider routing policy
- memory read/propose/commit/supersede scopes
- `ContextReceipt`
- durable `MemoryRecord`
- memory authority/status/type/data-classification enums
- `AgentRun`
- deterministic vs model execution mode
- validation/evaluator states
- `EvalResult`
- evidence verification states

## Deterministic safety invariants

The contract layer fails closed when:

1. an agent attempts direct commit/supersede authority over `system/procedural/*` memory;
2. a T4 definition does not require human approval;
3. deterministic-only agents claim model/provider routes;
4. model-routed definitions omit approved providers/models;
5. a ContextReceipt includes cross-workspace, cross-user or wrong-run memory;
6. a MemoryRecord namespace disagrees with canonical scope fields;
7. AI-derived memory omits agent/model/prompt/tool derivation metadata;
8. deleted memory omits an explicit deletion reason;
9. deterministic AgentRuns claim model/provider execution;
10. model AgentRuns omit explicit model/provider identifiers;
11. successful AgentRuns omit a structured result;
12. an evaluator attempts to evaluate the same run that generated the subject result;
13. an evaluator accepts evidence that is not `verified`.

## Tests

`packages/contracts/src/ai.spec.ts` exercises the initial safety boundary, including cross-tenant context isolation and independent evaluator behavior.

The authoritative completion state for this slice is **not VERIFIED** until repository CI passes on the exact branch/PR head and the change is integrated through the normal PR path.

## Explicit non-scope

This slice does **not** activate or implement:

- a production model/provider;
- prompt execution;
- agent orchestration/DAG execution;
- durable AgentRun/Memory persistence tables;
- embeddings/vector retrieval;
- autonomous external actions;
- connector/source activation;
- outreach;
- payment/billing provider activation;
- production deployment.

## Next safe slice after verification

After this contract slice passes CI and integrates, the next M01A batch should implement canonical PostgreSQL persistence for AgentDefinition/AgentRun/ContextReceipt/MemoryRecord/EvalResult with reversible migrations, tenant integrity, append/history semantics and dedicated database verification before runtime orchestration is introduced.
