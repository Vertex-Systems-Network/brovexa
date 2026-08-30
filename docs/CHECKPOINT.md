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
- current implementation head before this checkpoint: `401c7936381f02ddf84b09a47a16a411f574b7b7`
- initial runtime foundation: `9cc48faed8531cbab1a72716e5f9b5c351f6902c`
- TypeScript 7 NodeNext compatibility: `5e7318a87db2ddd57928dd0ddf364dfb8ecdc016`
- API `.env` loading: `8c939b90f874dfc5f68afba1c64faae450ffd584`
- self-hosted contract/reference alignment: `23c7803c8081ba9732dc098d66491387df1a674c`
- API dev supervisor + lifecycle correction: `3eb242b33ade7602d4585bd6852a3986c5b201a5` / `a67daca7fa7825b07864af8ad2931551184b6e34`
- safe API startup failure handling: `489fbc417fcb411478d0d47ba9e6bb43119a8f5f`
- API startup regression guard: `8a1c7618c22f0323d7e79bf7404c89df9cf32359`
- API production test-source exclusion: `265bc2d4a43f162d5222c949c8669f3541f2e801`
- API build-exclusion verifier: `f893b796f9c745f7b0b33f73963bd9d7c6ddd32f`
- API build-exclusion negative regression: `401c7936381f02ddf84b09a47a16a411f574b7b7`

Local developer working-copy/runtime/database state remains `UNKNOWN` because repository changes are being made through remote GitHub tooling.

## Default-branch security

`main` remains verified `protected:false` with required checks off. `docs/DEFAULT_BRANCH_INTEGRATION_POLICY.md` is the compensating control and Linear `ABD-266` remains open through the M01 FULL GATE.

Owner-approved least-privilege dispatcher hardening is integrated on `main` through replacement PR #6. Operational `.github/workflows/m01-self-hosted-dispatch.yml` is:

- manual-only
- `contents: read`
- `[self-hosted, Windows, X64]`
- immutable Action pins
- `persist-credentials: false`
- fixed checkout to exactly `m01/platform-foundation`
- no caller-controlled target ref

## M01 Foundation Slice 1

State: `IMPLEMENTED BUT NOT VERIFIED`.

The static/repository foundation is now considered **READY FOR EXECUTABLE VERIFICATION**. No dependency-gated downstream platform work should start until `ABD-259` passes.

Implemented foundation includes:

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
- production build/test-source separation for shared packages and API
- repo-root `.env` loading for API runtime
- cross-platform dependency-free API development supervisor
- deterministic safe API startup failure path

## Static hardening resolved

1. pnpm `ci` command collision removed; canonical gate is `pnpm run quality`.
2. direct dependency pins and GitHub Action references are exact/immutable.
3. Config/Contracts/API production builds exclude both `*.spec.ts` and `*.test.ts` sources.
4. Node-targeted TypeScript projects use `NodeNext` module/resolution for TypeScript 7.
5. API local runtime loads repo-root `.env` without adding dotenv and preserves process-env precedence.
6. Self-hosted trusted-runner path is manual-only and exact-branch constrained.
7. `pnpm run dev:api` performs ordered Config → Contracts → API initial compile before starting watchers/runtime.
8. API dev supervisor treats unexpected child exit as failure and preserves non-zero shutdown state.
9. API top-level bootstrap rejection is handled explicitly with a generic safe message and `process.exitCode = 1`; bare `void bootstrap()` is regression-blocked.
10. Web foundation shell static review found no confirmed M01 blocker; it remains intentionally a boundary shell, not production product UI.

## Verification evidence

### Hosted GitHub Actions — infrastructure blocked

Latest current-head hosted run:

- head `401c7936381f02ddf84b09a47a16a411f574b7b7`
- run `33309506532`
- first job `99251880954`
- diagnostic rerun job `99251942947`
- both concluded `failure`
- both returned no executable steps / no runner allocation evidence

The diagnostic rerun was performed once solely to verify runner-allocation state. It produced the same signature, so redundant hosted reruns are now stopped.

Classification remains:

`CI INFRASTRUCTURE / HOSTED-RUNNER ALLOCATION FAILURE — APPLICATION TESTS NOT EXECUTED`

This is neither an application failure nor a PASS.

### Manual self-hosted dispatch

Default-branch workflow is ready, but GitHub reports **0 `workflow_dispatch` runs** on `main` during the latest check. No approved Windows self-hosted quality execution has occurred yet.

### Runner-independent structural evidence

Previous structural verifier/regression checks and `node --check` checks passed within their declared scope. They validate repository invariants only. The available tool runtime is Node 22.x, so they do **not** prove:

- approved Node 24 dependency resolution
- TypeScript 7 compiler execution
- Nest/Next build
- Vitest tests
- actual API hot-reload behavior with installed dependencies

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

## Next safe action

1. Bring an approved `[self-hosted, Windows, X64]` runner online and manually execute `M01 Self-hosted Verification Dispatch`, or use hosted CI only if runner allocation demonstrably recovers.
2. Execute Node `24.20.0` + pnpm `11.23.0` dependency installation.
3. Commit generated `pnpm-lock.yaml` and switch all CI installs to `pnpm install --frozen-lockfile`.
4. Run `pnpm run quality` and classify any actual failures from logs.
5. Exercise `pnpm run dev:api` source-to-runtime restart behavior.
6. Only after all `ABD-259` exit criteria pass, begin `ABD-260` PostgreSQL/Drizzle implementation.

Until executable runner evidence exists, avoid further significant foundation feature growth: static foundation is verification-ready and additional code would increase unverified surface area.
