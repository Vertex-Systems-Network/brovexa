# Brovexa M01 Development & Verification Runbook

Status: **M01 active / Foundation Slice 1 verified / PostgreSQL foundation in progress**

Repository/runtime/test evidence outranks this document if they conflict.

## 1. Prerequisites

- Node.js `24.20.0`
- pnpm `11.23.0`

Use `.nvmrc` / `.node-version` and root `packageManager`/`engines` metadata. Do not substitute another major runtime and report it as equivalent verification.

## 2. Environment

Copy `.env.example` to `.env` for local development.

Current non-secret variables:
- `NODE_ENV=development|test|staging|production`
- `HOST` — default `0.0.0.0`
- `PORT` — default `3001`, valid 1–65535
- `DATABASE_URL` — optional PostgreSQL connection URL; leave empty when DB readiness is not required

The API loads repo-root `.env` through Node's native `--env-file-if-exists`. Existing process environment variables remain authoritative. Never commit credentials/provider tokens/production secrets.

## 3. Foundation preflight

Before dependency installation:

```bash
node scripts/verify-foundation.mjs
node scripts/verify-foundation.test.mjs
```

These are zero-dependency structural/security guardrails. They do not replace build/typecheck/application tests.

## 4. Dependency installation

`pnpm-lock.yaml` is committed and mandatory.

```bash
pnpm install --frozen-lockfile
```

Non-frozen CI installation is a verification defect. Temporary lockfile write workflows must be removed immediately after an approved dependency-lock reconciliation.

`pnpm-workspace.yaml` contains an exact-version release-age exception for `zod@4.5.4`. It also explicitly permits dependency build scripts only for the exact currently locked esbuild versions required by the Drizzle tooling graph. Do not broaden either trust rule to a package wildcard or all future versions without dependency review.

## 5. FAST quality gate

```bash
pnpm run quality
```

Contract:

```text
Foundation preflight → Guardrail regression tests → Build → Typecheck → Tests
```

Post-install checks only:

```bash
pnpm run quality:runtime
```

Do not use bare `pnpm ci` as the Brovexa quality script; pnpm 11 owns that command as package-manager behavior.

## 6. Verified Foundation Slice 1 baseline

Hosted GitHub Actions has executed successfully with Node `24.20.0` and pnpm `11.23.0`.

Final Foundation Slice 1 run `33312134186` / job `99258997531` proved:
- foundation preflight and negative guardrails
- committed frozen-lockfile installation
- Config/Contracts/API builds
- Next.js 16.3.3 production build
- TypeScript 7 typecheck across all foundation workspace projects
- Vitest: Contracts 4, Config 6, API health 1 — **11/11 tests passed**
- live API source-to-runtime reload smoke

`ABD-259` is therefore `VERIFIED/DONE`. PostgreSQL/data-layer work continues under `ABD-260`.

## 7. API development loop

Canonical command:

```bash
pnpm run dev:api
```

Equivalent package command:

```bash
pnpm --filter @brovexa/api dev
```

`scripts/dev-api.mjs` uses a deterministic dependency-free polling supervisor rather than platform-specific native filesystem watchers.

Current flow:

```text
Initial Config compile
→ Initial Contracts compile
→ Initial DB compile
→ Initial API compile
→ Start last-good API runtime
→ Poll Config/Contracts/DB/API TypeScript sources, DB migration SQL, and build tsconfigs every 500ms
→ On change: rebuild Config → Contracts → DB → API
→ If rebuild succeeds: graceful runtime restart
→ If rebuild fails: keep the last-good API runtime alive and retry on the next source change
```

This avoids native watcher limitations in container/networked environments while ensuring the API never consumes a stale `@brovexa/db` build during local development.

Live executable smoke command:

```bash
pnpm run verify:dev-api
```

The smoke starts the supervisor on an isolated test port, verifies `/health`, temporarily mutates the health version only in the CI working tree, verifies the rebuilt response, restores the source, verifies the restored response, and terminates the supervisor. The temporary mutation is never committed.

Production-style API start after build:

```bash
pnpm --filter @brovexa/api start
```

Web development server:

```bash
pnpm --filter @brovexa/web dev
```

## 8. Health and readiness

`GET /health` remains process health and is independent of PostgreSQL.

Canonical health response:

```json
{
  "status": "ok",
  "service": "brovexa-api",
  "version": "0.1.0",
  "timestamp": "ISO-8601 timestamp"
}
```

`GET /ready` is database-aware during ABD-260 and fails closed when the database is not configured, unavailable, on the wrong PostgreSQL major, or missing the required schema. See `docs/DATABASE.md`.

## 9. GitHub-hosted CI

`.github/workflows/ci.yml` is the normal PR quality gate.

Steady-state properties:
- `contents: read`
- checkout credentials not persisted
- immutable Action commit pins
- committed lockfile required
- `pnpm install --frozen-lockfile`
- explicit pnpm dependency-build allowlist; broad allow-all is forbidden
- build/typecheck/test gate
- live API reload smoke gate
- PostgreSQL 18 migration/data-layer integration gate during ABD-260
- no standing CI write-back job

Historical pre-runner failures are baseline evidence only; hosted allocation recovered and executable application verification runs normally.

## 10. Manual self-hosted fallback

Operational default-branch workflow:

```text
.github/workflows/m01-self-hosted-dispatch.yml
```

It checks out exactly `m01/platform-foundation` on `[self-hosted, Windows, X64]`, is manual-only, and accepts no caller-controlled target ref.

The implementation branch `.github/workflows/ci-self-hosted.yml` is a **reference mirror**, not the operational dispatch entry point.

Required contract:
- manual `workflow_dispatch` only
- exact `m01/platform-foundation`
- no automatic PR/push execution on the local machine
- `[self-hosted, Windows, X64]`
- `contents: read`
- immutable Action SHAs
- `persist-credentials: false`
- frozen-lockfile install
- same foundation/runtime quality contract

A self-hosted PASS validates that runner path; it is not necessary to prove hosted runner health once hosted CI itself executes successfully unless a Windows-specific behavior is under investigation.

### Runner diagnostics / recovery

Recovery guide:

```text
docs/SELF_HOSTED_RUNNER_RECOVERY.md
```

Read-only diagnostic command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\diagnose-github-runner.ps1
```

The diagnostic script never starts/stops/installs/removes/registers/reconfigures the runner and never prints registration token material.

## 11. Failure classification

Use actual evidence:
- `FOUNDATION CONTRACT FAILURE`
- `DEPENDENCY INSTALL FAILURE`
- `BUILD FAILURE`
- `TYPECHECK FAILURE`
- `TEST FAILURE`
- `DATABASE INTEGRATION FAILURE`
- `CI INFRASTRUCTURE FAILURE`
- `BASELINE FAILURE`
- `FLAKY TEST DEFECT`

Do not rerun until a defect happens to pass and hide the failing evidence.

## 12. M01 progression

Completed:
- `ABD-259` monorepo/foundation executable baseline

Current:
- `ABD-260` PostgreSQL migration/data-layer harness

`ABD-260` must not be called Done until actual PostgreSQL 18 evidence proves migration apply, constraints, transaction rollback, explicit down migration, re-apply, and API readiness behavior.

Next dependency-gated work:
- `ABD-261` durable worker/queue foundation
- `ABD-262` provider-neutral identity/RBAC/tenant primitives
- `ABD-263` API conventions/observability
- `ABD-264` M01 FULL GATE

## 13. Current non-scope

This M01 work does not activate production deployment, source connectors, payment providers, unrestricted internet acquisition, autonomous/bulk outreach, the Daily Market Intelligence Scout, destructive production data actions, or later legal/provider/commercial gates.
