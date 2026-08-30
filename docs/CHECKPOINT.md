# Brovexa Project Checkpoint

Updated: 2026-08-31

## Project state

`ACTIVE_EXISTING_PROJECT`

M01 — Platform Foundation & Developer Experience is explicitly approved and active.

## Authorization

Approved implementation scope: **M01 milestone**.

Still separately gated: production connectors, payment-provider activation, unrestricted acquisition, autonomous/bulk outreach, Daily Market Intelligence Scout activation, production deployment, destructive production data actions, and later legal/provider/commercial decisions.

## VCS state

- default branch: `main`
- current `main`: `69dd5adc3a509aa35b0be46f4e0124d15dc8de3c`
- planning PR #1: draft/unmerged
- M01 implementation branch: `m01/platform-foundation`
- M01 implementation PR #2: draft/unmerged
- current verified implementation head before this checkpoint: `014b1a847391df7cab7eb5a9a7f91065aa5f1ab4`
- final ABD-260 verification run: `33333195961`

Local developer working-copy/runtime/database state remains `UNKNOWN` because repository changes are being made through remote GitHub tooling.

## Default-branch security

`main` remains verified `protected:false` with required checks off. `docs/DEFAULT_BRANCH_INTEGRATION_POLICY.md` remains the compensating control and Linear `ABD-266` remains open through the M01 FULL GATE.

Owner-approved least-privilege default-branch self-hosted dispatcher remains:

- manual-only
- `contents: read`
- `[self-hosted, Windows, X64]`
- immutable Action pins
- `persist-credentials: false`
- fixed checkout to exactly `m01/platform-foundation`
- no caller-controlled target ref

## M01 verification state

### ABD-259 — monorepo foundation / executable CI

State: **VERIFIED / DONE**.

Final hosted evidence: run `33312134186`, job `99258997531`.

Verified under Node `24.20.0` + pnpm `11.23.0`:

- zero-dependency foundation preflight
- negative regression guardrails
- committed `pnpm-lock.yaml`
- frozen-lockfile installation
- Config/Contracts/API builds
- Next.js production build
- TypeScript 7 typecheck
- Vitest foundation suite
- deterministic API source → compile → runtime reload smoke

The API development loop uses bounded polling instead of native filesystem watching and keeps the last-good runtime alive across compile failures.

### ABD-260 — PostgreSQL migration/data layer

State: **VERIFIED / DONE**.

Final GitHub Actions run `33333195961`:

- quality/dev-loop job `99315413253`: PASS
- PostgreSQL 18 migration integration job `99315636396`: PASS

Verified behavior:

- PostgreSQL `18.6` immutable service image
- `@brovexa/db` Drizzle/node-postgres foundation
- canonical `workspaces` tenant root
- workspace-scoped FK child contract
- reviewed SQL up/down migrations
- migration checksum journal
- advisory-lock serialization
- transaction-wrapped migration apply/rollback
- caller-visible migration result state only after successful COMMIT
- exact unique constraint rejection by SQLSTATE `23505`
- exact FK rejection by SQLSTATE `23503`
- cascade delete behavior
- transaction rollback behavior
- explicit down migration
- successful re-apply
- DB readiness/schema probe
- destructive integration-test safety guard (`BROVEXA_DB_TEST_ALLOW_RESET=true` + `*_test` DB name)

No production database/provider/secret was activated.

## Current active lane — ABD-261 durable worker/queue foundation

State: **IN PROGRESS**.

Goal: introduce queue/worker execution transport without allowing queue state to become canonical workflow truth.

Locked principles:

- PostgreSQL remains canonical job/work-unit/checkpoint truth.
- Queue state is transport/execution state only.
- Restart recovery must derive runnable work from PostgreSQL.
- Idempotency/effect guards live in PostgreSQL.
- Queue delivery cannot mark business completion without a canonical DB state transition.
- Retryable/permanent/cancelled/DLQ/review states are explicit.
- Worker readiness and correlation/metrics contracts are required.
- No hosted Redis/Valkey provider or production credentials are activated in M01.

Current ecosystem preflight:

- BullMQ `6.3.2` is current but is a recently released v6 major with pluggable Redis/PostgreSQL backends.
- BullMQ `5.81.4` remains an actively published v5 line.
- Valkey `9.1.1` is current stable.
- Final queue-runtime pin must be chosen from executable compatibility/stability/supply-chain evidence, not latest-version bias.
- Do not assume every Redis-compatible implementation is BullMQ-compatible.

## Technology pins currently verified

- Node.js `24.20.0`
- pnpm `11.23.0`
- TypeScript `7.0.2`
- Next.js `16.3.3`
- React `19.2.8`
- NestJS `12.0.1`
- Vitest `4.1.11`
- Zod `4.5.4`
- PostgreSQL `18.6`
- Drizzle ORM `0.45.2`
- Drizzle Kit `0.31.10`
- `pg` `8.23.0`
- `@types/pg` `8.23.1`

## Supply-chain posture

- exact direct dependency pins
- committed lockfile
- CI frozen-lockfile only
- pnpm 11 supply-chain policy checks enabled
- no broad lifecycle-script bypass
- only exact currently locked esbuild versions are allowed to execute lifecycle scripts
- immutable GitHub Action SHAs
- steady-state hosted CI `contents: read`

## M01 gates

- `ABD-259` — executable monorepo/CI verification — **DONE**
- `ABD-260` — PostgreSQL harness/data layer — **DONE**
- `ABD-261` — durable worker/queue foundation — **IN PROGRESS**
- `ABD-262` — identity/RBAC/tenant enforcement — dependency-gated by stable DB contract; not started
- `ABD-263` — API/observability/health — later coordinated M01 lane
- `ABD-266` — default-branch protection/compensating controls — remains open through FULL GATE
- `ABD-264` — M01 FULL GATE — final integration/readiness handoff

## Next safe action

1. Finalize the smallest stable queue transport/runtime selection for ABD-261.
2. Extend canonical PostgreSQL schema with job/work-unit/effect/idempotency records through reviewed migrations.
3. Add worker boundary, queue naming/version conventions, retry/backoff/error classification and cancellation model.
4. Add Redis/Valkey-compatible local/CI transport only after executable compatibility is proven.
5. Prove idempotent retry, restart recovery from PostgreSQL, cancellation, failed-retry/DLQ behavior and worker readiness in CI.
6. Close ABD-261 only from executable evidence, then advance the next dependency-unblocked M01 lane.

PR #2 remains draft/unmerged; no auto-merge or production activation is authorized by this checkpoint.
