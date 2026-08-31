# Brovexa M01 Development & Verification Runbook

Status: **M01 active / ABD-259 through ABD-263 verified / ABD-264 FULL GATE active**

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

Before dependency installation, these checks can run directly with the approved Node runtime:

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

`verify:format` and `lint` intentionally share the deterministic M01 source-hygiene policy: EditorConfig-compatible LF/final-newline/space/trailing-whitespace rules plus repository security lint invariants such as no `@ts-ignore`, `@ts-nocheck`, `debugger`, `eval`, dynamic `Function`, or disabled TLS validation in application/source scripts.

## 4. Dependency installation and supply-chain checks

`pnpm-lock.yaml` is committed and mandatory.

```bash
pnpm install --frozen-lockfile
pnpm run audit:dependencies
```

`pnpm run audit:dependencies` executes `pnpm audit --audit-level high` and fails the FULL GATE for known high/critical registry advisories. Registry availability failures must be classified as CI/dependency-infrastructure failures rather than silently treated as PASS.

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

`scripts/dev-api.mjs` uses deterministic dependency-free source polling rather than platform-specific native filesystem watchers. It rebuilds Config → Contracts → DB → API and keeps the last-good runtime alive when a reload compile fails.

Live executable smoke:

```bash
pnpm run verify:dev-api
```

The smoke verifies:

- `/health` process health;
- safe request/trace correlation headers;
- `/ready` fail-closed behavior when PostgreSQL is not configured;
- stable correlated 404 errors;
- query-string redaction from structured logs;
- source → compile → runtime reload;
- restoration of the original source after the temporary mutation.

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

The hosted CI supplies isolated PostgreSQL 18.6 and Valkey 9.1.1 services with immutable image digests.

Verified coverage includes:

- migration apply, checksum journal, rollback and re-apply;
- transaction/constraint behavior;
- tenant isolation and deny-by-default authorization;
- one-shot owner bootstrap and last-owner protections;
- stale authorization snapshot revalidation;
- queue idempotency and effect dedupe;
- retry/backoff, cancellation, review/dead-letter outcomes;
- restart recovery from canonical PostgreSQL state;
- canonical job correlation ID surviving PostgreSQL → queue delivery → worker handler;
- worker readiness and transport metrics.

## 8. Health, readiness and observability

`GET /health` is process health and remains independent of PostgreSQL.

`GET /ready` is dependency/schema readiness and fails closed when PostgreSQL is unconfigured, unavailable, on the wrong major, or missing the required schema.

The M01 observability foundation provides:

- bounded/generated request IDs;
- W3C version-00 trace-context parsing with safe fallback trace IDs;
- `x-request-id` and `x-trace-id` response headers;
- stable correlated public API error envelopes;
- structured completion/failure logs with query strings stripped;
- canonical queue/job correlation IDs.

No OpenTelemetry SDK/exporter/collector or telemetry SaaS is activated in M01.

## 9. GitHub-hosted CI

`.github/workflows/ci.yml` is the normal PR verification path and, on the ABD-264 stack, the executable M01 FULL GATE.

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

## 10. Manual self-hosted fallback

Operational default-branch workflow:

```text
.github/workflows/m01-self-hosted-dispatch.yml
```

It is manual-only, runs on `[self-hosted, Windows, X64]`, and checks out exactly `m01/platform-foundation` with no caller-controlled target ref.

The implementation-branch `.github/workflows/ci-self-hosted.yml` is a **reference mirror**, not the operational dispatch entry point.

A self-hosted PASS validates that runner path; it does not replace hosted CI when hosted CI is functioning normally.

Runner recovery guide:

```text
docs/SELF_HOSTED_RUNNER_RECOVERY.md
```

## 11. M01 FULL GATE

Linear `ABD-264` requires clean install, format/lint/typecheck/build, unit/integration/API verification, migration apply/rollback, RBAC/tenant regression, queue idempotency/recovery, dependency/security checks, health/readiness/observability, no-secret/config review, fresh-setup documentation, and checkpoint/Plan↔Reality reconciliation.

Static/readiness portion:

```bash
pnpm run verify:m01:full-gate
```

Dependency vulnerability portion:

```bash
pnpm run audit:dependencies
```

The complete FULL GATE is the hosted CI workflow because PostgreSQL and Valkey integration require isolated services. A local static PASS is not sufficient to call M01 Done.

## 12. Default-branch integration control

Native `main` protection is currently not configured. The repository therefore uses `docs/DEFAULT_BRANCH_INTEGRATION_POLICY.md` as the compensating control under Linear `ABD-266`.

Required behavior includes PR-based integration, no force push/history rewrite, no auto-merge, executable evidence, and expected-head SHA verification for any explicit merge.

M01 FULL GATE must record the actual native protection/ruleset state before handoff.

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

Do not rerun until a defect happens to pass and hide the failing evidence.

## 14. Verified M01 progression

- `ABD-259` monorepo/foundation executable baseline — **VERIFIED**
- `ABD-260` PostgreSQL migration/data layer — **VERIFIED**
- `ABD-261` durable worker/queue foundation — **VERIFIED**
- `ABD-262` provider-neutral identity/RBAC/tenant primitives — **VERIFIED on stacked PR #8**
- `ABD-263` API conventions/observability/health — **VERIFIED on stacked PR #9**
- `ABD-266` default-branch protection/compensating controls — **OPEN through FULL GATE**
- `ABD-264` M01 FULL GATE — **ACTIVE**

## 15. Current non-scope

M01 does not activate production deployment, production source connectors, payment providers, unrestricted internet acquisition, autonomous/bulk outreach, Daily Market Intelligence Scout execution, destructive production data actions, or unresolved later legal/provider/commercial gates.
