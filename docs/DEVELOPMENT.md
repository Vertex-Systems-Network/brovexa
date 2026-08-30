# Brovexa M01 Development & Verification Runbook

Status: **M01 active / Foundation Slice 1 not yet fully verified**

This runbook defines the safe developer path for the current platform foundation. Repository/runtime/test evidence outranks this document if they conflict.

## 1. Prerequisites

Foundation Slice 1 is pinned to:

- Node.js `24.20.0`
- pnpm `11.23.0`

Use the repository `.nvmrc` / `.node-version` and `packageManager`/`engines` metadata. Do not silently substitute a different major runtime and call the result verified.

## 2. Environment

Copy `.env.example` to `.env` for local development.

Current non-secret foundation variables:

- `NODE_ENV=development|test|staging|production`
- `HOST` — API listen address, default `0.0.0.0`
- `PORT` — API port, default `3001`, valid 1–65535

The API runtime loads repo-root `.env` through Node's native `--env-file-if-exists` option. Already-set process environment variables remain authoritative over `.env` values.

Real credentials, provider tokens and production secrets must never be committed. Foundation Slice 1 does not require any production secret.

## 3. Foundation preflight

Before dependency installation:

```bash
node scripts/verify-foundation.mjs
```

This is a zero-dependency structural gate. It validates repository/CI invariants but is **not** a replacement for dependency install, build, typecheck or tests.

## 4. Dependency installation

Current temporary bootstrap state, while no lockfile exists:

```bash
pnpm install --no-frozen-lockfile
```

The **first verified successful install** must generate `pnpm-lock.yaml`. Commit that lockfile in the same M01 verification work package, then both hosted and self-hosted CI must change to:

```bash
pnpm install --frozen-lockfile
```

After the lockfile exists, a non-frozen CI install is a verification defect.

## 5. FAST quality gate

Run:

```bash
pnpm run quality
```

The current quality contract is:

```text
Foundation preflight → Build → Typecheck → Test
```

Do not invoke bare `pnpm ci` as the Brovexa quality script. In pnpm 11, `pnpm ci` is a package-manager clean-install command.

## 6. Development commands

Full quality primitives:

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

The dependency-free `scripts/dev-api.mjs` supervisor performs an initial ordered compile of Config → Contracts → API. Only after those compiles pass does it start TypeScript watch compilers for all three projects plus Node's runtime watch for `apps/api/dist/main.js`. Node watch restarts when the entry point or imported built modules change. Ctrl+C terminates the supervised children.

This development loop is **implemented but not yet runtime-verified** because the approved Node 24 dependency installation/build gate has not executed successfully yet.

API production-style start after a successful build:

```bash
pnpm --filter @brovexa/api start
```

Web development server:

```bash
pnpm --filter @brovexa/web dev
```

## 7. Health contract

Foundation API exposes:

```text
GET /health
```

Expected contract shape:

```json
{
  "status": "ok",
  "service": "brovexa-api",
  "version": "0.1.0",
  "timestamp": "ISO-8601 timestamp"
}
```

The controller has a contract-level unit test, but it remains unverified until the actual test runner executes successfully.

## 8. GitHub-hosted CI

`.github/workflows/ci.yml` is the normal PR quality gate.

Current diagnostic state as of 2026-08-30:

- both `ubuntu-latest` and `ubuntu-slim` attempts failed before runner allocation
- observed jobs reported no executable steps
- application dependency install/build/typecheck/tests did not execute

Classification: **CI infrastructure / hosted-runner allocation failure**, exact account/org/budget/payment/policy/platform cause unverified.

Do not modify application code merely to make a pre-runner infrastructure failure disappear.

## 9. Manual self-hosted fallback

The **dispatchable** M01 fallback is the default-branch workflow:

```text
.github/workflows/m01-self-hosted-dispatch.yml
```

It checks out exactly `m01/platform-foundation` on an approved `[self-hosted, Windows, X64]` runner. It is manual-only and does not accept a caller-controlled target ref.

The implementation branch also carries `.github/workflows/ci-self-hosted.yml` as a **reference mirror** for structural regression checks. Because GitHub `workflow_dispatch` requires the workflow file on the default branch, do not treat the branch-local mirror as the operational dispatch entry point.

Required safety properties for the operational dispatcher/reference contract:

- manual `workflow_dispatch` only
- exact `m01/platform-foundation` checkout
- no automatic PR/push execution on the local machine
- explicit `[self-hosted, Windows, X64]` labels
- `contents: read` GitHub token permissions
- immutable Action commit pins
- `persist-credentials: false`
- same preflight/install/quality contract as hosted CI

If manually dispatched, preserve the exact workflow run/job evidence. A self-hosted PASS may provide M01 verification evidence, but it does not prove GitHub-hosted runner allocation is fixed.

### Runner diagnostics / recovery

Current evidence shows the historical trusted Windows probe still queued, which is consistent with no online/idle runner matching all required labels.

Use the dedicated recovery runbook:

```text
docs/SELF_HOSTED_RUNNER_RECOVERY.md
```

Safe read-only Windows diagnostic command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\diagnose-github-runner.ps1
```

The script checks service/process/registration-file presence, runner binary metadata, diagnostic-log location, and representative outbound TCP/443 connectivity. It never starts, stops, installs, removes, registers, or reconfigures the runner and does not read/print runner token material.

## 10. Failure classification

When a check fails, record the actual category:

- `FOUNDATION CONTRACT FAILURE`
- `DEPENDENCY INSTALL FAILURE`
- `BUILD FAILURE`
- `TYPECHECK FAILURE`
- `TEST FAILURE`
- `CI INFRASTRUCTURE FAILURE`
- `BASELINE FAILURE`
- `FLAKY TEST DEFECT`

Never repeatedly rerun a failing test until it happens to pass and report only the successful attempt.

## 11. Foundation Slice 1 exit gate

`ABD-259` cannot complete until all are evidenced:

1. an approved runner actually executes;
2. dependency installation succeeds;
3. `pnpm-lock.yaml` is committed;
4. CI uses frozen-lockfile mode;
5. foundation preflight passes on the real checkout;
6. build passes;
7. typecheck passes;
8. tests pass;
9. checkpoint and Linear evidence are reconciled.

Only after this gate should `ABD-260` PostgreSQL/migration implementation begin.

## 12. Current non-scope

This runbook does not authorize:

- production deployment
- source connector activation
- payment-provider activation
- unrestricted internet acquisition
- autonomous/bulk outreach
- Daily Market Intelligence Scout activation
- destructive data actions
- bypass of later legal/provider/commercial gates
