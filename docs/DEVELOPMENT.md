# Brovexa M01 Development & Verification Runbook

Status: **M01 VERIFIED / INTEGRATED TO `main` / not deployed or released**

Repository/runtime/test evidence outranks this document if they conflict.

## 1. Prerequisites

- Node.js `24.20.0`
- pnpm `11.23.0`

Use `.nvmrc` / `.node-version` and root `packageManager`/`engines` metadata. Do not substitute another major runtime and report it as equivalent verification.

## 2. Fresh setup

From a clean checkout:

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm run quality
```

The `.env` file is local-only and ignored. Never commit credentials, provider tokens, production secrets, or a real `.env` file.

Current non-secret configuration:

- `NODE_ENV=development|test|staging|production`
- `HOST` — default `0.0.0.0`
- `PORT` — default `3001`, valid 1–65535
- `DATABASE_URL` — optional PostgreSQL connection URL; leave empty when DB readiness is not required

The API loads repo-root `.env` through Node's native `--env-file-if-exists`. Existing process environment variables remain authoritative.

## 3. Zero-dependency structural/security checks

Before dependency installation:

```bash
node scripts/verify-foundation.mjs
node scripts/verify-foundation.test.mjs
node scripts/verify-queue-foundation.mjs
node scripts/verify-source-hygiene.mjs
node scripts/verify-no-secrets.mjs
node scripts/verify-m01-full-gate.mjs
```

Equivalent package commands after pnpm is available:

```bash
pnpm run verify:format
pnpm run lint
pnpm run verify:no-secrets
pnpm run verify:m01:full-gate
```

`verify:format` and `lint` share the deterministic M01 source-hygiene policy: EditorConfig-compatible line/whitespace rules plus repository security lint invariants such as no TypeScript suppression directives, committed debugger statements, dynamic evaluation, dynamic `Function`, or disabled TLS validation in application/source scripts.

## 4. Dependency installation and supply-chain checks

`pnpm-lock.yaml` is committed and mandatory.

```bash
pnpm install --frozen-lockfile
pnpm run audit:dependencies
```

`pnpm run audit:dependencies` executes `pnpm audit --audit-level high`. Registry availability failure is a dependency/CI infrastructure failure, never a silent PASS.

`pnpm-workspace.yaml` retains exact reviewed lifecycle-script and release-age exceptions only. Do not broaden them to wildcards without dependency review.

## 5. FAST quality gate

```bash
pnpm run quality
```

Contract:

```text
Foundation preflight
→ negative guardrails
→ queue foundation guardrails
→ format/source hygiene
→ lint/source security policy
→ tracked-secret scan
→ build
→ typecheck
→ unit tests
```

Post-install runtime-only checks:

```bash
pnpm run quality:runtime
```

Do not use bare `pnpm ci` as the Brovexa quality script; pnpm 11 owns that command as package-manager behavior.

## 6. API development loop

Canonical command:

```bash
pnpm run dev:api
```

Equivalent package command:

```bash
pnpm --filter @brovexa/api dev
```

`scripts/dev-api.mjs` uses deterministic dependency-free source polling rather than platform-specific native filesystem watchers. It rebuilds Config → Contracts → DB → API and keeps the last-good runtime alive when a reload compile fails. The bounded `poll` loop is intentional for cross-platform/dev-container reliability.

Live executable smoke:

```bash
pnpm run verify:dev-api
```

The smoke verifies `/health`, safe request/trace correlation headers, fail-closed `/ready`, stable correlated 404 errors, query-string redaction, source → compile → runtime reload, and cleanup/restoration of the temporary source mutation.

Production-style API start after build:

```bash
pnpm --filter @brovexa/api start
```

Web development server:

```bash
pnpm --filter @brovexa/web dev
```

## 7. Database, identity and queue integration

These destructive integration checks are test-environment-only. They require the explicit reset guard and a database name ending in `_test`.

```bash
pnpm run verify:db
pnpm run verify:identity
pnpm run verify:queue
```

Hosted CI supplies isolated PostgreSQL 18.6 and Valkey 9.1.1 services with immutable image digests.

Verified coverage includes migration apply/rollback/re-apply, tenant isolation/RBAC, owner invariants, stale authorization revalidation, queue idempotency/effect dedupe, retry/backoff, cancellation, review/dead-letter outcomes, restart recovery from PostgreSQL, canonical job correlation PostgreSQL → queue → worker, worker readiness, and transport metrics.

## 8. Health, readiness and observability

`GET /health` is process health and remains independent of PostgreSQL.

`GET /ready` is dependency/schema readiness and fails closed when PostgreSQL is unconfigured, unavailable, on the wrong major, or missing the required schema.

M01 provides bounded/generated request IDs, W3C version-00 trace-context parsing, correlation response headers, stable correlated public errors, structured redacted completion/failure logs, and canonical queue/job correlation IDs.

No OpenTelemetry SDK/exporter/collector or telemetry SaaS was activated in M01.

## 9. GitHub-hosted CI

`.github/workflows/ci.yml` is the authoritative normal PR verification path now integrated on `main`.

Steady-state controls:

- `contents: read`;
- checkout credentials not persisted;
- immutable Action commit pins;
- committed frozen lockfile;
- zero-dependency format/lint/no-secret/readiness checks before install;
- dependency vulnerability audit;
- production builds, TypeScript checks and tests;
- live API correlation/error/redaction/reload smoke;
- PostgreSQL migration + identity/RBAC regression;
- canonical worker + Valkey idempotency/recovery/correlation regression;
- no standing CI write-back job.

M01 final integration was verified in the actual current-`main` merge context by run `33406039572` (#133): quality/security `99533753418`, PostgreSQL+RBAC `99534688415`, and worker+Valkey `99535283167`, all PASS.

## 10. Manual self-hosted fallback

Operational default-branch workflow:

```text
.github/workflows/m01-self-hosted-dispatch.yml
```

It is manual-only, runs on `[self-hosted, Windows, X64]`, and checks out exactly `m01/platform-foundation` with no caller-controlled target ref.

The implementation-branch `.github/workflows/ci-self-hosted.yml` remains a **reference mirror**, not the operational dispatch entry point.

Because M01 is now integrated, hosted CI on `main`/PR merge contexts is authoritative. The historical manual dispatcher remains a least-privilege diagnostic/fallback path until deliberately retired or retargeted in a separate reviewed change.

Runner recovery guide:

```text
docs/SELF_HOSTED_RUNNER_RECOVERY.md
```

## 11. M01 FULL GATE

Linear `ABD-264` required clean install, format/lint/typecheck/build, unit/integration/API verification, migration apply/rollback, RBAC/tenant regression, queue idempotency/recovery, dependency/security checks, health/readiness/observability, no-secret/config review, fresh-setup documentation, and checkpoint/Plan↔Reality reconciliation.

Static/readiness portion:

```bash
pnpm run verify:m01:full-gate
```

Dependency vulnerability portion:

```bash
pnpm run audit:dependencies
```

The complete FULL GATE is hosted CI because PostgreSQL and Valkey integration require isolated services. M01 passed the frozen source run `33377314942`, post-stack run `33405687098`, and current-main merge-context run `33406039572` before PR #13 merged.

## 12. Default-branch integration control

Native `main` protection is not configured. `docs/DEFAULT_BRANCH_INTEGRATION_POLICY.md` remains the compensating control under Linear `ABD-266`.

Required behavior includes PR-based integration, no force push/history rewrite, no auto-merge, executable evidence, and expected-head SHA verification for explicit merges.

M01 integration followed this policy. The same policy remains required until native branch/ruleset protection is verified.

## 13. Failure classification

Use actual evidence:

- `FOUNDATION CONTRACT FAILURE`
- `FORMAT/LINT FAILURE`
- `SECRET SCAN FAILURE`
- `DEPENDENCY AUDIT FAILURE`
- `DEPENDENCY INSTALL FAILURE`
- `BUILD FAILURE`
- `TYPECHECK FAILURE`
- `TEST FAILURE`
- `DATABASE INTEGRATION FAILURE`
- `IDENTITY/RBAC INTEGRATION FAILURE`
- `QUEUE/RECOVERY INTEGRATION FAILURE`
- `CI INFRASTRUCTURE FAILURE`
- `BASELINE FAILURE`
- `FLAKY TEST DEFECT`

Do not rerun until a defect happens to pass and hide failing evidence.

## 14. M01 progression

- `ABD-259` monorepo/foundation executable baseline — **DONE**
- `ABD-260` PostgreSQL migration/data layer — **DONE**
- `ABD-261` durable worker/queue foundation — **DONE**
- `ABD-262` provider-neutral identity/RBAC/tenant primitives — **DONE / INTEGRATED**
- `ABD-263` API / observability / health — **DONE / INTEGRATED**
- `ABD-266` default-branch protection / compensating controls — **DONE VIA COMPENSATING CONTROL**
- `ABD-264` M01 FULL GATE — **DONE / INTEGRATED**
- parent `ABD-216` — **ready for final Done reconciliation after the post-integration checkpoint PR merges**

## 15. Current non-scope

M01 completion does not activate production deployment, production source connectors, payment providers, unrestricted internet acquisition, autonomous/bulk outreach, Daily Market Intelligence Scout execution, destructive production data actions, or unresolved later legal/provider/commercial gates.
