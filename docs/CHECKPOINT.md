# Brovexa Project Checkpoint

Updated: 2026-08-30

## Project state

`ACTIVE_EXISTING_PROJECT`

M01 — Platform Foundation & Developer Experience is explicitly approved and active.

## Authorization

Approved scope: **M01 milestone**.

Still separately gated: production connectors, payment-provider activation, unrestricted acquisition, autonomous/bulk outreach, Daily Market Intelligence Scout activation, production deployment, destructive data actions, and later legal/provider/commercial decisions.

## VCS state

- default branch: `main`
- current `main`: `198eec6ddc582e07a78c72d3bd8c88b05a0a5b75`
- planning PR #1: draft/unmerged
- M01 implementation branch: `m01/platform-foundation`
- M01 implementation PR #2: draft/unmerged
- current implementation head: `a67daca7fa7825b07864af8ad2931551184b6e34`
- initial runtime foundation: `9cc48faed8531cbab1a72716e5f9b5c351f6902c`
- shared-package production-build hardening: `43f8deccd50d74c0591586926d6047144fdc2580`
- TypeScript 7 NodeNext compatibility: `5e7318a87db2ddd57928dd0ddf364dfb8ecdc016`
- API `.env` loading: `8c939b90f874dfc5f68afba1c64faae450ffd584`
- self-hosted contract/reference alignment: `23c7803c8081ba9732dc098d66491387df1a674c`
- API dev supervisor: `3eb242b33ade7602d4585bd6852a3986c5b201a5`
- API dev supervisor failure-state correction: `a67daca7fa7825b07864af8ad2931551184b6e34`

Local developer working-copy/runtime/database state remains `UNKNOWN` because repository changes are being made through remote GitHub tooling.

## Default-branch security

`main` remains verified `protected:false` with required checks off. `docs/DEFAULT_BRANCH_INTEGRATION_POLICY.md` is the compensating control and Linear `ABD-266` remains open through the M01 FULL GATE.

Owner-approved dispatcher hardening was integrated through exact-head replacement PR #6 after the connector could not transition draft PR #5 to ready-for-review. The signed `main` commit `198eec6d...` now makes `.github/workflows/m01-self-hosted-dispatch.yml`:

- manual-only
- `contents: read`
- `[self-hosted, Windows, X64]`
- immutable Action pins
- `persist-credentials: false`
- fixed checkout to exactly `m01/platform-foundation`
- no caller-controlled target ref

## M01 Foundation Slice 1

State: `IMPLEMENTED BUT NOT VERIFIED`.

Implemented foundation now includes:

- pnpm/Turborepo/TypeScript monorepo metadata
- exact runtime/dependency pins
- shared contracts/config packages
- NestJS API with `/health`
- minimal Next.js Web shell
- hosted CI and controlled self-hosted verification path
- zero-dependency foundation verifier + negative regression suite
- development/verification runbook
- default-branch integration policy
- NodeNext compatibility for TypeScript 7
- production build/test-source separation for shared packages
- repo-root `.env` loading for API runtime
- cross-platform dependency-free API development supervisor

## API development loop

Canonical command:

```bash
pnpm run dev:api
```

`node scripts/dev-api.mjs` performs an initial ordered compile:

`Config → Contracts → API`

Only after all initial compiles succeed does it start:

- Config TypeScript watcher
- Contracts TypeScript watcher
- API TypeScript watcher
- Node `--watch` runtime on `apps/api/dist/main.js`

Node runtime uses `--env-file-if-exists=.env`. Unexpected watcher/runtime exit is treated as failure, not success; shutdown preserves the intended non-zero exit state.

Independent tool-container checks performed on the supervisor source:

- `node --check scripts/dev-api.mjs` — PASS
- execution without installed TypeScript/workspace dependencies — expected fail-safe exit `1` with instruction to run `pnpm install`

This is supervisor structural behavior evidence only; the full loop remains unverified until approved Node 24 dependencies exist.

## Self-hosted reference alignment

The implementation branch `.github/workflows/ci-self-hosted.yml` is now explicitly a structural **reference mirror**, not the operational dispatch entry point. It mirrors the default-branch safety contract: exact `m01/platform-foundation` checkout, no persisted credentials, immutable actions, Windows x64 labels, manual-only trigger, and lockfile-aware install mode.

The development runbook and foundation verifier/regression tests enforce this distinction and include negative cases for arbitrary-ref drift and persisted checkout credentials.

## Verification evidence

### Hosted GitHub Actions — still infrastructure blocked

Latest observed hosted run for head `a67daca7fa7825b07864af8ad2931551184b6e34`:

- run `33309018041`
- job `99250580416`
- conclusion `failure`
- executable steps: none (`steps=null`)

Classification remains:

`CI INFRASTRUCTURE / HOSTED-RUNNER ALLOCATION FAILURE — APPLICATION TESTS NOT EXECUTED`

This is neither an application failure nor a PASS.

### Runner-independent evidence

Zero-dependency foundation guardrails have previous PASS evidence on reconstructed repository fixtures, including negative regression behavior for unsafe workflow/dependency/TypeScript/build drift. The available tool runtime is Node 22.x, so this cannot substitute for the approved Node 24/pnpm build/type/test gate.

## Technology pins

- Node.js `24.20.0`
- pnpm `11.23.0`
- TypeScript `7.0.2`
- Next.js `16.3.3`
- React `19.2.8`
- NestJS `12.0.1`
- Vitest `4.1.11`
- Zod `4.5.4`

`pnpm-lock.yaml` remains absent because no approved dependency installation has completed.

## M01 gates

- `ABD-266` — default-branch protection/compensating controls — IN PROGRESS
- `ABD-259` — executable monorepo/CI verification — IN PROGRESS / SERIALIZE
- `ABD-260` — PostgreSQL harness — BLOCKED BY ABD-259
- `ABD-261` — durable worker/queue — BLOCKED BY ABD-259/260
- `ABD-262` — identity/RBAC/tenant — BLOCKED BY ABD-259/260
- `ABD-263` — API/observability/health — waits for executable CI
- `ABD-264` — M01 FULL GATE — final integration gate

## Still not verified

- approved Node 24 dependency install
- lockfile generation/frozen-lockfile enforcement
- actual TypeScript 7 compile/typecheck
- Nest/Next build
- Vitest application tests
- API hot-reload loop with installed workspace dependencies
- approved Windows self-hosted quality run
- native `main` protection
- local developer database/runtime state

## Next safe action

1. Bring an approved `[self-hosted, Windows, X64]` runner online and manually run the default-branch `M01 Self-hosted Verification Dispatch`, or use hosted CI if allocation recovers.
2. Execute Node `24.20.0` + pnpm `11.23.0` dependency installation.
3. Commit the generated `pnpm-lock.yaml`.
4. Switch all CI installs to frozen-lockfile-only mode.
5. Run build/typecheck/Vitest and fix only failures proven by logs.
6. Verify `pnpm run dev:api` source-to-runtime restart behavior.
7. Then add the remaining M01 quality/security gates and proceed to `ABD-260` only after `ABD-259` passes.

Do not pull later milestone implementation forward merely to bypass this verification gate.
