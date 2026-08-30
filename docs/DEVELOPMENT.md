# Brovexa M01 Development & Verification Runbook

Status: **M01 active / Foundation Slice 1 executable verification in progress**

Repository/runtime/test evidence outranks this document if they conflict.

## 1. Prerequisites

- Node.js `24.20.0`
- pnpm `11.23.0`

Use `.nvmrc` / `.node-version` and the root `packageManager`/`engines` metadata. Do not substitute another major runtime and report the result as equivalent verification.

## 2. Environment

Copy `.env.example` to `.env` for local development.

Current non-secret variables:
- `NODE_ENV=development|test|staging|production`
- `HOST` — default `0.0.0.0`
- `PORT` — default `3001`, valid 1–65535

The API loads repo-root `.env` through Node's native `--env-file-if-exists`. Already-set process environment variables remain authoritative. Never commit credentials/provider tokens/production secrets.

## 3. Foundation preflight

Before dependency installation:

```bash
node scripts/verify-foundation.mjs
node scripts/verify-foundation.test.mjs
```

These are zero-dependency structural/security guardrails. They do not replace build/typecheck/application tests.

## 4. Dependency installation

`pnpm-lock.yaml` is committed and is now mandatory.

Canonical install:

```bash
pnpm install --frozen-lockfile
```

Non-frozen CI installation is a verification defect. The one-time bootstrap artifact/write path has been removed after the lockfile was persisted.

`pnpm-workspace.yaml` keeps an explicit exact-version release-age exception for `zod@4.5.4`; do not broaden it to a package wildcard without dependency review.

## 5. FAST quality gate

```bash
pnpm run quality
```

Contract:

```text
Foundation preflight → Guardrail regression tests → Build → Typecheck → Tests
```

The post-install portion is available separately as:

```bash
pnpm run quality:runtime
```

Do not use bare `pnpm ci` as the Brovexa quality script; pnpm 11 owns that command as package-manager behavior.

## 6. Verified hosted baseline

Hosted GitHub Actions has now executed successfully on Node `24.20.0` with pnpm `11.23.0`.

Verified on run `33310396346` / job `99254280825`:
- checkout and Node setup passed
- foundation preflight passed
- negative guardrail suite passed
- dependency installation passed
- Config/Contracts/API builds passed
- Next.js 16.3.3 production build passed
- TypeScript 7 typecheck passed across all workspace projects
- Vitest passed: Contracts 4 tests, Config 6 tests, API health 1 test (11/11 total)

The bootstrap lockfile was then persisted by controlled run `33310860606`; current steady-state CI requires a clean frozen-lockfile run after bootstrap machinery removal.

## 7. Development commands

Full primitives:

```bash
pnpm run build
pnpm run typecheck
pnpm run test
```

API source-to-runtime development loop:

```bash
pnpm run dev:api
```

Equivalent package command:

```bash
pnpm --filter @brovexa/api dev
```

`scripts/dev-api.mjs` first compiles Config → Contracts → API. Only after all initial compiles pass does it start TypeScript watch compilers for all three projects plus Node runtime watch for `apps/api/dist/main.js`. Unexpected child exit is a failure; Ctrl+C shuts down supervised children.

The compile/build/test portion is verified on hosted CI. Source-to-runtime restart behavior still requires an explicit executable smoke check before `ABD-259` closes.

Production-style API start after build:

```bash
pnpm --filter @brovexa/api start
```

Web development server:

```bash
pnpm --filter @brovexa/web dev
```

## 8. Health contract

`GET /health`

Expected shape:

```json
{
  "status": "ok",
  "service": "brovexa-api",
  "version": "0.1.0",
  "timestamp": "ISO-8601 timestamp"
}
```

The controller contract test is verified green on hosted CI.

## 9. GitHub-hosted CI

`.github/workflows/ci.yml` is the normal PR quality gate.

Steady-state safety properties:
- `contents: read`
- checkout credentials are not persisted
- immutable Action commit pins
- committed lockfile required
- `pnpm install --frozen-lockfile`
- runtime build/typecheck/test gate
- no bootstrap artifact upload
- no CI write-back job

Historical pre-runner failures are retained as baseline evidence, but hosted allocation recovered and real application verification has now executed.

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
- same preflight/runtime quality gates

A self-hosted PASS validates that runner path; it is not required to prove hosted runner health once hosted CI itself executes successfully, unless a Windows-specific behavior needs verification.

### Runner diagnostics / recovery

Recovery guide:

```text
docs/SELF_HOSTED_RUNNER_RECOVERY.md
```

Read-only diagnostic command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\diagnose-github-runner.ps1
```

The diagnostic script does not start/stop/install/remove/register/reconfigure the runner and does not print registration token material.

## 11. Failure classification

Use actual evidence:
- `FOUNDATION CONTRACT FAILURE`
- `DEPENDENCY INSTALL FAILURE`
- `BUILD FAILURE`
- `TYPECHECK FAILURE`
- `TEST FAILURE`
- `CI INFRASTRUCTURE FAILURE`
- `BASELINE FAILURE`
- `FLAKY TEST DEFECT`

Do not rerun until a failure happens to pass and hide the failing evidence.

## 12. Foundation Slice 1 exit gate

`ABD-259` completes only when all are evidenced:
1. approved executable runner evidence exists;
2. dependency installation succeeds;
3. `pnpm-lock.yaml` is committed;
4. steady-state CI is frozen-lockfile-only;
5. preflight/regression guardrails pass;
6. build passes;
7. typecheck passes;
8. tests pass;
9. API development source-to-runtime restart smoke check passes;
10. checkpoint and Linear state are reconciled.

After this gate, `ABD-260` PostgreSQL/migration implementation begins.

## 13. Current non-scope

This M01 work does not activate production deployment, source connectors, payment providers, unrestricted internet acquisition, autonomous/bulk outreach, the Daily Market Intelligence Scout, destructive data actions, or later legal/provider/commercial gates.
