# Brovexa Project Checkpoint

Updated: 2026-08-31

## Project state

`ACTIVE_EXISTING_PROJECT`

**M01 — Platform Foundation & Developer Experience is VERIFIED, INTEGRATED TO `main`, and ready to close.**

This means the M01 development foundation is built and integrated. It does **not** mean deployed, released, production-verified, or authorized for production providers/connectors/payments/outreach.

## Authorization boundary

The approved M01 implementation scope has been completed and integrated.

Still separately gated: production connectors, payment-provider activation, unrestricted acquisition, autonomous/bulk outreach, Daily Market Intelligence Scout activation, production deployment, destructive production data actions, and unresolved legal/provider/commercial decisions.

## VCS / integration state

- default branch: `main`
- integrated M01 `main` head before this checkpoint PR: `c82c46649033988c5f90d0e4407a47d02aab4d8a`
- original planning PR #1: closed unmerged; superseded by same-head replacement PR #12
- planning integration PR #12: merged as `0c9ce138fe0b4dc80ce60c33f291cb00b0a59859`
- consolidated M01 stack PR #11: merged into `m01/platform-foundation` as `825bddeb00a2d571e5e8132b077fb9707b2021e0`
- final M01 default-branch integration PR #13: merged to `main` as `c82c46649033988c5f90d0e4407a47d02aab4d8a`
- legacy tracker/stacked PRs #2/#8/#9/#10 are superseded integration artifacts and may be closed unmerged after this checkpoint is accepted

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

The compensating path was exercised repeatedly with reviewed PRs, explicit integration decisions, expected-head merges, no auto-merge, and no history rewrite.

### ABD-264 — M01 FULL GATE

State: **VERIFIED / DONE / INTEGRATED**.

Frozen exact FULL GATE head: `083b99400597a5e14827cf4ca52d270d9278defa`.
Exact-head run `33377314942`: PASS.

- M01 FULL GATE quality/security `99441599943`: PASS
- PostgreSQL 18 migration + RBAC `99442228132`: PASS
- canonical worker + Valkey recovery/idempotency/correlation `99442428894`: PASS

## Integration verification layers

M01 was not merged to `main` from source evidence alone. It passed three verification layers:

1. **Frozen FULL GATE source:** `083b9940...`, run `33377314942` PASS.
2. **Post-stack integrated M01 branch:** `825bddeb...`, run `33405687098` (#132) SUCCESS.
3. **Current-main merge context:** PR #13, run `33406039572` (#133) PASS:
   - quality/security + dependency audit + runtime/live API `99533753418`: PASS
   - PostgreSQL 18 migration + tenant/RBAC `99534688415`: PASS
   - canonical worker + Valkey recovery/idempotency/correlation `99535283167`: PASS

PR #13 then merged with expected head `825bddeb00a2d571e5e8132b077fb9707b2021e0` and produced `main` commit `c82c46649033988c5f90d0e4407a47d02aab4d8a`.

The main-only manual self-hosted dispatcher was explicitly checked in PR #13's merge context and remained present.

## ABD-216 acceptance criteria reconciliation

- Fresh setup reproducible from documented instructions: **VERIFIED**.
- CI fails closed on required quality gates: **VERIFIED**.
- No tracked secrets: **VERIFIED**.
- Queue idempotent retry/recovery behavior: **VERIFIED**.
- Migrations apply and roll back in test: **VERIFIED**.
- Auth/RBAC/tenant boundaries have automated tests: **VERIFIED**.
- Request/job correlation is traceable: **VERIFIED**.
- Durable project checkpoint reflects actual integration state: **VERIFIED by this checkpoint PR once its own CI passes and it is merged**.

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
- OpenTelemetry SDK/exporter/collector is not part of M01;
- local developer working-copy state is unknown;
- the manual self-hosted M01 dispatcher remains fixed to the historical `m01/platform-foundation` branch and is a fallback/diagnostic path, not the authoritative ongoing `main` CI gate;
- M01 integration does not authorize production connectors, payments, unrestricted acquisition, autonomous outreach, or later release gates.

## Next safe action

1. Verify and merge this checkpoint-only PR through normal hosted CI.
2. Close superseded draft PRs #2/#8/#9/#10 unmerged with integration references.
3. Reconcile Linear `ABD-216` to Done after this durable checkpoint is on `main`.
4. Before beginning M01A/M02 feature implementation, preserve their explicit architecture/security/provider gates; no production provider activation is implied by M01 completion.
