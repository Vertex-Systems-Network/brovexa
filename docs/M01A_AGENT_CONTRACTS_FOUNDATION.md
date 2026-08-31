# M01A — Executable Agent Contracts Foundation

Status: **VERIFIED / INTEGRATED TO `main`**

Updated: 2026-09-01

## Purpose

This is the first reversible implementation slice of **M01A — AI Agent Runtime & Memory OS**. It converts the canonical planning contracts into executable, provider-neutral TypeScript/Zod contracts before any model provider, orchestration framework, vector store, autonomous action, production connector or external action is enabled.

The governing rule remains:

> Models reason; durable platform state remembers; deterministic services enforce permissions/policy; evidence supports claims.

## Implemented contracts

`packages/contracts/src/ai.ts` defines executable schemas/types for:

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

## Verification evidence

The first hosted run correctly caught an `exactOptionalPropertyTypes` compile mismatch in the new scope contract. The implementation was corrected rather than bypassing the gate.

Final exact source head: `e6c1e379aacae634ccae791b5901552689315d29`.

Hosted FULL GATE run `33435851495`: **PASS**.

- quality/security + build/typecheck/tests + live API observability job `99631967923`: **PASS**
- PostgreSQL 18 migration + tenant/RBAC regression job `99632659346`: **PASS**
- canonical worker + Valkey recovery/correlation regression job `99632922997`: **PASS**

PR #17 merged the verified source head to `main` as `de800e0a502830340556dc3d814a4ab0b5714c87`.

`packages/contracts/src/ai.spec.ts` exercises the initial safety boundary, including cross-tenant context isolation and independent evaluator behavior.

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

## Next safe slice

Implement canonical PostgreSQL persistence for AgentDefinition/AgentRun/ContextReceipt/MemoryRecord/EvalResult with reversible migrations, tenant integrity, append/history semantics and dedicated database verification before runtime orchestration is introduced.
