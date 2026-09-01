# Brovexa Project Checkpoint

Updated: 2026-09-01

## Project state

`ACTIVE_EXISTING_PROJECT`

**M01 — Platform Foundation & Developer Experience is VERIFIED / INTEGRATED. M01A — AI Agent Runtime & Memory OS is ACTIVE with ten FULL-GATE verified implementation slices integrated to `main`.**

This means the governed platform foundation plus the current AI runtime/memory foundations are built and integrated. It does **not** mean deployed, released, production-verified, or authorized for production providers/connectors/payments/outreach.

## Authorization boundary

The approved M01 implementation scope is complete. M01A implementation is proceeding in small reversible slices under the approved architecture/security boundary.

Still separately gated: production model/provider execution, production connectors, payment-provider activation, unrestricted acquisition, autonomous/bulk outreach, Daily Market Intelligence Scout activation, production deployment, destructive production data actions, and unresolved legal/provider/commercial decisions.

## VCS / integration state

- default branch: `main`
- current integrated `main` head at this checkpoint branch base: `206e9f00b14674f6ec182751d0b56f85821b6e4b`
- original planning PR #1: closed unmerged; superseded by same-head replacement PR #12
- planning integration PR #12: merged as `0c9ce138fe0b4dc80ce60c33f291cb00b0a59859`
- consolidated M01 stack PR #11: merged into `m01/platform-foundation` as `825bddeb00a2d571e5e8132b077fb9707b2021e0`
- final M01 default-branch integration PR #13: merged to `main` as `c82c46649033988c5f90d0e4407a47d02aab4d8a`
- M01A deterministic dispatcher PR #29: exact source head `eba81cabe2d8bcfa1bb6b8785ac50d56b03d8b8a`, merged to `main` as `2a455d561472417a8b353b0303bb848b94e0cdf2`
- M01A deterministic specialist execution bridge PR #31: exact source head `18340eed0d1be87e27cbe60b2b4777ba6113fc30`, merged to `main` as `2d1ed2d0f6cb5b24b0601b9a92fe9ba3282fd93f`
- M01A execution aggregation + evaluator handoff PR #33: exact source head `65fa365ef22c481d721bd93ce630f631b67fde46`, merged to `main` as `bd67b1331652f7aee390f1d43fc171fa39ea10e4`
- M01A evaluator decision + review resolution PR #35: exact source head `9dcdc3383ec7ff665660cb2833fa2b2e97b26fd6`, merged to `main` as `206e9f00b14674f6ec182751d0b56f85821b6e4b`
- legacy tracker/stacked PRs #2/#8/#9/#10 are superseded integration artifacts and may remain closed/unmerged

Local developer working-copy/runtime/database state remains `UNKNOWN` because repository changes were performed through remote GitHub tooling.

## Default-branch security

GitHub was re-read after M01 integration on 2026-08-31:

- `main` protected: **false**
- required status checks: **off**
- repository rulesets observed: **none**

Native protection is not claimed. `docs/DEFAULT_BRANCH_INTEGRATION_POLICY.md` remains the compensating control: PR-only integration, no force push/history rewrite, no auto-merge, executable evidence for runtime/product integration, and expected-head SHA verification immediately before explicit merges.

Linear `ABD-266` exit is satisfied through the documented/exercised compensating path; native protection remains a future hardening opportunity when the repository/tooling supports it.

## M01 verification state

### ABD-259 — monorepo foundation / executable CI

State: **VERIFIED / DONE**.

Final hosted evidence: run `33312134186`, job `99258997531`.

### ABD-260 — PostgreSQL migration / data layer

State: **VERIFIED / DONE**.

Final evidence: run `33333195961`.

### ABD-261 — durable worker / queue foundation

State: **VERIFIED / DONE**.

Final evidence: run `33334936386`.

### ABD-262 — identity / RBAC / tenant primitives

State: **VERIFIED / INTEGRATED**.

Frozen implementation head: `c13a0e12b40aa364fa54465408cdabb88f58f55c`.
Final evidence: run `33369721378`.

Verified deny-by-default tenant authorization, composite cross-tenant integrity, stale-grant mutation revalidation, one-shot owner bootstrap, immutable canonical owner role, last-active-owner safeguards, authorization audit events, provider-neutral identity/session boundary, and API tenant-context tests.

### ABD-263 — API / observability / health

State: **VERIFIED / INTEGRATED / DONE**.

Frozen implementation head: `421720a57ece7a932eedd4ebb794c393b62475fd`.
Final evidence: run `33371785178`.

- quality/build/typecheck/unit + live API smoke `99424328348`: PASS
- PostgreSQL 18 + tenant/RBAC regression `99424892965`: PASS
- worker + Valkey regression `99425085741`: PASS

Verified bounded request IDs, strict W3C trace correlation, stable correlated safe errors, internal-error redaction, structured matched/unmatched request logs, query redaction, and health/readiness semantics.

### ABD-266 — default-branch protection / compensating controls

State: **DONE VIA COMPENSATING CONTROL / NATIVE PROTECTION OFF**.

The compensating path continues to be exercised with reviewed PRs, explicit integration decisions, expected-head merges, no auto-merge, and no history rewrite.

### ABD-264 — M01 FULL GATE

State: **VERIFIED / DONE / INTEGRATED**.

Frozen exact FULL GATE head: `083b99400597a5e14827cf4ca52d270d9278defa`.
Exact-head run `33377314942`: PASS.

- M01 FULL GATE quality/security `99441599943`: PASS
- PostgreSQL 18 migration + RBAC `99442228132`: PASS
- canonical worker + Valkey recovery/idempotency/correlation `99442428894`: PASS

## M01A verification state

State: **ACTIVE — ten verified/integrated slices**.

Integrated slices:

1. executable governed Agent/Memory/Eval contracts and safety invariants;
2. canonical `AgentDefinition → ContextReceipt → AgentRun` PostgreSQL persistence;
3. durable governed `MemoryRecord` and independent `EvalResult` persistence;
4. append-only AgentRun transitions and explicit memory supersession/deletion lifecycle;
5. deterministic approved Agent Registry and minimum-necessary Context Builder runtime;
6. bounded immutable provider-neutral Orchestrator/Planner `AgentExecutionPlan` persistence;
7. deterministic `AgentExecutionPlan → JobRun/WorkUnit` dispatch using the canonical M01 execution foundation;
8. deterministic specialist execution bridge with per-attempt child ContextReceipt/AgentRun trace, retry lifecycle, canonical checkpoints/budgets and structured governed result persistence;
9. deterministic completed-DAG aggregation with exact specialist-result/run/budget validation, explicit orchestrator outcome handling and exact deterministic independent-evaluator handoff;
10. deterministic evaluator decision application with current authorization/definition/context/evidence-policy revalidation, durable independent EvalResult finalization, fail-closed review normalization, and active-owner-only explicit review/resume resolution.

### Seventh-slice exact evidence — deterministic plan dispatcher

- source head: `eba81cabe2d8bcfa1bb6b8785ac50d56b03d8b8a`
- PR #29: `feat(m01a): add deterministic agent plan dispatcher`
- exact-head FULL GATE run `33449897197`: PASS
- quality/security job `99677185961`: PASS
- PostgreSQL 18 migration + RBAC job `99677793352`: PASS
- canonical worker + Valkey job `99678018183`: PASS
- merge SHA: `2a455d561472417a8b353b0303bb848b94e0cdf2`

The first dispatcher CI attempt `33448973098` exposed a test-fixture problem rather than a runtime defect: the verifier tried to suspend the only active owner and the existing `workspace_requires_active_owner` invariant correctly rejected it. The fixture was corrected to revoke a normal member while retaining the active owner. No RBAC or lifecycle invariant was weakened.

### Eighth-slice exact evidence — deterministic specialist execution bridge

- source head: `18340eed0d1be87e27cbe60b2b4777ba6113fc30`
- PR #31: `feat(m01a): add deterministic specialist execution bridge`
- exact-head FULL GATE run `33452361663`: PASS
- quality/security job `99684875670`: PASS
- PostgreSQL 18 migration + RBAC job `99685310855`: PASS
- canonical worker + Valkey job `99685494095`: PASS
- merge SHA: `2d1ed2d0f6cb5b24b0601b9a92fe9ba3282fd93f`

The first specialist-bridge run `33452024750` passed quality, PostgreSQL/RBAC and the pre-existing canonical worker integration verifier. The new specialist verifier then failed because its broad child-context selector also counted the parent ContextReceipt (`3` rows instead of the expected `2`). The selector was tightened by exact specialist agent identity; runtime behavior was unchanged, and the final exact-head run passed all lanes.

### Ninth-slice exact evidence — execution aggregation + evaluator handoff

- source head: `65fa365ef22c481d721bd93ce630f631b67fde46`
- PR #33: `feat(m01a): aggregate specialist DAGs and create evaluator handoff`
- exact-head FULL GATE run `33484348956`: PASS
- quality/security job `99780868770`: PASS
- PostgreSQL 18 migration + RBAC job `99781570196`: PASS
- canonical worker + Valkey job `99781739052`: PASS
- merge SHA: `bd67b1331652f7aee390f1d43fc171fa39ea10e4`

The initial aggregation run `33483976613` passed quality/security but the PostgreSQL lane stopped before reaching the new aggregation verifier because the older lifecycle verifier used a fixed `2026-09-01T01:00:00Z` transition time while persisted AgentRun state used current database time. The existing `AGENT_RUN_TRANSITION_TIME_REGRESSION` guard correctly rejected the stale fixture. The verifier was changed to derive transition timestamps from the persisted run `updated_at`; no lifecycle invariant was weakened. The final exact-head run passed the complete DB/RBAC and worker/Valkey gates, including the new aggregation/evaluator integration harness.

### Tenth-slice exact evidence — evaluator decision + owner review resolution

- source head: `9dcdc3383ec7ff665660cb2833fa2b2e97b26fd6`
- PR #35: `feat(m01a): apply evaluator decisions and resolve reviews`
- exact-head FULL GATE run `33489635395`: PASS
- quality/security job `99797806016`: PASS
- PostgreSQL 18 migration + RBAC job `99798572515`: PASS
- canonical worker + Valkey job `99798867860`: PASS
- merge SHA: `206e9f00b14674f6ec182751d0b56f85821b6e4b`

The exact-head run passed source/security/runtime quality, the complete PostgreSQL 18 data/RBAC stack including the new evaluator-decision verifier, and the canonical worker/Valkey regression. The verifier proved high-confidence verified acceptance, durable EvalResult persistence and replay, fail-closed evidence-scope rejection, low-confidence/unverified acceptance normalization to review, non-owner denial, owner-attributed resume/approval lifecycle, and contradiction-backed rejection.

Current evidence-based estimate: M01A approximately **92%** complete with approximately **1–2 focused engineering days** remaining. This is an engineering estimate, not a calendar commitment.

Current remaining M01A gap is bounded to runtime lifecycle read/trace hardening plus provider-neutral route-resolution enforcement around the integrated deterministic lifecycle. Actual provider/model invocation remains separately gated and is not implied by completing that hardening slice.

## Integration verification layers

M01 was not merged to `main` from source evidence alone. It passed three verification layers:

1. **Frozen FULL GATE source:** `083b9940...`, run `33377314942` PASS.
2. **Post-stack integrated M01 branch:** `825bddeb...`, run `33405687098` (#132) SUCCESS.
3. **Current-main merge context:** PR #13, run `33406039572` (#133) PASS:
   - quality/security + dependency audit + runtime/live API `99533753418`: PASS
   - PostgreSQL 18 migration + tenant/RBAC `99534688415`: PASS
   - canonical worker + Valkey recovery/idempotency/correlation `99535283167`: PASS

PR #13 then merged with expected head `825bddeb00a2d571e5e8132b077fb9707b2021e0` and produced `main` commit `c82c46649033988c5f90d0e4407a47d02aab4d8a`.

The same compensating integration discipline is being applied to M01A: each implementation slice is isolated, verified on its exact current PR head through the hosted FULL GATE, and merged only with an expected-head SHA guard.

## ABD-216 acceptance criteria reconciliation

- Fresh setup reproducible from documented instructions: **VERIFIED**.
- CI fails closed on required quality gates: **VERIFIED**.
- No tracked secrets: **VERIFIED**.
- Queue idempotent retry/recovery behavior: **VERIFIED**.
- Migrations apply and roll back in test: **VERIFIED**.
- Auth/RBAC/tenant boundaries have automated tests: **VERIFIED**.
- Request/job correlation is traceable: **VERIFIED**.
- Durable project checkpoint reflects actual M01/M01A integration state: **VERIFIED by this checkpoint PR once merged**.

## Supply-chain posture

- exact direct dependency pins
- committed/frozen lockfile
- pnpm 11 supply-chain policy checks
- exact reviewed lifecycle-script allowlist
- immutable GitHub Action SHAs
- hosted CI `contents: read`
- tracked-secret gate
- high/critical dependency advisory audit

Dependency advisory evidence is time-sensitive and must be rerun on future integration/release gates.

## Known limitations / not production verification

- native GitHub branch protection/rulesets remain unconfigured;
- no production deployment has occurred;
- no hosted DB/queue/identity/telemetry provider is activated;
- no production model/provider or source connector is activated;
- OpenTelemetry SDK/exporter/collector is not part of M01;
- local developer working-copy state is unknown;
- the manual self-hosted M01 dispatcher remains fixed to the historical `m01/platform-foundation` branch and is a fallback/diagnostic path, not the authoritative ongoing `main` CI gate;
- M01/M01A integration does not authorize production connectors, payments, unrestricted acquisition, autonomous outreach, or later release gates.

## Next safe action

1. Verify and merge this M01A progress/checkpoint-only PR through normal hosted FULL GATE and expected-head integration.
2. Start a fresh implementation branch from the resulting `main` head.
3. Implement the bounded M01A hardening slice: tenant-scoped lifecycle read/trace state across orchestrator/specialist/evaluator/review projections plus provider-neutral route-resolution enforcement from approved AgentDefinition model policy.
4. Keep actual provider/model invocation and production provider credentials/configuration separately gated after route-resolution hardening is independently FULL-GATE verified.
