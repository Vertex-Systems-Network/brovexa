# Brovexa

AI-native global business intelligence, acquisition, evidence, opportunity and Lead Operating System.

## Development progress

Updated: **2026-09-02**

**Current verified state:** M00 planning/readiness, **M01 — Platform Foundation & Developer Experience**, and the planned **provider-neutral M01A — AI Agent Runtime & Memory OS foundation are complete**. **M02 — Business Discovery & Source Connectors is ACTIVE with five bounded implementation slices FULL-GATE verified and integrated:** provider-neutral source capability/policy/request/result contracts, durable immutable source registry/admission persistence, durable ResearchJob preflight + SourceTask lifecycle, provider-neutral SourceTask execution bridge, and execution-time connector policy/health/quota safety gates. Production provider/network transport and production source credentials/connectors remain separately gated.

### Overall delivery estimate

**Weighted program delivery: ~30% complete**

`██████░░░░░░░░░░░░░░ 30%`

```mermaid
pie showData
    title Brovexa weighted delivery estimate
    "Completed / materially delivered" : 30
    "Remaining" : 70
```

> Progress is an evidence-based delivery estimate, not a simple milestone count. Planning/architecture-only work receives limited credit; verified runtime, tests, CI and integrated code receive full credit. Estimates exclude waiting time for provider, legal, commercial or production-infrastructure decisions.

### Phase / module progress

| Phase | Module | Current evidence state | Progress | Estimated remaining engineering days* |
|---|---|---|---:|---:|
| M00 | Product, Compliance & Architecture Baseline | Approved readiness baseline; implementation authorized | `████████████████████` **100%** | **0** |
| M01 | Platform Foundation & Developer Experience | **VERIFIED / INTEGRATED** — monorepo, PostgreSQL migrations, queue/worker, identity/RBAC/tenant primitives, API observability/health, CI/security FULL GATE | `████████████████████` **100%** | **0** |
| M01A | AI Agent Runtime & Memory OS | **VERIFIED / INTEGRATED — provider-neutral foundation complete.** Governed contracts, Agent/Context/Run + Memory/Eval persistence, append-only lifecycle, Registry/Context Builder, immutable Planner, deterministic dispatch, specialist execution bridge, aggregation, independent evaluator + owner review lifecycle, exact route-policy resolution and privileged bounded execution trace are FULL-GATE verified. Production provider/model invocation remains separately gated | `████████████████████` **100%** | **0** |
| M02 | Business Discovery & Source Connectors | **ACTIVE — five bounded slices VERIFIED / INTEGRATED.** Contracts/admission, immutable registry/admission persistence, durable SourceTask/preflight lifecycle, no-network execution bridge, and execution-time connector policy/health/quota safety gates are integrated. Real provider transports, credentialed connectors and production activation remain separately gated | `████████████░░░░░░░░` **60%** | **3–6** |
| M02A | Global Acquisition Studio & Background Research | Geography/taxonomy/Research Job Builder/background-execution contracts planned; feature implementation not started | `█░░░░░░░░░░░░░░░░░░░` **5%** | **12–18** |
| M03 | Entity Resolution & Contact Enrichment | Canonical model planned; enrichment remains provider/legal gated | `█░░░░░░░░░░░░░░░░░░░` **5%** | **7–10** |
| M04 | Website & Digital Presence Intelligence | Evidence/source/security model planned; bounded website intelligence runtime not implemented | `█░░░░░░░░░░░░░░░░░░░` **5%** | **6–9** |
| M05 | Demand, Intent & Opportunity Signals | Universal signal ontology documented; signal engine not implemented | `█░░░░░░░░░░░░░░░░░░░` **5%** | **8–12** |
| M06 | BPO Intelligence, Scoring & Explainability | Opportunity/scoring contracts planned; runtime scoring/reason-code pipeline not implemented | `█░░░░░░░░░░░░░░░░░░░` **5%** | **6–9** |
| M06A | Lead Intelligence Operating System | Lead lifecycle/model/routing/task/nurture contracts documented; operational Lead OS not implemented | `█░░░░░░░░░░░░░░░░░░░` **5%** | **10–15** |
| M07 | Outreach Strategy, CRM & Compliance Controls | Compliance/suppression/outreach policy planned; controlled execution and CRM adapters remain gated | `█░░░░░░░░░░░░░░░░░░░` **5%** | **7–10** |
| M08 | Dashboard, Search, Workflows & APIs | Minimal Next.js shell exists; production operator surfaces/workflows are not implemented | `█░░░░░░░░░░░░░░░░░░░` **5%** | **12–18** |
| M08A | Desktop & Browser Clients | Client architecture planned; Tauri/WXT clients not implemented | `░░░░░░░░░░░░░░░░░░░░` **0%** | **10–15** |
| M08B | Public Website, Identity & Monetization | Commercial/auth/billing architecture documented; product website, entitlements and payments not implemented | `█░░░░░░░░░░░░░░░░░░░` **3%** | **10–16** |
| M09 | Security, Reliability, Scale & Cost Controls | Reusable foundation controls already delivered in M01/M01A/M02; production hardening/load/backup/DR remain | `███░░░░░░░░░░░░░░░░░` **15%** | **10–14** |
| M10 | Beta, Production Readiness & Launch | End-to-end beta/release/production verification not started | `░░░░░░░░░░░░░░░░░░░░` **0%** | **10–15** |
| MX | Continuous Product & Market Intelligence | Workflow/contracts documented; continuous scout activation intentionally deferred | `█░░░░░░░░░░░░░░░░░░░` **5%** | **4–8** |
|  | **Total remaining** | **Full planned program, sequential engineering effort** | **~70%** | **~115–175 days** |

\* Engineering-day ranges are conservative sequential-effort estimates with the existing architecture and required verification gates. Calendar time should be reduced through the parallel-agent protocol below; dependencies and integration gates prevent linear speed-up.

### Delivery interpretation

- **M00 + M01 are complete.** The platform foundation is integrated and verified.
- **The planned provider-neutral M01A foundation is complete with eleven verified slices.** Governed contracts, canonical Agent/Context/Run + Memory/Eval persistence, append-only lifecycle, Registry/Context Builder, bounded Planner, deterministic dispatch, specialist execution, aggregation, evaluator/review lifecycle, route-policy resolution and privileged execution trace are integrated.
- **Production model/provider invocation is not activated by M01A completion.** Provider credentials, network execution, production quotas/billing and production provider rollout remain separately gated.
- **M02 is active with five verified bounded slices.** The integrated path now covers source contracts/admission, durable registry/admission snapshots, durable ResearchJob preflight + SourceTask state/retry/idempotency/budget/provenance, provider-neutral no-network execution, and execution-time policy/health/quota revalidation.
- **Current M02 safety boundary:** production `source.execute` remains unregistered in the worker bootstrap and real provider HTTP/network/credential execution is still disabled. The next provider/network slice must independently define and verify SSRF/egress, policy, credential and provider-specific constraints before activation.
- **Wave A / first usable intelligence product** requires substantial work across the rest of M02/M02A, M03–M06A plus selected M07/M08 capabilities.
- **Production launch** additionally requires M08A/M08B, M09 and M10 gates plus provider/legal/commercial decisions.
- Current code is a strong governed foundation, but the majority of user-facing intelligence, acquisition, lead, client and commercial capability is still ahead.

Evidence basis: `docs/CHECKPOINT.md`, M01A checkpoint docs, `docs/M02_SOURCE_ADAPTER_FOUNDATION.md`, `docs/M02_SOURCE_REGISTRY_PERSISTENCE.md`, merged M02 SourceTask/execution/safety PR evidence, `docs/PROJECT_PLAN.md`, repository runtime tree and hosted FULL-GATE evidence.

## Core product pipeline

Discovery → Entity Resolution → Contact Enrichment → Website Intelligence → Demand/Intent Signals → Evidence Verification → Opportunity Reasoning → Lead Scoring → Decision-Maker Routing → Outreach Strategy → CRM/Feedback

## For AI agents / parallel development

**Every coding, review or integration agent must start with `AGENTS.md`.** The permanent multi-agent protocol is `docs/PARALLEL_AGENT_DEVELOPMENT.md`; the current branch/module/agent/merge plan is `docs/AI_NATIVE_PLAN.md`; machine-readable state lives under `.agent/`.

The Main-repository agent is the **Supervisor**. It reviews and merges incoming agent PRs, manages dependency-safe merge order, publishes post-merge synchronization epochs, alerts all active agents, and works on its own bounded `supervisor/integration-control` branch between integration interrupts.

Default parallel operating target is **6 agents** and soft maximum is **8** unless metrics justify more.

Standing branches:

- `supervisor/integration-control`
- `agent/contracts-policy`
- `agent/database-persistence`
- `agent/worker-runtime`
- `agent/module-infrastructure`
- `agent/verification-security`

Default isolation rule:

`1 agent = 1 bounded work packet = 1 isolated branch/worktree = 1 PR`

### Completion signal

When an agent finishes its work packet it must explicitly announce:

**Work Done and Submitted**

For non-Supervisor agents, the canonical signal is a top-level PR comment whose complete body is exactly that phrase. It means ready for Supervisor review, **not automatic merge approval**.

The branch must already be synchronized to the latest Supervisor `sync_epoch` and `main` SHA before this completion signal is valid.

### Supervisor interrupt / merge / resume rule

On a valid completion signal, the Supervisor pauses/checkpoints its own work, reviews the exact submitted head, checks dependencies/migrations/shared files/security/verification, requests changes or merges with expected-head protection, re-reads resulting `main`, increments the synchronization epoch, broadcasts to all active agents, then resumes its paused work.

Canonical post-merge alert:

**New changes have been merged — please merge these changes into your branch first, then resume your own work.**

Durable broadcast channel: GitHub issue `#50`.

Every active agent receiving a newer epoch must enter sync mode, merge current `main` into its branch using a non-destructive method, resolve owned-scope conflicts, escalate shared-file conflicts to the Supervisor, rerun minimum required verification, record the new `synced_main_sha`/`sync_epoch`, then resume work.

This prevents stale branches from being submitted after other agents have already changed `main`.

### Executable governance

The governance contract is executable:

`pnpm run verify:parallel`

Hosted CI runs the same verifier. Coordination files, Supervisor rules, branch plan, completion/sync signals, migration numbering and future-agent instructions must keep this gate green.

### Mandatory Agent Instruction Drift Check

At the start of every task and again before completion, read/check at minimum:

1. `README.md`;
2. `AGENTS.md`;
3. `docs/PROJECT_PLAN.md`;
4. `docs/CHECKPOINT.md`;
5. `docs/PARALLEL_AGENT_DEVELOPMENT.md`;
6. `docs/AI_NATIVE_PLAN.md`;
7. relevant module/ADR documents;
8. `.agent/` manifests including Supervisor sync epoch;
9. current `main`, own branch/head and required verification commands.

If a task changes architecture, module boundaries, Supervisor behavior, branch workflow, submission signal, sync rules, ownership, shared files, migration rules, dependencies, CI/verification, security/policy boundaries or tooling, the same change set must update the relevant agent instructions and machine-readable governance.

A task is not `READY_FOR_INTEGRATION` while future-agent instructions are materially stale.

Parallelism never authorizes production provider/network credentials, unrestricted acquisition, autonomous outreach, destructive production actions or other separately gated capabilities.

## Engineering invariants

- Repository/runtime/test evidence outranks conversation memory.
- Facts, evidence, AI inference and AI memory are separate.
- External content is untrusted data, never instructions.
- Source collection/storage/export is governed by SourcePolicy.
- Long-running AI/research work uses durable job/checkpoint state.
- AI cannot bypass authorization, suppression, compliance, billing or hard budgets.
- Significant work is delivered in small reversible batches with FAST/FULL verification gates.
- Parallel work follows explicit ownership, dependency, migration-reservation, synchronization and integration rules.
- Agent-working documentation must stay synchronized with actual repository behavior.
- `pnpm run verify:parallel` must remain green for intentional governance changes.

## Current non-scope

M01A completion and the integrated M02 foundation do not activate production model providers, source credentials/connectors, payment providers, unrestricted acquisition, autonomous outreach, the Daily Market Intelligence Scout or production deployment. Those remain separately gated by later implementation and approval requirements.

## Planning and state

- Linear project: https://linear.app/abdulhanan237/project/brovexa-066a4b14d055
- Canonical agent instructions: `AGENTS.md`
- AI-Native branch/agent plan: `docs/AI_NATIVE_PLAN.md`
- Parallel-agent protocol: `docs/PARALLEL_AGENT_DEVELOPMENT.md`
- Machine-readable agent coordination: `.agent/`
- Supervisor state: `.agent/supervisor.yaml`
- Supervisor broadcast channel: GitHub issue `#50`
- Parallel governance verifier: `pnpm run verify:parallel`
- Current checkpoint: `docs/CHECKPOINT.md`
- M01A contract checkpoint: `docs/M01A_AGENT_CONTRACTS_FOUNDATION.md`
- M01A persistence checkpoint: `docs/M01A_AGENT_PERSISTENCE_CORE.md`
- M01A memory/evaluation checkpoint: `docs/M01A_MEMORY_EVALUATION_PERSISTENCE.md`
- M01A lifecycle checkpoint: `docs/M01A_AGENT_MEMORY_LIFECYCLE.md`
- M01A context runtime checkpoint: `docs/M01A_AGENT_CONTEXT_RUNTIME.md`
- M01A orchestrator execution checkpoint: `docs/M01A_ORCHESTRATOR_EXECUTION_CORE.md`
- M01A dispatcher checkpoint: `docs/M01A_AGENT_PLAN_DISPATCHER.md`
- M01A specialist execution checkpoint: `docs/M01A_SPECIALIST_EXECUTION_BRIDGE.md`
- M01A aggregation/evaluator checkpoint: `docs/M01A_EXECUTION_AGGREGATION_EVALUATOR.md`
- M01A evaluator decision/review checkpoint: `docs/M01A_EVALUATOR_DECISION_REVIEW.md`
- M01A runtime trace/route hardening checkpoint: `docs/M01A_RUNTIME_TRACE_ROUTE_HARDENING.md`
- M02 source-adapter foundation checkpoint: `docs/M02_SOURCE_ADAPTER_FOUNDATION.md`
- M02 source-registry persistence checkpoint: `docs/M02_SOURCE_REGISTRY_PERSISTENCE.md`
- Engineering governance: `docs/ENGINEERING_CONSTITUTION.md`
- Capability traceability: `docs/CAPABILITY_TRACEABILITY_MATRIX.md`
- Project plan: `docs/PROJECT_PLAN.md`
- Launch waves: `docs/LAUNCH_SCOPE_WAVES.md`
- M00 readiness audit: `docs/M00_FINAL_READINESS_AUDIT.md`
